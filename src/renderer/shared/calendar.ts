import type { Card, List } from './types';

/*
 * Date helpers behind the calendar view.
 *
 * Everything here works in local time. A due date is stored as an ISO string,
 * but the day a card belongs to is the day on the user's own clock: a card due
 * late in the evening in Sao Paulo must not jump to the next day just because
 * UTC has already rolled over.
 */

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Anchored on the first of the month, so stepping off the 31st never skips. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** `YYYY-MM-DD` in local time, used to bucket cards into days. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

/** Weeks start on Sunday, which is how a Brazilian calendar is laid out. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  return addDays(start, -start.getDay());
}

export function weekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/**
 * The month of `cursor` as whole weeks: the grid starts on the Sunday before
 * the 1st and ends on the Saturday after the last day, so it is 4 to 6 rows
 * rather than a fixed 6 with a blank one at the bottom.
 */
export function monthMatrix(cursor: Date): Date[][] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const end = addDays(startOfWeek(last), 6);

  const weeks: Date[][] = [];
  for (let day = startOfWeek(first); day <= end; day = addDays(day, 7)) {
    weeks.push(weekDays(day));
  }
  return weeks;
}

export function parseDue(iso: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The value an `<input type="date">` wants, read in local time. */
export function toDateInput(iso: string | null): string {
  const date = parseDue(iso);
  return date ? dateKey(date) : '';
}

/**
 * The reverse. `new Date('2026-10-20')` is parsed as UTC midnight, which lands
 * on the previous day for everyone west of Greenwich, so the parts are read by
 * hand and a local date is built from them. Any time of day already on the
 * card is kept.
 */
export function fromDateInput(value: string, previous: string | null = null): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const base = parseDue(previous);
  if (base) date.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return date.toISOString();
}

/** Moves a due date to another day, keeping its time. Used by calendar drops. */
export function moveDue(iso: string | null, day: Date): string {
  const next = startOfDay(day);
  const base = parseDue(iso);
  if (base) next.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
  return next.toISOString();
}

/**
 * How long ago something happened, for the card history.
 *
 * Only the first day is counted in words; past that the date itself says more
 * than "ha 23 dias". `now` is a parameter so the test does not depend on the
 * clock. A timestamp in the future - a document written by a machine whose
 * clock runs ahead - reads as "agora" rather than as a negative age.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = parseDue(iso);
  if (!date) return '';

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `ha ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours} h`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/* ------------------------------------------------------------------ *
 * Grouping
 * ------------------------------------------------------------------ */

export interface CalendarEntry {
  card: Card;
  list: List;
  due: Date;
}

export interface CalendarEntries {
  /** Cards with a due date, keyed by `dateKey` and sorted by time. */
  byDay: Map<string, CalendarEntry[]>;
  /** Cards with no due date, in board order. */
  undated: { card: Card; list: List }[];
  /** How many cards carry a due date, after filtering. */
  dated: number;
}

/**
 * `include` is the board filter (shared/filter.ts), so the calendar shows
 * the same cards the board does - not only those matching the keyword.
 */
export function groupByDay(
  lists: List[],
  include: (card: Card) => boolean = () => true,
): CalendarEntries {
  const byDay = new Map<string, CalendarEntry[]>();
  const undated: { card: Card; list: List }[] = [];
  let dated = 0;

  for (const list of lists) {
    for (const card of list.cards) {
      // Archived cards are off the board, and a date on one is not a plan.
      if (card.archivedAt) continue;
      if (!include(card)) continue;
      const due = parseDue(card.due);
      if (!due) {
        undated.push({ card, list });
        continue;
      }
      const key = dateKey(due);
      const bucket = byDay.get(key);
      if (bucket) bucket.push({ card, list, due });
      else byDay.set(key, [{ card, list, due }]);
      dated += 1;
    }
  }

  // Within a day, earlier first; cards sharing a time keep their board order.
  for (const bucket of byDay.values()) {
    bucket.sort((a, b) => a.due.getTime() - b.due.getTime());
  }

  return { byDay, undated, dated };
}
