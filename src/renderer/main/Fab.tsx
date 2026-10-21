import { useEffect, useState, type DragEvent } from 'react';
import type { Action } from '../shared/reducer';
import type { Board, Card } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import './Fab.css';

interface FabProps {
  board: Board;
  /**
   * The card being dragged anywhere in the window, or null. The board and the
   * calendar own their own drag state; only the id is lifted this far, because
   * the dock lives outside both of them.
   */
  dragCardId: string | null;
  confirmDelete: boolean;
  onNew: () => void;
  dispatch: (action: Action) => void;
}

type Target = 'archive' | 'trash';

function findCard(board: Board, cardId: string): Card | null {
  for (const list of board.lists) {
    const card = list.cards.find((c) => c.id === cardId);
    if (card) return card;
  }
  return null;
}

/**
 * The dock in the bottom right corner: the new-card button, which becomes the
 * trash while a card is being dragged, and an archive box that rises above it
 * for the length of the drag.
 *
 * The trash reuses the button rather than appearing beside it, so the target
 * the user is already heading for does not move. The archive box grows upward
 * from it, into what was empty board, and is there from the first move of the
 * drag instead of popping in on approach.
 */
export function Fab({ board, dragCardId, confirmDelete, onNew, dispatch }: FabProps) {
  const [armed, setArmed] = useState<Target | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { m } = useI18n();
  const t = m.fab;

  // The card is looked up on every render instead of being held in state: it
  // can be edited, moved or deleted from the modal, an automation or another
  // window while the confirmation is open, and a stored copy would go stale.
  const pending = pendingId ? findCard(board, pendingId) : null;

  useEffect(() => {
    if (pendingId && !pending) setPendingId(null);
  }, [pending, pendingId]);

  const dragging = dragCardId !== null;
  // Staying a trash while the confirmation is open keeps the prompt pointing
  // at a trash can rather than at a plus sign.
  const trash = dragging || pending !== null;

  function remove(card: Card) {
    // Its files go once nothing else points at them; App decides that.
    dispatch({ type: 'card/remove', cardId: card.id });
  }

  function allowDrop(event: DragEvent<HTMLButtonElement>, target: Target) {
    // No preventDefault for a list drag: the browser then refuses the drop and
    // says so, instead of a target accepting something it cannot act on.
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setArmed(target);
  }

  /**
   * Acting on the card inside the drop handler unmounts the tile the drag
   * started from, and Chromium then fires dragend at a node that is no longer
   * in the document, where React's delegated listener never sees it: the board
   * would keep its drop line and this dock would stay open. A timeout runs in
   * a later task, when the drag has already ended.
   */
  function afterDrag(fn: () => void) {
    setTimeout(fn, 0);
  }

  function onArchiveDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setArmed(null);
    const card = dragCardId ? findCard(board, dragCardId) : null;
    if (!card) return;
    // No confirmation here, unlike the trash: the card keeps its place in the
    // list and the panel in the sidebar puts it back.
    afterDrag(() => dispatch({ type: 'card/archive', cardId: card.id }));
  }

  function onTrashDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setArmed(null);
    const card = dragCardId ? findCard(board, dragCardId) : null;
    if (!card) return;
    if (confirmDelete) {
      setPendingId(card.id);
      return;
    }
    afterDrag(() => remove(card));
  }

  return (
    <div className="fab-dock">
      {pending && (
        <div
          className="fab-confirm"
          role="dialog"
          aria-label={t.confirmDialog}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPendingId(null);
          }}
        >
          <p className="fab-confirm__text">
            {t.confirmBefore}
            <strong>{pending.title}</strong>
            {t.confirmAfter}
          </p>
          <div className="fab-confirm__actions">
            {/* Focus starts on the harmless option, so Enter does not delete. */}
            <button
              type="button"
              className="btn btn--subtle"
              autoFocus
              onClick={() => setPendingId(null)}
            >
              {m.common.cancel}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                remove(pending);
                setPendingId(null);
              }}
            >
              {m.common.delete}
            </button>
          </div>
        </div>
      )}

      {dragging && (
        <button
          type="button"
          className={`fab-archive${armed === 'archive' ? ' fab-archive--over' : ''}`}
          onDragOver={(event) => allowDrop(event, 'archive')}
          onDragLeave={() => setArmed(null)}
          onDrop={onArchiveDrop}
          aria-label={t.archiveCard}
          title={t.archiveHint}
        >
          <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2.2 3.4h11.6v2.4H2.2zM3.2 5.8h9.6v6.1a.9.9 0 0 1-.9.9H4.1a.9.9 0 0 1-.9-.9z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M6.4 8.5h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="fab-archive__label">{t.archive}</span>
        </button>
      )}

      <button
        type="button"
        className={['fab', trash ? 'fab--trash' : '', armed === 'trash' ? 'fab--over' : '']
          .filter(Boolean)
          .join(' ')}
        onClick={() => {
          if (!trash) onNew();
        }}
        onDragOver={(event) => allowDrop(event, 'trash')}
        onDragLeave={() => setArmed(null)}
        onDrop={onTrashDrop}
        aria-label={trash ? t.deleteCard : t.newCard}
        title={trash ? t.deleteHint : t.newCardHint}
      >
        {trash ? (
          <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2.8 4.6h10.4M6.2 4.6V3.4a.9.9 0 0 1 .9-.9h1.8a.9.9 0 0 1 .9.9v1.2M4.4 4.6l.5 8.1a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.5-8.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.7 7v3.8M9.3 7v3.8"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
