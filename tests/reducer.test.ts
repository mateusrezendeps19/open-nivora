import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyBoard, emptyCard, emptyList, normalize, seedDocument } from '../src/renderer/shared/document';
import { reducer, type Action } from '../src/renderer/shared/reducer';
import type { BoardDocument } from '../src/renderer/shared/types';

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
    labels: [],
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
