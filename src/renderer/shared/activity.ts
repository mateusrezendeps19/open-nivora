import { messages, toLocale, type Messages } from './i18n';
import { id } from './id';
import type { Action } from './reducer';
import type { Activity, BoardDocument, Card, List } from './types';

/**
 * The card history the modal shows under "Comentarios e atividade".
 *
 * The reducer calls this with the document before and after an action, and it
 * appends a line for the changes worth remembering. The line is composed here,
 * once: a list renamed - or deleted - later must not rewrite what happened.
 *
 * It runs for the automation engine's actions too, because the engine applies
 * them through the same wrapped reducer. A card moved by a rule is as much a
 * part of its history as one moved by hand.
 */

function event(text: string): Activity {
  return { id: id('act'), kind: 'event', text, at: new Date().toISOString(), editedAt: null };
}

function activeBoardLists(doc: BoardDocument): List[] {
  return doc.boards.find((board) => board.id === doc.activeBoardId)?.lists ?? [];
}

function listOfCard(doc: BoardDocument, cardId: string): List | undefined {
  return activeBoardLists(doc).find((list) => list.cards.some((card) => card.id === cardId));
}

function cardById(doc: BoardDocument, cardId: string): Card | undefined {
  for (const list of activeBoardLists(doc)) {
    const card = list.cards.find((entry) => entry.id === cardId);
    if (card) return card;
  }
  return undefined;
}

function labelName(doc: BoardDocument, labelId: string, m: Messages): string {
  return doc.labels.find((label) => label.id === labelId)?.name ?? m.events.unknownLabel;
}

/** The due date as the card badge shows it. Intl output keeps its accents. */
function dayLabel(iso: string, doc: BoardDocument): string {
  return new Date(iso).toLocaleDateString(toLocale(doc.prefs.locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function allDone(card: Card): boolean {
  return card.checklist.every((item) => item.done);
}

function append(doc: BoardDocument, cardId: string, texts: string[]): BoardDocument {
  if (texts.length === 0) return doc;
  const entries = texts.map(event);
  return {
    ...doc,
    boards: doc.boards.map((board) => {
      if (board.id !== doc.activeBoardId) return board;
      return {
        ...board,
        lists: board.lists.map((list) => {
          if (!list.cards.some((card) => card.id === cardId)) return list;
          return {
            ...list,
            cards: list.cards.map((card) =>
              card.id === cardId ? { ...card, activity: [...card.activity, ...entries] } : card,
            ),
          };
        }),
      };
    }),
  };
}

/** One line on every card of a list, on any board - `append` only sees the active one. */
function appendToList(doc: BoardDocument, boardId: string, listId: string, text: string): BoardDocument {
  return {
    ...doc,
    boards: doc.boards.map((board) => {
      if (board.id !== boardId) return board;
      return {
        ...board,
        lists: board.lists.map((list) => {
          if (list.id !== listId) return list;
          return {
            ...list,
            cards: list.cards.map((card) => ({ ...card, activity: [...card.activity, event(text)] })),
          };
        }),
      };
    }),
  };
}

export function logActivity(
  prev: BoardDocument,
  next: BoardDocument,
  action: Action,
): BoardDocument {
  // Written in the language in use now, and left in it: like the titles it
  // quotes, a line of history is not recomposed when the setting changes.
  const m = messages(next.prefs.locale);
  const { events } = m;
  switch (action.type) {
    case 'card/add': {
      const list = activeBoardLists(next).find((entry) => entry.id === action.listId);
      if (!list) return next;
      const known = new Set(
        (activeBoardLists(prev).find((entry) => entry.id === action.listId)?.cards ?? []).map(
          (card) => card.id,
        ),
      );
      const added = list.cards.find((card) => !known.has(card.id));
      return added ? append(next, added.id, [events.added(list.title)]) : next;
    }

    case 'card/move': {
      // A move inside the same list is a reorder, not a step in the history.
      const from = listOfCard(prev, action.cardId);
      const to = listOfCard(next, action.cardId);
      if (!from || !to || from.id === to.id) return next;
      return append(next, action.cardId, [events.moved(from.title, to.title)]);
    }

    case 'card/update': {
      const before = cardById(prev, action.cardId);
      const after = cardById(next, action.cardId);
      if (!before || !after) return next;

      const texts: string[] = [];
      if (before.done !== after.done) {
        texts.push(after.done ? events.done : events.reopened);
      }
      if (before.due !== after.due) {
        texts.push(after.due ? events.dueSet(dayLabel(after.due, next)) : events.dueRemoved);
      }
      for (const labelId of after.labelIds) {
        if (!before.labelIds.includes(labelId)) {
          texts.push(events.labelAdded(labelName(next, labelId, m)));
        }
      }
      for (const labelId of before.labelIds) {
        if (!after.labelIds.includes(labelId)) {
          texts.push(events.labelRemoved(labelName(next, labelId, m)));
        }
      }
      return append(next, action.cardId, texts);
    }

    case 'card/archive':
    case 'card/restore': {
      const before = cardById(prev, action.cardId);
      const after = cardById(next, action.cardId);
      if (!before || !after || before.archivedAt === after.archivedAt) return next;
      return append(next, action.cardId, [
        after.archivedAt ? events.archived : events.restored,
      ]);
    }

    case 'card/attach':
      return append(
        next,
        action.cardId,
        action.attachments.map((attachment) => events.attached(attachment.name)),
      );

    case 'card/detach': {
      const before = cardById(prev, action.cardId);
      const gone = before?.attachments.find((a) => a.id === action.attachmentId);
      return gone ? append(next, action.cardId, [events.detached(gone.name)]) : next;
    }

    case 'checklist/add':
    case 'checklist/toggle':
    case 'checklist/remove': {
      // Only the moment the last item falls, which is the one worth a line.
      const before = cardById(prev, action.cardId);
      const after = cardById(next, action.cardId);
      if (!after || after.checklist.length === 0 || !allDone(after)) return next;
      if (before && before.checklist.length > 0 && allDone(before)) return next;
      return append(next, action.cardId, [events.checklistDone]);
    }

    case 'list/copy': {
      const original = activeBoardLists(prev).find((list) => list.id === action.listId);
      const known = new Set(activeBoardLists(prev).map((list) => list.id));
      const copy = activeBoardLists(next).find((list) => !known.has(list.id));
      if (!original || !copy) return next;
      if (!next.activeBoardId) return next;
      return appendToList(next, next.activeBoardId, copy.id, events.copied(original.title));
    }

    case 'list/transfer': {
      // To the same board it is a reorder of lists: nothing happened to a card.
      if (action.toBoardId === prev.activeBoardId) return next;
      const from = prev.boards.find((board) => board.id === prev.activeBoardId);
      const to = next.boards.find((board) => board.id === action.toBoardId);
      if (!from || !to?.lists.some((list) => list.id === action.listId)) return next;
      return appendToList(
        next,
        to.id,
        action.listId,
        events.listMoved(to.title, from.title),
      );
    }

    default:
      return next;
  }
}
