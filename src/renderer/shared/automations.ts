import type { Action } from './reducer';
import type { Board, BoardDocument, Card, Rule, RuleAction, TriggerType } from './types';

/**
 * Rule engine, in the spirit of Trello's Butler but deliberately smaller.
 *
 * It runs inside the reducer: after a user action is applied, the engine
 * derives the events that action caused, finds the enabled rules on the active
 * board that match, and feeds their actions back through the reducer.
 *
 * Loops are the obvious hazard here (a rule that moves a card to a list whose
 * rule moves it back). Two guards, both necessary:
 *   - MAX_PASSES caps how deep chaining goes.
 *   - a rule may fire at most once per card per dispatch, tracked in `fired`.
 * The second is what makes termination unconditional: the pairs only ever grow,
 * so a cycle runs out of fresh pairs and stops.
 */

const MAX_PASSES = 3;

interface AutomationEvent {
  type: TriggerType;
  cardId: string;
  listId?: string;
  labelId?: string;
}

/** Events the engine understands, derived from what actually changed. */
export function eventsFor(
  prev: BoardDocument,
  next: BoardDocument,
  action: Action,
): AutomationEvent[] {
  const board = activeBoard(next);
  if (!board) return [];

  switch (action.type) {
    case 'card/add': {
      const before = findList(activeBoard(prev), action.listId);
      const after = findList(board, action.listId);
      if (!after) return [];
      const known = new Set((before?.cards ?? []).map((card) => card.id));
      const added = after.cards.find((card) => !known.has(card.id));
      return added ? [{ type: 'card-added', cardId: added.id, listId: action.listId }] : [];
    }

    case 'card/move': {
      // A move inside the same list is a reorder, not an arrival.
      const from = listOfCard(activeBoard(prev), action.cardId);
      if (from?.id === action.toListId) return [];
      return [{ type: 'card-moved', cardId: action.cardId, listId: action.toListId }];
    }

    case 'card/update': {
      if (!action.patch.labelIds) return [];
      const before = cardById(activeBoard(prev), action.cardId);
      const after = cardById(board, action.cardId);
      if (!before || !after) return [];
      const had = new Set(before.labelIds);
      return after.labelIds
        .filter((labelId) => !had.has(labelId))
        .map((labelId) => ({ type: 'label-added' as const, cardId: action.cardId, labelId }));
    }

    case 'checklist/toggle':
    case 'checklist/add':
    case 'checklist/remove': {
      const before = cardById(activeBoard(prev), action.cardId);
      const after = cardById(board, action.cardId);
      if (!after || after.checklist.length === 0) return [];
      const wasComplete = !!before && before.checklist.length > 0 && allDone(before);
      if (wasComplete || !allDone(after)) return [];
      return [{ type: 'checklist-completed', cardId: action.cardId }];
    }

    default:
      return [];
  }
}

function matches(rule: Rule, event: AutomationEvent): boolean {
  if (!rule.enabled || rule.trigger.type !== event.type) return false;

  switch (event.type) {
    case 'card-added':
    case 'card-moved':
      // A null list on the trigger means any list.
      return !rule.trigger.listId || rule.trigger.listId === event.listId;
    case 'label-added':
      return !rule.trigger.labelId || rule.trigger.labelId === event.labelId;
    case 'checklist-completed':
      return true;
    default:
      return false;
  }
}

