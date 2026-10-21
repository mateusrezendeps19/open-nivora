import path from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron';
import {
  AppChannel,
  AssetChannel,
  FindInPageChannel,
  PrefsChannel,
  StoreOp,
  WindowChannel,
} from './channels';
import {
  handleAssetProtocol,
  importPaths,
  openAsset,
  pickAndImport,
  registerAssetScheme,
  removeAsset,
  revealAsset,
  sweepAssets,
} from './assets';
import { documentLocale, menuLabels } from './menuLabels';
import { LEGACY_NAME, migrateUserData } from './migrate';
import { getStorePath, readStore, writeStore } from './store';
import { closeWindow, each, find, nameOf, openWindow, WINDOWS, type WindowName } from './windows';

const DEV = !!process.env.VITE_DEV_SERVER_URL;

registerAssetScheme();

function senderWindow(event: IpcMainInvokeEvent | Electron.IpcMainEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

/* ------------------------------------------------------------------ *
 * Window controls: the frameless shell (frame:!1 in the real app) means
 * minimise / maximise / close all have to round-trip through IPC.
 * ------------------------------------------------------------------ */

ipcMain.on(WindowChannel.TRIGGER_MINIMIZE, (event) => senderWindow(event)?.minimize());

ipcMain.on(WindowChannel.TRIGGER_MAXIMIZE, (event) => {
  const win = senderWindow(event);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on(WindowChannel.TRIGGER_CLOSE, (event) => senderWindow(event)?.close());

ipcMain.on(WindowChannel.TRIGGER_MENU, (event) => {
  const win = senderWindow(event);
  const menu = Menu.getApplicationMenu();
  if (win && menu) menu.popup({ window: win });
});

ipcMain.on(WindowChannel.TITLE_CHANGE, (event, title: string) => {
  if (typeof title === 'string') senderWindow(event)?.setTitle(title);
});

ipcMain.handle(WindowChannel.STATE, (event) => {
  const win = senderWindow(event);
  return {
    maximized: win?.isMaximized() ?? false,
    fullScreen: win?.isFullScreen() ?? false,
    name: win ? nameOf(win) : undefined,
  };
});

ipcMain.on(WindowChannel.OPEN, (_event, name: unknown) => {
  if (typeof name !== 'string' || !Object.hasOwn(WINDOWS, name)) {
    console.warn(`[window-open] janela desconhecida: ${String(name)}`);
    return;
  }
  openWindow(name as WindowName);
});

ipcMain.on(WindowChannel.CLOSED, (_event, name: unknown) => {
  if (typeof name === 'string' && Object.hasOwn(WINDOWS, name)) closeWindow(name as WindowName);
});

/* ------------------------------------------------------------------ *
 * app-store: single JSON document, atomic writes, userData directory.
 * ------------------------------------------------------------------ */

ipcMain.handle(AppChannel.STORE, async (event, op: string, payload: unknown) => {
  switch (op) {
    case StoreOp.READ:
      return readStore<unknown>(null);
    case StoreOp.WRITE:
      await writeStore(payload);
      broadcastStoreChange(payload, event.sender.id);
      syncMenu(payload);
      return true;
    /*
     * Hands the action to the main window, which owns the document, and tells
     * the caller whether that worked.
     *
     * Two windows each reading the document, changing it and writing it back
     * is a lost update waiting to happen: whichever write lands second drops
     * the other's change. That is what made a card added in `newcard`
     * disappear - the board window wrote its own copy, from before the card,
     * moments later. With the action applied where the document is owned
     * there is a single writer and nothing to overwrite.
     */
    case StoreOp.APPLY: {
      const owner = find('main');
      if (!owner || owner.isDestroyed() || owner.webContents.id === event.sender.id) return false;
      owner.webContents.send(AppChannel.STORE, StoreOp.APPLY, payload);
      return true;
    }
    case StoreOp.PATH:
      return getStorePath();
    default:
      throw new Error(`app-store: operacao desconhecida "${op}"`);
  }
});

/**
 * Keeps the other windows (newcard, preferences) in sync with the board.
 *
 * The sender is skipped on purpose. Echoing its own write back is not just
 * redundant, it loses data: the renderer debounces saves, so an edit made in
 * the gap between the write leaving and the echo arriving would be replaced by
 * the older document the echo carries.
 */
function broadcastStoreChange(payload: unknown, senderId: number): void {
  each((win) => {
    if (win.webContents.id === senderId) return;
    win.webContents.send(AppChannel.STORE, StoreOp.WRITE, payload);
  });
}

ipcMain.handle(AppChannel.CONFIG, () => ({
  appId: 'desktop',
  desktopVersion: app.getVersion(),
  platform: process.platform,
  locale: app.getLocale(),
  isDev: DEV,
}));

ipcMain.on(AppChannel.COMMAND, (_event, command: string) => {
  switch (command) {
    case 'open-preferences':
      openWindow('preferences');
      break;
    case 'open-newcard':
      openWindow('newcard');
      break;
    case 'open-find':
      openWindow('find_in_page');
      break;
    case 'quit':
      app.quit();
      break;
    default:
      console.warn(`[app-command] comando ignorado: ${command}`);
  }
});

/* ------------------------------------------------------------------ *
 * find-in-page: the real app drives webContents.findInPage from a small
 * always-on-top window. Same six channels, same direction.
 * ------------------------------------------------------------------ */

ipcMain.on(FindInPageChannel.SET_QUERY, (_event, query: string) => {
  const target = find('main');
  if (!target) return;
  if (!query) {
    target.webContents.stopFindInPage('clearSelection');
    target.webContents.send(FindInPageChannel.RESET);
    return;
  }
  target.webContents.findInPage(query);
});

ipcMain.on(FindInPageChannel.CLOSE, () => {
  find('main')?.webContents.stopFindInPage('clearSelection');
  closeWindow('find_in_page');
});

ipcMain.handle(FindInPageChannel.IS_SHOWN, () => !!find('find_in_page'));

ipcMain.on(FindInPageChannel.FOCUS, () => find('find_in_page')?.focus());

/* ------------------------------------------------------------------ *
 * Asset store: board backgrounds and card attachments.
 * ------------------------------------------------------------------ */

ipcMain.handle(AssetChannel.PICK, (event, kind: unknown) =>
  pickAndImport(senderWindow(event), kind),
);

ipcMain.handle(AssetChannel.IMPORT, (_event, paths: unknown) => importPaths(paths));

ipcMain.handle(AssetChannel.REMOVE, (_event, asset: unknown) => removeAsset(asset));

ipcMain.handle(AssetChannel.OPEN, (_event, asset: unknown) => openAsset(asset));

ipcMain.on(AssetChannel.REVEAL, (_event, asset: unknown) => revealAsset(asset));

/**
 * Deletes orphaned files. Only honoured once per run, right after the main
 * window reports the assets a genuinely loaded document still references; a
 * seeded fallback document must never drive this.
 */
let sweepDone = false;
ipcMain.handle(AssetChannel.SWEEP, async (_event, referenced: unknown) => {
  if (sweepDone) return 0;
  sweepDone = true;
  return sweepAssets(referenced);
});

/* prefs */

ipcMain.handle(PrefsChannel.LOCALE, () => app.getLocale());

/* ------------------------------------------------------------------ *
 * Application menu + lifecycle
 * ------------------------------------------------------------------ */

/** The language the menu is in now, so a save that did not change it rebuilds nothing. */
let menuLocale: unknown;

/**
 * Rebuilds the menu when the document's language changes. Every change is
 * saved through the store, so the write that carries a new language is the
 * moment to follow it - whichever window it was picked in.
 */
function syncMenu(doc: unknown): void {
  // A document from before the choice existed is Portuguese, as in normalize().
  const locale = documentLocale(doc) ?? 'pt-BR';
  if (Menu.getApplicationMenu() && locale === menuLocale) return;
  menuLocale = locale;
  buildMenu(locale);
}

function buildMenu(locale: unknown): void {
  const isMac = process.platform === 'darwin';
  const label = menuLabels(locale);
  const menu = Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: label.file,
      submenu: [
        {
          label: label.newCard,
          accelerator: 'CmdOrCtrl+N',
          click: () => openWindow('newcard'),
        },
        {
          label: label.settings,
          accelerator: 'CmdOrCtrl+,',
          click: () => openWindow('preferences'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    { role: 'editMenu' },
    {
      label: label.view,
      submenu: [
        {
          label: label.find,
          accelerator: 'CmdOrCtrl+F',
          click: () => openWindow('find_in_page'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: label.help,
      submenu: [
        {
          label: label.report,
          click: () => void shell.openExternal('https://github.com/morluto/rea'),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Only for the default folder: a --user-data-dir (the smoke test's, say)
  // asked for a folder of its own and must not be filled with the user's boards.
  const appData = app.getPath('appData');
  const userData = app.getPath('userData');
  if (path.resolve(userData) === path.resolve(appData, app.getName())) {
    try {
      if (migrateUserData(path.join(appData, LEGACY_NAME), userData)) {
        console.log(`[migrate] boards copied from ${LEGACY_NAME} to ${userData}`);
      }
    } catch (error) {
      console.error('[migrate] could not copy the old boards:', error);
    }
  }

  handleAssetProtocol();
  // In the system's language until the document is read, which is also the
  // language a first run starts the document in.
  buildMenu(app.getLocale());
  void readStore<unknown>(null).then((doc) => {
    if (doc) syncMenu(doc);
  });
  openWindow('main');

  each((win) => win.webContents.send(AppChannel.READY));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow('main');
    else find('main')?.focus();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Never let a renderer navigate itself somewhere else or spawn an unmanaged
// window; every new surface goes through the registry or the system browser.
app.on('web-contents-created', (_event, contents) => {
  // A renderer that fails to load, or that a CSP rule blocks, otherwise just
  // shows an empty window; surface both on the main process stdout.
  contents.on('did-fail-load', (_failEvent, code, description, url) => {
    console.error(`[load-fail] ${code} ${description} ${url}`);
  });
  contents.on('console-message', (details) => {
    if (details.level === 'error' || details.level === 'warning') {
      console.error(`[renderer:${details.level}] ${details.message}`);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    const allowed = DEV && url.startsWith(process.env.VITE_DEV_SERVER_URL ?? '');
    if (!allowed && !url.startsWith('file://')) event.preventDefault();
  });
});
