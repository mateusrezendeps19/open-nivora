import { useRef, type ReactNode, type RefObject } from 'react';
import {
  EMPTY_FILTER,
  isFiltering,
  type ActivityWindow,
  type CardFilter,
  type DueWindow,
} from '../shared/filter';
import type { Label } from '../shared/types';
import { useDismiss } from './useDismiss';
import './FilterPanel.css';

interface FilterPanelProps {
  filter: CardFilter;
  labels: Label[];
  trigger: RefObject<HTMLElement | null>;
  onChange: (filter: CardFilter) => void;
  onClose: () => void;
}

const DUE: { id: DueWindow; label: string; tone: string }[] = [
  { id: 'none', label: 'Sem prazo', tone: 'none' },
  { id: 'overdue', label: 'Atrasado', tone: 'late' },
  { id: 'day', label: 'Vence no proximo dia', tone: 'soon' },
  { id: 'week', label: 'Vence na proxima semana', tone: 'later' },
  { id: 'month', label: 'Vence no proximo mes', tone: 'later' },
];

const ACTIVITY: { id: ActivityWindow; label: string }[] = [
  { id: 'week', label: 'Ativo na ultima semana' },
  { id: 'twoWeeks', label: 'Ativo nas ultimas duas semanas' },
  { id: 'fourWeeks', label: 'Ativo nas ultimas quatro semanas' },
  { id: 'stale', label: 'Sem atividade nas ultimas quatro semanas' },
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

  const set = (patch: Partial<CardFilter>) => onChange({ ...filter, ...patch });

  const option = (key: string, checked: boolean, onToggle: () => void, content: ReactNode) => (
    <label key={key} className="filter__option">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {content}
    </label>
  );

  return (
    <div className="filter" ref={panelRef} role="dialog" aria-label="Filtros">
      <header className="filter__head">
        <h3>Filtro</h3>
        <button type="button" className="filter__close" aria-label="Fechar" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <section className="filter__group">
        <label className="filter__title" htmlFor="filter-keyword">
          Palavra-chave
        </label>
        <input
          id="filter-keyword"
          className="field"
          type="search"
          value={filter.keyword}
          autoFocus
          placeholder="Digite uma palavra-chave..."
          onChange={(event) => set({ keyword: event.target.value })}
        />
        <p className="filter__hint">Procura no titulo e na descricao dos cartoes.</p>
      </section>

      <section className="filter__group">
        <h4 className="filter__title">Status do cartao</h4>
        {option('done', filter.done, () => set({ done: !filter.done }), 'Marcado como concluido')}
        {option('open', filter.open, () => set({ open: !filter.open }), 'Nao marcado como concluido')}
      </section>

      <section className="filter__group">
        <h4 className="filter__title">Data de entrega</h4>
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
              {entry.label}
            </>,
          ),
        )}
      </section>

      <section className="filter__group">
        <h4 className="filter__title">Etiquetas</h4>
        {option(
          'no-labels',
          filter.noLabels,
          () => set({ noLabels: !filter.noLabels }),
          <>
            <span className="filter__chip filter__chip--none" aria-hidden="true" />
            Sem etiquetas
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
        {/* "Qualquer correspondencia / Correspondencia exata" in Trello. */}
        <select
          className="field filter__match"
          aria-label="Como combinar as etiquetas"
          value={filter.labelMatch}
          disabled={filter.labels.length < 2}
          onChange={(event) => set({ labelMatch: event.target.value as CardFilter['labelMatch'] })}
        >
          <option value="any">Qualquer etiqueta marcada</option>
          <option value="all">Todas as etiquetas marcadas</option>
        </select>
      </section>

      <section className="filter__group">
        <h4 className="filter__title">Atividade</h4>
        {ACTIVITY.map((entry) =>
          option(
            entry.id,
            filter.activity === entry.id,
            // One at a time: the windows overlap, so two ticked would mean the wider.
            () => set({ activity: filter.activity === entry.id ? null : entry.id }),
            entry.label,
          ),
        )}
      </section>

      {isFiltering(filter) && (
        <button type="button" className="btn btn--subtle filter__clear" onClick={() => onChange(EMPTY_FILTER)}>
          Limpar filtros
        </button>
      )}
    </div>
  );
}
