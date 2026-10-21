import type { Card, List } from '../shared/types';

/**
 * Where the card in flight would land: a list, plus an index counted with the
 * card already pulled out of its own list.
 *
 * `card/move` counts the other way round - its `toIndex` is a slot in the list
 * as it looks with the card still in it - and that is what the reducer has
 * always meant and what its tests pin, so it stays that way. The board needs
 * the other coordinate system, because it draws the board with the move
 * already applied and therefore has to say where the card sits *after* coming
 * out. `toActionIndex` is the conversion, and tests/carddrag.test.ts pins that
 * the two agree for every slot of every list.
 */
export interface CardDrop {
  listId: string;
  index: number;
}

/**
 * The lists as they will be once the drop is committed.
 *
 * The board renders this instead of the stored lists for as long as a card is
 * in flight, which is what makes the card's old space close, the space at the
 * target open, and every card in between slide (useFlip). The alternative -
 * hiding the card where it came from and drawing a placeholder where it is
 * going - cannot be done at all: Chromium ends the renderer process if the
 * element a native drag started from stops being painted or laid out, so the
 * card has to stay a real, visible, in-flow element for the whole drag. It
 * does: it is the one at the target, dimmed.
 */
export function previewMove(lists: List[], cardId: string, drop: CardDrop): List[] {
  const source = lists.find((list) => list.cards.some((card) => card.id === cardId));
  const card = source?.cards.find((entry) => entry.id === cardId);
  if (!source || !card) return lists;

  return lists.map((list) => {
    let cards: Card[] =
      list.id === source.id ? list.cards.filter((entry) => entry.id !== cardId) : list.cards;
    if (list.id === drop.listId) {
      cards = [...cards];
      cards.splice(Math.max(0, Math.min(drop.index, cards.length)), 0, card);
    }
    return cards === list.cards ? list : { ...list, cards };
  });
}

/**
 * The midpoint of every card of every list, as the board stood when the drag
 * started, measured in each list body's own scrolling content space.
 *
 * The drop has to be decided against this and never against the live DOM. The
 * board draws the drag by moving the card to where it would land, so the cards
 * under the pointer move as the target changes - and a target read off the
 * element that happens to be under the pointer then chases itself: the card is
 * inserted above the pointer, everything shifts, the pointer lands on the card
 * it just moved, and the drag stalls there. It also lets the last event before
 * the drop disagree with what is on screen, so the card lands somewhere the
 * user was never shown.
 *
 * Frozen geometry has neither problem: the layout moves, the ruler does not.
 * The card being dragged is left out, because the index being measured counts
 * the slots of a list that no longer holds it.
 */
export function freezeLists(root: HTMLElement, dragCardId: string): Map<string, number[]> {
  const frozen = new Map<string, number[]>();
  for (const column of root.querySelectorAll<HTMLElement>('[data-list]')) {
    const listId = column.dataset.list;
    const body = column.querySelector<HTMLElement>('[data-cards]');
    if (!listId || !body) continue;

    const top = body.getBoundingClientRect().top - body.scrollTop;
    const midpoints: number[] = [];
    for (const tile of body.querySelectorAll<HTMLElement>('[data-flip]')) {
      if (tile.dataset.flip === dragCardId) continue;
      const rect = tile.getBoundingClientRect();
      midpoints.push(rect.top + rect.height / 2 - top);
    }
    frozen.set(listId, midpoints);
  }
  return frozen;
}

/** How many of those midpoints the pointer is already past. */
export function slotAt(midpoints: number[], y: number): number {
  let index = 0;
  while (index < midpoints.length && midpoints[index] < y) index += 1;
  return index;
}

/**
 * The same drop in the coordinates `card/move` expects. The reducer pulls the
 * card out and then takes one off any index past the slot it came from, so a
 * target at or after that slot has to be handed in one higher for the commit
 * to land where the drag showed it would.
 */
export function toActionIndex(lists: List[], cardId: string, drop: CardDrop): number {
  const source = lists.find((list) => list.cards.some((card) => card.id === cardId));
  if (!source || source.id !== drop.listId) return drop.index;
  const fromIndex = source.cards.findIndex((card) => card.id === cardId);
  return drop.index > fromIndex ? drop.index + 1 : drop.index;
}
