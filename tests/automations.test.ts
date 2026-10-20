import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyBoard, emptyCard, emptyList, emptyRule } from '../src/renderer/shared/document';
import { reducer, type Action } from '../src/renderer/shared/reducer';
import {
  DEFAULT_LABELS,
  type BoardDocument,
  type Rule,
  type RuleAction,
  type Trigger,
} from '../src/renderer/shared/types';

interface ListIds {
  a: string;
  b: string;
  c: string;
}

/**
 * Board with lists "A", "B", "C" and one card "x" in A.
 *
 * Rules come from a builder that receives the real list ids, because every
 * fixture generates fresh ones; a rule built against another fixture would
 * point at a list that does not exist here.
 */
function fixture(makeRules: (ids: ListIds) => Rule[] = () => []): BoardDocument {
  const board = emptyBoard('Quadro', '#0079bf');
  const a = emptyList('A');
  const b = emptyList('B');
  const c = emptyList('C');
  a.cards = [emptyCard('x')];
  board.lists = [a, b, c];
  board.automations = makeRules({ a: a.id, b: b.id, c: c.id });
  return {
    version: 2,
    boards: [board],
    activeBoardId: board.id,
    labels: DEFAULT_LABELS,
    prefs: { theme: 'dark', locale: 'pt-BR', confirmCardDelete: true, automationsEnabled: true },
  };
}

const run = (doc: BoardDocument, ...actions: Action[]) => actions.reduce(reducer, doc);
const lists = (doc: BoardDocument) => doc.boards[0].lists;
const listNamed = (doc: BoardDocument, title: string) =>
  lists(doc).find((list) => list.title === title)!;
const theCard = (doc: BoardDocument) => {
  for (const list of lists(doc)) {
    const card = list.cards.find((candidate) => candidate.title === 'x');
    if (card) return { card, list };
  }
  throw new Error('cartao x desapareceu');
};
const cardId = (doc: BoardDocument) => theCard(doc).card.id;

function rule(trigger: Trigger, actions: RuleAction[], name = 'r'): Rule {
  return emptyRule(name, trigger, actions);
}

/* ------------------------------------------------------------------ *
 * Triggers
 * ------------------------------------------------------------------ */

test('card-moved dispara a acao na lista configurada', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: b }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ]);

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  assert.deepEqual(theCard(next).card.labelIds, ['lbl-green']);
});

test('card-moved so dispara na lista indicada', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: b }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ]);

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'C').id,
    toIndex: 0,
  });

  assert.deepEqual(theCard(next).card.labelIds, []);
});

test('card-moved com lista nula vale para qualquer lista', () => {
  const doc = fixture(() => [
    rule({ type: 'card-moved', listId: null }, [{ type: 'add-label', labelId: 'lbl-blue' }]),
  ]);
  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'C').id,
    toIndex: 0,
  });
  assert.deepEqual(theCard(next).card.labelIds, ['lbl-blue']);
});

test('reordenar dentro da mesma lista nao conta como movimentacao', () => {
  const doc = fixture(() => [
    rule({ type: 'card-moved', listId: null }, [{ type: 'add-label', labelId: 'lbl-red' }]),
  ]);
  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'A').id,
    toIndex: 0,
  });
  assert.deepEqual(theCard(next).card.labelIds, []);
});

test('card-added dispara ao criar o cartao na lista', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-added', listId: b }, [{ type: 'add-label', labelId: 'lbl-yellow' }]),
  ]);

  const next = run(doc, { type: 'card/add', listId: listNamed(doc, 'B').id, title: 'novo' });
  const created = listNamed(next, 'B').cards.find((card) => card.title === 'novo')!;
  assert.deepEqual(created.labelIds, ['lbl-yellow']);
});

test('label-added dispara so para a etiqueta configurada', () => {
  const doc = fixture(({ c }) => [
    rule({ type: 'label-added', labelId: 'lbl-red' }, [{ type: 'move-to-list', listId: c }]),
  ]);
  const id = cardId(doc);

  const other = run(doc, { type: 'card/update', cardId: id, patch: { labelIds: ['lbl-blue'] } });
  assert.equal(theCard(other).list.title, 'A');

  const matched = run(doc, { type: 'card/update', cardId: id, patch: { labelIds: ['lbl-red'] } });
  assert.equal(theCard(matched).list.title, 'C');
});

