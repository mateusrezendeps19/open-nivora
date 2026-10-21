/**
 * IPC channel contract.
 *
 * Channel names marked LITERAL were recovered verbatim from the Trello desktop
 * app.asar by REA (rea analyze-javascript-application). Names marked SYMBOL were
 * only recoverable as minified symbol references (r.TRIGGER_*, t.TITLE_CHANGE,
 * i.BLUR ...) because the bundle resolves them dynamically; REA reported 55 of
 * the 59 IPC operations as `resolution: "dynamic"`. For those we keep the
 * recovered symbol name and bind our own literal, documented in
 * REVERSE-ENGINEERING.md.
 */

export const WindowChannel = {
  // SYMBOL: renderer -> main, observed as r./t./i.TRIGGER_* in every preload
  TRIGGER_CLOSE: 'window-close', // LITERAL "window-close" also present in main
  TRIGGER_MINIMIZE: 'window-minimize',
  TRIGGER_MAXIMIZE: 'window-maximize',
  TRIGGER_MENU: 'window-menu', // LITERAL
  // SYMBOL: main -> renderer
  TITLE_CHANGE: 'window-title', // LITERAL
  FOCUS: 'window-focus', // LITERAL
  BLUR: 'window-blur', // LITERAL
  // LITERAL, used as-is by the real app
  ENTER_FULL_SCREEN: 'window:enter-full-screen',
  LEAVE_FULL_SCREEN: 'window:leave-full-screen',
  // LITERAL lifecycle channels
  CREATED: 'window-created',
  CLOSED: 'window-closed',
  ALL_CLOSED: 'window-all-closed',
  CONTROL: 'window-control',
  CONTROLS: 'window-controls',
  FRAME: 'window-frame',
  STATE: 'window-state',
  OPEN: 'window-open',
} as const;

export const AppChannel = {
  READY: 'app-ready', // LITERAL
  CONFIG: 'app-config', // LITERAL
  STORE: 'app-store', // LITERAL - the real app persists via node-persist
  COMMAND: 'app-command', // LITERAL
  ACTIVATE: 'app-activate', // LITERAL
  BEFORE_QUIT: 'app-before-quit', // LITERAL
  WILL_QUIT: 'app-will-quit', // LITERAL
} as const;

export const FindInPageChannel = {
  SET_QUERY: 'find-in-page-set-query', // LITERAL
  FOUND: 'find-in-page-found', // LITERAL
  CLOSE: 'find-in-page-close', // LITERAL
  FOCUS: 'find-in-page-focus', // LITERAL
  RESET: 'find-in-page-reset', // LITERAL
  IS_SHOWN: 'find-in-page-is-shown', // LITERAL
} as const;

export const PrefsChannel = {
  LOCALE: 'prefs.locale', // LITERAL
  GET: 'prefs-get',
  SET: 'prefs-set',
} as const;

/** Store operations multiplexed over AppChannel.STORE, like the real app does. */
export const StoreOp = {
  READ: 'read',
  WRITE: 'write',
  PATH: 'path',
  /**
   * Taskly addition. A satellite window hands an action to the window that
   * owns the document instead of writing the whole document itself, so there
   * is only ever one writer. See the note on the handler in main.ts.
   */
  APPLY: 'apply',
} as const;

/**
 * Taskly additions, not recovered from the Trello app: the asset store behind
 * board backgrounds and card attachments. Named apart from the channels above
 * so the evidence-backed contract stays recognisable.
 */
export const AssetChannel = {
  PICK: 'assets-pick',
  IMPORT: 'assets-import',
  REMOVE: 'assets-remove',
  SWEEP: 'assets-sweep',
  OPEN: 'assets-open',
  REVEAL: 'assets-reveal',
} as const;

/** Kinds of file the picker offers, which also bounds what gets imported. */
export const AssetPickKind = {
  IMAGE: 'image',
  ANY: 'any',
} as const;

/**
 * The real preload exposes `isChannelSupported` and validates every channel
 * before forwarding it. We reproduce that allowlist behaviour.
 */
export const SUPPORTED_CHANNELS: readonly string[] = [
  ...Object.values(WindowChannel),
  ...Object.values(AppChannel),
  ...Object.values(FindInPageChannel),
  ...Object.values(PrefsChannel),
  ...Object.values(AssetChannel),
];
