import { id } from './id';
import {
  DEFAULT_LABELS,
  GRADIENTS,
  IMAGE_MIME,
  type Attachment,
  type Background,
  type Board,
  type BoardDocument,
  type Card,
  type List,
  type Rule,
  type RuleAction,
  type Trigger,
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
    attachments: [],
    coverAttachmentId: null,
    done: false,
    createdAt: new Date().toISOString(),
  };
}

export function emptyList(title: string): List {
  return { id: id('list'), title, cards: [] };
}

export function emptyBoard(title: string, color: string): Board {
  return {
    id: id('board'),
    title,
    color,
    background: { kind: 'color', value: color },
    lists: [],
    automations: [],
  };
}

export function emptyRule(name: string, trigger: Trigger, actions: RuleAction[]): Rule {
  return {
    id: id('rule'),
    name,
    enabled: true,
    // Both keys are always present, so a rule built here is identical to the
    // same rule after a normalize() round trip.
    trigger: { type: trigger.type, listId: trigger.listId ?? null, labelId: trigger.labelId ?? null },
    actions,
  };
}

/** First-run content, so the app is never an empty screen. */
export function seedDocument(): BoardDocument {
  const board = emptyBoard('Meu primeiro quadro', '#0079bf');
  board.background = { kind: 'gradient', value: 'midnight' };

  const todo = emptyList('A fazer');
  const doing = emptyList('Em andamento');
  const done = emptyList('Concluido');

  todo.cards = [
    { ...emptyCard('Arrastar um cartao entre as listas'), labelIds: ['lbl-blue'] },
    { ...emptyCard('Abrir um cartao para anexar uma imagem') },
    { ...emptyCard('Trocar o fundo do quadro pelo botao Fundo') },
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

  // One rule enabled by default, so the feature is visible rather than hidden
  // behind an empty panel.
  board.automations = [
    emptyRule(
      'Ao concluir, marcar como Pronto',
      { type: 'card-moved', listId: done.id },
      [
        { type: 'mark-card-done' },
        { type: 'add-label', labelId: 'lbl-green' },
        { type: 'mark-checklist-done' },
        { type: 'clear-due' },
      ],
    ),
  ];

  return {
    version: 2,
    boards: [board],
    activeBoardId: board.id,
    labels: DEFAULT_LABELS,
    prefs: {
      theme: 'dark',
      locale: 'pt-BR',
      confirmCardDelete: true,
      automationsEnabled: true,
      sidebarCollapsed: false,
      view: 'board',
    },
  };
}

function normalizeBackground(input: unknown, color: string): Background {
  const candidate = input as Partial<Background> | undefined;
  if (candidate?.kind === 'gradient' && typeof candidate.value === 'string') {
    // A gradient id that no longer exists would render as nothing.
    if (GRADIENTS.some((gradient) => gradient.id === candidate.value)) {
      return { kind: 'gradient', value: candidate.value };
    }
    return { kind: 'color', value: color };
  }
  if (candidate?.kind === 'image' && typeof candidate.value === 'string' && candidate.value) {
    return { kind: 'image', value: candidate.value };
  }
  if (candidate?.kind === 'color' && typeof candidate.value === 'string' && candidate.value) {
    return { kind: 'color', value: candidate.value };
  }
  // Documents written before backgrounds existed only carry `color`.
  return { kind: 'color', value: color };
}

function normalizeAttachment(input: unknown): Attachment | null {
  const a = input as Partial<Attachment> | undefined;
  if (!a || typeof a.asset !== 'string' || !a.asset) return null;
  const mime = typeof a.mime === 'string' ? a.mime : 'application/octet-stream';
  return {
    id: a.id ?? id('att'),
    name: typeof a.name === 'string' && a.name ? a.name : 'anexo',
    mime,
    size: typeof a.size === 'number' ? a.size : 0,
    addedAt: typeof a.addedAt === 'string' ? a.addedAt : new Date().toISOString(),
    asset: a.asset,
    isImage: typeof a.isImage === 'boolean' ? a.isImage : IMAGE_MIME.test(mime),
  };
}

function normalizeRule(input: unknown): Rule | null {
  const r = input as Partial<Rule> | undefined;
  const triggerType = r?.trigger?.type;
  const valid: Rule['trigger']['type'][] = [
    'card-added',
    'card-moved',
    'label-added',
    'checklist-completed',
  ];
  if (!triggerType || !valid.includes(triggerType)) return null;
  const actions = (r?.actions ?? []).filter(
    (action): action is RuleAction => !!action && typeof action.type === 'string',
  );
  if (actions.length === 0) return null;
  return {
    id: r?.id ?? id('rule'),
    name: r?.name ?? 'Regra sem nome',
    enabled: r?.enabled !== false,
    trigger: {
      type: triggerType,
      listId: r?.trigger?.listId ?? null,
      labelId: r?.trigger?.labelId ?? null,
    },
    actions,
  };
}

/** Tolerates a partial or older document instead of throwing it away. */
export function normalize(input: unknown): BoardDocument {
  if (!input || typeof input !== 'object') return seedDocument();
  const doc = input as Partial<BoardDocument>;
  if (!Array.isArray(doc.boards) || doc.boards.length === 0) return seedDocument();

  const boards = doc.boards.map((board) => {
    const color = board.color ?? '#0079bf';
    return {
      id: board.id ?? id('board'),
      title: board.title ?? 'Quadro sem titulo',
      color,
      background: normalizeBackground(board.background, color),
      lists: (board.lists ?? []).map((list) => ({
        id: list.id ?? id('list'),
        title: list.title ?? 'Lista',
        cards: (list.cards ?? []).map((card) => {
          const attachments = (card.attachments ?? [])
            .map(normalizeAttachment)
            .filter((attachment): attachment is Attachment => attachment !== null);
          const cover =
            card.coverAttachmentId &&
            attachments.some((a) => a.id === card.coverAttachmentId && a.isImage)
              ? card.coverAttachmentId
              : null;
          return {
            ...emptyCard(card.title ?? 'Cartao'),
            ...card,
            labelIds: card.labelIds ?? [],
            checklist: card.checklist ?? [],
            due: card.due ?? null,
            description: card.description ?? '',
            attachments,
            coverAttachmentId: cover,
            done: card.done === true,
          };
        }),
      })),
      automations: (board.automations ?? [])
        .map(normalizeRule)
        .filter((rule): rule is Rule => rule !== null),
    };
  });

  return {
    version: 2,
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
      automationsEnabled: doc.prefs?.automationsEnabled ?? true,
      sidebarCollapsed: doc.prefs?.sidebarCollapsed === true,
      view: doc.prefs?.view === 'calendar' ? 'calendar' : 'board',
    },
  };
}

/** Every asset path the document still points at, for the startup sweep. */
export function referencedAssets(doc: BoardDocument): string[] {
  const assets = new Set<string>();
  for (const board of doc.boards) {
    if (board.background.kind === 'image') assets.add(board.background.value);
    for (const list of board.lists) {
      for (const card of list.cards) {
        for (const attachment of card.attachments) assets.add(attachment.asset);
      }
    }
  }
  return [...assets];
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