/** Translates one rule action into reducer actions for a given card. */
function expand(action: RuleAction, card: Card, board: Board): Action[] {
  switch (action.type) {
    case 'move-to-list': {
      if (!action.listId) return [];
      const target = board.lists.find((list) => list.id === action.listId);
      if (!target) return [];
      // Already there: emitting a move would be a no-op that still counts as a
      // pass, so skip it.
      const current = listOfCard(board, card.id);
      if (current?.id === target.id) return [];
      return [{ type: 'card/move', cardId: card.id, toListId: target.id, toIndex: 0 }];
    }

    case 'add-label': {
      if (!action.labelId || card.labelIds.includes(action.labelId)) return [];
      return [
        {
          type: 'card/update',
          cardId: card.id,
          patch: { labelIds: [...card.labelIds, action.labelId] },
        },
      ];
    }

    case 'remove-label': {
      if (!action.labelId || !card.labelIds.includes(action.labelId)) return [];
      return [
        {
          type: 'card/update',
          cardId: card.id,
          patch: { labelIds: card.labelIds.filter((id) => id !== action.labelId) },
        },
      ];
    }

    case 'set-due': {
      const days = action.days ?? 0;
      const due = new Date();
      due.setDate(due.getDate() + days);
      return [{ type: 'card/update', cardId: card.id, patch: { due: due.toISOString() } }];
    }

    case 'clear-due':
      if (card.due === null) return [];
      return [{ type: 'card/update', cardId: card.id, patch: { due: null } }];

    case 'add-checklist-item': {
      const text = action.text?.trim();
      if (!text) return [];
      return [{ type: 'checklist/add', cardId: card.id, text }];
    }

    case 'mark-card-done':
      if (card.done) return [];
      return [{ type: 'card/update', cardId: card.id, patch: { done: true } }];

    case 'mark-card-undone':
      if (!card.done) return [];
      return [{ type: 'card/update', cardId: card.id, patch: { done: false } }];

    case 'mark-checklist-done': {
      const pending = card.checklist.filter((item) => !item.done);
      if (pending.length === 0) return [];
      return pending.map((item) => ({
        type: 'checklist/toggle' as const,
        cardId: card.id,
        itemId: item.id,
      }));
    }

    default:
      return [];
  }
}

/**
 * Runs the rules triggered by `action` and returns the resulting document.
 *
 * `apply` is the plain reducer, passed in so this module does not import it and
 * create a cycle.
 */
export function runAutomations(
  prev: BoardDocument,
  next: BoardDocument,
  action: Action,
  apply: (state: BoardDocument, action: Action) => BoardDocument,
): BoardDocument {
  if (!next.prefs.automationsEnabled) return next;

  const board = activeBoard(next);
  if (!board || board.automations.length === 0) return next;

  const fired = new Set<string>();
  let current = next;
  let pending = eventsFor(prev, current, action);
  let pass = 0;

  while (pending.length > 0 && pass < MAX_PASSES) {
    pass += 1;
    // Events caused by this pass, which the next pass reacts to.
    const produced: AutomationEvent[] = [];

    for (const event of pending) {
      for (const rule of activeBoard(current)?.automations ?? []) {
        if (!matches(rule, event)) continue;

        const key = `${rule.id}:${event.cardId}`;
        if (fired.has(key)) continue;
        fired.add(key);

        for (const ruleAction of rule.actions) {
          const board = activeBoard(current);
          // Re-read between actions: add-label followed by mark-checklist-done
          // must see what the previous action left behind. The card may also
          // have been moved or deleted by an earlier rule.
          const live = board ? cardById(board, event.cardId) : undefined;
          if (!board || !live) break;

          for (const derived of expand(ruleAction, live, board)) {
            const stateBefore = current;
            current = apply(current, derived);
            // Derive each event against the exact pair of states around its
            // own action, not against whatever the last one left.
            produced.push(...eventsFor(stateBefore, current, derived));
          }
        }
      }
    }

    pending = produced;
  }

  return current;
}

/* helpers */

function activeBoard(doc: BoardDocument): Board | undefined {
  return doc.boards.find((board) => board.id === doc.activeBoardId) ?? doc.boards[0];
}

function findList(board: Board | undefined, listId: string) {
  return board?.lists.find((list) => list.id === listId);
}

function listOfCard(board: Board | undefined, cardId: string) {
  return board?.lists.find((list) => list.cards.some((card) => card.id === cardId));
}

function cardById(board: Board | undefined, cardId: string): Card | undefined {
  if (!board) return undefined;
  for (const list of board.lists) {
    const card = list.cards.find((candidate) => candidate.id === cardId);
    if (card) return card;
  }
  return undefined;
}

function allDone(card: Card): boolean {
  return card.checklist.every((item) => item.done);
}
