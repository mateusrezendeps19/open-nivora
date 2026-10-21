import { useState } from 'react';
import { BOARD_COLORS, type Board } from '../shared/types';
import { InlineTitle } from './InlineTitle';
import './Sidebar.css';

/** Cards on the board, which is what the sidebar counts: archived ones are off it. */
function countCards(board: Board): number {
  let total = 0;
  for (const list of board.lists) {
    for (const card of list.cards) if (!card.archivedAt) total += 1;
  }
  return total;
}

interface SidebarProps {
  boards: Board[];
  activeBoardId: string;
  collapsed: boolean;
  /** Archived cards on the active board; the entry is hidden when there are none. */
  archivedCount: number;
  onToggle: () => void;
  onOpenArchive: () => void;
  onSelect: (boardId: string) => void;
  onAdd: (title: string, color: string) => void;
  onRename: (boardId: string, title: string) => void;
  onRemove: (boardId: string) => void;
}

export function Sidebar({
  boards,
  activeBoardId,
  collapsed,
  archivedCount,
  onToggle,
  onOpenArchive,
  onSelect,
  onAdd,
  onRename,
  onRemove,
}: SidebarProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string>(BOARD_COLORS[0]);

  function submit() {
    const next = title.trim();
    if (!next) return;
    onAdd(next, color);
    setTitle('');
    setAdding(false);
  }

  /**
   * Collapsed, the sidebar keeps the one thing it is for - switching boards -
   * as a rail of colored tiles, so the board can have the width back without
   * the list disappearing entirely.
   */
  if (collapsed) {
    return (
      <aside className="sidebar sidebar--collapsed">
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label="Expandir a barra lateral"
          aria-expanded={false}
          title="Expandir"
        >
          &rsaquo;
        </button>

        <ul className="sidebar__rail">
          {boards.map((board) => (
            <li key={board.id}>
              <button
                type="button"
                className={`sidebar__tile${
                  board.id === activeBoardId ? ' sidebar__tile--active' : ''
                }`}
                style={{ background: board.color }}
                onClick={() => onSelect(board.id)}
                title={board.title}
                aria-label={`Abrir ${board.title}`}
                aria-current={board.id === activeBoardId}
              >
                {board.title.trim().charAt(0).toUpperCase() || '?'}
              </button>
            </li>
          ))}
        </ul>

        {archivedCount > 0 && (
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onOpenArchive}
            aria-label={`Arquivados (${archivedCount})`}
            title={`Arquivados (${archivedCount})`}
          >
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2.2 3.4h11.6v2.4H2.2zM3.2 5.8h9.6v6.1a.9.9 0 0 1-.9.9H4.1a.9.9 0 0 1-.9-.9z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M6.4 8.5h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          </button>
        )}

        <button
          type="button"
          className="sidebar__toggle"
          onClick={() => {
            onToggle();
            setAdding(true);
          }}
          aria-label="Criar quadro"
          title="Criar quadro"
        >
          +
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <h2 className="sidebar__heading">Seus quadros</h2>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onToggle}
          aria-label="Recolher a barra lateral"
          aria-expanded
          title="Recolher"
        >
          &lsaquo;
        </button>
      </div>

      <ul className="sidebar__list">
        {boards.map((board) => (
          <li
            key={board.id}
            className={`sidebar__item${board.id === activeBoardId ? ' sidebar__item--active' : ''}`}
          >
            <button
              type="button"
              className="sidebar__swatch"
              style={{ background: board.color }}
              onClick={() => onSelect(board.id)}
              aria-label={`Abrir ${board.title}`}
            />
            {board.id === activeBoardId ? (
              <InlineTitle
                value={board.title}
                className="sidebar__name"
                ariaLabel="Renomear quadro"
                onCommit={(next) => onRename(board.id, next)}
              />
            ) : (
              <button type="button" className="sidebar__name" onClick={() => onSelect(board.id)}>
                {board.title}
              </button>
            )}
            <span className="sidebar__meta">{countCards(board)}</span>
            {boards.length > 1 && (
              <button
                type="button"
                className="sidebar__remove"
                aria-label={`Excluir ${board.title}`}
                onClick={() => onRemove(board.id)}
              >
                x
              </button>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="sidebar__add">
          <input
            className="field"
            autoFocus
            value={title}
            placeholder="Nome do quadro"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
              if (event.key === 'Escape') setAdding(false);
            }}
          />
          <div className="sidebar__colors">
            {BOARD_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={`sidebar__color${option === color ? ' sidebar__color--on' : ''}`}
                style={{ background: option }}
                aria-label={`Cor ${option}`}
                onClick={() => setColor(option)}
              />
            ))}
          </div>
          <div className="sidebar__add-actions">
            <button type="button" className="btn btn--primary" onClick={submit}>
              Criar
            </button>
            <button type="button" className="btn btn--subtle" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="sidebar__new" onClick={() => setAdding(true)}>
          + Criar quadro
        </button>
      )}

      {archivedCount > 0 && (
        <button type="button" className="sidebar__archive" onClick={onOpenArchive}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M2.2 3.4h11.6v2.4H2.2zM3.2 5.8h9.6v6.1a.9.9 0 0 1-.9.9H4.1a.9.9 0 0 1-.9-.9z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path d="M6.4 8.5h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Arquivados
          <span className="sidebar__meta">{archivedCount}</span>
        </button>
      )}
    </aside>
  );
}
