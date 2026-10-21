import { useEffect, useState } from 'react';
import type { Action } from '../shared/reducer';
import type { Board, Card, List } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import './ArchivePanel.css';

interface ArchivePanelProps {
  board: Board;
  confirmDelete: boolean;
  onClose: () => void;
  dispatch: (action: Action) => void;
}

export interface ArchivedEntry {
  card: Card;
  list: List;
}

/** The archived cards of a board, most recently archived first. */
export function archivedCards(board: Board): ArchivedEntry[] {
  const entries: ArchivedEntry[] = [];
  for (const list of board.lists) {
    for (const card of list.cards) {
      if (card.archivedAt) entries.push({ card, list });
    }
  }
  return entries.sort((a, b) => (a.card.archivedAt! < b.card.archivedAt! ? 1 : -1));
}

/**
 * Where a card dragged onto the archive box ends up, and the only way back.
 *
 * Restoring needs no target to be chosen: the card never left its list, so it
 * reappears where it was.
 */
export function ArchivePanel({ board, confirmDelete, onClose, dispatch }: ArchivePanelProps) {
  const entries = archivedCards(board);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { m, locale } = useI18n();

  // Nothing left to show: the panel would be an empty dialog over the board.
  useEffect(() => {
    if (entries.length === 0) onClose();
  }, [entries.length, onClose]);

  function remove(card: Card) {
    if (confirmDelete && confirmingId !== card.id) {
      setConfirmingId(card.id);
      return;
    }
    // Its files go once nothing else points at them; App decides that.
    dispatch({ type: 'card/remove', cardId: card.id });
    setConfirmingId(null);
  }

  return (
    <div
      className="archive__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="archive" role="dialog" aria-modal="true" aria-label={m.archive.dialog}>
        <header className="archive__header">
          <h2>{m.archive.heading}</h2>
          <span className="archive__count">{entries.length}</span>
          <button type="button" className="archive__close" aria-label={m.common.close} onClick={onClose}>
            x
          </button>
        </header>

        <ul className="archive__list">
          {entries.map(({ card, list }) => (
            <li key={card.id} className="archive__item">
              <div className="archive__card">
                <span className="archive__title">{card.title}</span>
                <span className="archive__meta">
                  {list.title} &middot; {m.archive.archivedOn}{' '}
                  {new Date(card.archivedAt!).toLocaleDateString(locale, {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--subtle"
                onClick={() => {
                  setConfirmingId(null);
                  dispatch({ type: 'card/restore', cardId: card.id });
                }}
              >
                {m.archive.restore}
              </button>
              <button type="button" className="btn btn--danger" onClick={() => remove(card)}>
                {confirmingId === card.id ? m.common.confirmDelete : m.common.delete}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
