import { useCallback, useRef, useState } from 'react';
import { hasShell } from '../shared/bridge';
import { activeFilterCount, type CardFilter } from '../shared/filter';
import type { AppView, Label } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import { FilterPanel } from './FilterPanel';
import './Toolbar.css';

const VIEWS: AppView[] = ['board', 'calendar'];

interface ToolbarProps {
  filter: CardFilter;
  labels: Label[];
  view: AppView;
  onQueryChange: (value: string) => void;
  onFilterChange: (filter: CardFilter) => void;
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
  filter,
  labels,
  view,
  onQueryChange,
  onFilterChange,
  onViewChange,
  onFind,
  onSettings,
}: ToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const { m } = useI18n();
  const filterButton = useRef<HTMLButtonElement>(null);
  const closeFilter = useCallback(() => setFilterOpen(false), []);
  const query = filter.keyword;
  const active = activeFilterCount(filter);

  return (
    <div className="toolbar">
      <div className="toolbar__views" role="group" aria-label={m.toolbar.views}>
        {VIEWS.map((id) => (
          <button
            key={id}
            type="button"
            className={`toolbar__view${view === id ? ' toolbar__view--on' : ''}`}
            aria-pressed={view === id}
            onClick={() => onViewChange(id)}
          >
            {m.toolbar[id]}
          </button>
        ))}
      </div>

      {/*
        Search and Filtros are one centred group, as in Trello's header: they
        are what the board is looked at through, so they sit over its middle.
      */}
      <div className="toolbar__center">
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
            placeholder={m.toolbar.searchPlaceholder}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label={m.toolbar.searchLabel}
          />
          {query && (
            <button
              type="button"
              className="toolbar__clear"
              onClick={() => onQueryChange('')}
              aria-label={m.toolbar.clearSearch}
            >
              x
            </button>
          )}
        </label>

        {/*
          Trello's Filtros button. The search box beside it is the same keyword:
          typing in either shows in both. No Limpar beside it: the banner over
          the board and the popover both have one, and a button that comes and
          goes here changed the group's width, so the centred search jumped.
        */}
        <div className="toolbar__filter">
          <button
            ref={filterButton}
            type="button"
            className={`toolbar__filter-btn${active ? ' toolbar__filter-btn--on' : ''}`}
            aria-expanded={filterOpen}
            aria-label={active ? m.toolbar.filtersActive(active) : m.toolbar.filters}
            onClick={() => setFilterOpen((open) => !open)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 3.5h12l-4.6 5.4v4.1l-2.8 1.4V8.9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {m.toolbar.filters}
            {active > 0 && <span className="toolbar__filter-count">{active}</span>}
          </button>
          {filterOpen && (
            <FilterPanel
              filter={filter}
              labels={labels}
              trigger={filterButton}
              onChange={onFilterChange}
              onClose={closeFilter}
            />
          )}
        </div>
      </div>

      <div className="toolbar__actions">
        {hasShell() && (
          <button type="button" className="btn btn--subtle" onClick={onFind}>
            {m.toolbar.find}
          </button>
        )}
        <button type="button" className="btn btn--subtle" onClick={onSettings}>
          {m.toolbar.settings}
        </button>
      </div>
    </div>
  );
}
