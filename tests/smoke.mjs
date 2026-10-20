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

/** Repete `probe` ate dar certo; as escritas do renderer sao debounced. */
async function waitFor(probe, message, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (await probe()) return;
    } catch {
      // ainda nao
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

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

  await check('Configuracoes reune aparencia, fundo, automacoes e dados', async () => {
    await page.click('.toolbar__actions .btn:has-text("Configuracoes")');
    await page.waitForSelector('.settings__tabs');

    const tabs = await page.locator('.settings__tab').allTextContents();
    assert.deepEqual(
      tabs.map((label) => label.replace(/\d+$/, '')),
      ['Aparencia', 'Fundo', 'Automacoes', 'Dados'],
    );

    // Os botoes avulsos de Fundo, Automacoes e tema sairam da toolbar.
    const toolbar = await page.locator('.toolbar__actions .btn').allTextContents();
    for (const gone of ['Fundo', 'Automacoes', 'Claro', 'Escuro']) {
      assert.ok(
        !toolbar.some((label) => label.trim() === gone),
        `"${gone}" nao deveria mais estar na toolbar: ${JSON.stringify(toolbar)}`,
      );
    }
  });

  await check('o tema branco escolhido em Aparencia persiste', async () => {
    await page.click('.settings__tab:has-text("Aparencia")');
    await page.click('.segmented button:has-text("Branco")');

    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(theme, 'light');

    const storePath = path.join(userData, 'boards.json');
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return doc.prefs.theme === 'light';
    }, 'o tema nao chegou ao boards.json');

    // Volta para escuro, que e o estado em que o resto das verificacoes roda.
    await page.click('.segmented button:has-text("Escuro")');
  });

  await check('trocar o fundo na aba Fundo persiste no documento', async () => {
    await page.click('.settings__tab:has-text("Fundo")');
    await page.waitForSelector('.bg__grid');

    // Segundo gradiente da lista, para nao coincidir com o da semente.
    await page.click('.bg__swatch--wide >> nth=1');

    const storePath = path.join(userData, 'boards.json');
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const background = doc.boards[0].background;
      return background.kind === 'gradient' && background.value === 'ember';
    }, 'o fundo gradiente nao chegou ao boards.json');
  });

  await check('importar um anexo copia o arquivo e o serve por nivora://', async () => {
    // PNG 1x1 valido, so para ter um arquivo de verdade em disco.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );
    const source = path.join(userData, 'smoke-anexo.png');
    await fs.writeFile(source, png);

    const records = await page.evaluate(
      (filePath) => window.electron.ipc.invoke('assets-import', [filePath]),
      source,
    );

    assert.equal(records.length, 1, 'o import deveria devolver um registro');
    const [record] = records;
    assert.equal(record.isImage, true);
    assert.equal(record.mime, 'image/png');
    assert.equal(record.size, png.length);
    assert.ok(record.asset.endsWith('-smoke-anexo.png'), `nome inesperado: ${record.asset}`);

    // O arquivo foi copiado para a loja de ativos, nao referenciado no lugar.
    const stored = path.join(userData, 'assets', record.asset);
    await fs.access(stored);

    // E o renderer consegue carregar pelo esquema proprio, com a CSP ativa.
    const loaded = await page.evaluate(
      (asset) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ ok: true, width: img.naturalWidth });
          img.onerror = () => resolve({ ok: false, width: 0 });
          img.src = `nivora://assets/${encodeURIComponent(asset)}`;
        }),
      record.asset,
    );
    assert.deepEqual(loaded, { ok: true, width: 1 }, 'nivora:// nao entregou a imagem');
  });

  await check('o protocolo recusa sair da pasta de ativos', async () => {
    const status = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve('carregou');
          img.onerror = () => resolve('recusou');
          img.src = 'nivora://assets/..%2F..%2Fboards.json';
        }),
    );
    assert.equal(status, 'recusou', 'travessia de caminho deveria ser bloqueada');
  });

  await check('a aba Automacoes lista a regra da semente', async () => {
    await page.click('.settings__tab:has-text("Automacoes")');
    await page.waitForSelector('.auto__list');

    const names = await page.locator('.auto__info strong').allTextContents();
    assert.deepEqual(names, ['Ao concluir, marcar como Pronto']);

    const described = await page.locator('.auto__info span').first().textContent();
    assert.ok(
      described.includes('Marcar o cartao como concluido'),
      `a regra deveria incluir a acao de concluir o cartao: ${described}`,
    );

    await page.click('.settings__close');
  });

  await check('marcar um cartao como concluido persiste', async () => {
    await page.click('.tile >> nth=0');
    await page.waitForSelector('.modal__done');
    const title = await page.locator('.modal__title').inputValue();

    await page.click('.modal__done');
    await page.waitForSelector('.modal__done--on');
    await page.click('.modal__close');

    const storePath = path.join(userData, 'boards.json');
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return doc.boards[0].lists
        .flatMap((list) => list.cards)
        .some((card) => card.title === title && card.done === true);
    }, `"${title}" nao ficou marcado como concluido no boards.json`);
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
