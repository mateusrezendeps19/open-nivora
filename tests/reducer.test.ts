import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyBoard, emptyCard, emptyList, normalize, seedDocument } from '../src/renderer/shared/document';
import { labelUsage, reducer, type Action } from '../src/renderer/shared/reducer';
import { DEFAULT_LABELS, type BoardDocument, type Rule } from '../src/renderer/shared/types';

/** A board with one list of cards titled a, b, c and a second, empty list. */
function fixture(): BoardDocument {
  const board = emptyBoard('Quadro', '#0079bf');
  const left = emptyList('Esquerda');
  const right = emptyList('Direita');
  left.cards = [emptyCard('a'), emptyCard('b'), emptyCard('c')];
  board.lists = [left, right];
  return {
    version: 2,
    boards: [board],
    activeBoardId: board.id,
    labels: [...DEFAULT_LABELS],
    prefs: {
      theme: 'dark',
      locale: 'pt-BR',
      confirmCardDelete: true,
      automationsEnabled: true,
      sidebarCollapsed: false,
      view: 'board',
    },
  };
}

const run = (doc: BoardDocument, ...actions: Action[]) => actions.reduce(reducer, doc);
const titles = (doc: BoardDocument, listIndex: number) =>
  doc.boards[0].lists[listIndex].cards.map((card) => card.title);

test('criar e editar etiquetas vale para o documento inteiro', () => {
  const doc = fixture();
  const before = doc.labels.length;

  const created = run(doc, { type: 'label/add', name: 'Urgente', color: '#f87168' });
  assert.equal(created.labels.length, before + 1);
  const added = created.labels[created.labels.length - 1];
  assert.equal(added.name, 'Urgente');
  assert.equal(added.color, '#f87168');

  const renamed = run(created, {
    type: 'label/update',
    labelId: added.id,
    patch: { name: 'Hoje', color: '#579dff' },
  });
  assert.equal(renamed.labels[renamed.labels.length - 1].name, 'Hoje');
  assert.equal(renamed.labels[renamed.labels.length - 1].color, '#579dff');

  // O id nao muda, entao os cartoes que ja usavam a etiqueta continuam ligados.
  assert.equal(renamed.labels[renamed.labels.length - 1].id, added.id);
});

test('excluir uma etiqueta a tira de todos os cartoes, de todos os quadros', () => {
  const doc = fixture();
  const other = emptyBoard('Outro', '#000');
  const list = emptyList('L');
  list.cards = [{ ...emptyCard('arquivado'), labelIds: ['lbl-red'], archivedAt: '2026-10-01T00:00:00.000Z' }];
  other.lists = [list];
  doc.boards = [...doc.boards, other];
  const [a, b] = doc.boards[0].lists[0].cards;
  a.labelIds = ['lbl-red', 'lbl-green'];
  b.labelIds = ['lbl-green'];

  assert.equal(labelUsage(doc, 'lbl-red').cards, 2);
  const next = run(doc, { type: 'label/remove', labelId: 'lbl-red' });

  assert.ok(!next.labels.some((label) => label.id === 'lbl-red'));
  assert.deepEqual(next.boards[0].lists[0].cards[0].labelIds, ['lbl-green']);
  // O cartao arquivado de outro quadro tambem: restaura-lo traria de volta um id sem etiqueta.
  assert.deepEqual(next.boards[1].lists[0].cards[0].labelIds, []);
  // Um cartao que nao a usava fica o mesmo objeto.
  assert.equal(next.boards[0].lists[0].cards[1], doc.boards[0].lists[0].cards[1]);
});

