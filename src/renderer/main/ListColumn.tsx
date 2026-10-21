import { useRef, useState, type DragEvent } from 'react';
import type { Action } from '../shared/reducer';
import type { Card, Label, List } from '../shared/types';
import type { Drag, Grab } from './BoardCanvas';
import { CardComposer } from './CardComposer';
import { CardTile } from './CardTile';
import { InlineTitle } from './InlineTitle';
import './ListColumn.css';

interface ListColumnProps {
  list: List;
  /** The cards this list draws: archived and filtered-out ones are not here. */
  cards: Card[];
  listIndex: number;
  filtered: boolean;
  labels: Label[];
  drag: Drag;
  listDrop: number | null;
  onDragStart: (drag: Drag, grab: Grab | null, source: HTMLElement) => void;
  /** Where the pointer is inside this list's card area, in its content space. */
  onCardHover: (listId: string, y: number) => void;
  onListHover: (index: number | null) => void;
  onOpenCard: (cardId: string) => void;
  dispatch: (action: Action) => void;
}

export function ListColumn({
  list,
  cards,
  listIndex,
  filtered,
  labels,
  drag,
  listDrop,
  onDragStart,
  onCardHover,
  onListHover,
  onOpenCard,
  dispatch,
}: ListColumnProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const draggingThisList = drag?.kind === 'list' && drag.listId === list.id;

  // The badge counts what is on the board, so it is not thrown off by the
  // query filter above it nor by the archived cards still held in the list.
  const active = list.cards.reduce((total, card) => total + (card.archivedAt ? 0 : 1), 0);

  /**
   * One handler for the whole column, cards included - the events from the
   * tiles bubble up to here. What is under the pointer is deliberately not
   * consulted: only where the pointer is, which the board then reads against
   * the frozen geometry (see cardDrag). Above the first card, below the last
   * one, over the header or over the composer all fall out of that on their
   * own.
   */
  function onColumnDragOver(event: DragEvent<HTMLDivElement>) {
    if (drag?.kind === 'list') {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientX > rect.left + rect.width / 2;
      onListHover(after ? listIndex + 1 : listIndex);
      return;
    }
    if (drag?.kind !== 'card') return;
    event.preventDefault();
    const body = bodyRef.current;
    if (!body) return;
    onCardHover(list.id, event.clientY - body.getBoundingClientRect().top + body.scrollTop);
  }

  return (
    <div
      className={[
        'column',
        draggingThisList ? 'column--dragging' : '',
        listDrop === listIndex && drag?.kind === 'list' ? 'column--drop-before' : '',
        listDrop === listIndex + 1 && drag?.kind === 'list' ? 'column--drop-after' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // Reordered lists slide the same way reordered cards do. The key is
      // prefixed because a list and a card can hold the same id only by
      // accident, and the flip map is one namespace.
      data-flip={`list:${list.id}`}
      data-list={list.id}
      onDragOver={onColumnDragOver}
    >
      <header
        className="column__header"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', list.id);
          // A whole column is too big to carry under the pointer, so the
          // native drag image is left in place for a list drag.
          onDragStart({ kind: 'list', listId: list.id }, null, event.currentTarget);
        }}
      >
        <InlineTitle
          value={list.title}
          className="column__title"
          ariaLabel="Renomear lista"
          onCommit={(title) => dispatch({ type: 'list/rename', listId: list.id, title })}
        />
        <span className="column__count">{active}</span>
        <button
          type="button"
          className="column__menu-btn"
          aria-label="Acoes da lista"
          onClick={() => setMenuOpen((open) => !open)}
        >
          ...
        </button>

        {menuOpen && (
          <div className="column__menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                dispatch({ type: 'card/add', listId: list.id, title: 'Novo cartao', atTop: true });
                setMenuOpen(false);
              }}
            >
              Adicionar cartao no topo
            </button>
            <button
              type="button"
              role="menuitem"
              className="column__menu-danger"
              onClick={() => {
                dispatch({ type: 'list/remove', listId: list.id });
                setMenuOpen(false);
              }}
            >
              Excluir lista
            </button>
          </div>
        )}
      </header>

      {/* data-cards: freezeLists measures the drag against this box. */}
      <div className="column__cards" ref={bodyRef} data-cards>
        {cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            labels={labels}
            dragging={drag?.kind === 'card' && drag.cardId === card.id}
            onOpen={() => onOpenCard(card.id)}
            onToggleDone={() =>
              dispatch({ type: 'card/update', cardId: card.id, patch: { done: !card.done } })
            }
            onDragStart={(grab, source) =>
              onDragStart({ kind: 'card', cardId: card.id, fromListId: list.id }, grab, source)
            }
          />
        ))}

        {cards.length === 0 && (
          <p className="column__empty">
            {filtered ? 'Nenhum cartao corresponde ao filtro.' : 'Nenhum cartao ainda.'}
          </p>
        )}
      </div>

      <CardComposer
        onAdd={(title) => dispatch({ type: 'card/add', listId: list.id, title })}
      />
    </div>
  );
}