test('checklist-completed dispara quando o ultimo item e marcado', () => {
  const doc = fixture(() => [
    rule({ type: 'checklist-completed' }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ]);
  const id = cardId(doc);

  const withItems = run(
    doc,
    { type: 'checklist/add', cardId: id, text: 'um' },
    { type: 'checklist/add', cardId: id, text: 'dois' },
  );
  const [first, second] = theCard(withItems).card.checklist;

  const half = run(withItems, { type: 'checklist/toggle', cardId: id, itemId: first.id });
  assert.deepEqual(theCard(half).card.labelIds, [], 'metade concluida nao deve disparar');

  const full = run(half, { type: 'checklist/toggle', cardId: id, itemId: second.id });
  assert.deepEqual(theCard(full).card.labelIds, ['lbl-green']);
});

test('checklist-completed nao redispara enquanto segue completa', () => {
  const doc = fixture(() => [
    rule({ type: 'checklist-completed' }, [{ type: 'add-checklist-item', text: 'extra' }]),
  ]);
  const id = cardId(doc);

  const one = run(doc, { type: 'checklist/add', cardId: id, text: 'um' });
  const item = theCard(one).card.checklist[0];
  const done = run(one, { type: 'checklist/toggle', cardId: id, itemId: item.id });

  // A regra adicionou um item, que entra pendente e quebra a conclusao.
  assert.deepEqual(
    theCard(done).card.checklist.map((entry) => entry.text),
    ['um', 'extra'],
  );
  assert.equal(theCard(done).card.checklist.filter((entry) => entry.done).length, 1);
});

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */

test('regra desativada nao roda', () => {
  const doc = fixture(() => {
    const disabled = rule({ type: 'card-moved', listId: null }, [
      { type: 'add-label', labelId: 'lbl-green' },
    ]);
    disabled.enabled = false;
    return [disabled];
  });

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });
  assert.deepEqual(theCard(next).card.labelIds, []);
});

test('a chave geral desliga todas as regras', () => {
  const doc = fixture(() => [
    rule({ type: 'card-moved', listId: null }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ]);
  doc.prefs.automationsEnabled = false;

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });
  assert.deepEqual(theCard(next).card.labelIds, []);
});

test('duas regras que se empurram entre listas terminam', () => {
  // A -> B e B -> A: sem guarda, isso roda para sempre.
  const doc = fixture(({ a, b }) => [
    rule({ type: 'card-moved', listId: b }, [{ type: 'move-to-list', listId: a }], 'volta'),
    rule({ type: 'card-moved', listId: a }, [{ type: 'move-to-list', listId: b }], 'vai'),
  ]);

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  // O que importa e ter retornado. O cartao para em uma das duas listas.
  assert.ok(['A', 'B'].includes(theCard(next).list.title));
});

test('uma regra que dispara a si mesma termina', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: null }, [{ type: 'move-to-list', listId: b }], 'sempre B'),
  ]);

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'C').id,
    toIndex: 0,
  });
  assert.equal(theCard(next).list.title, 'B');
});

test('o encadeamento alcanca a regra da lista de destino', () => {
  const doc = fixture(({ a, b }) => [
    rule({ type: 'card-added', listId: a }, [{ type: 'move-to-list', listId: b }], 'triagem'),
    rule({ type: 'card-moved', listId: b }, [{ type: 'add-label', labelId: 'lbl-purple' }], 'marca'),
  ]);

  const next = run(doc, { type: 'card/add', listId: listNamed(doc, 'A').id, title: 'novo' });

  const created = listNamed(next, 'B').cards.find((card) => card.title === 'novo');
  assert.ok(created, 'a primeira regra deveria ter movido o cartao para B');
  assert.deepEqual(created.labelIds, ['lbl-purple'], 'a segunda regra deveria ter marcado');
});

test('carregar um documento nao executa regras', () => {
  const doc = fixture(() => [
    rule({ type: 'card-moved', listId: null }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ]);
  const loaded = reducer(fixture(), { type: 'replace', doc });
  assert.deepEqual(theCard(loaded).card.labelIds, []);
});

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

test('set-due define o prazo em dias a partir de agora', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: b }, [{ type: 'set-due', days: 3 }]),
  ]);

  const dated = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  const due = theCard(dated).card.due;
  assert.ok(due, 'o prazo deveria estar definido');
  const days = Math.round((new Date(due).getTime() - Date.now()) / 86_400_000);
  assert.equal(days, 3);
});