test('excluir uma etiqueta remove ou corta as automacoes que dependem dela', () => {
  const doc = fixture();
  const rule = (id: string, trigger: Rule['trigger'], actions: Rule['actions']): Rule => ({
    id,
    name: id,
    enabled: true,
    trigger,
    actions,
  });
  doc.boards[0].automations = [
    rule('dispara', { type: 'label-added', labelId: 'lbl-red' }, [{ type: 'mark-card-done' }]),
    rule('qualquer', { type: 'label-added', labelId: null }, [{ type: 'mark-card-done' }]),
    rule('so-ela', { type: 'card-added' }, [{ type: 'add-label', labelId: 'lbl-red' }]),
    rule('mista', { type: 'card-added' }, [
      { type: 'remove-label', labelId: 'lbl-red' },
      { type: 'clear-due' },
    ]),
    rule('alheia', { type: 'card-added' }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ];

  assert.equal(labelUsage(doc, 'lbl-red').rules, 3);
  const next = run(doc, { type: 'label/remove', labelId: 'lbl-red' });
  const rules = next.boards[0].automations;

  assert.deepEqual(rules.map((entry) => entry.id), ['qualquer', 'mista', 'alheia']);
  assert.deepEqual(rules[1].actions, [{ type: 'clear-due' }]);
  assert.equal(rules[2], doc.boards[0].automations[4]);
});

test('arquivar guarda a data e mantem o cartao no lugar', () => {
  const doc = fixture();
  const b = doc.boards[0].lists[0].cards[1].id;

  const next = run(doc, { type: 'card/archive', cardId: b });
  const card = next.boards[0].lists[0].cards[1];

  assert.equal(card.id, b, 'o cartao arquivado saiu da sua posicao');
  assert.ok(card.archivedAt, 'archivedAt nao foi preenchido');
  assert.deepEqual(titles(next, 0), ['a', 'b', 'c']);
});

test('arquivar duas vezes nao reescreve a data', () => {
  const doc = fixture();
  const b = doc.boards[0].lists[0].cards[1].id;

  const once = run(doc, { type: 'card/archive', cardId: b });
  const twice = run(once, { type: 'card/archive', cardId: b });

  assert.equal(
    twice.boards[0].lists[0].cards[1].archivedAt,
    once.boards[0].lists[0].cards[1].archivedAt,
  );
});

test('restaurar devolve o cartao a posicao que ele nunca deixou', () => {
  const doc = fixture();
  const b = doc.boards[0].lists[0].cards[1].id;

  const next = run(doc, { type: 'card/archive', cardId: b }, { type: 'card/restore', cardId: b });

  assert.equal(next.boards[0].lists[0].cards[1].archivedAt, null);
  assert.deepEqual(titles(next, 0), ['a', 'b', 'c']);
});

test('um cartao arquivado continua podendo ser excluido de vez', () => {
  const doc = fixture();
  const b = doc.boards[0].lists[0].cards[1].id;

  const next = run(doc, { type: 'card/archive', cardId: b }, { type: 'card/remove', cardId: b });

  assert.deepEqual(titles(next, 0), ['a', 'c']);
});

test('mover um cartao para baixo na mesma lista compensa o indice', () => {
  const doc = fixture();
  const b = doc.boards[0].lists[0].cards[1].id;
  const listId = doc.boards[0].lists[0].id;

  // Dropping below "c" means insertion index 3 in the pre-removal list.
  const next = run(doc, { type: 'card/move', cardId: b, toListId: listId, toIndex: 3 });
  assert.deepEqual(titles(next, 0), ['a', 'c', 'b']);
});

test('mover um cartao para cima na mesma lista nao compensa', () => {
  const doc = fixture();
  const c = doc.boards[0].lists[0].cards[2].id;
  const listId = doc.boards[0].lists[0].id;

  const next = run(doc, { type: 'card/move', cardId: c, toListId: listId, toIndex: 0 });
  assert.deepEqual(titles(next, 0), ['c', 'a', 'b']);
});

test('mover para a mesma posicao nao altera a ordem', () => {
  const doc = fixture();
  const b = doc.boards[0].lists[0].cards[1].id;
  const listId = doc.boards[0].lists[0].id;

  const next = run(doc, { type: 'card/move', cardId: b, toListId: listId, toIndex: 1 });
  assert.deepEqual(titles(next, 0), ['a', 'b', 'c']);
});

test('mover entre listas remove da origem e insere no destino', () => {
  const doc = fixture();
  const a = doc.boards[0].lists[0].cards[0].id;
  const target = doc.boards[0].lists[1].id;

  const next = run(doc, { type: 'card/move', cardId: a, toListId: target, toIndex: 0 });
  assert.deepEqual(titles(next, 0), ['b', 'c']);
  assert.deepEqual(titles(next, 1), ['a']);
});

test('indice de destino fora do intervalo e fixado no fim da lista', () => {
  const doc = fixture();
  const a = doc.boards[0].lists[0].cards[0].id;
  const target = doc.boards[0].lists[1].id;

  const next = run(doc, { type: 'card/move', cardId: a, toListId: target, toIndex: 99 });
  assert.deepEqual(titles(next, 1), ['a']);
});

test('reordenar listas respeita o indice de destino', () => {
  const doc = fixture();
  const first = doc.boards[0].lists[0].id;

  const next = run(doc, { type: 'list/move', listId: first, toIndex: 2 });
  assert.deepEqual(
    next.boards[0].lists.map((l) => l.title),
    ['Direita', 'Esquerda'],
  );
});

test('excluir o ultimo quadro recria o documento semente', () => {
  const doc = fixture();
  const next = run(doc, { type: 'board/remove', boardId: doc.boards[0].id });
  assert.equal(next.boards.length, 1);
  assert.ok(next.activeBoardId);
});

test('excluir um quadro ativo entre varios troca o quadro ativo', () => {
  const doc = run(fixture(), { type: 'board/add', title: 'Segundo', color: '#519839' });
  const removed = doc.activeBoardId as string;
  const next = run(doc, { type: 'board/remove', boardId: removed });
  assert.equal(next.boards.length, 1);
  assert.notEqual(next.activeBoardId, removed);
  assert.ok(next.boards.some((b) => b.id === next.activeBoardId));
});

test('checklist alterna e remove itens pelo id', () => {
  const doc = fixture();
  const cardId = doc.boards[0].lists[0].cards[0].id;

  const added = run(doc, { type: 'checklist/add', cardId, text: 'item' });
  const item = added.boards[0].lists[0].cards[0].checklist[0];
  assert.equal(item.done, false);

  const toggled = run(added, { type: 'checklist/toggle', cardId, itemId: item.id });
  assert.equal(toggled.boards[0].lists[0].cards[0].checklist[0].done, true);

  const removed = run(toggled, { type: 'checklist/remove', cardId, itemId: item.id });
  assert.equal(removed.boards[0].lists[0].cards[0].checklist.length, 0);
});

test('o reducer nao muta o documento recebido', () => {
  const doc = fixture();
  const snapshot = JSON.stringify(doc);
  const cardId = doc.boards[0].lists[0].cards[0].id;

  run(
    doc,
    { type: 'card/move', cardId, toListId: doc.boards[0].lists[1].id, toIndex: 0 },
    { type: 'card/update', cardId, patch: { title: 'outro' } },
  );

  assert.equal(JSON.stringify(doc), snapshot);
});

test('normalize aceita documento parcial e preenche os defaults', () => {
  const partial = { boards: [{ title: 'Solto', lists: [{ cards: [{ title: 'x' }] }] }] };
  const doc = normalize(partial);

  assert.equal(doc.version, 2);
  assert.equal(doc.boards.length, 1);
  assert.equal(doc.boards[0].title, 'Solto');
  assert.equal(doc.activeBoardId, doc.boards[0].id);
  assert.ok(doc.boards[0].lists[0].id);
  assert.equal(doc.boards[0].lists[0].cards[0].title, 'x');
  assert.deepEqual(doc.boards[0].lists[0].cards[0].labelIds, []);
  assert.deepEqual(doc.boards[0].lists[0].cards[0].attachments, []);
  assert.equal(doc.boards[0].lists[0].cards[0].coverAttachmentId, null);
  assert.deepEqual(doc.boards[0].automations, []);
  // Sem background gravado, o fallback e a cor do quadro.
  assert.deepEqual(doc.boards[0].background, { kind: 'color', value: '#0079bf' });
  assert.ok(doc.labels.length > 0);
  assert.equal(doc.prefs.theme, 'dark');
  assert.equal(doc.prefs.automationsEnabled, true);
});

test('normalize substitui entradas invalidas pelo documento semente', () => {
  for (const input of [null, undefined, 42, {}, { boards: [] }]) {
    const doc = normalize(input);
    assert.ok(doc.boards.length > 0, `entrada ${JSON.stringify(input)} deveria virar semente`);
  }
});

test('o documento semente sobrevive a um ciclo de serializacao', () => {
  const doc = seedDocument();
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(doc))), doc);
});
