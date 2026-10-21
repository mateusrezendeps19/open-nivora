import { DEFAULT_LOCALE, messages, toLocale, type Locale, type Messages } from './i18n';
import { id } from './id';
import {
  DEFAULT_LABELS,
  GRADIENTS,
  IMAGE_MIME,
  type Activity,
  type Attachment,
  type Background,
  type Board,
  type BoardDocument,
  type Card,
  type Label,
  type List,
  type Rule,
  type RuleAction,
  type Trigger,
} from './types';

const LOCAL_KEY = 'taskly:document';
/** The key from before the rename, read once so a browser session keeps its boards. */
const LEGACY_LOCAL_KEY = 'nivora:document';

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
    activity: [],
    archivedAt: null,
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

/** The starting labels, named in `m`'s language; ids and colors are the same in all of them. */
function defaultLabels(m: Messages): Label[] {
  return DEFAULT_LABELS.map((label) => ({ ...label, name: m.defaultLabels[label.id] ?? label.name }));
}

/**
 * First-run content, so the app is never an empty screen. Written in the
 * language the app starts in; changing the language later leaves it as it
 * is, because by then it is the user's content like any other.
 */
export function seedDocument(locale: Locale = DEFAULT_LOCALE): BoardDocument {
  const m = messages(locale);
  const { seed } = m;
  const board = emptyBoard(seed.board, '#0079bf');
  board.background = { kind: 'gradient', value: 'midnight' };

  const todo = emptyList(seed.todo);
  const doing = emptyList(seed.doing);
  const done = emptyList(seed.done);

  todo.cards = [
    { ...emptyCard(seed.dragCard), labelIds: ['lbl-blue'] },
    { ...emptyCard(seed.attachImage) },
    { ...emptyCard(seed.changeBackground) },
  ];
  doing.cards = [
    {
      ...emptyCard(seed.rebuildShell),
      description: seed.rebuildShellDescription,
      labelIds: ['lbl-purple'],
      checklist: [
        { id: id('chk'), text: seed.windows, done: true },
        { id: id('chk'), text: seed.channels, done: true },
        { id: id('chk'), text: seed.bridge, done: true },
      ],
    },
  ];
  done.cards = [{ ...emptyCard(seed.analyse), labelIds: ['lbl-green'] }];

  board.lists = [todo, doing, done];

  // One rule enabled by default, so the feature is visible rather than hidden
  // behind an empty panel.
  board.automations = [
    emptyRule(
      seed.rule,
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
    labels: defaultLabels(m),
    prefs: {
      theme: 'dark',
      locale,
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

function normalizeAttachment(input: unknown, m: Messages): Attachment | null {
  const a = input as Partial<Attachment> | undefined;
  if (!a || typeof a.asset !== 'string' || !a.asset) return null;
  const mime = typeof a.mime === 'string' ? a.mime : 'application/octet-stream';
  return {
    id: a.id ?? id('att'),
    name: typeof a.name === 'string' && a.name ? a.name : m.defaults.attachment,
    mime,
    size: typeof a.size === 'number' ? a.size : 0,
    addedAt: typeof a.addedAt === 'string' ? a.addedAt : new Date().toISOString(),
    asset: a.asset,
    isImage: typeof a.isImage === 'boolean' ? a.isImage : IMAGE_MIME.test(mime),
  };
}

/** Drops anything that is not a readable line of history. */
function normalizeActivity(input: unknown): Activity | null {
  const entry = input as Partial<Activity> | undefined;
  if (!entry || typeof entry.text !== 'string' || !entry.text) return null;
  return {
    id: entry.id ?? id('act'),
    kind: entry.kind === 'comment' ? 'comment' : 'event',
    text: entry.text,
    at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
    editedAt: typeof entry.editedAt === 'string' ? entry.editedAt : null,
  };
}

function normalizeRule(input: unknown, m: Messages): Rule | null {
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
    name: r?.name ?? m.defaults.rule,
    enabled: r?.enabled !== false,
    trigger: {
      type: triggerType,
      listId: r?.trigger?.listId ?? null,
      labelId: r?.trigger?.labelId ?? null,
    },
    actions,
  };
}

/**
 * Tolerates a partial or older document instead of throwing it away.
 *
 * `fallbackLocale` is the language of the seed returned when there is no
 * document at all - the first run. A document without a language is one from
 * before the choice existed, and that was Portuguese.
 */
export function normalize(input: unknown, fallbackLocale: Locale = DEFAULT_LOCALE): BoardDocument {
  if (!input || typeof input !== 'object') return seedDocument(fallbackLocale);
  const doc = input as Partial<BoardDocument>;
  if (!Array.isArray(doc.boards) || doc.boards.length === 0) return seedDocument(fallbackLocale);
  const locale = toLocale(doc.prefs?.locale);
  const m = messages(locale);

  const boards = doc.boards.map((board) => {
    const color = board.color ?? '#0079bf';
    return {
      id: board.id ?? id('board'),
      title: board.title ?? m.defaults.board,
      color,
      background: normalizeBackground(board.background, color),
      lists: (board.lists ?? []).map((list) => ({
        id: list.id ?? id('list'),
        title: list.title ?? m.defaults.list,
        cards: (list.cards ?? []).map((card) => {
          const attachments = (card.attachments ?? [])
            .map((attachment) => normalizeAttachment(attachment, m))
            .filter((attachment): attachment is Attachment => attachment !== null);
          const cover =
            card.coverAttachmentId &&
            attachments.some((a) => a.id === card.coverAttachmentId && a.isImage)
              ? card.coverAttachmentId
              : null;
          return {
            ...emptyCard(card.title ?? m.defaults.card),
            ...card,
            labelIds: card.labelIds ?? [],
            checklist: card.checklist ?? [],
            due: card.due ?? null,
            description: card.description ?? '',
            attachments,
            coverAttachmentId: cover,
            done: card.done === true,
            activity: (card.activity ?? [])
              .map(normalizeActivity)
              .filter((entry): entry is Activity => entry !== null),
            archivedAt: typeof card.archivedAt === 'string' ? card.archivedAt : null,
          };
        }),
      })),
      automations: (board.automations ?? [])
        .map((rule) => normalizeRule(rule, m))
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
    labels: doc.labels?.length ? doc.labels : defaultLabels(m),
    prefs: {
      theme: doc.prefs?.theme ?? 'dark',
      locale,
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

/**
 * Stored files `before` pointed at and `after` no longer does anywhere - on
 * no card of any board, archived or not, nor as any board's background.
 *
 * This is the only thing that decides a file can go. Deleting it from the
 * place that dropped it is wrong as soon as a file is shared, and files are
 * shared: the store names them by content hash, so the same picture attached
 * to two cards is one file, and a copied list's cards point at the files of
 * the original.
 */
export function releasedAssets(before: BoardDocument, after: BoardDocument): string[] {
  const kept = new Set(referencedAssets(after));
  return referencedAssets(before).filter((asset) => !kept.has(asset));
}

export function readLocal(): unknown {
  try {
    const raw = localStorage.getItem(LOCAL_KEY) ?? localStorage.getItem(LEGACY_LOCAL_KEY);
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
