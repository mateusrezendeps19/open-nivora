import { useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { Action } from '../shared/reducer';
import type { Board, Card, Label } from '../shared/types';
import { activeFilterCount, isFiltering, isShown, type CardFilter } from '../shared/filter';
import type { Messages } from '../shared/i18n';
import { useI18n } from '../shared/i18n/context';
import {
  freezeLists,
  previewMove,
  slotAt,
  slotToIndex,
  toActionIndex,
  type CardDrop,
} from './cardDrag';
import { CardTile } from './CardTile';
import { ListColumn } from './ListColumn';
import { ListComposer } from './ListComposer';
import { useFlip } from './useFlip';
import './BoardCanvas.css';

export interface CardDrag {
  kind: 'card';
  cardId: string;
  fromListId: string;
}

export interface ListDrag {
  kind: 'list';
  listId: string;
}

export type Drag = CardDrag | ListDrag | null;

/**
 * The card in flight, as the board needs it to draw the card under the
 * pointer: the size of the tile it came from and where inside it the pointer
 * took hold, so the card keeps that grip instead of jumping to its corner.
 */
export interface Lift {
  cardId: string;
  width: number;
  height: number;
  grabX: number;
  grabY: number;
  /** Pointer position at the start, to place the card before the first move. */
  x: number;
  y: number;
  /**
   * Whether the board draws the card at the pointer. False when the native
   * drag image could not be replaced (see dragPreview), and the board must not
   * draw a second card over Chromium's own.
   */
  drawn: boolean;
}

/** What a tile can measure about itself when the drag starts. */
export type Grab = Omit<Lift, 'cardId'>;

/**
 * The line over the board while a filter is on. A keyword alone reads as the
 * search it is; anything more is counted, because a list of every ticked box
 * would not fit on one line.
 */
function filterSummary(matches: number, filter: CardFilter, m: Messages): string {
  const keyword = filter.keyword.trim();
  const count = activeFilterCount(filter);
  const others = count - (keyword ? 1 : 0);
  return m.board.filterSummary(matches, keyword && others === 0 ? keyword : null, count);
}

/** The preview is drawn, not operated. */
const noop = () => {};

interface BoardCanvasProps {
  board: Board;
  /** Every board, for the lists' Mover lista. */
  boards: Board[];
  labels: Label[];
  filter: CardFilter;
  onClearFilter: () => void;
  dispatch: (action: Action) => void;
  onOpenCard: (cardId: string) => void;
  /** Reported up so the floating button can offer itself as a trash. */
  onCardDragChange: (cardId: string | null) => void;
}

export function BoardCanvas({
  board,
  boards,
  labels,
  filter,
  onClearFilter,
  dispatch,
  onOpenCard,
  onCardDragChange,
}: BoardCanvasProps) {
  const [drag, setDrag] = useState<Drag>(null);
  const { m } = useI18n();
  const [cardDrop, setCardDrop] = useState<CardDrop | null>(null);
  const [listDrop, setListDrop] = useState<number | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);

  const canvasRef = useRef<HTMLElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /**
   * The same lift the state holds, for the imperative path: the card under the
   * pointer is positioned by writing to the element, not by rendering.
   */
  const liftRef = useRef<Lift | null>(null);
  /** The board's card midpoints as they stood when the drag started. */
  const frozenRef = useRef<Map<string, number[]>>(new Map());

  const seedFlip = useFlip(canvasRef);


  /**
   * While a card is in flight the board draws the move as though it had
   * already happened: the card sits where it would land, its old space is
   * closed, and everything in between has moved - which useFlip then animates.
   * The commit changes nothing on screen, so the drop has nothing to catch up
   * with.
   */
  const lists = useMemo(() => {
    if (drag?.kind === 'card' && cardDrop) return previewMove(board.lists, drag.cardId, cardDrop);
    return board.lists;
  }, [board.lists, drag, cardDrop]);

  /**
   * Archived cards and cards the filter hides stay in their lists and only
   * stop being drawn. The drop is measured against what is on screen and then
   * placed in the whole list by slotToIndex.
   */
  const shown = (card: Card) => isShown(card, filter);
  const filtering = isFiltering(filter);
  const visible = useMemo(
    () => lists.map((list) => ({ list, cards: list.cards.filter((card) => isShown(card, filter)) })),
    [lists, filter],
  );

  const matches = visible.reduce((total, entry) => total + entry.cards.length, 0);

  const liftCard = useMemo(() => {
    if (!lift) return null;
    for (const list of board.lists) {
      const found = list.cards.find((card) => card.id === lift.cardId);
      if (found) return found;
    }
    return null;
  }, [board.lists, lift]);

  /**
   * The pointer position is written straight to the element and never kept in
   * state: a drag reports a position per frame, and a render per frame would
   * re-measure every card on the board for the FLIP each time, for a card that
   * only has to move.
   */
  function placeLift(x: number, y: number) {
    const layer = layerRef.current;
    const current = liftRef.current;
    if (!layer || !current) return;
    layer.style.transform = `translate(${x - current.grabX}px, ${y - current.grabY}px)`;
  }

  // The first placement, before any drag event has fired, or the card would
  // appear in the top left corner for a frame.
  useLayoutEffect(() => {
    if (lift) placeLift(lift.x, lift.y);
  }, [lift]);

  /**
   * A list reports where the pointer is inside its own card area; the slot it
   * falls in is resolved here, against the geometry frozen at the start of the
   * drag (see cardDrag).
   *
   * Dragover fires continuously, so the drop only goes into state when the
   * slot it points at actually changes. Otherwise every event of a still
   * pointer is a render, and every render re-measures the board for the FLIP.
   */
  function hoverCard(listId: string, y: number) {
    if (drag?.kind !== 'card') return;
    const slot = slotAt(frozenRef.current.get(listId) ?? [], y);
    // The stored lists, not the preview: the slot is a place among the cards
    // as they stand without this one, and the preview already moved it.
    const cards = board.lists.find((list) => list.id === listId)?.cards ?? [];
    const index = slotToIndex(cards, drag.cardId, shown, slot);
    setCardDrop((current) => {
      if (current && current.listId === listId && current.index === index) return current;
      return { listId, index };
    });
  }

  /**
   * The handlers of the latest render, for the native listeners below: they are
   * registered once per drag and would otherwise call a stale closure, one that
   * still sees the drop as it was when the drag began.
   */
  const latest = useRef({ placeLift, endAndCommit });
  useLayoutEffect(() => {
    latest.current = { placeLift, endAndCommit };
  });

  /**
   * `drag` and `dragend` are listened for natively on the element the drag
   * started from, not through React. The board draws the drag by moving the
   * card into its target list, and moving a card to another list is a
   * different ListColumn rendering it: React unmounts the tile the drag began
   * on and mounts a new one. Chromium keeps sending the drag's events to the
   * original element, now outside the document, where React's listeners at the
   * root never hear them - the card under the pointer froze where the list
   * changed, and the drag never ended. A listener on the element itself still
   * fires once it is detached.
   */
  function beginDrag(next: Drag, grab: Grab | null, source: HTMLElement) {
    const onDrag = (event: MouseEvent) => {
      // Chromium reports 0,0 for the last drag event of a gesture, which would
      // throw the card into the top left corner right before it is dropped.
      if (event.clientX !== 0 || event.clientY !== 0) {
        latest.current.placeLift(event.clientX, event.clientY);
      }
    };
    const onEnd = () => {
      source.removeEventListener('drag', onDrag);
      source.removeEventListener('dragend', onEnd);
      latest.current.endAndCommit();
    };
    source.addEventListener('drag', onDrag);
    source.addEventListener('dragend', onEnd);

    if (next?.kind === 'card' && canvasRef.current) {
      frozenRef.current = freezeLists(canvasRef.current, next.cardId);
    }
    setDrag(next);
    onCardDragChange(next?.kind === 'card' ? next.cardId : null);
    const nextLift = next?.kind === 'card' && grab ? { cardId: next.cardId, ...grab } : null;
    liftRef.current = nextLift;
    setLift(nextLift);
  }

  function endDrag() {
    /*
     * The card flies from where the pointer let go of it rather than from the
     * slot it left, because that is where the user is looking. Seeding the
     * FLIP with the preview's rect is what starts the drop there - and what
     * sends a cancelled drag back home instead of blinking it back.
     */
    const layer = layerRef.current;
    if (layer && liftRef.current) {
      seedFlip(liftRef.current.cardId, layer.getBoundingClientRect());
    }
    setDrag(null);
    setCardDrop(null);
    setListDrop(null);
    liftRef.current = null;
    setLift(null);
    onCardDragChange(null);
  }

  function commitCardDrop() {
    if (drag?.kind === 'card' && cardDrop) {
      dispatch({
        type: 'card/move',
        cardId: drag.cardId,
        toListId: cardDrop.listId,
        // The board counts slots with the card out of the list; the reducer
        // counts them with the card still in it.
        toIndex: toActionIndex(board.lists, drag.cardId, cardDrop),
      });
    }
    endDrag();
  }

  /**
   * The pointer left the board, so nothing is being shown any more and the end
   * of the drag has nothing to commit. This is what makes a release over the
   * dock archive or delete the card instead of also moving it, and a release
   * outside the window a plain cancel.
   *
   * Dragleave also fires on the way from one child to the next, which is not
   * leaving at all - hence the containment test.
   */
  function onDragLeave(event: DragEvent<HTMLElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && canvasRef.current?.contains(next)) return;
    setCardDrop(null);
    setListDrop(null);
  }

  function allowDrop(event: DragEvent<HTMLElement>) {
    if (!drag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function commitListDrop() {
    if (drag?.kind === 'list' && listDrop !== null) {
      dispatch({ type: 'list/move', listId: drag.listId, toIndex: listDrop });
    }
    endDrag();
  }

  /**
   * The move is committed at the end of the drag and not on the drop, because
   * the drop cannot be relied on to arrive: Chromium never delivers one when
   * the pointer comes up over the element the drag started from, and the board
   * draws the card exactly where the pointer is pointing - so a release that
   * lands on the card being dragged would silently throw the move away.
   *
   * Dragend always arrives. What is on screen when it does is what gets
   * written, and `onDragLeave` is what guarantees nothing is on screen when
   * the card was taken somewhere else.
   */
  function endAndCommit() {
    if (drag?.kind === 'card') commitCardDrop();
    else if (drag?.kind === 'list') commitListDrop();
    else endDrag();
  }

  return (
    <main
      className="canvas"
      ref={canvasRef}
      onDragOver={allowDrop}
      onDragLeave={onDragLeave}
      onDrop={(event) => event.preventDefault()}
    >
      {filtering && (
        <div className="canvas__filter">
          {filterSummary(matches, filter, m)}
          <button type="button" className="canvas__filter-clear" onClick={onClearFilter}>
            {m.common.clearFilters}
          </button>
        </div>
      )}

      <div className="canvas__lists">
        {visible.map(({ list, cards }, listIndex) => (
          <ListColumn
            key={list.id}
            list={list}
            board={board}
            boards={boards}
            cards={cards}
            listIndex={listIndex}
            filtered={filtering}
            labels={labels}
            drag={drag}
            listDrop={listDrop}
            onDragStart={beginDrag}
            onCardHover={hoverCard}
            onListHover={setListDrop}
            onOpenCard={onOpenCard}
            dispatch={dispatch}
          />
        ))}

        <ListComposer onAdd={(title) => dispatch({ type: 'list/add', title })} />
      </div>

      {/*
        The card under the pointer, drawn by the board because Chromium's own
        drag image is a flat snapshot that cannot be tilted. It is outside the
        scrolling list area so it is positioned against the viewport, and it
        takes no pointer events: the drop targets under it, the lists and the
        dock, have to keep receiving the drag.
      */}
      {lift?.drawn && liftCard && (
        <div
          ref={layerRef}
          className="drag-layer"
          style={{ width: lift.width }}
          aria-hidden="true"
        >
          <CardTile
            card={liftCard}
            labels={labels}
            preview
            dragging={false}
            onOpen={noop}
            onToggleDone={noop}
            onDragStart={noop}
          />
        </div>
      )}
    </main>
  );
}
