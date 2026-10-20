import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { SUPPORTED_CHANNELS } from '../channels';

/**
 * Reproduces the contextBridge surface REA recovered from
 * .webpack/renderer/*\/preload.js:
 *
 *   exposeInMainWorld("electron", { logger, ipc: { isChannelSupported, invoke,
 *     send, sendSync, on, once, removeAllListeners } })
 *
 * The real preload validates the channel before every forward (the recovered
 * bundle calls a guard `_(e)` on each operation). We do the same against an
 * explicit allowlist, so a compromised renderer cannot reach an arbitrary
 * channel.
 */

type Listener = (...args: unknown[]) => void;

function assertChannel(channel: string): void {
  if (!SUPPORTED_CHANNELS.includes(channel)) {
    throw new Error(`ipc: canal nao suportado "${channel}"`);
  }
}

const logger = {
  debug: (...args: unknown[]) => console.debug('[renderer]', ...args),
  info: (...args: unknown[]) => console.info('[renderer]', ...args),
  warn: (...args: unknown[]) => console.warn('[renderer]', ...args),
  error: (...args: unknown[]) => console.error('[renderer]', ...args),
};

const ipc = {
  isChannelSupported: (channel: string) => SUPPORTED_CHANNELS.includes(channel),

  invoke: (channel: string, ...args: unknown[]) => {
    assertChannel(channel);
    return ipcRenderer.invoke(channel, ...args);
  },

  send: (channel: string, ...args: unknown[]) => {
    assertChannel(channel);
    ipcRenderer.send(channel, ...args);
  },

  sendSync: (channel: string, ...args: unknown[]) => {
    assertChannel(channel);
    return ipcRenderer.sendSync(channel, ...args);
  },

  /** Returns an unsubscribe function; the raw IpcRendererEvent is not exposed. */
  on: (channel: string, listener: Listener) => {
    assertChannel(channel);
    const wrapped = (_event: unknown, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  once: (channel: string, listener: Listener) => {
    assertChannel(channel);
    ipcRenderer.once(channel, (_event, ...args) => listener(...args));
  },

  removeAllListeners: (channel: string) => {
    assertChannel(channel);
    ipcRenderer.removeAllListeners(channel);
  },
};

/**
 * Dropping files on a page gives File objects whose real path Electron no
 * longer puts on `File.path`; webUtils is the supported way to get it, and it
 * has to be called in the preload.
 */
function getPathForFile(file: unknown): string | null {
  try {
    return webUtils.getPathForFile(file as File) || null;
  } catch {
    return null;
  }
}

export function exposeElectron(): void {
  contextBridge.exposeInMainWorld('electron', { logger, ipc, getPathForFile });
}

/**
 * Only the `main` preload exposes this in the real app. Field names and values
 * are the ones REA read out of the bundle verbatim.
 */
export function exposeInitConfig(desktopVersion: string): void {
  contextBridge.exposeInMainWorld('init_config', {
    appId: 'desktop',
    desktopVersion,
    dontDismissNotifications: true,
    dontUpsell: true,
    limitMemoryUsage: true,
    analyticsContext: { platform: process.platform },
  });
}
