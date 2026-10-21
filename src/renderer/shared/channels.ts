/** Renderer-side mirror of electron/channels.ts. Kept in sync by hand. */
export const WindowChannel = {
  TRIGGER_CLOSE: 'window-close',
  TRIGGER_MINIMIZE: 'window-minimize',
  TRIGGER_MAXIMIZE: 'window-maximize',
  TRIGGER_MENU: 'window-menu',
  TITLE_CHANGE: 'window-title',
  FOCUS: 'window-focus',
  BLUR: 'window-blur',
  ENTER_FULL_SCREEN: 'window:enter-full-screen',
  LEAVE_FULL_SCREEN: 'window:leave-full-screen',
  CONTROLS: 'window-controls',
  STATE: 'window-state',
  OPEN: 'window-open',
  CLOSED: 'window-closed',
} as const;

export const AppChannel = {
  READY: 'app-ready',
  CONFIG: 'app-config',
  STORE: 'app-store',
  COMMAND: 'app-command',
} as const;

export const FindInPageChannel = {
  SET_QUERY: 'find-in-page-set-query',
  FOUND: 'find-in-page-found',
  CLOSE: 'find-in-page-close',
  FOCUS: 'find-in-page-focus',
  RESET: 'find-in-page-reset',
  IS_SHOWN: 'find-in-page-is-shown',
} as const;

export const AssetChannel = {
  PICK: 'assets-pick',
  IMPORT: 'assets-import',
  REMOVE: 'assets-remove',
  SWEEP: 'assets-sweep',
  OPEN: 'assets-open',
  REVEAL: 'assets-reveal',
} as const;

export const StoreOp = {
  READ: 'read',
  WRITE: 'write',
  PATH: 'path',
  /** Hands an action to the window that owns the document. */
  APPLY: 'apply',
} as const;
