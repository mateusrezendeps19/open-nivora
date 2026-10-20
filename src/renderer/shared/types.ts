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

export interface Card {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  due: string | null;
  checklist: ChecklistItem[];
  createdAt: string;
}

export interface List {
  id: string;
  title: string;
  cards: Card[];
}

export interface Board {
  id: string;
  title: string;
  color: string;
  lists: List[];
}

export interface Prefs {
  theme: 'dark' | 'light';
  locale: string;
  confirmCardDelete: boolean;
}

/** The whole persisted document, written as one JSON file in userData. */
export interface BoardDocument {
  version: 1;
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

export const DEFAULT_LABELS: Label[] = [
  { id: 'lbl-green', name: 'Pronto', color: '#4bce97' },
  { id: 'lbl-yellow', name: 'Atencao', color: '#f5cd47' },
  { id: 'lbl-orange', name: 'Prioridade', color: '#fea362' },
  { id: 'lbl-red', name: 'Bloqueado', color: '#f87168' },
  { id: 'lbl-purple', name: 'Revisao', color: '#9f8fef' },
  { id: 'lbl-blue', name: 'Ideia', color: '#579dff' },
];
