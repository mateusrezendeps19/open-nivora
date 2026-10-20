import { emptyBoard, emptyCard, emptyList, seedDocument } from './document';
import { id } from './id';
import type { Board, BoardDocument, Card, Prefs } from './types';

export type Action =
  | { type: 'replace'; doc: BoardDocument }
  | { type: 'board/add'; title: string; color: string }
  | { type: 'board/rename'; boardId: string; title: string }
  | { type: 'board/remove'; boardId: string }
  | { type: 'board/select'; boardId: string }
  | { type: 'list/add'; title: string }
  | { type: 'list/rename'; listId: string; title: string }
  | { type: 'list/remove'; listId: string }
  | { type: 'list/move'; listId: string; toIndex: number }
  | { type: 'card/add'; listId: string; title: string; atTop?: boolean }
  | { type: 'card/update'; cardId: string; patch: Partial<Card> }
  | { type: 'card/remove'; cardId: string }
  | { type: 'card/move'; cardId: string; toListId: string; toIndex: number }
  | { type: 'checklist/add'; cardId: string; text: string }
  | { type: 'checklist/toggle'; cardId: string; itemId: string }
  | { type: 'checklist/remove'; cardId: string; itemId: string }
  | { type: 'prefs/set'; patch: Partial<Prefs> };

/** Every case returns a new document; the board tree is never mutated in place. */
export function reducer(state: BoardDocument, action: Action): BoardDocument {
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