test('clear-due remove o prazo', () => {
  const doc = fixture(({ b }) => [rule({ type: 'card-moved', listId: b }, [{ type: 'clear-due' }])]);
  const id = cardId(doc);

  const dated = run(doc, {
    type: 'card/update',
    cardId: id,
    patch: { due: new Date().toISOString() },
  });
  const next = run(dated, {
    type: 'card/move',
    cardId: id,
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  assert.equal(theCard(next).card.due, null);
});

test('mark-checklist-done marca todos os itens pendentes', () => {
  const doc = fixture(({ c }) => [
    rule({ type: 'card-moved', listId: c }, [{ type: 'mark-checklist-done' }]),
  ]);
  const id = cardId(doc);

  const withItems = run(
    doc,
    { type: 'checklist/add', cardId: id, text: 'um' },
    { type: 'checklist/add', cardId: id, text: 'dois' },
  );
  const next = run(withItems, {
    type: 'card/move',
    cardId: id,
    toListId: listNamed(doc, 'C').id,
    toIndex: 0,
  });

  assert.ok(theCard(next).card.checklist.every((item) => item.done));
});

test('remove-label tira so a etiqueta indicada', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: b }, [{ type: 'remove-label', labelId: 'lbl-red' }]),
  ]);
  const id = cardId(doc);

  const marked = run(doc, {
    type: 'card/update',
    cardId: id,
    patch: { labelIds: ['lbl-red', 'lbl-blue'] },
  });
  const next = run(marked, {
    type: 'card/move',
    cardId: id,
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  assert.deepEqual(theCard(next).card.labelIds, ['lbl-blue']);
});

test('uma acao que nao mudaria nada nao e emitida', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: b }, [{ type: 'add-label', labelId: 'lbl-green' }]),
  ]);
  const id = cardId(doc);

  const pre = run(doc, { type: 'card/update', cardId: id, patch: { labelIds: ['lbl-green'] } });
  const next = run(pre, {
    type: 'card/move',
    cardId: id,
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  assert.deepEqual(theCard(next).card.labelIds, ['lbl-green'], 'nao deve duplicar a etiqueta');
});

test('add-checklist-item usa o texto configurado', () => {
  const doc = fixture(({ b }) => [
    rule({ type: 'card-moved', listId: b }, [
      { type: 'add-checklist-item', text: 'revisar com o time' },
    ]),
  ]);

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });

  assert.deepEqual(
    theCard(next).card.checklist.map((item) => item.text),
    ['revisar com o time'],
  );
});

test('uma regra com varias acoes aplica todas, em ordem', () => {
  const doc = fixture(({ c }) => [
    rule({ type: 'card-moved', listId: c }, [
      { type: 'add-label', labelId: 'lbl-green' },
      { type: 'add-checklist-item', text: 'conferir' },
      { type: 'mark-checklist-done' },
      { type: 'clear-due' },
    ]),
  ]);
  const id = cardId(doc);

  const dated = run(doc, {
    type: 'card/update',
    cardId: id,
    patch: { due: new Date().toISOString() },
  });
  const next = run(dated, {
    type: 'card/move',
    cardId: id,
    toListId: listNamed(doc, 'C').id,
    toIndex: 0,
  });

  const { card } = theCard(next);
  assert.deepEqual(card.labelIds, ['lbl-green']);
  // mark-checklist-done roda depois do add, entao pega o item recem-criado.
  assert.deepEqual(card.checklist.map((item) => [item.text, item.done]), [['conferir', true]]);
  assert.equal(card.due, null);
});

test('uma regra apontando para lista inexistente nao quebra o dispatch', () => {
  const doc = fixture(() => [
    rule({ type: 'card-moved', listId: null }, [{ type: 'move-to-list', listId: 'list_fantasma' }]),
  ]);

  const next = run(doc, {
    type: 'card/move',
    cardId: cardId(doc),
    toListId: listNamed(doc, 'B').id,
    toIndex: 0,
  });
  assert.equal(theCard(next).list.title, 'B');
});
