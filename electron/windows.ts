import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';
import { FindInPageChannel, WindowChannel } from './channels';

/**
 * Window inventory.
 *
 * REA recovered exactly ten renderer entry points from the asar
 * (.webpack/renderer/<name>/index.html, each with its own preload.js):
 *   main, auth, preferences, newcard, downloads, find_in_page,
 *   prompt, welcome, switch_account, manage_account
 *
 * All ten are registered here. Five have their own renderer bundle; the
 * account/download windows are registered but route to the main renderer until
 * their own UI is built, which is noted in REVERSE-ENGINEERING.md.
 *
 * Geometry below comes from literals found in .webpack/main/index.js:
 *   width:500,height:325 · width:900,height:620 · width:900,height:640 (x2)
 *   minWidth:480 · minHeight:400 · minHeight:720 · frame:!1 (frameless)
 */

export type WindowName =
  | 'main'
  | 'auth'
  | 'preferences'
  | 'newcard'
  | 'downloads'
  | 'find_in_page'
  | 'prompt'
  | 'welcome'
  | 'switch_account'
  | 'manage_account';

interface WindowSpec {
  /** Renderer bundle to load; falls back to `main` where no bundle exists yet. */
  entry: 'main' | 'newcard' | 'preferences' | 'find_in_page' | 'welcome';
  title: string;
  options: BrowserWindowConstructorOptions;
  /** Only one instance may exist at a time (true for every window but prompt). */
  singleton: boolean;
  /** Uses the main preload, which additionally exposes `init_config`. */
  mainPreload?: boolean;
}

const DEV = !!process.env.VITE_DEV_SERVER_URL;

function preloadPath(kind: 'main' | 'window'): string {
  return path.join(__dirname, '..', 'preload', `${kind}.js`);
}

/** Shared hardening: the real app runs every renderer with contextIsolation. */
function webPreferences(kind: 'main' | 'window'): BrowserWindowConstructorOptions['webPreferences'] {
  return {
    preload: preloadPath(kind),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    spellcheck: true,
  };
}

export const WINDOWS: Record<WindowName, WindowSpec> = {
  main: {
    entry: 'main',
    title: 'Nivora',
    singleton: true,
    mainPreload: true,
    options: {
      width: 1280,
      height: 820,
      minWidth: 760,
      minHeight: 720,
      frame: false,
      backgroundColor: '#1d2125',
      show: false,
    },
  },
  newcard: {
    entry: 'newcard',
    title: 'Novo cartao',
    singleton: true,
    options: {
      width: 500,
      height: 325,
      minWidth: 480,
      minHeight: 400,
      frame: false,
      resizable: false,
      backgroundColor: '#22272b',
      show: false,
    },
  },
  preferences: {
    entry: 'preferences',
    title: 'Configuracoes',
    singleton: true,
    options: {
      width: 900,
      height: 640,
      minWidth: 480,
      minHeight: 400,
      frame: false,
      backgroundColor: '#22272b',
      show: false,
    },
  },
  welcome: {
    entry: 'welcome',
    title: 'Bem-vindo',
    singleton: true,
    options: {
      width: 900,
      height: 620,
      frame: false,
      resizable: false,
      backgroundColor: '#22272b',
      show: false,
    },
  },
  find_in_page: {
    entry: 'find_in_page',
    title: 'Localizar',
    singleton: true,
    options: {
      width: 420,
      height: 76,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      backgroundColor: '#22272b',
      show: false,
    },
  },
  // Registered for parity with the asar inventory; no dedicated bundle yet.
  auth: {
    entry: 'welcome',
    title: 'Entrar',
    singleton: true,
    options: { width: 900, height: 640, frame: false, backgroundColor: '#22272b', show: false },
  },
  downloads: {
    entry: 'preferences',
    title: 'Downloads',
    singleton: true,
    options: { width: 500, height: 325, frame: false, backgroundColor: '#22272b', show: false },
  },
  prompt: {
    entry: 'newcard',
    title: 'Nivora',
    singleton: false,
    options: { width: 500, height: 325, frame: false, resizable: false, backgroundColor: '#22272b', show: false },
  },
  switch_account: {
    entry: 'preferences',
    title: 'Trocar de conta',
    singleton: true,
    options: { width: 500, height: 325, frame: false, backgroundColor: '#22272b', show: false },
  },
  manage_account: {
    entry: 'preferences',
    title: 'Gerenciar conta',
    singleton: true,
    options: { width: 900, height: 640, frame: false, backgroundColor: '#22272b', show: false },
  },
};

const open = new Map<WindowName, BrowserWindow>();

export function find(name: WindowName): BrowserWindow | undefined {
  const win = open.get(name);
  return win && !win.isDestroyed() ? win : undefined;
}

export function nameOf(win: BrowserWindow): WindowName | undefined {
  for (const [name, candidate] of open) {
    if (candidate === win) return name;
  }
  return undefined;
}

export function each(fn: (win: BrowserWindow, name: WindowName) => void): void {
  for (const [name, win] of open) {
    if (!win.isDestroyed()) fn(win, name);
  }
}

function urlFor(entry: WindowSpec['entry']): { url: string } | { file: string } {
  if (DEV) return { url: `${process.env.VITE_DEV_SERVER_URL}${entry}/index.html` };
  return { file: path.join(__dirname, '..', 'renderer', entry, 'index.html') };
}

export function openWindow(name: WindowName): BrowserWindow {
  const spec = WINDOWS[name];

  if (spec.singleton) {
    const existing = find(name);
    if (existing) {
      existing.show();
      existing.focus();
      return existing;
    }
  }

  const win = new BrowserWindow({
    ...spec.options,
    title: spec.title,
    webPreferences: webPreferences(spec.mainPreload ? 'main' : 'window'),
  });

  open.set(name, win);

  // The renderer needs to know which window it is before it paints, because a
  // single bundle can back more than one window name (see the inventory above).
  win.webContents.on('did-finish-load', () => {
    win.webContents.send(WindowChannel.CONTROLS, { name, title: spec.title });
  });

  win.once('ready-to-show', () => win.show());

  // Window-chrome events. These are the whole observable IPC surface of the
  // real desktop app, alongside analytics.
  win.on('focus', () => win.webContents.send(WindowChannel.FOCUS));
  win.on('blur', () => win.webContents.send(WindowChannel.BLUR));
  win.on('maximize', () => win.webContents.send(WindowChannel.STATE, { maximized: true }));
  win.on('unmaximize', () => win.webContents.send(WindowChannel.STATE, { maximized: false }));
  win.on('enter-full-screen', () => win.webContents.send(WindowChannel.ENTER_FULL_SCREEN));
  win.on('leave-full-screen', () => win.webContents.send(WindowChannel.LEAVE_FULL_SCREEN));
  // Electron reports match counts on the window that is searching; forward them
  // to the find_in_page overlay, which owns the find-in-page-found channel.
  if (name === 'main') {
    win.webContents.on('found-in-page', (_event, result) => {
      find('find_in_page')?.webContents.send(FindInPageChannel.FOUND, {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
      });
    });
  }

  win.on('closed', () => open.delete(name));

  const target = urlFor(spec.entry);
  if ('url' in target) {
    void win.loadURL(target.url);
  } else {
    void win.loadFile(target.file);
  }

  return win;
}

export function closeWindow(name: WindowName): void {
  find(name)?.close();
}
