import { useMemo, useState, type DragEvent } from 'react';
import { isFiltering, matchesFilter, type CardFilter } from '../shared/filter';
import {
  addDays,
  addMonths,
  dateKey,
  groupByDay,
  isSameDay,
  monthMatrix,
  moveDue,
  startOfDay,
  weekDays,
  type CalendarEntry,
} from '../shared/calendar';
import type { Locale } from '../shared/i18n';
import { useI18n } from '../shared/i18n/context';
import type { Action } from '../shared/reducer';
import type { Board, Card, Label, List } from '../shared/types';
import './Calendar.css';

type Granularity = 'month' | 'week';

/** Sunday first. Jan 7 2024 was a Sunday, so the week from it names them all. */
function weekdayNames(locale: Locale): string[] {
  return weekDays(new Date(2024, 0, 7)).map((day) =>
    day.toLocaleDateString(locale, { weekday: 'short' }).replace('.', ''),
  );
}

/** Where the undated panel registers itself as a drop target. */
const UNDATED_KEY = 'undated';

type Tone = 'done' | 'late' | 'today' | 'plain';

function toneOf(due: Date | null, done: boolean, today: Date): Tone {
  if (done) return 'done';
  if (!due) return 'plain';
  const day = startOfDay(due);
  if (day < today) return 'late';
  if (day.getTime() === today.getTime()) return 'today';
  return 'plain';
}

