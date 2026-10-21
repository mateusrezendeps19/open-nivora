import { logActivity } from './activity';
import { runAutomations } from './automations';
import { emptyBoard, emptyCard, emptyList, seedDocument } from './document';
import { id } from './id';
import type {
  Attachment,
  Background,
  Board,
  BoardDocument,
  Card,
  Label,
  Prefs,
  Rule,
} from './types';

export type Action =
  | { type: 'replace'; doc: BoardDocument }
  | { type: 'board/add'; title: string; color: string }
  | { type: 'board/rename'; boardId: string; title: string }
  | { type: 'board/remove'; boardId: string }
  | { type: 'board/select'; boardId: string }
  | { type: 'board/background'; boardId: string; background: Background }
  | { type: 'list/add'; title: string }
  | { type: 'list/rename'; listId: string; title: string }
  | { type: 'list/remove'; listId: string }
  | { type: 'list/move'; listId: string; toIndex: number }
  | { type: 'card/add'; listId: string; title: string; atTop?: boolean }
  | { type: 'card/update'; cardId: string; patch: Partial<Card> }
  | { type: 'card/remove'; cardId: string }
  | { type: 'card/archive'; cardId: string }
  | { type: 'card/restore'; cardId: string }
  | { type: 'card/move'; cardId: string; toListId: string; toIndex: number }
  | { type: 'checklist/add'; cardId: string; text: string }
  | { type: 'checklist/toggle'; cardId: string; itemId: string }
  | { type: 'checklist/remove'; cardId: string; itemId: string }
  | { type: 'card/attach'; cardId: string; attachments: Attachment[] }
  | { type: 'card/detach'; cardId: string; attachmentId: string }
  | { type: 'card/cover'; cardId: string; attachmentId: string | null }
  | { type: 'comment/add'; cardId: string; text: string }
  | { type: 'comment/update'; cardId: string; activityId: string; text: string }
  | { type: 'comment/remove'; cardId: string; activityId: string }
  | { type: 'label/add'; name: string; color: string }
  | { type: 'label/update'; labelId: string; patch: Partial<Omit<Label, 'id'>> }
  | { type: 'rule/add'; rule: Rule }
  | { type: 'rule/update'; rule: Rule }
  | { type: 'rule/remove'; ruleId: string }
  | { type: 'rule/toggle'; ruleId: string }
  | { type: 'prefs/set'; patch: Partial<Prefs> };

