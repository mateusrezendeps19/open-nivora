import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyBoard, emptyCard, emptyList, releasedAssets } from '../src/renderer/shared/document';
import { reducer, type Action } from '../src/renderer/shared/reducer';
import { DEFAULT_LABELS, type Attachment, type BoardDocument } from '../src/renderer/shared/types';

function attachment(asset: string): Attachment {
  return {
    id: `att_${asset}`,
    name: asset,
    mime: 'image/png',
    size: 1,
    addedAt: '2026-10-21T00:00:00.000Z',
    asset,
    isImage: true,
  };
}

/** Board "Um" with lists A (a, b, archived c) and B, plus an empty board "Dois". */
function fixture(): BoardDocument {
  const one = emptyBoard('Um', '#0079bf');
  const two = emptyBoard('Dois', '#519839');
  const a = emptyList('A');
  const b = emptyList('B');
  const first = emptyCard('a');
  first.attachments = [attachment('foto.png')];
  first.coverAttachmentId = first.attachments[0].id;
  first.checklist = [{ id: 'chk_1', text: 'item', done: true }];
  first.labelIds = [DEFAULT_LABELS[0].id];
  first.activity = [{ id: 'act_1', kind: 'comment', text: 'oi', at: 'x', editedAt: null }];
  const archived = emptyCard('c');
  archived.archivedAt = '2026-10-20T00:00:00.000Z';
  a.cards = [first, emptyCard('b'), archived];
  one.lists = [a, b];
  two.lists = [emptyList('X')];
  return {
    version: 2,
    boards: [one, two],
    activeBoardId: one.id,
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

test('copiar uma lista poe a copia logo depois, com o nome dado', () => {
  const doc = fixture();
  const next = run(doc, { type: 'list/copy', listId: doc.boards[0].lists[0].id, title: 'A (copia)' });
  assert.deepEqual(
    next.boards[0].lists.map((list) => list.title),
    ['A', 'A (copia)', 'B'],
  );
});

test('a copia tem ids novos em tudo e deixa os arquivados para tras', () => {
  const doc = fixture();
  const original = doc.boards[0].lists[0];
  const next = run(doc, { type: 'list/copy', listId: original.id, title: 'Copia' });
  const copy = next.boards[0].lists[1];

  assert.notEqual(copy.id, original.id);
  assert.deepEqual(copy.cards.map((card) => card.title), ['a', 'b']);

  const [card] = copy.cards;
  const source = original.cards[0];
  assert.notEqual(card.id, source.id);
  assert.notEqual(card.checklist[0].id, source.checklist[0].id);
  assert.notEqual(card.attachments[0].id, source.attachments[0].id);
  // A capa segue o anexo copiado, nao o original.
  assert.equal(card.coverAttachmentId, card.attachments[0].id);
  // O arquivo e o mesmo: e a liberacao por referencia que torna isso seguro.
  assert.equal(card.attachments[0].asset, 'foto.png');
  assert.deepEqual(card.labelIds, source.labelIds);
  assert.equal(card.checklist[0].done, true);
});

test('o historico da copia comeca pela linha que diz de onde ela veio', () => {
  const doc = fixture();
  const next = run(doc, { type: 'list/copy', listId: doc.boards[0].lists[0].id, title: 'Copia' });
  const [card] = next.boards[0].lists[1].cards;
  // O comentario do original nao vem junto.
  assert.deepEqual(card.activity.map((entry) => entry.text), ['Copiou este cartao da lista A']);
});

test('copiar nao mexe na lista original', () => {
  const doc = fixture();
  const original = doc.boards[0].lists[0];
  const next = run(doc, { type: 'list/copy', listId: original.id, title: 'Copia' });
  assert.equal(next.boards[0].lists[0], original);
});

test('mover a lista para outro quadro a tira deste e a poe na posicao pedida', () => {
  const doc = fixture();
  const list = doc.boards[0].lists[0];
  const next = run(doc, {
    type: 'list/transfer',
    listId: list.id,
    toBoardId: doc.boards[1].id,
    toIndex: 0,
  });
  assert.deepEqual(next.boards[0].lists.map((entry) => entry.title), ['B']);
  assert.deepEqual(next.boards[1].lists.map((entry) => entry.title), ['A', 'X']);
  // Os cartoes vao com ela, inclusive o arquivado, e com os mesmos ids.
  assert.deepEqual(
    next.boards[1].lists[0].cards.map((card) => card.id),
    list.cards.map((card) => card.id),
  );
  // O quadro aberto continua o mesmo.
  assert.equal(next.activeBoardId, doc.boards[0].id);
});

test('cada cartao levado para outro quadro registra a mudanca', () => {
  const doc = fixture();
  const next = run(doc, {
    type: 'list/transfer',
    listId: doc.boards[0].lists[0].id,
    toBoardId: doc.boards[1].id,
    toIndex: 1,
  });
  for (const card of next.boards[1].lists[1].cards) {
    assert.equal(card.activity.at(-1)?.text, 'Moveu a lista para o quadro Dois, vinda de Um');
  }
});

test('mover para o proprio quadro so reordena, sem historico', () => {
  const doc = fixture();
  const list = doc.boards[0].lists[0];
  const next = run(doc, {
    type: 'list/transfer',
    listId: list.id,
    toBoardId: doc.boards[0].id,
    toIndex: 1,
  });
  assert.deepEqual(next.boards[0].lists.map((entry) => entry.title), ['B', 'A']);
  assert.deepEqual(next.boards[0].lists[1].cards[0].activity, list.cards[0].activity);
});

test('um quadro de destino que nao existe deixa tudo como estava', () => {
  const doc = fixture();
  const next = run(doc, {
    type: 'list/transfer',
    listId: doc.boards[0].lists[0].id,
    toBoardId: 'board_inexistente',
    toIndex: 0,
  });
  assert.equal(next, doc);
});

test('um arquivo so e liberado quando nada mais aponta para ele', () => {
  const doc = fixture();
  const original = doc.boards[0].lists[0];
  const copied = run(doc, { type: 'list/copy', listId: original.id, title: 'Copia' });

  // Excluir o cartao original: a copia ainda usa a foto.
  const withoutOriginal = run(copied, { type: 'card/remove', cardId: original.cards[0].id });
  assert.deepEqual(releasedAssets(copied, withoutOriginal), []);

  // Excluir tambem a copia: agora sim.
  const copy = withoutOriginal.boards[0].lists[1].cards[0];
  const withoutBoth = run(withoutOriginal, { type: 'card/remove', cardId: copy.id });
  assert.deepEqual(releasedAssets(withoutOriginal, withoutBoth), ['foto.png']);
});

test('arquivar nao libera o arquivo: o cartao arquivado ainda e do documento', () => {
  const doc = fixture();
  const next = run(doc, { type: 'card/archive', cardId: doc.boards[0].lists[0].cards[0].id });
  assert.deepEqual(releasedAssets(doc, next), []);
});
