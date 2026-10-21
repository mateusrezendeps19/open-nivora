import type { Card } from './types';

/**
 * The board filter, as Trello's Filtros popover has it.
 *
 * Within a group the options add up - Atrasado and Vence na proxima semana
 * shows both - and between groups they narrow - a label AND a due date. A
 * group with nothing ticked does not filter at all. That is Trello's rule, and
 * the only one under which ticking a second box never hides a card the first
 * one showed.
 *
 * Trello's Membros group is not here: this app has no members.
 */

export type DueWindow = 'none' | 'overdue' | 'day' | 'week' | 'month';
export type ActivityWindow = 'week' | 'twoWeeks' | 'fourWeeks' | 'stale';

export interface CardFilter {
  /** Matched against the title and the description, ignoring case. */
  keyword: string;
  /** Marcado como concluido. */
  done: boolean;
  /** Nao marcado como concluido. */
  open: boolean;
  due: DueWindow[];
  /** Sem etiquetas. */
  noLabels: boolean;
  labels: string[];
  /** Whether a card needs any of the ticked labels or all of them. */
  labelMatch: 'any' | 'all';
  /** One choice, as in Trello: the windows overlap, so ticking two says nothing. */
  activity: ActivityWindow | null;
}

export const EMPTY_FILTER: CardFilter = {
  keyword: '',
  done: false,
  open: false,
  due: [],
  noLabels: false,
  labels: [],
  labelMatch: 'any',
  activity: null,
};

const DAY = 24 * 60 * 60 * 1000;

/** How many choices are ticked, for the count on the Filtros button. */
export function activeFilterCount(filter: CardFilter): number {
  return (
    (filter.keyword.trim() ? 1 : 0) +
    (filter.done ? 1 : 0) +
    (filter.open ? 1 : 0) +
    filter.due.length +
    (filter.noLabels ? 1 : 0) +
    filter.labels.length +
    (filter.activity ? 1 : 0)
  );
}

/**
 * The filter without labels that no longer exist. A deleted label left ticked
 * would still count on the button and hide every card, with no box anywhere
 * to untick. Returns the same object when there is nothing to drop.
 */
export function withLabels(filter: CardFilter, labelIds: string[]): CardFilter {
  const labels = filter.labels.filter((id) => labelIds.includes(id));
  return labels.length === filter.labels.length ? filter : { ...filter, labels };
}

export function isFiltering(filter: CardFilter): boolean {
  return activeFilterCount(filter) > 0;
}

/** The last time anything happened to the card: a comment, an event, its creation. */
export function lastActivity(card: Card): number {
  let latest = Date.parse(card.createdAt) || 0;
  for (const entry of card.activity) {
    const at = Date.parse(entry.at);
    if (at > latest) latest = at;
  }
  return latest;
}

function matchesDue(card: Card, window: DueWindow, now: number): boolean {
  if (window === 'none') return !card.due;
  if (!card.due) return false;
  const due = Date.parse(card.due);
  if (Number.isNaN(due)) return false;
  // A finished card is not late, whatever its date says.
  if (window === 'overdue') return due < now && !card.done;
  // The windows look forward from now and do not include what is already late.
  const span = window === 'day' ? DAY : window === 'week' ? 7 * DAY : 30 * DAY;
  return due >= now && due <= now + span;
}

function matchesActivity(card: Card, window: ActivityWindow, now: number): boolean {
  const age = now - lastActivity(card);
  switch (window) {
    case 'week':
      return age <= 7 * DAY;
    case 'twoWeeks':
      return age <= 14 * DAY;
    case 'fourWeeks':
      return age <= 28 * DAY;
    case 'stale':
      return age > 28 * DAY;
  }
}

/** Archived cards are not the filter's business; callers leave them out first. */
export function matchesFilter(card: Card, filter: CardFilter, now: number = Date.now()): boolean {
  const needle = filter.keyword.trim().toLowerCase();
  if (
    needle &&
    !card.title.toLowerCase().includes(needle) &&
    !card.description.toLowerCase().includes(needle)
  ) {
    return false;
  }

  // Both ticked is every card, the same as neither.
  if (filter.done !== filter.open && card.done !== filter.done) return false;

  if (filter.due.length && !filter.due.some((window) => matchesDue(card, window, now))) {
    return false;
  }

  if (filter.noLabels || filter.labels.length) {
    const bare = filter.noLabels && card.labelIds.length === 0;
    const has = (id: string) => card.labelIds.includes(id);
    const labelled =
      filter.labels.length > 0 &&
      (filter.labelMatch === 'all' ? filter.labels.every(has) : filter.labels.some(has));
    if (!bare && !labelled) return false;
  }

  if (filter.activity && !matchesActivity(card, filter.activity, now)) return false;

  return true;
}

/** What the board draws: off the board when archived, and through the filter. */
export function isShown(card: Card, filter: CardFilter, now: number = Date.now()): boolean {
  return !card.archivedAt && matchesFilter(card, filter, now);
}
