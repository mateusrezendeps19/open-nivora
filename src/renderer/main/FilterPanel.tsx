import { useRef, type ReactNode, type RefObject } from 'react';
import {
  EMPTY_FILTER,
  isFiltering,
  type ActivityWindow,
  type CardFilter,
  type DueWindow,
} from '../shared/filter';
import type { Messages } from '../shared/i18n';
import type { Label } from '../shared/types';
import { useI18n } from '../shared/i18n/context';
import { useDismiss } from './useDismiss';
import './FilterPanel.css';

interface FilterPanelProps {
  filter: CardFilter;
  labels: Label[];
  trigger: RefObject<HTMLElement | null>;
  onChange: (filter: CardFilter) => void;
  onClose: () => void;
}

type FilterMessages = Messages['filter'];

const DUE: { id: DueWindow; label: keyof FilterMessages; tone: string }[] = [
  { id: 'none', label: 'dueNone', tone: 'none' },
  { id: 'overdue', label: 'dueOverdue', tone: 'late' },
  { id: 'day', label: 'dueDay', tone: 'soon' },
  { id: 'week', label: 'dueWeek', tone: 'later' },
  { id: 'month', label: 'dueMonth', tone: 'later' },
];

const ACTIVITY: { id: ActivityWindow; label: keyof FilterMessages }[] = [
  { id: 'week', label: 'activityWeek' },
  { id: 'twoWeeks', label: 'activityTwoWeeks' },
  { id: 'fourWeeks', label: 'activityFourWeeks' },
  { id: 'stale', label: 'activityStale' },
];

const MATCH: { id: CardFilter['labelMatch']; label: keyof FilterMessages }[] = [
  { id: 'any', label: 'matchAny' },
  { id: 'all', label: 'matchAll' },
];

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

/**
 * The popover behind the Filtros button, laid out as Trello's: keyword, card
 * status, due date, labels and activity, each a group of boxes. The semantics
 * - boxes in a group add up, groups narrow each other - are in
 * shared/filter.ts, where they are tested.
 *
 * Every box applies at once, as in Trello; there is no Aplicar. The board
 * behind it is the preview.
 */
export function FilterPanel({ filter, labels, trigger, onChange, onClose }: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(panelRef, trigger, onClose);
  const { m } = useI18n();
  const t = m.filter;

  const set = (patch: Partial<CardFilter>) => onChange({ ...filter, ...patch });

  const option = (key: string, checked: boolean, onToggle: () => void, content: ReactNode) => (
    <label key={key} className="filter__option">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {content}
    </label>
  );

  return (
    <div className="filter" ref={panelRef} role="dialog" aria-label={m.toolbar.filters}>
      <header className="filter__head">
        <h3>{t.heading}</h3>
        <button type="button" className="filter__close" aria-label={m.common.close} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="filter__body">
        <section className="filter__group">
          <label className="filter__title" htmlFor="filter-keyword">
            {t.keyword}
          </label>
          <input
            id="filter-keyword"
            className="field"
            type="search"
            value={filter.keyword}
            autoFocus
            placeholder={t.keywordPlaceholder}
            onChange={(event) => set({ keyword: event.target.value })}
          />
          <p className="filter__hint">{t.keywordHint}</p>
        </section>

        <section className="filter__group">
          <h4 className="filter__title">{t.status}</h4>
          {option('done', filter.done, () => set({ done: !filter.done }), t.done)}
          {option('open', filter.open, () => set({ open: !filter.open }), t.open)}
        </section>

        <section className="filter__group">
          <h4 className="filter__title">{t.due}</h4>
          {DUE.map((entry) =>
            option(
              entry.id,
              filter.due.includes(entry.id),
              () => set({ due: toggle(filter.due, entry.id) }),
              <>
                <span className={`filter__due filter__due--${entry.tone}`} aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 4.8V8l2.2 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                {t[entry.label]}
              </>,
            ),
          )}
        </section>

        <section className="filter__group">
          <h4 className="filter__title">{t.labels}</h4>
          {option(
            'no-labels',
            filter.noLabels,
            () => set({ noLabels: !filter.noLabels }),
            <>
              <span className="filter__chip filter__chip--none" aria-hidden="true" />
              {t.noLabels}
            </>,
          )}
          {labels.map((label) =>
            option(
              label.id,
              filter.labels.includes(label.id),
              () => set({ labels: toggle(filter.labels, label.id) }),
              <span className="filter__chip" style={{ background: label.color }} title={label.name}>
                {label.name}
              </span>,
            ),
          )}
          {/*
            "Qualquer correspondencia / Correspondencia exata" in Trello. Two
            buttons and not a select: the select was disabled until two labels
            were ticked, and read as a dropdown that would not open. Both
            choices are always there, and the one in force is lit.
          */}
          <div className="filter__match" role="radiogroup" aria-label={t.matchGroup}>
            <span className="filter__match-label">{t.matchLead}</span>
            {MATCH.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={filter.labelMatch === entry.id}
                className={`filter__match-btn${filter.labelMatch === entry.id ? ' filter__match-btn--on' : ''}`}
                onClick={() => set({ labelMatch: entry.id })}
              >
                {t[entry.label]}
              </button>
            ))}
          </div>
        </section>

        <section className="filter__group">
          <h4 className="filter__title">{t.activity}</h4>
          {ACTIVITY.map((entry) =>
            option(
              entry.id,
              filter.activity === entry.id,
              // One at a time: the windows overlap, so two ticked would mean the wider.
              () => set({ activity: filter.activity === entry.id ? null : entry.id }),
              t[entry.label],
            ),
          )}
        </section>

      </div>

      {/*
        Out of the scrolling body so it is always in reach, and always there:
        at the bottom of the list and only while filtering, it was a button
        nobody saw.
      */}
      <footer className="filter__foot">
        <button
          type="button"
          className="btn btn--subtle filter__clear"
          disabled={!isFiltering(filter)}
          onClick={() => onChange(EMPTY_FILTER)}
        >
          {m.common.clearFilters}
        </button>
      </footer>
    </div>
  );
}
