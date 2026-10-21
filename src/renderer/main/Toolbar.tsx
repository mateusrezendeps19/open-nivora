import { hasShell } from '../shared/bridge';
import type { AppView } from '../shared/types';
import './Toolbar.css';

const VIEWS: { id: AppView; label: string }[] = [
  { id: 'board', label: 'Quadro' },
  { id: 'calendar', label: 'Calendario' },
];

interface ToolbarProps {
  query: string;
  view: AppView;
  onQueryChange: (value: string) => void;
  onViewChange: (view: AppView) => void;
  onFind: () => void;
  onSettings: () => void;
}

/*
 * No control for the sidebar here: the sidebar collapses and expands from its
 * own chevron, and keeps a rail of board tiles when collapsed, so a second
 * toggle in the title bar only duplicated it.
 */
export function Toolbar({
  query,
  view,
  onQueryChange,
  onViewChange,
  onFind,
  onSettings,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar__views" role="group" aria-label="Visao">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`toolbar__view${view === entry.id ? ' toolbar__view--on' : ''}`}
            aria-pressed={view === entry.id}
            onClick={() => onViewChange(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <label className="toolbar__search">
        <span className="toolbar__search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16">
            <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.5 10.5 L15 15" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          placeholder="Filtrar cartoes  (Ctrl+K)"
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label="Filtrar cartoes"
        />
        {query && (
          <button
            type="button"
            className="toolbar__clear"
            onClick={() => onQueryChange('')}
            aria-label="Limpar filtro"
          >
            x
          </button>
        )}
      </label>

      <div className="toolbar__actions">
        {hasShell() && (
          <button type="button" className="btn btn--subtle" onClick={onFind}>
            Localizar
          </button>
        )}
        <button type="button" className="btn btn--subtle" onClick={onSettings}>
          Configuracoes
        </button>
      </div>
    </div>
  );
}
