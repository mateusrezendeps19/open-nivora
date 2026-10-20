export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/**
 * A file copied into the asset store under userData. `asset` is the path
 * relative to that store, which the renderer turns into a `nivora://` URL.
 */
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  addedAt: string;
  asset: string;
  isImage: boolean;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  due: string | null;
  checklist: ChecklistItem[];
  attachments: Attachment[];
  /** An image attachment shown as the card cover, or null. */
  coverAttachmentId: string | null;
  /**
   * Whether the card itself is finished. Distinct from the checklist: a card
   * with no checklist still needs a way to be marked done, which is what
   * "mover para Concluido e marcar como concluido" asks for.
   */
  done: boolean;
  createdAt: string;
}

export interface List {
  id: string;
  title: string;
  cards: Card[];
}

/* ------------------------------------------------------------------ *
 * Board background
 * ------------------------------------------------------------------ */

export type BackgroundKind = 'color' | 'gradient' | 'image';

export interface Background {
  kind: BackgroundKind;
  /** A hex color, a gradient id from GRADIENTS, or an asset path. */
  value: string;
}

export interface Gradient {
  id: string;
  name: string;
  css: string;
  /** Drives the chrome tint so text stays readable over the background. */
  tone: 'dark' | 'light';
}

/* ------------------------------------------------------------------ *
 * Automations
 * ------------------------------------------------------------------ */

export type TriggerType = 'card-added' | 'card-moved' | 'label-added' | 'checklist-completed';

export interface Trigger {
  type: TriggerType;
  /** For card-added and card-moved; null means any list. */
  listId?: string | null;
  /** For label-added; null means any label. */
  labelId?: string | null;
}

export type RuleActionType =
  | 'move-to-list'
  | 'add-label'
  | 'remove-label'
  | 'set-due'
  | 'clear-due'
  | 'add-checklist-item'
  | 'mark-checklist-done'
  | 'mark-card-done'
  | 'mark-card-undone';

export interface RuleAction {
  type: RuleActionType;
  listId?: string;
  labelId?: string;
  /** For set-due: days from now, which may be negative. */
  days?: number;
  /** For add-checklist-item. */
  text?: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  actions: RuleAction[];
}

export interface Board {
  id: string;
  title: string;
  /** Kept as the fallback tint and for documents written before backgrounds. */
  color: string;
  background: Background;
  lists: List[];
  automations: Rule[];
}

export interface Prefs {
  theme: 'dark' | 'light';
  locale: string;
  confirmCardDelete: boolean;
  automationsEnabled: boolean;
}

/** The whole persisted document, written as one JSON file in userData. */
export interface BoardDocument {
  version: 2;
  boards: Board[];
  activeBoardId: string | null;
  labels: Label[];
  prefs: Prefs;
}

export const BOARD_COLORS = [
  '#0079bf',
  '#d29034',
  '#519839',
  '#b04632',
  '#89609e',
  '#cd5a91',
  '#4bbf6b',
  '#00aecc',
] as const;

/**
 * Trello offers photo backgrounds from Unsplash, which needs the network and an
 * API key. Nivora stays offline: solid colors, these gradients, or a local
 * image the user picks.
 */
export const GRADIENTS: Gradient[] = [
  {
    id: 'midnight',
    name: 'Meia-noite',
    css: 'linear-gradient(135deg, #0b1324 0%, #243b63 55%, #3f6ea8 100%)',
    tone: 'dark',
  },
  {
    id: 'ember',
    name: 'Brasa',
    css: 'linear-gradient(135deg, #2b1055 0%, #7b2d8e 50%, #e05a47 100%)',
    tone: 'dark',
  },
  {
    id: 'forest',
    name: 'Floresta',
    css: 'linear-gradient(135deg, #0f2e1d 0%, #1f6b43 55%, #63b97f 100%)',
    tone: 'dark',
  },
  {
    id: 'dusk',
    name: 'Crepusculo',
    css: 'linear-gradient(135deg, #1a1a2e 0%, #4a3f8f 50%, #c86b9c 100%)',
    tone: 'dark',
  },
  {
    id: 'ocean',
    name: 'Oceano',
    css: 'linear-gradient(135deg, #012a4a 0%, #01649c 55%, #61c0d8 100%)',
    tone: 'dark',
  },
  {
    id: 'sand',
    name: 'Areia',
    css: 'linear-gradient(135deg, #f6e7d2 0%, #e6c79c 55%, #c99b6a 100%)',
    tone: 'light',
  },
  {
    id: 'mint',
    name: 'Menta',
    css: 'linear-gradient(135deg, #e8f7f0 0%, #a8ddc6 55%, #6fbfa3 100%)',
    tone: 'light',
  },
  {
    id: 'slate',
    name: 'Grafite',
    css: 'linear-gradient(135deg, #1d2125 0%, #2c333a 55%, #4a545e 100%)',
    tone: 'dark',
  },
];

export const DEFAULT_LABELS: Label[] = [
  { id: 'lbl-green', name: 'Pronto', color: '#4bce97' },
  { id: 'lbl-yellow', name: 'Atencao', color: '#f5cd47' },
  { id: 'lbl-orange', name: 'Prioridade', color: '#fea362' },
  { id: 'lbl-red', name: 'Bloqueado', color: '#f87168' },
  { id: 'lbl-purple', name: 'Revisao', color: '#9f8fef' },
  { id: 'lbl-blue', name: 'Ideia', color: '#579dff' },
];

export const IMAGE_MIME = /^image\/(png|jpeg|gif|webp|avif|svg\+xml|bmp)$/;