function findCard(lists: List[], cardId: string): Card | null {
  for (const list of lists) {
    const card = list.cards.find((c) => c.id === cardId);
    if (card) return card;
  }
  return null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "18 - 24 de out. de 2026", naming the month twice only when it changes. */
function weekTitle(days: Date[], locale: Locale): string {
  const [first] = days;
  const last = days[days.length - 1];
  const from = first.toLocaleDateString(
    locale,
    first.getMonth() === last.getMonth() ? { day: '2-digit' } : { day: '2-digit', month: 'short' },
  );
  const to = last.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${from} - ${to}`;
}

interface CalendarProps {
  board: Board;
  labels: Label[];
  filter: CardFilter;
  dispatch: (action: Action) => void;
  onOpenCard: (cardId: string) => void;
  /** Reported up so the floating button can offer itself as a trash. */
  onCardDragChange: (cardId: string | null) => void;
}

/**
 * The cards of the board laid out on the days they are due.
 *
 * Opens on the month, which is the view that answers "what is coming up"; the
 * week is a zoom-in on the same data. Dragging a card onto another day
 * reschedules it, and the panel on the right holds the cards with no date, so
 * they can be dragged onto the grid - or back, to clear the date again.
 */
export function Calendar({
  board,
  labels,
  filter,
  dispatch,
  onOpenCard,
  onCardDragChange,
}: CalendarProps) {
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const { m, locale } = useI18n();
  const t = m.calendar;
  const weekdays = useMemo(() => weekdayNames(locale), [locale]);

  const filtering = isFiltering(filter);
  const { byDay, undated, dated } = useMemo(
    () => groupByDay(board.lists, (card) => matchesFilter(card, filter)),
    [board.lists, filter],
  );

  const today = startOfDay(new Date());
  const weeks = useMemo(() => monthMatrix(cursor), [cursor]);
  const days = useMemo(() => weekDays(cursor), [cursor]);

  const title =
    granularity === 'month'
      ? capitalize(cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' }))
      : weekTitle(days, locale);

  function step(delta: number) {
    setCursor((current) =>
      granularity === 'month' ? addMonths(current, delta) : addDays(current, delta * 7),
    );
  }

  function changeGranularity(next: Granularity) {
    setGranularity(next);
    // Zooming into a week of the month on screen should land on today when
    // that is the month being looked at, rather than on its first week.
    const sameMonth =
      cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
    if (next === 'week' && sameMonth) setCursor(today);
  }

  function beginDrag(cardId: string) {
    setDragCardId(cardId);
    onCardDragChange(cardId);
  }

  function endDrag() {
    setDragCardId(null);
    setDropKey(null);
    onCardDragChange(null);
  }

  function allowDrop(event: DragEvent, key: string) {
    if (!dragCardId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropKey(key);
  }

  /** `day` is null for the undated panel, which clears the date instead. */
  function drop(day: Date | null) {
    const card = dragCardId ? findCard(board.lists, dragCardId) : null;
    if (card) {
      const due = day ? moveDue(card.due, day) : null;
      if (due !== card.due) dispatch({ type: 'card/update', cardId: card.id, patch: { due } });
    }
    endDrag();
  }

  function renderEntries(entries: CalendarEntry[], showTime: boolean) {
    return entries.map(({ card, list, due }) => (
      <CardChip
        key={card.id}
        card={card}
        list={list}
        labels={labels}
        tone={toneOf(due, card.done, today)}
        time={showTime ? due : null}
        dragging={dragCardId === card.id}
        onOpen={() => onOpenCard(card.id)}
        onDragStart={() => beginDrag(card.id)}
      />
    ));
  }

  function renderCell(day: Date, tall: boolean) {
    const key = dateKey(day);
    const entries = byDay.get(key) ?? [];
    const outside = !tall && day.getMonth() !== cursor.getMonth();

    return (
      <div
        key={key}
        className={
          'cell' +
          (tall ? ' cell--tall' : '') +
          (outside ? ' cell--outside' : '') +
          (isSameDay(day, today) ? ' cell--today' : '') +
          (dropKey === key ? ' cell--drop' : '')
        }
        onDragOver={(event) => allowDrop(event, key)}
        onDrop={() => drop(day)}
      >
        <div className="cell__head">
          <span className="cell__day">{day.getDate()}</span>
          {entries.length > 0 && <span className="cell__count">{entries.length}</span>}
        </div>
        <div className="cell__cards">
          {renderEntries(entries, tall)}
          {tall && entries.length === 0 && <span className="cell__empty">{t.noCards}</span>}
        </div>
      </div>
    );
  }

  return (
    <main className="calendar" onDragEnd={endDrag}>
      <header className="calendar__bar">
        <div className="calendar__nav">
          <button
            type="button"
            className="calendar__step"
            onClick={() => step(-1)}
            aria-label={granularity === 'month' ? t.prevMonth : t.prevWeek}
          >
            &lsaquo;
          </button>
          <button
            type="button"
            className="calendar__step"
            onClick={() => step(1)}
            aria-label={granularity === 'month' ? t.nextMonth : t.nextWeek}
          >
            &rsaquo;
          </button>
          <button type="button" className="btn btn--subtle" onClick={() => setCursor(today)}>
            {t.today}
          </button>
        </div>

        <h2 className="calendar__title">{title}</h2>

        <div className="calendar__right">
          <span className="calendar__count">
            {t.withDue(dated, filtering)}
          </span>
          <div className="calendar__modes" role="group" aria-label={t.modes}>
            {MODES.map((id) => (
              <button
                key={id}
                type="button"
                className={`calendar__mode${granularity === id ? ' calendar__mode--on' : ''}`}
                aria-pressed={granularity === id}
                onClick={() => changeGranularity(id)}
              >
                {t[id]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="calendar__body">
        <div className="calendar__grid">
          <div className="calendar__weekdays" aria-hidden="true">
            {weekdays.map((name) => (
              <span key={name} className="calendar__weekday">
                {name}
              </span>
            ))}
          </div>

          {granularity === 'month' ? (
            <div className="calendar__weeks">
              {weeks.map((week) => (
                <div key={dateKey(week[0])} className="calendar__week">
                  {week.map((day) => renderCell(day, false))}
                </div>
              ))}
            </div>
          ) : (
            <div className="calendar__week calendar__week--only">
              {days.map((day) => renderCell(day, true))}
            </div>
          )}
        </div>

        {panelOpen ? (
          <aside
            className={`undated${dropKey === UNDATED_KEY ? ' undated--drop' : ''}`}
            onDragOver={(event) => allowDrop(event, UNDATED_KEY)}
            onDrop={() => drop(null)}
          >
            <header className="undated__head">
              <h3 className="undated__title">{t.undated}</h3>
              <span className="undated__count">{undated.length}</span>
              <button
                type="button"
                className="undated__toggle"
                onClick={() => setPanelOpen(false)}
                aria-label={t.hideUndated}
              >
                &rsaquo;
              </button>
            </header>

            <div className="undated__cards">
              {undated.length === 0 ? (
                <p className="undated__empty">
                  {filtering ? t.undatedEmptyFiltered : t.undatedEmpty}
                </p>
              ) : (
                undated.map(({ card, list }) => (
                  <CardChip
                    key={card.id}
                    card={card}
                    list={list}
                    labels={labels}
                    tone={card.done ? 'done' : 'plain'}
                    time={null}
                    dragging={dragCardId === card.id}
                    onOpen={() => onOpenCard(card.id)}
                    onDragStart={() => beginDrag(card.id)}
                  />
                ))
              )}
            </div>

            <p className="undated__hint">{t.undatedHint}</p>
          </aside>
        ) : (
          <button
            type="button"
            className="undated__show"
            onClick={() => setPanelOpen(true)}
            aria-label={t.showUndated}
          >
            <span className="undated__show-label">{t.undated}</span>
            <span className="undated__count">{undated.length}</span>
          </button>
        )}
      </div>
    </main>
  );
}

const MODES: Granularity[] = ['month', 'week'];

interface CardChipProps {
  card: Card;
  list: List;
  labels: Label[];
  tone: Tone;
  /** Shown in the week view, where there is room for it. */
  time: Date | null;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
}

function CardChip({ card, list, labels, tone, time, dragging, onOpen, onDragStart }: CardChipProps) {
  const cardLabels = labels.filter((label) => card.labelIds.includes(label.id));
  const { locale } = useI18n();

  return (
    <button
      type="button"
      className={`chip chip--${tone}${dragging ? ' chip--dragging' : ''}`}
      draggable
      title={`${card.title}\n${list.title}`}
      onClick={onOpen}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.id);
        onDragStart();
      }}
    >
      {cardLabels.length > 0 && (
        <span className="chip__labels">
          {cardLabels.slice(0, 3).map((label) => (
            <span key={label.id} className="chip__label" style={{ background: label.color }} />
          ))}
        </span>
      )}

      <span className="chip__line">
        {time && (
          <span className="chip__time">
            {time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="chip__title">{card.title}</span>
      </span>

      {time && <span className="chip__list">{list.title}</span>}
    </button>
  );
}
