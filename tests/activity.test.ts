import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyBoard, emptyCard, emptyList, emptyRule } from '../src/renderer/shared/document';
import { reducer, type Action } from '../src/renderer/shared/reducer';
import { DEFAULT_LABELS, type BoardDocument, type Card } from '../src/renderer/shared/types';

/** Board with lists "A fazer" and "Feito", and one card in the first. */
function fixture(): BoardDocument {
  const board = emptyBoard('Quadro', '#0079bf');
  const todo = emptyList('A fazer');
  const done = emptyList('Feito');
  todo.cards = [emptyCard('x'), emptyCard('y')];
  board.lists = [todo, done];
  return {
    version: 2,
    boards: [board],
    activeBoardId: board.id,
    labels: DEFAULT_LABELS,
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

function find(doc: BoardDocument, title: string): Card {
  for (const list of doc.boards[0].lists) {
    const card = list.cards.find((entry) => entry.title === title);
    if (card) return card;
  }
  throw new Error(`cartao "${title}" nao existe`);
}

const texts = (doc: BoardDocument, title: string) =>
  find(doc, title).activity.map((entry) => entry.text);

test('mover entre listas entra na atividade com os dois nomes', () => {
  const doc = fixture();
  const card = find(doc, 'x');
  const feito = doc.boards[0].lists[1].id;

  const next = run(doc, { type: 'card/move', cardId: card.id, toListId: feito, toIndex: 0 });

  assert.deepEqual(texts(next, 'x'), ['Moveu de A fazer para Feito']);
});

test('reordenar dentro da lista nao escreve nada', () => {
  const doc = fixture();
  const card = find(doc, 'x');
  const todo = doc.boards[0].lists[0].id;

  const next = run(doc, { type: 'card/move', cardId: card.id, toListId: todo, toIndex: 2 });

  assert.deepEqual(texts(next, 'x'), []);
});

test('prazo, conclusao e etiquetas viram linhas, uma por mudanca', () => {
  const doc = fixture();
  const card = find(doc, 'x');
  const label = DEFAULT_LABELS[0];

  const next = run(
    doc,
    { type: 'card/update', cardId: card.id, patch: { done: true } },
    { type: 'card/update', cardId: card.id, patch: { labelIds: [label.id] } },
    { type: 'card/update', cardId: card.id, patch: { labelIds: [] } },
    { type: 'card/update', cardId: card.id, patch: { due: null } },
  );

  assert.deepEqual(texts(next, 'x'), [
    'Marcou como concluido',
    `Adicionou a etiqueta ${label.name}`,
    `Removeu a etiqueta ${label.name}`,
  ]);
});

test('definir e remover o prazo viram linhas com a data', () => {
  const doc = fixture();
  const card = find(doc, 'x');
  const due = new Date(2026, 9, 20, 12, 0).toISOString();

  const next = run(
    doc,
    { type: 'card/update', cardId: card.id, patch: { due } },
    { type: 'card/update', cardId: card.id, patch: { due: null } },
  );

  const lines = texts(next, 'x');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Definiu o prazo para .*2026/);
  assert.equal(lines[1], 'Removeu o prazo');
});

test('renomear o cartao nao e um evento', () => {
  const doc = fixture();
  const card = find(doc, 'x');

  const next = run(doc, { type: 'card/update', cardId: card.id, patch: { title: 'z' } });

  assert.deepEqual(texts(next, 'z'), []);
});

test('arquivar e restaurar entram na atividade', () => {
  const doc = fixture();
  const card = find(doc, 'x');

  const next = run(
    doc,
    { type: 'card/archive', cardId: card.id },
    { type: 'card/archive', cardId: card.id },
    { type: 'card/restore', cardId: card.id },
  );

  assert.deepEqual(texts(next, 'x'), ['Arquivou o cartao', 'Restaurou o cartao']);
});

test('a checklist so entra quando o ultimo item cai', () => {
  const doc = fixture();
  const card = find(doc, 'x');

  const withItems = run(
    doc,
    { type: 'checklist/add', cardId: card.id, text: 'um' },
    { type: 'checklist/add', cardId: card.id, text: 'dois' },
  );
  const items = find(withItems, 'x').checklist;

  const half = run(withItems, {
    type: 'checklist/toggle',
    cardId: card.id,
    itemId: items[0].id,
  });
  assert.deepEqual(texts(half, 'x'), []);

  const full = run(half, { type: 'checklist/toggle', cardId: card.id, itemId: items[1].id });
  assert.deepEqual(texts(full, 'x'), ['Concluiu a checklist']);
});

test('um comentario pode ser editado e excluido', () => {
  const doc = fixture();
  const card = find(doc, 'x');

  const posted = run(doc, { type: 'comment/add', cardId: card.id, text: 'primeiro' });
  const comment = find(posted, 'x').activity[0];
  assert.equal(comment.kind, 'comment');
  assert.equal(comment.editedAt, null);

  const edited = run(posted, {
    type: 'comment/update',
    cardId: card.id,
    activityId: comment.id,
    text: 'corrigido',
  });
  const after = find(edited, 'x').activity[0];
  assert.equal(after.text, 'corrigido');
  assert.ok(after.editedAt, 'editedAt deveria marcar a edicao');

  const removed = run(edited, {
    type: 'comment/remove',
    cardId: card.id,
    activityId: comment.id,
  });
  assert.deepEqual(texts(removed, 'x'), []);
});

test('um evento nao pode ser reescrito nem apagado como comentario', () => {
  const doc = fixture();
  const card = find(doc, 'x');
  const feito = doc.boards[0].lists[1].id;

  const moved = run(doc, { type: 'card/move', cardId: card.id, toListId: feito, toIndex: 0 });
  const event = find(moved, 'x').activity[0];

  const next = run(
    moved,
    { type: 'comment/update', cardId: card.id, activityId: event.id, text: 'nunca aconteceu' },
    { type: 'comment/remove', cardId: card.id, activityId: event.id },
  );

  assert.deepEqual(texts(next, 'x'), ['Moveu de A fazer para Feito']);
});

test('o que a automacao faz tambem fica registrado', () => {
  const doc = fixture();
  const [todo, feito] = doc.boards[0].lists;
  doc.boards[0].automations = [
    emptyRule('manda pro Feito', { type: 'card-added', listId: todo.id }, [
      { type: 'move-to-list', listId: feito.id },
    ]),
  ];

  const next = run(doc, { type: 'card/add', listId: todo.id, title: 'novo' });

  assert.deepEqual(texts(next, 'novo'), [
    'Adicionou este cartao a lista A fazer',
    'Moveu de A fazer para Feito',
  ]);
});

test('carregar o documento nao reescreve a historia', () => {
  const doc = fixture();
  const card = find(doc, 'x');
  const feito = doc.boards[0].lists[1].id;

  const moved = run(doc, { type: 'card/move', cardId: card.id, toListId: feito, toIndex: 0 });
  const loaded = run(moved, { type: 'replace', doc: moved });

  assert.deepEqual(texts(loaded, 'x'), ['Moveu de A fazer para Feito']);
});
