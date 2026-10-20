import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

/**
 * End-to-end smoke test over the built app.
 *
 * Checks the pieces unit tests cannot reach: that the preload really reaches
 * the renderer, that the channel allowlist is enforced, that the frameless
 * title bar is wired to the window-control channels, and that editing a board
 * lands in boards.json inside userData.
 *
 * Run with: npm run smoke   (requires `npm run build` first)
 */

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// A throwaway userData directory, so the test never touches real boards.
const userData = await mkdtemp(path.join(os.tmpdir(), 'nivora-smoke-'));
let app;
let failures = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`ok   ${name}`))
    .catch((error) => {
      failures += 1;
      console.error(`FAIL ${name}\n     ${error.message}`);
    });
}

try {
  app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`],
    cwd: root,
  });

  const page = await app.firstWindow();
  await page.waitForSelector('.canvas__lists', { timeout: 20_000 });

  await check('o preload expoe window.electron no renderer', async () => {
    const shape = await page.evaluate(() => ({
      hasElectron: !!window.electron,
      ipcMembers: Object.keys(window.electron?.ipc ?? {}).sort(),
      hasInitConfig: !!window.init_config,
      appId: window.init_config?.appId,
    }));
    assert.equal(shape.hasElectron, true, 'window.electron ausente');
    assert.deepEqual(shape.ipcMembers, [
      'invoke',
      'isChannelSupported',
      'on',
      'once',
      'removeAllListeners',
      'send',
      'sendSync',
    ]);
    assert.equal(shape.hasInitConfig, true, 'window.init_config ausente na janela main');
    assert.equal(shape.appId, 'desktop');
  });

  await check('a allowlist de canais rejeita um canal arbitrario', async () => {
    const result = await page.evaluate(async () => {
      const supported = window.electron.ipc.isChannelSupported('app-store');
      const unsupported = window.electron.ipc.isChannelSupported('nao-existe');
      let threw = false;
      try {
        await window.electron.ipc.invoke('rce-tentativa');
      } catch {
        threw = true;
      }
      return { supported, unsupported, threw };
    });
    assert.equal(result.supported, true);
    assert.equal(result.unsupported, false);
    assert.equal(result.threw, true, 'invoke de canal fora da allowlist deveria lancar');
  });

  await check('a titlebar sem moldura responde ao canal de maximizar', async () => {
    const before = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMaximized(),
    );
    await page.click('.titlebar__btn[aria-label="Maximizar"], .titlebar__btn[aria-label="Restaurar"]');
    await page.waitForTimeout(600);
    const after = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isMaximized(),
    );
    assert.notEqual(before, after, 'o estado de maximizacao nao mudou');
  });

  await check('adicionar um cartao persiste em boards.json no userData', async () => {
    const title = `Cartao de smoke ${Date.now()}`;

    const column = page.locator('.column').first();
    await column.locator('.composer__open').click();
    await column.locator('.composer__input').fill(title);
    await column.locator('.composer__input').press('Enter');

    await page.waitForSelector(`.tile__title:text-is("${title}")`, { timeout: 5_000 });

    const storePath = path.join(userData, 'boards.json');
    // The renderer debounces its write by 250ms.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
        const found = doc.boards.some((board) =>
          board.lists.some((list) => list.cards.some((card) => card.title === title)),
        );
        if (found) return;
      } catch {
        // not written yet
      }
      await page.waitForTimeout(100);
    }
    throw new Error(`cartao nao apareceu em ${storePath}`);
  });

  await check('a janela newcard abre com seu proprio bundle', async () => {
    await page.evaluate(() => window.electron.ipc.send('window-open', 'newcard'));
    const newcard = await app.waitForEvent('window', { timeout: 10_000 });
    await newcard.waitForSelector('.newcard__body', { timeout: 10_000 });
    const shape = await newcard.evaluate(() => ({
      hasElectron: !!window.electron,
      // Only the main preload exposes init_config, per the real app.
      hasInitConfig: !!window.init_config,
    }));
    assert.equal(shape.hasElectron, true);
    assert.equal(shape.hasInitConfig, false, 'init_config nao deveria existir fora da janela main');
  });
} finally {
  await app?.close().catch(() => undefined);
  await rm(userData, { recursive: true, force: true }).catch(() => undefined);
}

if (failures > 0) {
  console.error(`\n${failures} verificacao(oes) falharam`);
  process.exit(1);
}
console.log('\ntodas as verificacoes de smoke passaram');
