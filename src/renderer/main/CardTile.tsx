import { useState } from 'react';
import { assetUrl } from '../shared/assets';
import type { Card, Label } from '../shared/types';
import type { Grab } from './BoardCanvas';
import { hideNativeDragImage } from './dragPreview';
import './CardTile.css';

interface CardTileProps {
  card: Card;
  labels: Label[];
  /**
   * This card is in flight. It stays in the list, dimmed, at the slot it would
   * land in - it cannot be hidden, see cardDrag.
   */
  dragging: boolean;
  /** This tile *is* the card at the pointer: visual only, takes no input. */
  preview?: boolean;
  onOpen: () => void;
  /** The circle beside the title. Same action as the card's Marcar como concluido. */
  onToggleDone: () => void;
  /** `source` is the element the drag started from; see BoardCanvas.beginDrag. */
  onDragStart: (grab: Grab, source: HTMLElement) => void;
}

function dueState(due: string | null): 'none' | 'soon' | 'late' {
  if (!due) return 'none';
  const time = new Date(due).getTime();
  if (Number.isNaN(time)) return 'none';
  const remaining = time - Date.now();
  if (remaining < 0) return 'late';
  if (remaining < 48 * 60 * 60 * 1000) return 'soon';
  return 'none';
}

export function CardTile({
  card,
  labels,
  dragging,
  preview = false,
  onOpen,
  onToggleDone,
  onDragStart,
}: CardTileProps) {
  /**
   * Set by the click on the circle and cleared when its animation ends. The
   * pop belongs to the moment of ticking the card off; tied to `card.done`
   * alone, every finished card on the board would pop each time it loaded.
   */
  const [ticked, setTicked] = useState(false);
  const cardLabels = labels.filter((label) => card.labelIds.includes(label.id));
  const done = card.checklist.filter((item) => item.done).length;
  const state = dueState(card.due);
  const cover = card.coverAttachmentId
    ? card.attachments.find((a) => a.id === card.coverAttachmentId && a.isImage)
    : undefined;

  return (
    <button
      type="button"
      className={[
        'tile',
        dragging ? 'tile--dragging' : '',
        preview ? 'tile--preview' : '',
        card.done ? 'tile--done' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      // The preview is a copy of a card that is also still in the list; one
      // flip key per card, or the two would be measured as the same element.
      data-flip={preview ? undefined : card.id}
      draggable={!preview}
      tabIndex={preview ? -1 : undefined}
      onClick={preview ? undefined : onOpen}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.id);
        const rect = event.currentTarget.getBoundingClientRect();
        onDragStart({
          width: rect.width,
          height: rect.height,
          grabX: event.clientX - rect.left,
          grabY: event.clientY - rect.top,
          x: event.clientX,
          y: event.clientY,
          drawn: hideNativeDragImage(event.dataTransfer),
        }, event.currentTarget);
      }}
    >
      {cover && (
        <img className="tile__cover" src={assetUrl(cover.asset)} alt="" loading="lazy" />
      )}

      {cardLabels.length > 0 && (
        <span className="tile__labels">
          {cardLabels.map((label) => (
            <span
              key={label.id}
              className="tile__label"
              style={{ background: label.color }}
              title={label.name}
            />
          ))}
        </span>
      )}

      <span className="tile__head">
        {/*
          The circle opens beside the title when the pointer is on the card,
          pushing the title right, and stays open once the card is done.

          The tile itself is a button, and a button cannot hold another, so
          this is a span with the checkbox role. It stops the click so ticking
          the card off does not also open it. It takes no focus of its own:
          from the keyboard the same thing is the card's Marcar como
          concluido, one Enter away.
        */}
        <span
          className={`tile__check${ticked ? ' tile__check--ticked' : ''}`}
          role="checkbox"
          aria-checked={card.done}
          aria-label={card.done ? 'Marcar como nao concluido' : 'Marcar como concluido'}
          title={card.done ? 'Marcar como nao concluido' : 'Marcar como concluido'}
          onClick={(event) => {
            event.stopPropagation();
            if (preview) return;
            setTicked(!card.done);
            onToggleDone();
          }}
          onAnimationEnd={() => setTicked(false)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle className="tile__check-ring" cx="8" cy="8" r="6.75" />
            <circle className="tile__check-fill" cx="8" cy="8" r="7.5" />
            <path className="tile__check-mark" d="M4.8 8.2 7 10.4 11.2 6.1" />
          </svg>
        </span>
        <span className="tile__title">{card.title}</span>
      </span>

      {(card.description ||
        card.checklist.length > 0 ||
        card.due ||
        card.attachments.length > 0) && (
        <span className="tile__badges">
          {card.description && (
            <span className="tile__badge" title="Tem descricao">
              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M2 3h12M2 7h12M2 11h8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          )}
          {card.checklist.length > 0 && (
            <span
              className={`tile__badge${done === card.checklist.length ? ' tile__badge--done' : ''}`}
              title="Checklist"
            >
              {done}/{card.checklist.length}
            </span>
          )}
          {card.attachments.length > 0 && (
            <span className="tile__badge" title="Anexos">
              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M10.5 5 5.8 9.7a1.9 1.9 0 0 0 2.7 2.7l5-5a3.3 3.3 0 0 0-4.7-4.7l-5.2 5.2a4.7 4.7 0 0 0 6.6 6.6l2-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              {card.attachments.length}
            </span>
          )}
          {card.due && (
            <span className={`tile__badge tile__badge--due-${state}`} title="Prazo">
              {new Date(card.due).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
