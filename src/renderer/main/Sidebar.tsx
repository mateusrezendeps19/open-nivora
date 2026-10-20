import { useState } from 'react';
import { BOARD_COLORS, type Board } from '../shared/types';
import { InlineTitle } from './InlineTitle';
import './Sidebar.css';

interface SidebarProps {
  boards: Board[];
  activeBoardId: string;
  onSelect: (boardId: string) => void;
  onAdd: (title: string, color: string) => void;
  onRename: (boardId: string, title: string) => void;
  onRemove: (boardId: string) => void;
}

export function Sidebar({
  boards,
  activeBoardId,
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

  return (
    <aside className="sidebar">
      <h2 className="sidebar__heading">Seus quadros</h2>

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
            <span className="sidebar__meta">
              {board.lists.reduce((total, list) => total + list.cards.length, 0)}
            </span>
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
    </aside>
  );
}
