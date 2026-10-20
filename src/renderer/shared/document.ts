import { id } from './id';
import {
  DEFAULT_LABELS,
  type Board,
  type BoardDocument,
  type Card,
  type List,
} from './types';

const LOCAL_KEY = 'nivora:document';

export function emptyCard(title: string): Card {
  return {
    id: id('card'),
    title,
    description: '',
    labelIds: [],
    due: null,
    checklist: [],
    createdAt: new Date().toISOString(),
  };
}

export function emptyList(title: string): List {
  return { id: id('list'), title, cards: [] };
}

export function emptyBoard(title: string, color: string): Board {
  return { id: id('board'), title, color, lists: [] };
}

/** First-run content, so the app is never an empty screen. */
export function seedDocument(): BoardDocument {
  const board = emptyBoard('Meu primeiro quadro', '#0079bf');
  const todo = emptyList('A fazer');
  const doing = emptyList('Em andamento');
  const done = emptyList('Concluido');

  todo.cards = [
    { ...emptyCard('Arrastar um cartao entre as listas'), labelIds: ['lbl-blue'] },
    { ...emptyCard('Abrir um cartao para editar descricao e checklist') },
    { ...emptyCard('Criar uma nova lista no fim do quadro') },
  ];
  doing.cards = [
    {
      ...emptyCard('Reconstruir o shell Electron a partir das evidencias'),
      description:
        'Janelas, contrato IPC e titlebar sem moldura foram reconstruidos a partir da analise do app.asar feita pelo REA.',
      labelIds: ['lbl-purple'],
      checklist: [
        { id: id('chk'), text: 'Inventario de 10 janelas', done: true },
        { id: id('chk'), text: 'Canais IPC de janela', done: true },
        { id: id('chk'), text: 'contextBridge com allowlist', done: true },
      ],
    },
  ];
  done.cards = [{ ...emptyCard('Analisar o app.asar com o REA'), labelIds: ['lbl-green'] }];

  board.lists = [todo, doing, done];

  return {
    version: 1,
    boards: [board],
    activeBoardId: board.id,
    labels: DEFAULT_LABELS,
    prefs: { theme: 'dark', locale: 'pt-BR', confirmCardDelete: true },
  };
}

/** Tolerates a partial or older document instead of throwing it away. */
export function normalize(input: unknown): BoardDocument {
  if (!input || typeof input !== 'object') return seedDocument();
  const doc = input as Partial<BoardDocument>;
  if (!Array.isArray(doc.boards) || doc.boards.length === 0) return seedDocument();

  const boards = doc.boards.map((board) => ({
    id: board.id ?? id('board'),
    title: board.title ?? 'Quadro sem titulo',
    color: board.color ?? '#0079bf',
    lists: (board.lists ?? []).map((list) => ({
      id: list.id ?? id('list'),
      title: list.title ?? 'Lista',
      cards: (list.cards ?? []).map((card) => ({
        ...emptyCard(card.title ?? 'Cartao'),
        ...card,
        labelIds: card.labelIds ?? [],
        checklist: card.checklist ?? [],
        due: card.due ?? null,
        description: card.description ?? '',
      })),
    })),
  }));

  return {
    version: 1,
    boards,
    activeBoardId:
      doc.activeBoardId && boards.some((b) => b.id === doc.activeBoardId)
        ? doc.activeBoardId
        : boards[0].id,
    labels: doc.labels?.length ? doc.labels : DEFAULT_LABELS,
    prefs: {
      theme: doc.prefs?.theme ?? 'dark',
      locale: doc.prefs?.locale ?? 'pt-BR',
      confirmCardDelete: doc.prefs?.confirmCardDelete ?? true,
    },
  };
}

export function readLocal(): unknown {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeLocal(doc: BoardDocument): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(doc));
  } catch {
    // Private windows and cleared site data make this throw; the in-memory
    // document still works for the session.
  }
}