/** Every case returns a new document; the board tree is never mutated in place. */
export function baseReducer(state: BoardDocument, action: Action): BoardDocument {
  switch (action.type) {
    case 'replace':
      return action.doc;

    case 'board/add': {
      const board = emptyBoard(action.title, action.color);
      return { ...state, boards: [...state.boards, board], activeBoardId: board.id };
    }

    case 'board/rename':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId ? { ...b, title: action.title } : b,
        ),
      };

    case 'board/remove': {
      const boards = state.boards.filter((b) => b.id !== action.boardId);
      if (boards.length === 0) return seedDocument();
      return {
        ...state,
        boards,
        activeBoardId: state.activeBoardId === action.boardId ? boards[0].id : state.activeBoardId,
      };
    }

    case 'board/select':
      return { ...state, activeBoardId: action.boardId };

    case 'board/background':
      return {
        ...state,
        boards: state.boards.map((b) =>
          b.id === action.boardId
            ? {
                ...b,
                background: action.background,
                // Solid colors keep `color` in step, so the chrome tint and
                // documents read by older versions stay consistent.
                color: action.background.kind === 'color' ? action.background.value : b.color,
              }
            : b,
        ),
      };

    case 'list/add':
      return mapActiveBoard(state, (board) => ({
        ...board,
        lists: [...board.lists, emptyList(action.title)],
      }));

    case 'list/rename':
      return mapActiveBoard(state, (board) => ({
        ...board,
        lists: board.lists.map((l) => (l.id === action.listId ? { ...l, title: action.title } : l)),
      }));

    case 'list/remove':
      return mapActiveBoard(state, (board) => ({
        ...board,
        lists: board.lists.filter((l) => l.id !== action.listId),
      }));

    case 'list/move':
      return mapActiveBoard(state, (board) => {
        const from = board.lists.findIndex((l) => l.id === action.listId);
        if (from === -1) return board;
        const lists = [...board.lists];
        const [moved] = lists.splice(from, 1);
        const to = Math.max(0, Math.min(action.toIndex, lists.length));
        lists.splice(to, 0, moved);
        return { ...board, lists };
      });

    case 'card/add':
      return mapActiveBoard(state, (board) => ({
        ...board,
        lists: board.lists.map((l) => {
          if (l.id !== action.listId) return l;
          const card = emptyCard(action.title);
          return { ...l, cards: action.atTop ? [card, ...l.cards] : [...l.cards, card] };
        }),
      }));

    case 'card/update':
      return mapActiveBoard(state, (board) => ({
        ...board,
        lists: board.lists.map((l) => ({
          ...l,
          cards: l.cards.map((c) => (c.id === action.cardId ? { ...c, ...action.patch } : c)),
        })),
      }));

    case 'card/remove':
      return mapActiveBoard(state, (board) => ({
        ...board,
        lists: board.lists.map((l) => ({
          ...l,
          cards: l.cards.filter((c) => c.id !== action.cardId),
        })),
      }));

    /*
     * Archiving is a flag, not a move: the card stays in its list at its own
     * index, so restoring it puts it back where it was. Every view that shows
     * cards filters `archivedAt` out.
     */
    case 'card/archive':
      return updateCard(state, action.cardId, (card) =>
        card.archivedAt ? card : { ...card, archivedAt: new Date().toISOString() },
      );

    case 'card/restore':
      return updateCard(state, action.cardId, (card) =>
        card.archivedAt ? { ...card, archivedAt: null } : card,
      );

    case 'card/move':
      return mapActiveBoard(state, (board) => {
        const source = board.lists.find((l) => l.cards.some((c) => c.id === action.cardId));
        const card = source?.cards.find((c) => c.id === action.cardId);
        if (!source || !card) return board;

        const sameList = source.id === action.toListId;
        const fromIndex = source.cards.findIndex((c) => c.id === action.cardId);

        // Pulling the card out first shifts every later index down by one, so a
        // same-list move to a later slot has to compensate.
        const target = sameList && action.toIndex > fromIndex ? action.toIndex - 1 : action.toIndex;

        return {
          ...board,
          lists: board.lists.map((l) => {
            let cards = l.id === source.id ? l.cards.filter((c) => c.id !== action.cardId) : l.cards;
            if (l.id === action.toListId) {
              cards = [...cards];
              cards.splice(Math.max(0, Math.min(target, cards.length)), 0, card);
            }
            return cards === l.cards ? l : { ...l, cards };
          }),
        };
      });

    case 'checklist/add':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        checklist: [...card.checklist, { id: id('chk'), text: action.text, done: false }],
      }));

    case 'checklist/toggle':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        checklist: card.checklist.map((item) =>
          item.id === action.itemId ? { ...item, done: !item.done } : item,
        ),
      }));

    case 'checklist/remove':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        checklist: card.checklist.filter((item) => item.id !== action.itemId),
      }));

    case 'card/attach':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        attachments: [...card.attachments, ...action.attachments],
        // First image attached becomes the cover, which is what Trello does.
        coverAttachmentId:
          card.coverAttachmentId ?? action.attachments.find((a) => a.isImage)?.id ?? null,
      }));

    case 'card/detach':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        attachments: card.attachments.filter((a) => a.id !== action.attachmentId),
        coverAttachmentId:
          card.coverAttachmentId === action.attachmentId ? null : card.coverAttachmentId,
      }));

    case 'card/cover':
      return updateCard(state, action.cardId, (card) => {
        if (action.attachmentId === null) return { ...card, coverAttachmentId: null };
        const attachment = card.attachments.find((a) => a.id === action.attachmentId);
        if (!attachment?.isImage) return card;
        return { ...card, coverAttachmentId: action.attachmentId };
      });

    case 'comment/add':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        activity: [
          ...card.activity,
          {
            id: id('cmt'),
            kind: 'comment',
            text: action.text,
            at: new Date().toISOString(),
            editedAt: null,
          },
        ],
      }));

    /*
     * Comments and events share one feed, so both edits guard on the kind: an
     * event is the record of what happened and is not the user's to rewrite.
     */
    case 'comment/update':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        activity: card.activity.map((entry) =>
          entry.id === action.activityId && entry.kind === 'comment'
            ? { ...entry, text: action.text, editedAt: new Date().toISOString() }
            : entry,
        ),
      }));

    case 'comment/remove':
      return updateCard(state, action.cardId, (card) => ({
        ...card,
        activity: card.activity.filter(
          (entry) => !(entry.id === action.activityId && entry.kind === 'comment'),
        ),
      }));

    // Labels belong to the document, not to a board: every board picks from
    // the same set, so these two cases do not go through mapActiveBoard.
    case 'label/add':
      return {
        ...state,
        labels: [...state.labels, { id: id('lbl'), name: action.name, color: action.color }],
      };

    case 'label/update':
      return {
        ...state,
        labels: state.labels.map((label) =>
          label.id === action.labelId ? { ...label, ...action.patch } : label,
        ),
      };

    case 'rule/add':
      return mapActiveBoard(state, (board) => ({
        ...board,
        automations: [...board.automations, action.rule],
      }));

    case 'rule/update':
      return mapActiveBoard(state, (board) => ({
        ...board,
        automations: board.automations.map((rule) =>
          rule.id === action.rule.id ? action.rule : rule,
        ),
      }));

    case 'rule/remove':
      return mapActiveBoard(state, (board) => ({
        ...board,
        automations: board.automations.filter((rule) => rule.id !== action.ruleId),
      }));

    case 'rule/toggle':
      return mapActiveBoard(state, (board) => ({
        ...board,
        automations: board.automations.map((rule) =>
          rule.id === action.ruleId ? { ...rule, enabled: !rule.enabled } : rule,
        ),
      }));

    case 'prefs/set':
      return { ...state, prefs: { ...state.prefs, ...action.patch } };

    default:
      return state;
  }
}

