import { useMemo, useState } from 'react';
import type { Action } from '../shared/reducer';
import type { Board, Label } from '../shared/types';
import { ListColumn } from './ListColumn';
import { ListComposer } from './ListComposer';
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

/** Where the dragged card would land: a list plus an insertion index. */
export interface CardDrop {
  listId: string;
  index: number;
}

interface BoardCanvasProps {
  board: Board;
  labels: Label[];
  query: string;
  dispatch: (action: Action) => void;
  onOpenCard: (cardId: string) => void;
}

export function BoardCanvas({ board, labels, query, dispatch, onOpenCard }: BoardCanvasProps) {
  const [drag, setDrag] = useState<Drag>(null);
  const [cardDrop, setCardDrop] = useState<CardDrop | null>(null);
  const [listDrop, setListDrop] = useState<number | null>(null);

  const needle = query.trim().toLowerCase();

  /**
   * Filtering keeps the original index of every card, so a drop computed
   * against a filtered view still lands in the right place in the full list.
   */
  const visible = useMemo(
    () =>
      board.lists.map((list) => ({
        list,
        cards: list.cards
          .map((card, index) => ({ card, index }))
          .filter(({ card }) => {
            if (!needle) return true;
            return (
              card.title.toLowerCase().includes(needle) ||
              card.description.toLowerCase().includes(needle)
            );
          }),
      })),
    [board.lists, needle],
  );

  const matches = visible.reduce((total, entry) => total + entry.cards.length, 0);

  function endDrag() {
    setDrag(null);
    setCardDrop(null);
    setListDrop(null);
  }

  function commitCardDrop() {
    if (drag?.kind === 'card' && cardDrop) {
      dispatch({
        type: 'card/move',
        cardId: drag.cardId,
        toListId: cardDrop.listId,
        toIndex: cardDrop.index,
      });
    }
    endDrag();
  }

  function commitListDrop() {
    if (drag?.kind === 'list' && listDrop !== null) {
      dispatch({ type: 'list/move', listId: drag.listId, toIndex: listDrop });
    }
    endDrag();
  }

  return (
    <main className="canvas" onDragEnd={endDrag}>
      {needle && (
        <div className="canvas__filter">
          {matches === 0
            ? `Nenhum cartao corresponde a "${query}"`
            : `${matches} cartao(oes) correspondem a "${query}"`}
        </div>
      )}

      <div className="canvas__lists">
        {visible.map(({ list, cards }, listIndex) => (
          <ListColumn
            key={list.id}
            list={list}
            cards={cards}
            listIndex={listIndex}
            filtered={!!needle}
            labels={labels}
            drag={drag}
            cardDrop={cardDrop}
            listDrop={listDrop}
            onDragStart={setDrag}
            onCardHover={setCardDrop}
            onListHover={setListDrop}
            onCardDrop={commitCardDrop}
            onListDrop={commitListDrop}
            onOpenCard={onOpenCard}
            dispatch={dispatch}
          />
        ))}

        <ListComposer onAdd={(title) => dispatch({ type: 'list/add', title })} />
      </div>
    </main>
  );
}
