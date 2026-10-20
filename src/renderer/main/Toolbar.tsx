import { hasShell } from '../shared/bridge';
import './Toolbar.css';

interface ToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onToggleSidebar: () => void;
  onNewCard: () => void;
  onFind: () => void;
  onBackground: () => void;
  onAutomations: () => void;
  /** Enabled rules on the active board, shown as a badge. */
  automationCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Toolbar({
  query,
  onQueryChange,
  onToggleSidebar,
  onNewCard,
  onFind,
  onBackground,
  onAutomations,
  automationCount,
  theme,
  onToggleTheme,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button type="button" className="btn btn--subtle" onClick={onToggleSidebar} title="Quadros">
        Quadros
      </button>

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
        <button type="button" className="btn btn--subtle" onClick={onBackground}>
          Fundo
        </button>
        <button type="button" className="btn btn--subtle" onClick={onAutomations}>
          Automacoes
          {automationCount > 0 && <span className="toolbar__badge">{automationCount}</span>}
        </button>
        {hasShell() && (
          <>
            <button type="button" className="btn btn--subtle" onClick={onNewCard}>
              Novo cartao
            </button>
            <button type="button" className="btn btn--subtle" onClick={onFind}>
              Localizar
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn--subtle"
          onClick={onToggleTheme}
          title="Alternar tema"
        >
          {theme === 'dark' ? 'Claro' : 'Escuro'}
        </button>
      </div>
    </div>
  );
}