function mapActiveBoard(state: BoardDocument, fn: (board: Board) => Board): BoardDocument {
  return {
    ...state,
    boards: state.boards.map((b) => (b.id === state.activeBoardId ? fn(b) : b)),
  };
}

function updateCard(state: BoardDocument, cardId: string, fn: (card: Card) => Card): BoardDocument {
  return mapActiveBoard(state, (board) => ({
    ...board,
    lists: board.lists.map((l) => ({
      ...l,
      cards: l.cards.map((c) => (c.id === cardId ? fn(c) : c)),
    })),
  }));
}

/**
 * Applies an action and writes the card history line it deserves.
 *
 * The automation engine gets this one, not the plain reducer, so a card moved
 * or labelled by a rule is logged like any other change.
 */
function applyAndLog(state: BoardDocument, action: Action): BoardDocument {
  return logActivity(state, baseReducer(state, action), action);
}

/**
 * The reducer the app dispatches to: applies the action, logs it, then lets
 * the automation engine react to it.
 *
 * `replace` is excluded from both on purpose. It is how a document arrives
 * from disk or from another window, and re-running rules over a load would
 * fire them again on state they already produced - and logging it would write
 * the whole history a second time.
 */
export function reducer(state: BoardDocument, action: Action): BoardDocument {
  if (action.type === 'replace') return baseReducer(state, action);
  const next = applyAndLog(state, action);
  return runAutomations(state, next, action, applyAndLog);
}
