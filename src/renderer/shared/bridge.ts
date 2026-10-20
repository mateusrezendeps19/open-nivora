/**
 * Typed view of the preload surface. Mirrors the contextBridge contract the
 * REA analysis recovered from the Trello desktop app:
 *   window.electron = { logger, ipc: { isChannelSupported, invoke, send,
 *                       sendSync, on, once, removeAllListeners } }
 *   window.init_config = { appId, desktopVersion, ... }   (main window only)
 */

export interface ElectronBridge {
  logger: Record<'debug' | 'info' | 'warn' | 'error', (...args: unknown[]) => void>;
  ipc: {
    isChannelSupported(channel: string): boolean;
    invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
    send(channel: string, ...args: unknown[]): void;
    sendSync<T = unknown>(channel: string, ...args: unknown[]): T;
    on(channel: string, listener: (...args: unknown[]) => void): () => void;
    once(channel: string, listener: (...args: unknown[]) => void): void;
    removeAllListeners(channel: string): void;
  };
}

export interface InitConfig {
  appId: string;
  desktopVersion: string;
  dontDismissNotifications: boolean;
  dontUpsell: boolean;
  limitMemoryUsage: boolean;
  analyticsContext: { platform: string };
}

declare global {
  interface Window {
    electron?: ElectronBridge;
    init_config?: InitConfig;
  }
}

/** True when running inside the Electron shell rather than a plain browser. */
export const hasShell = (): boolean => typeof window !== 'undefined' && !!window.electron;

/**
 * No-op bridge used when the renderer is opened in a browser (`npm run dev`
 * serves the same bundles over http). Keeps the UI fully usable, falling back
 * to localStorage for persistence.
 */
const noopBridge: ElectronBridge = {
  logger: {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  },
  ipc: {
    isChannelSupported: () => false,
    invoke: async () => undefined as never,
    send: () => undefined,
    sendSync: () => undefined as never,
    on: () => () => undefined,
    once: () => undefined,
    removeAllListeners: () => undefined,
  },
};

export const bridge = (): ElectronBridge => window.electron ?? noopBridge;
