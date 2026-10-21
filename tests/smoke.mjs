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

  await check('nos dois temas todo campo de formulario tem contraste legivel', async () => {
    // Regressao: `select` ficava fora da heranca de cor em base.css e caia no
    // preto padrao do navegador sobre o fundo escuro, enquanto input e
    // textarea herdavam o claro - dai "algumas brancas, outras pretas".
    const measure = () =>
      page.evaluate(() => {
        const parse = (value) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = ([r, g, b]) =>
          [r, g, b]
            .map((channel) => channel / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
            .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);

        // Um fundo transparente herda do ancestral pintado mais proximo.
        function backgroundOf(element) {
          let node = element;
          while (node) {
            const value = getComputedStyle(node).backgroundColor;
            const rgba = value.match(/[\d.]+/g)?.map(Number) ?? [];
            if (rgba.length < 4 || rgba[3] > 0.5) return parse(value);
            node = node.parentElement;
          }
          return [0, 0, 0];
        }

        return [...document.querySelectorAll('.field')].map((element) => {
          const style = getComputedStyle(element);
          const [light, dark] = [luminance(parse(style.color)), luminance(backgroundOf(element))]
            .sort((a, b) => b - a);
          return {
            tag: element.tagName.toLowerCase(),
            color: style.color,
            ratio: (light + 0.05) / (dark + 0.05),
          };
        });
      });

    for (const theme of ['dark', 'light']) {
      await page.click('.settings__tab:has-text("Aparencia")');
      await page.click(`.segmented button:has-text("${theme === 'dark' ? 'Escuro' : 'Branco'}")`);

      // O editor de regras e onde ficam os <select> do app.
      await page.click('.settings__tab:has-text("Automacoes")');
      await page.waitForSelector('.auto__list');
      const newRule = page.locator('.settings__panel .btn:has-text("+ Nova regra")');
      if (await newRule.count()) await newRule.click();
      await page.waitForSelector('.auto__editor select');

      const fields = await measure();
      assert.ok(fields.length >= 3, `poucos campos medidos no tema ${theme}: ${fields.length}`);
      assert.ok(
        fields.some((field) => field.tag === 'select'),
        `nenhum select medido no tema ${theme}`,
      );

      const unreadable = fields.filter((field) => field.ratio < 4.5);
      assert.deepEqual(
        unreadable.map((field) => `${field.tag} ${field.color} ratio=${field.ratio.toFixed(2)}`),
        [],
        `campos sem contraste no tema ${theme}`,
      );

      // O contraste acima nao alcanca as partes que o navegador desenha fora da
      // pagina: a lista aberta do select, o calendario do input de data, a
      // checkbox. Quem governa essas e color-scheme, entao ela e verificada
      // diretamente - sem isso, um dos dois lados da correcao poderia voltar a
      // regredir sem o teste notar.
      const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
      assert.equal(scheme, theme, `color-scheme deveria acompanhar o tema ${theme}`);

      await page.click('.auto__editor-actions .btn:has-text("Cancelar")');
    }

    // As verificacoes seguintes contam com o tema escuro.
    await page.click('.settings__tab:has-text("Aparencia")');
    await page.click('.segmented button:has-text("Escuro")');
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

  await check('a barra lateral recolhe para a trilha e persiste', async () => {
    await page.click('.sidebar__head .sidebar__toggle');
    await page.waitForSelector('.sidebar--collapsed .sidebar__tile');

    const storePath = path.join(userData, 'boards.json');
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return doc.prefs.sidebarCollapsed === true;
    }, 'sidebarCollapsed nao foi persistido');

    await page.click('.sidebar--collapsed .sidebar__toggle');
    await page.waitForSelector('.sidebar__list');
  });

  await check('o calendario abre no mes e situa o cartao no dia do prazo', async () => {
    // A card due today, set through the modal, so the date takes the same path
    // a user would take.
    await page.click('.tile >> nth=0');
    await page.waitForSelector('.modal__due input');
    const title = await page.locator('.modal__title').inputValue();
    const today = new Date();
    const key = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    await page.fill('.modal__due input', key);
    await page.click('.modal__close');

    await page.click('.toolbar__view:has-text("Calendario")');
    await page.waitForSelector('.calendar__weeks', { timeout: 5_000 });

    // Month is the default granularity.
    assert.equal(
      await page.locator('.calendar__mode--on').textContent(),
      'Mes',
      'o calendario deveria abrir na visao mensal',
    );

    const chip = page.locator('.cell--today .chip', { hasText: title });
    await chip.waitFor({ timeout: 5_000 });
  });

  await check('arrastar um cartao no calendario reagenda o prazo', async () => {
    const storePath = path.join(userData, 'boards.json');
    const chip = page.locator('.cell--today .chip').first();
    const title = (await chip.textContent()).trim();

    // Any day of this month other than today, found by its number.
    const target = new Date().getDate() === 15 ? 16 : 15;
    const cell = page
      .locator('.cell:not(.cell--outside)')
      .filter({ has: page.locator(`.cell__day:text-is("${target}")`) });

    await chip.dragTo(cell);

    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const card = doc.boards[0].lists
        .flatMap((list) => list.cards)
        .find((candidate) => candidate.title === title);
      return card?.due && new Date(card.due).getDate() === target;
    }, `${title} nao foi reagendado para o dia ${target}`);

    await page.click('.toolbar__view:has-text("Quadro")');
    await page.waitForSelector('.canvas__lists');
  });

  await check('o botao flutuante abre a janela newcard com seu proprio bundle', async () => {
    await page.click('.fab');
    const newcard = await app.waitForEvent('window', { timeout: 10_000 });
    await newcard.waitForSelector('.newcard__body', { timeout: 10_000 });
    const shape = await newcard.evaluate(() => ({
      hasElectron: !!window.electron,
      // Only the main preload exposes init_config, per the real app.
      hasInitConfig: !!window.init_config,
    }));
    assert.equal(shape.hasElectron, true);
    assert.equal(shape.hasInitConfig, false, 'init_config nao deveria existir fora da janela main');

    // The window opening is not the point: the card has to land on the board.
    // Two faults used to swallow it. The list was picked from the seed
    // document rendered before the real one arrived, leaving an id that
    // matched no list; and both windows read, changed and wrote the whole
    // document, so whichever wrote second dropped the other's change.
    const title = `Cartao do newcard ${Date.now()}`;
    await newcard.fill('.newcard__body textarea', title);

    // Enabled only once the document is in and the selected list exists, so
    // waiting on it is waiting for the window to be genuinely ready.
    const add = newcard.locator('.btn--primary:has-text("Adicionar")');
    await add.waitFor({ state: 'visible' });
    await waitFor(async () => !(await add.isDisabled()), 'o botao Adicionar ficou desabilitado');

    const list = await newcard.locator('.newcard__field select >> nth=1').inputValue();
    assert.ok(list, 'a janela newcard deveria ter uma lista selecionada');
    await add.click();

    const storePath = path.join(userData, 'boards.json');
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return doc.boards.some((board) =>
        board.lists.some((entry) => entry.cards.some((card) => card.title === title)),
      );
    }, `"${title}" nao chegou ao boards.json`);

    // And the main window must pick it up from the store broadcast.
    await page.waitForSelector(`.tile__title:text-is("${title}")`, { timeout: 5_000 });

    // It goes into the list the window had selected, not just any list.
    const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
    const holder = doc.boards
      .flatMap((board) => board.lists)
      .find((entry) => entry.cards.some((card) => card.title === title));
    assert.equal(holder.id, list, 'o cartao foi para uma lista diferente da selecionada');

    // The other half of the lost update: adding a card must not undo what the
    // board window changed just before, which here is the view it was left on.
    assert.equal(doc.prefs.view, 'board', 'a janela newcard reverteu a visao do quadro');
  });

  await check('arrastar um cartao ate o botao flutuante o exclui', async () => {
    const storePath = path.join(userData, 'boards.json');
    const title = `Cartao da lixeira ${Date.now()}`;

    const column = page.locator('.column').first();
    await column.locator('.composer__open').click();
    await column.locator('.composer__input').fill(title);
    await column.locator('.composer__input').press('Enter');
    // Enter mantem o compositor aberto; fecha-lo devolve a coluna ao estado em
    // que a verificacao a encontrou, para quem rodar depois.
    await column.locator('.composer__input').press('Escape');
    await page.waitForSelector(`.tile__title:text-is("${title}")`, { timeout: 5_000 });

    await page.locator('.tile').filter({ hasText: title }).dragTo(page.locator('.fab'));

    // confirmCardDelete vem ligado do documento semente, entao o drop pergunta
    // antes de excluir, e a pergunta tem de nomear o cartao que foi solto.
    await page.waitForSelector('.fab-confirm', { timeout: 5_000 });
    const asked = await page.locator('.fab-confirm__text').textContent();
    assert.ok(asked.includes(title), `a confirmacao nao nomeia "${title}": ${asked}`);
    await page.locator('.fab-confirm button:text-is("Excluir")').click();

    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return !doc.boards.some((board) =>
        board.lists.some((entry) => entry.cards.some((card) => card.title === title)),
      );
    }, `"${title}" continuou no boards.json depois da lixeira`);

    // O arraste tem de terminar junto: o botao volta a ser o de novo cartao e
    // o quadro nao fica com a linha de drop acesa.
    assert.equal(await page.locator('.fab').getAttribute('aria-label'), 'Novo cartao');
    assert.equal(await page.locator('.column__drop-line').count(), 0, 'sobrou linha de drop');
  });

  await check('arrastar um cartao ate a caixa de arquivo o tira do quadro', async () => {
    const storePath = path.join(userData, 'boards.json');
    const title = `Cartao arquivado ${Date.now()}`;

    const column = page.locator('.column').first();
    await column.locator('.composer__open').click();
    await column.locator('.composer__input').fill(title);
    await column.locator('.composer__input').press('Enter');
    await column.locator('.composer__input').press('Escape');
    await page.waitForSelector(`.tile__title:text-is("${title}")`, { timeout: 5_000 });
    const before = await page.locator('.tile').count();
    const order = () =>
      page.$$eval('.column', (columns) =>
        columns.map((column) =>
          [...column.querySelectorAll('.tile__title')].map((node) => node.textContent.trim()),
        ),
      );
    const orderBefore = await order();

    // A caixa de arquivo so existe durante o arraste, entao o alvo tem de ser
    // resolvido com o cartao ja no ar: dragTo nao serve aqui.
    const tile = page.locator('.tile').filter({ hasText: title });
    const from = await tile.boundingBox();
    const dock = await page.locator('.fab').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, {
      steps: 5,
    });
    const box = await page.locator('.fab-archive').boundingBox();
    assert.ok(box, 'a caixa de arquivo nao apareceu durante o arraste');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2, { steps: 2 });
    await page.mouse.up();

    // Fora do quadro, mas ainda no documento: arquivar nao e excluir.
    await waitFor(async () => (await page.locator('.tile').count()) === before - 1, `"${title}" continuou no quadro`);
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const card = doc.boards
        .flatMap((board) => board.lists)
        .flatMap((list) => list.cards)
        .find((entry) => entry.title === title);
      return typeof card?.archivedAt === 'string';
    }, `"${title}" nao ficou com archivedAt no boards.json`);

    // E volta pelo painel da barra lateral, na mesma lista de onde saiu.
    await page.click('.sidebar__archive');
    const row = page.locator('.archive__item', { hasText: title });
    await row.waitFor({ state: 'visible', timeout: 5_000 });
    await row.locator('button:text-is("Restaurar")').click();
    await page.waitForSelector(`.tile__title:text-is("${title}")`, { timeout: 5_000 });
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const card = doc.boards
        .flatMap((board) => board.lists)
        .flatMap((list) => list.cards)
        .find((entry) => entry.title === title);
      return card?.archivedAt === null;
    }, `"${title}" nao foi restaurado no boards.json`);
    // Levar o cartao ao dock arquiva, e so arquiva. O quadro desenha o arraste
    // movendo o cartao de lugar, e sair do quadro tem de descartar esse
    // movimento em vez de grava-lo junto com o arquivamento.
    assert.deepEqual(await order(), orderBefore, 'o arraste ate a caixa de arquivo mexeu na ordem');

    // Sem arquivados, nem o painel nem a entrada na barra lateral continuam.
    assert.equal(await page.locator('.archive').count(), 0, 'o painel ficou aberto e vazio');
    assert.equal(await page.locator('.sidebar__archive').count(), 0);
  });

  await check('o cartao guarda comentario, atividade e uma etiqueta nova', async () => {
    const storePath = path.join(userData, 'boards.json');
    const title = `Cartao com historia ${Date.now()}`;
    const comment = 'Primeiro comentario deste cartao';
    const label = `Etiqueta ${Date.now()}`;

    const column = page.locator('.column').first();
    await column.locator('.composer__open').click();
    await column.locator('.composer__input').fill(title);
    await column.locator('.composer__input').press('Enter');
    await column.locator('.composer__input').press('Escape');
    await page.locator('.tile').filter({ hasText: title }).click();
    await page.waitForSelector('.modal__due input');

    // Criar o cartao ja e a primeira linha da historia.
    await page.waitForSelector('.activity__event', { timeout: 5_000 });
    const created = await page.locator('.activity__event').last().textContent();
    assert.match(created, /Adicionou este cartao/, `a atividade comeca com: ${created}`);

    // A historia fica na coluna da direita, ao lado do cartao.
    const main = await page.locator('.modal__main').boundingBox();
    const side = await page.locator('.modal__side').boundingBox();
    assert.ok(
      side.x >= main.x + main.width - 1,
      `a coluna da atividade nao esta a direita (main ate ${main.x + main.width}, side em ${side.x})`,
    );
    assert.ok(
      (await page.locator('.modal__side .activity__compose').count()) === 1,
      'o compositor de comentario nao esta na coluna da direita',
    );

    // O cartao abre com um tamanho fixo: enche-lo de conteudo nao o estica, a
    // rolagem acontece dentro dele e o fundo atras fica parado.
    //
    // A medida espera a animacao de abertura terminar. O cartao entra em
    // escala (--enter-modal, recuperado do bundle de movimento), e uma caixa
    // medida no meio da animacao vem 5% menor - o que a asercao abaixo leria
    // como o cartao tendo crescido depois.
    await page
      .locator('.modal')
      .evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)));
    const opened = await page.locator('.modal').boundingBox();
    const checkField = page.locator('.modal__section:has-text("CHECKLIST") .field');
    for (let item = 1; item <= 12; item += 1) {
      await checkField.fill(`Item ${item} da checklist`);
      await checkField.press('Enter');
    }
    const filled = await page.locator('.modal').boundingBox();
    assert.equal(
      Math.round(filled.height),
      Math.round(opened.height),
      `o cartao cresceu com o conteudo: ${opened.height} -> ${filled.height}`,
    );
    const inside = await page
      .locator('.modal__body')
      .evaluate((el) => el.scrollHeight > el.clientHeight);
    assert.ok(inside, 'o corpo do cartao deveria rolar por dentro');
    const outside = await page
      .locator('.modal__backdrop')
      .evaluate((el) => el.scrollHeight > el.clientHeight);
    assert.equal(outside, false, 'o fundo atras do cartao nao deveria rolar');

    await page.locator('.activity__compose textarea').fill(comment);
    await page.locator('.activity__compose button:text-is("Comentar")').click();
    // O comentario e desenhado como Markdown: o texto fica no paragrafo dentro
    // de .activity__text, e e esse o menor elemento que :text-is encontra.
    await page.waitForSelector(`.activity__text :text-is("${comment}")`, { timeout: 5_000 });

    // Marcar como concluido pelo modal escreve a proxima linha.
    await page.locator('.modal__done').click();
    await page.waitForSelector('.activity__event:has-text("Marcou como concluido")', {
      timeout: 5_000,
    });

    // O editor de etiquetas e um popover: abre sobre o cartao, sem empurrar o
    // que vem depois dele.
    await page.locator('.modal__body').evaluate((el) => el.scrollTo(0, 0));
    const dueBefore = await page.locator('.modal__section:has-text("PRAZO")').boundingBox();
    await page.locator('.modal__section-action').click();
    await page.waitForSelector('.labels');
    const dueAfter = await page.locator('.modal__section:has-text("PRAZO")').boundingBox();
    assert.equal(
      Math.round(dueAfter.y),
      Math.round(dueBefore.y),
      'abrir o editor de etiquetas empurrou o cartao para baixo',
    );

    // Uma etiqueta criada aqui vale para o documento, nao so para este cartao.
    await page.locator('.labels__new').click();
    await page.locator('.labels__row--new .field').fill(label);
    await page.locator('.labels__row--new button:text-is("Criar")').click();
    await page.waitForSelector(`.modal__label:text-is("${label}")`, { timeout: 5_000 });

    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const card = doc.boards
        .flatMap((board) => board.lists)
        .flatMap((list) => list.cards)
        .find((entry) => entry.title === title);
      if (!card) return false;
      const kinds = card.activity.map((entry) => entry.kind);
      return (
        doc.labels.some((entry) => entry.name === label) &&
        card.activity.some((entry) => entry.kind === 'comment' && entry.text === comment) &&
        card.activity.some((entry) => entry.text === 'Marcou como concluido') &&
        kinds.filter((kind) => kind === 'event').length >= 2
      );
    }, `o comentario, a atividade ou a etiqueta "${label}" nao chegaram ao boards.json`);

    await page.locator('.modal__close').click();
  });

  await check('descricao e comentarios aceitam formatacao pela barra e por atalho', async () => {
    const storePath = path.join(userData, 'boards.json');
    const title = `Cartao formatado ${Date.now()}`;

    const column = page.locator('.column').first();
    await column.locator('.composer__open').click();
    await column.locator('.composer__input').fill(title);
    await column.locator('.composer__input').press('Enter');
    await column.locator('.composer__input').press('Escape');
    await page.locator('.tile').filter({ hasText: title }).click();
    await page.waitForSelector('.modal');

    // Descricao: atalho de negrito, botao de lista, Enter continua a lista.
    await page.click('.modal__description-empty');
    await page.keyboard.type('Plano ');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('urgente');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.click('.modal__description .rich__tool[aria-label="Lista com marcadores"]');
    await page.keyboard.type('primeiro');
    await page.keyboard.press('Enter');
    await page.keyboard.type('segundo');
    await page.click('.modal__description-actions button:text-is("Salvar")');

    const view = page.locator('.modal__description-view');
    await view.locator('strong:text-is("urgente")').waitFor({ timeout: 5_000 });
    assert.deepEqual(await view.locator('li').allTextContents(), ['primeiro', 'segundo']);

    // Comentario: botao de italico, enviado com Ctrl+Enter.
    const box = page.locator('.activity__compose .rich__input');
    await box.click();
    await page.keyboard.type('Revisar ');
    await page.click('.activity__compose .rich__tool[aria-label^="Italico"]');
    await page.keyboard.type('hoje');
    await page.keyboard.press('Control+Enter');
    await page.locator('.activity__text em:text-is("hoje")').waitFor({ timeout: 5_000 });

    // O documento guarda Markdown, como o Trello guarda.
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const card = doc.boards
        .flatMap((board) => board.lists)
        .flatMap((list) => list.cards)
        .find((entry) => entry.title === title);
      return (
        card?.description === ['Plano **urgente**', '- primeiro', '- segundo'].join('\n') &&
        card.activity.some((entry) => entry.kind === 'comment' && entry.text === 'Revisar *hoje*')
      );
    }, `"${title}" nao ficou com a descricao e o comentario em Markdown no boards.json`);

    // Escape na edicao de um comentario cancela a edicao e nao fecha o cartao.
    await page.locator('.activity__link:text-is("Editar")').first().click();
    await page.locator('.activity__item .rich__input').waitFor({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.activity__item .rich').count(), 0, 'a edicao nao fechou');
    assert.equal(await page.locator('.modal').count(), 1, 'Escape fechou o cartao inteiro');

    await page.locator('.modal__close').click();
  });

  await check('a bolinha do cartao abre no hover e conclui sem abrir o cartao', async () => {
    const storePath = path.join(userData, 'boards.json');
    const title = `Cartao para concluir ${Date.now()}`;

    const column = page.locator('.column').first();
    await column.locator('.composer__open').click();
    await column.locator('.composer__input').fill(title);
    await column.locator('.composer__input').press('Enter');
    await column.locator('.composer__input').press('Escape');

    const tile = page.locator('.tile').filter({ hasText: title });
    const circle = tile.locator('.tile__check');
    const width = () => circle.evaluate((node) => node.getBoundingClientRect().width);
    // O cartao novo nasce onde estava o "Adicionar cartao" que acabou de ser
    // clicado, entao debaixo do ponteiro: tira-lo de la antes de conferir.
    await page.mouse.move(5, 5);
    await waitFor(async () => (await width()) === 0, 'a bolinha ficou aberta sem hover');

    // Dois movimentos: o primeiro evento sintetico depois de outra acao nem
    // sempre atualiza o :hover do Chromium, e um mouse de verdade manda varios.
    const box = await tile.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
    await waitFor(async () => (await width()) >= 15, 'a bolinha nao abriu com o mouse em cima');

    const at = await circle.boundingBox();
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    assert.equal(await circle.getAttribute('aria-checked'), 'true');
    assert.equal(await page.locator('.modal').count(), 0, 'clicar na bolinha abriu o cartao');

    // Mesma acao do modal: grava e entra no historico.
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const card = doc.boards
        .flatMap((board) => board.lists)
        .flatMap((list) => list.cards)
        .find((entry) => entry.title === title);
      return card?.done === true && card.activity.some((entry) => entry.text === 'Marcou como concluido');
    }, `"${title}" nao ficou concluido no boards.json`);

    // Concluido, a bolinha fica aberta mesmo sem o mouse em cima.
    await page.mouse.move(5, 5);
    await waitFor(async () => (await width()) >= 15, 'a bolinha de um cartao concluido fechou');

    // E clicar de novo reabre o cartao.
    const again = await circle.boundingBox();
    await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
    await page.mouse.click(again.x + again.width / 2, again.y + again.height / 2);
    assert.equal(await circle.getAttribute('aria-checked'), 'false');
  });

  await check('o cartao cai onde o arraste mostrou que ele cairia', async () => {
    const storePath = path.join(userData, 'boards.json');
    /** A ordem visivel do quadro inteiro, lista por lista. */
    const onScreen = () =>
      page.$$eval('.column', (columns) =>
        columns.map((column) =>
          [...column.querySelectorAll('.tile__title')].map((node) => node.textContent.trim()),
        ),
      );
    const inStore = async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return doc.boards[0].lists.map((list) =>
        list.cards.filter((card) => !card.archivedAt).map((card) => card.title),
      );
    };

    const column = page.locator('.column').nth(0);
    const tile = column.locator('.tile').first();
    const moving = (await tile.locator('.tile__title').textContent()).trim();
    const before = await onScreen();

    // Do topo para o fim da propria lista: e o caso em que o indice que o
    // reducer espera nao e o indice que o quadro desenha, porque tirar o
    // cartao da lista desloca todos os que vem depois.
    const from = await tile.boundingBox();
    const last = await column.locator('.tile').last().boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 10, {
      steps: 4,
    });
    // Abaixo do meio do ultimo cartao: depois dele. O segundo movimento, de um
    // pixel, e para o dragover da posicao final chegar: o Chromium agrupa os
    // eventos de arraste e o ultimo de um movimento rapido so sairia no drop.
    await page.mouse.move(last.x + last.width / 2, last.y + last.height * 0.8, { steps: 12 });
    await page.mouse.move(last.x + last.width / 2 + 1, last.y + last.height * 0.8, { steps: 2 });

    // O quadro desenha o arraste com o movimento ja aplicado: o cartao ja esta
    // no fim da lista e o lugar de onde saiu ja fechou. O que esta na tela
    // agora e o que o drop tem de gravar.
    await waitFor(
      async () => (await onScreen())[0].at(-1) === moving,
      `"${moving}" nao foi para o fim da lista durante o arraste`,
    );
    const drawn = await onScreen();
    assert.notDeepEqual(drawn, before, 'o arraste nao mudou nada na tela');

    await page.mouse.up();

    // O desenho e o que ficou gravado tem de ser a mesma ordem. Com a conversao
    // de indice de cardDrag.ts errada, o cartao cai uma casa ao lado do que o
    // arraste prometeu, e so o caminho inteiro mostra isso.
    await waitFor(
      async () => JSON.stringify(await inStore()) === JSON.stringify(drawn),
      `a ordem gravada nao e a que o arraste mostrou: esperava ${JSON.stringify(drawn)}`,
    );
    assert.deepEqual(await onScreen(), drawn, 'a ordem na tela mudou depois do drop');
    assert.equal(
      await page.locator('.tile--dragging').count(),
      0,
      'o cartao ficou com a aparencia de arraste depois do drop',
    );
    assert.equal(await page.locator('.drag-layer').count(), 0, 'a camada de arraste nao sumiu');
  });
  await check('o cartao levado para outra lista segue o ponteiro e o arraste termina', async () => {
    const storePath = path.join(userData, 'boards.json');
    const source = page.locator('.column').nth(0);
    const target = page.locator('.column').nth(1);
    const tile = source.locator('.tile').first();
    const moving = (await tile.locator('.tile__title').textContent()).trim();
    const from = await tile.boundingBox();
    const last = await target.locator('.tile').last().boundingBox();
    const layer = () => page.locator('.drag-layer').evaluate((node) => node.style.transform);

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 10, {
      steps: 4,
    });
    await page.mouse.move(last.x + last.width / 2, last.y + last.height * 0.8, { steps: 12 });
    await page.mouse.move(last.x + last.width / 2 + 1, last.y + last.height * 0.8, { steps: 2 });

    // Mudar de lista desmonta o cartao de onde o arraste comecou e monta outro
    // na lista de destino. Os eventos do arraste continuam indo para o
    // elemento antigo, ja fora do documento: ouvidos pelo React, o cartao no
    // ponteiro congelava ali e o arraste nunca terminava.
    await waitFor(
      async () => (await target.locator('.tile__title').allTextContents()).includes(moving),
      `"${moving}" nao foi para a outra lista durante o arraste`,
    );
    const atCrossing = await layer();
    await page.mouse.move(last.x + last.width / 2 + 40, last.y + last.height + 60, { steps: 8 });
    assert.notEqual(await layer(), atCrossing, 'o cartao no ponteiro parou ao trocar de lista');

    await page.mouse.up();
    await waitFor(
      async () => (await page.locator('.drag-layer').count()) === 0,
      'o arraste nao terminou depois de soltar',
    );
    assert.equal(await page.locator('.tile--dragging').count(), 0, 'sobrou a vaga do arraste');
    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      return doc.boards[0].lists[1].cards.some((card) => card.title === moving);
    }, `"${moving}" nao ficou gravado na outra lista`);
  });
  await check('o menu da lista fecha ao clicar fora, copia e move a lista', async () => {
    const storePath = path.join(userData, 'boards.json');
    const lists = () => page.locator('.column .column__title').allTextContents();
    const dots = () => page.locator('.column').first().locator('.column__menu-btn');
    const menuCount = () => page.locator('.list-menu').count();

    // O bug: o menu so fechava clicando de novo nos tres pontos.
    await dots().click();
    assert.equal(await menuCount(), 1);
    const canvas = await page.locator('.canvas__lists').boundingBox();
    await page.mouse.click(canvas.x + canvas.width - 20, canvas.y + canvas.height - 20);
    assert.equal(await menuCount(), 0, 'clicar no quadro nao fechou o menu');
    await dots().click();
    await page.keyboard.press('Escape');
    assert.equal(await menuCount(), 0, 'Escape nao fechou o menu');

    // Copiar: a copia vem logo depois da original, com os cartoes visiveis dela.
    const before = await lists();
    const original = before[0];
    const cards = await page.locator('.column').first().locator('.tile__title').allTextContents();
    const name = `Copia ${Date.now()}`;
    await dots().click();
    await page.locator('.list-menu button:text-is("Copiar lista")').click();
    await page.locator('.list-menu__name').fill(name);
    await page.locator('.list-menu button:text-is("Criar lista")').click();
    assert.deepEqual((await lists()).slice(0, 2), [original, name]);
    assert.deepEqual(
      await page.locator('.column').nth(1).locator('.tile__title').allTextContents(),
      cards,
    );

    // Mover para outro quadro: some daqui, aparece la.
    const destination = `Destino ${Date.now()}`;
    await page.click('.sidebar__new');
    await page.keyboard.type(destination);
    await page.click('.sidebar__add-actions button:text-is("Criar")');
    await page.locator('.sidebar').getByText('Meu primeiro quadro').click();
    await page.waitForSelector(`.column__title:text-is("${name}")`);
    await page.locator('.column').nth(1).locator('.column__menu-btn').click();
    await page.locator('.list-menu button:text-is("Mover lista")').click();
    await page.locator('.list-menu select').first().selectOption({ label: destination });
    await page.locator('.list-menu button:text-is("Mover")').click();
    assert.ok(!(await lists()).includes(name), 'a lista continuou no quadro de origem');

    await waitFor(async () => {
      const doc = JSON.parse(await fs.readFile(storePath, 'utf8'));
      const board = doc.boards.find((entry) => entry.title === destination);
      return board?.lists.some((list) => list.title === name);
    }, `"${name}" nao chegou ao quadro "${destination}" no boards.json`);
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
