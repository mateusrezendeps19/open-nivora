import { useState, type DragEvent } from 'react';
import type { Action } from '../shared/reducer';
import type { Card, Label, List } from '../shared/types';
import type { CardDrop, Drag } from './BoardCanvas';
import { CardComposer } from './CardComposer';
import { CardTile } from './CardTile';
import { InlineTitle } from './InlineTitle';
import './ListColumn.css';

interface ListColumnProps {
  list: List;
  /** Visible cards paired with their index in the unfiltered list. */
  cards: { card: Card; index: number }[];
  listIndex: number;
  filtered: boolean;
  labels: Label[];
  drag: Drag;
  cardDrop: CardDrop | null;
  listDrop: number | null;
  onDragStart: (drag: Drag) => void;
  onCardHover: (drop: CardDrop | null) => void;
  onListHover: (index: number | null) => void;
  onCardDrop: () => void;
  onListDrop: () => void;
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
  cardDrop,
  listDrop,
  onDragStart,
  onCardHover,
  onListHover,
  onCardDrop,
  onListDrop,
  onOpenCard,
  dispatch,
}: ListColumnProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const draggingThisList = drag?.kind === 'list' && drag.listId === list.id;

  function onColumnDragOver(event: DragEvent<HTMLDivElement>) {
    if (drag?.kind !== 'list') return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientX > rect.left + rect.width / 2;
    onListHover(after ? listIndex + 1 : listIndex);
  }

  /** Dropping on the empty area below the cards appends to the end. */
  function onBodyDragOver(event: DragEvent<HTMLDivElement>) {
    if (drag?.kind !== 'card') return;
    event.preventDefault();
    if (event.target === event.currentTarget) {
      onCardHover({ listId: list.id, index: list.cards.length });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (drag?.kind === 'card') onCardDrop();
    else if (drag?.kind === 'list') onListDrop();
  }

  const showLine = (index: number) => cardDrop?.listId === list.id && cardDrop.index === index;

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
      onDragOver={onColumnDragOver}
      onDrop={onDrop}
    >
      <header
        className="column__header"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', list.id);
          onDragStart({ kind: 'list', listId: list.id });
        }}
      >
        <InlineTitle
          value={list.title}
          className="column__title"
          ariaLabel="Renomear lista"
          onCommit={(title) => dispatch({ type: 'list/rename', listId: list.id, title })}
        />
        <span className="column__count">{list.cards.length}</span>
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

      <div className="column__cards" onDragOver={onBodyDragOver} onDrop={onDrop}>
        {showLine(0) && <div className="column__drop-line" />}

        {cards.map(({ card, index }) => (
          <div key={card.id}>
            <CardTile
              card={card}
              labels={labels}
              dragging={drag?.kind === 'card' && drag.cardId === card.id}
              onOpen={() => onOpenCard(card.id)}
              onDragStart={() => onDragStart({ kind: 'card', cardId: card.id, fromListId: list.id })}
              onHover={(after) => onCardHover({ listId: list.id, index: after ? index + 1 : index })}
              canAcceptDrag={drag?.kind === 'card'}
            />
            {showLine(index + 1) && <div className="column__drop-line" />}
          </div>
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
