import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron';
import { AppChannel, FindInPageChannel, PrefsChannel, StoreOp, WindowChannel } from './channels';
import { getStorePath, readStore, writeStore } from './store';
import { closeWindow, each, find, nameOf, openWindow, WINDOWS, type WindowName } from './windows';

const DEV = !!process.env.VITE_DEV_SERVER_URL;

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

ipcMain.handle(AppChannel.STORE, async (_event, op: string, payload: unknown) => {
  switch (op) {
    case StoreOp.READ:
      return readStore<unknown>(null);
    case StoreOp.WRITE:
      await writeStore(payload);
      broadcastStoreChange(payload);
      return true;
    case StoreOp.PATH:
      return getStorePath();
    default:
      throw new Error(`app-store: operacao desconhecida "${op}"`);
  }
});

/** Keeps secondary windows (newcard, preferences) in sync with the board. */
function broadcastStoreChange(payload: unknown): void {
  each((win) => win.webContents.send(AppChannel.STORE, StoreOp.WRITE, payload));
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

/* prefs */

ipcMain.handle(PrefsChannel.LOCALE, () => app.getLocale());

/* ------------------------------------------------------------------ *
 * Application menu + lifecycle
 * ------------------------------------------------------------------ */

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const menu = Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Novo cartao',
          accelerator: 'CmdOrCtrl+N',
          click: () => openWindow('newcard'),
        },
        {
          label: 'Preferencias',
          accelerator: 'CmdOrCtrl+,',
          click: () => openWindow('preferences'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Exibir',
      submenu: [
        {
          label: 'Localizar na pagina',
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
      label: 'Ajuda',
      submenu: [
        {
          label: 'Relatorio de engenharia reversa',
          click: () => void shell.openExternal('https://github.com/morluto/rea'),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  buildMenu();
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
