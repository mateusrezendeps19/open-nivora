import assert from 'node:assert/strict';
import test from 'node:test';
import { previewMove, toActionIndex, type CardDrop } from '../src/renderer/main/cardDrag';
import { emptyBoard, emptyCard, emptyList } from '../src/renderer/shared/document';
import { reducer } from '../src/renderer/shared/reducer';
import { DEFAULT_LABELS, type BoardDocument, type List } from '../src/renderer/shared/types';

/** Lists a,b,c and d,e, so a drop has somewhere else to go. */
function fixture(): BoardDocument {
  const board = emptyBoard('Quadro', '#0079bf');
  const left = emptyList('Esquerda');
  const right = emptyList('Direita');
  left.cards = [emptyCard('a'), emptyCard('b'), emptyCard('c')];
  right.cards = [emptyCard('d'), emptyCard('e')];
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

const shape = (lists: List[]) => lists.map((list) => list.cards.map((card) => card.title));

/**
 * The board draws a drag by rendering `previewMove`, and commits it by sending
 * `card/move` with `toActionIndex`. If those two ever disagree, the card lands
 * one slot away from where the drag said it would - a bug nobody would read in
 * the code, because both halves look right on their own. So this walks every
 * card into every slot of both lists and insists the drawing and the commit
 * come out the same.
 *
 * Validated against the bug by dropping the compensation in `toActionIndex`:
 * every same-list move to a later slot fails.
 */
test('o arraste desenhado e o movimento gravado chegam ao mesmo lugar', () => {
  const doc = fixture();
  const lists = doc.boards[0].lists;

  let checked = 0;
  for (const source of lists) {
    for (const card of source.cards) {
      for (const target of lists) {
        // One slot per gap in the target list once the card is out of it.
        const slots = target.cards.filter((entry) => entry.id !== card.id).length;
        for (let index = 0; index <= slots; index += 1) {
          const drop: CardDrop = { listId: target.id, index };

          const drawn = previewMove(lists, card.id, drop);
          const committed = reducer(doc, {
            type: 'card/move',
            cardId: card.id,
            toListId: target.id,
            toIndex: toActionIndex(lists, card.id, drop),
          });

          assert.deepEqual(
            shape(drawn),
            shape(committed.boards[0].lists),
            `"${card.title}" para ${target.title} na posicao ${index}`,
          );
          checked += 1;
        }
      }
    }
  }

  // Five cards, each into every gap of both lists: three plus three for each
  // of a, b and c, four plus two for each of d and e.
  assert.equal(checked, 30);
});

test('o arraste desenhado nao altera as listas recebidas', () => {
  const doc = fixture();
  const lists = doc.boards[0].lists;
  const before = shape(lists);

  previewMove(lists, lists[0].cards[0].id, { listId: lists[1].id, index: 1 });

  assert.deepEqual(shape(lists), before);
});

test('um cartao desconhecido deixa as listas como estao', () => {
  const lists = fixture().boards[0].lists;
  const drop: CardDrop = { listId: lists[0].id, index: 0 };

  assert.equal(previewMove(lists, 'card_inexistente', drop), lists);
  assert.equal(toActionIndex(lists, 'card_inexistente', drop), 0);
});
