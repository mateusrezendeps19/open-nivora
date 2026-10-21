# Relatório de engenharia reversa

Este documento registra o que foi extraído do app do Trello instalado nesta máquina, como foi
extraído, e exatamente qual parte deste repositório veio de evidência e qual parte é implementação
original. O resumo completo da evidência está em [`rea-evidence-summary.json`](./rea-evidence-summary.json).

## O alvo

| | |
|---|---|
| Pacote | `45273LiamForsyth.PawsforTrello_2.16.8.0_x64__7pb5ddty8z1pa` |
| `DisplayName` no manifesto | `Trello` |
| `PublisherDisplayName` | `Trello, Inc.` |
| Versão do app | 2.16.8 |
| Runtime | Electron 43.5.0 (arquivo `app/version`) |
| Artefato analisado | `app/resources/app.asar`, 5.753.283 bytes |
| SHA-256 do asar | `dcef5984276d6630c85189b8ad719f5b09deea2e69a52c15b65046312495a565` |

Apesar do nome do pacote da Store (`PawsforTrello`, de um publicador independente), o manifesto
identifica o app como o cliente desktop oficial da Trello, Inc. É um app Electron: `Trello.exe`
(238 MB), DLLs do Chromium, `resources.pak`, snapshots do V8 e um `app.asar` com o código.

## A ferramenta

[REA — Reverse Engineer Anything](https://github.com/morluto/rea), versão 6.7.0.

```bash
npm install --global rea-agents
rea analyze-javascript-application /caminho/para/app.asar --json
```

| | |
|---|---|
| `evidence_id` | `ev_d71b02e4486e63ddd92c61dfc7137e61a757fe0e8a4eb288dd6fe54aae4d8685` |
| Provider | `rea-javascript-application` v1 |
| `confidence` | `derived` |
| `authority` | `shipped-artifact` |
| Saída bruta | 121.547.092 bytes de JSON |

### Cobertura da análise

| Métrica | Valor |
|---|---|
| Arquivos relevantes no asar | 43 |
| Arquivos JavaScript parseados | 25 |
| Arquivos JavaScript ignorados | 7 |
| Falhas de parse | 0 |
| Nós de AST visitados | 360.874 |
| Módulos reconstruídos | 676 |
| Findings | 1.676 |
| Nós / arestas no grafo da aplicação | 1.062 / 2.532 |
| Nós / relações no grafo semântico | 56.882 / 50.550 |

## O que foi recuperado

### Inventário de janelas (10 renderers + 1 main)

Cada renderer tem `index.html`, `index.js` e `preload.js` próprios:

```
.webpack/main/index.js
.webpack/renderer/main/          .webpack/renderer/auth/
.webpack/renderer/preferences/   .webpack/renderer/newcard/
.webpack/renderer/downloads/     .webpack/renderer/find_in_page/
.webpack/renderer/prompt/        .webpack/renderer/welcome/
.webpack/renderer/switch_account/ .webpack/renderer/manage_account/
```

### Superfície do contextBridge

9 chamadas `exposeInMainWorld`, 15 membros expostos. Literalmente, do bundle:

```js
// .webpack/renderer/main/preload.js
exposeInMainWorld("electron", { logger: ..., ipc: (ai = e.ipcRenderer, {
  isChannelSupported, invoke, send, sendSync, on, once, removeAllListeners }) })

exposeInMainWorld("init_config", { appId: "desktop", desktopVersion: "2.16.8",
  dontDismissNotifications: !0, dontUpsell: !0, limitMemoryUsage: !0,
  analyticsContext: { platform: process.platform } })
```

`init_config` aparece **somente** no preload da janela `main`. As outras nove expõem apenas
`electron`. Toda operação de IPC passa por um guard de canal antes de ser encaminhada.

### Canais IPC

59 operações, 20 handlers no main, 19 listeners no renderer. Dessas, **4 resolvem para string
literal e 55 são dinâmicas** — o bundle minificado referencia `r.TRIGGER_MAXIMIZE`,
`t.TITLE_CHANGE`, `i.BLUR` etc., e o REA não adivinha o valor por semelhança textual.

Canais recuperados como literal no `.webpack/main/index.js`:

```
window-control   window-controls   window-frame    window-menu    window-title
window-focus     window-blur       window-close    window-closed  window-created
window-all-closed  window-manager  window-listeners
window:enter-full-screen           window:leave-full-screen
app-ready   app-config   app-store   app-command   app-controller  app-listeners
app-activate  app-before-quit  app-will-quit  app-will-finish-launching
auth-complete   prefs.locale
find-in-page-set-query   find-in-page-found   find-in-page-close
find-in-page-focus       find-in-page-reset   find-in-page-is-shown
analytics-track-event    analytics-set-user-info
```

Símbolos recuperados (valor literal não resolvido): `TRIGGER_CLOSE`, `TRIGGER_MINIMIZE`,
`TRIGGER_MAXIMIZE`, `TRIGGER_MENU`, `TITLE_CHANGE`, `FOCUS`, `BLUR`.

**A superfície IPC inteira é cromo de janela, autenticação, downloads, busca na página e
analytics.** Não há um único canal de quadro, lista ou cartão.

### Geometria das janelas

Literais no `.webpack/main/index.js`: `frame:!1` (sem moldura), `width:500,height:325`,
`width:900,height:620`, `width:900,height:640` (duas vezes), `minWidth:480`, `minHeight:400`,
`minHeight:720`.

### Dependências (do `package.json` dentro do asar)

React 18.3.1, `@atlaskit/icon` 37.3.0, `@atlaskit/tabs`, `@atlaskit/toggle`, `@atlaskit/tokens`
16.4.0, `@atlassiansox/analytics-web-client` 5.20.0, `@sentry/electron`, `node-persist` 4.0.3,
`mousetrap` 1.6.5, `date-fns` 4.1.0, `lodash`, `fs-jetpack`, `jszip`, `format-message`.

### Temas

Bundles de token do Atlaskit embutidos: `atlassian-light`, `atlassian-dark`,
`atlassian-light-future`, `atlassian-dark-future`, `atlassian-light-increased-contrast`,
`atlassian-dark-increased-contrast`, `atlassian-custom-theme`, `atlassian-typography`,
`atlassian-spacing`, `atlassian-shape`, `atlassian-motion`.

### Movimento

Segunda passagem da análise, feita sobre o mesmo asar (SHA-256 confere) com o REA 6.7.0:

```bash
rea extract-artifact /caminho/para/app.asar --format json
```

| | |
|---|---|
| `evidence_id` | `ev_6da7c2d721fc825268f5f6d8616c298fe9ff4089bed20922d0cc0b5ac8b6daa6` |
| Provider | `rea-artifact-graph` v1 |
| `confidence` | `observed` |
| `authority` | `shipped-artifact` |
| Arquivo | `.webpack/renderer/@atlaskit-internal_atlassian-motion/index.js`, 9.196 bytes |
| SHA-256 | `e26b5e0a5d46dd5c885f32706f5fdc7f347d562088fa714acaa02e1ea8b38270` |

O bundle é uma folha de estilo inteira em uma string: **20 keyframes** e **46 custom properties**
sob `html[data-theme~="motion:motion"]`. Literalmente, dele:

```css
--ds-duration-xxshort: 50ms;   --ds-duration-xshort: 100ms;  --ds-duration-short: 150ms;
--ds-duration-medium: 200ms;   --ds-duration-long: 250ms;    --ds-duration-xlong: 400ms;
--ds-duration-xxlong: 600ms;   --ds-duration-instant: 0ms;

--ds-easing-out-practical: cubic-bezier(0.4, 1, 0.6, 1);
--ds-easing-out-bold:      cubic-bezier(0, 0.4, 0, 1);
--ds-easing-in-practical:  cubic-bezier(0.6, 0, 0.8, 0.6);
--ds-easing-inout-bold:    cubic-bezier(0.4, 0, 0, 1);
--ds-easing-spring:        linear(0, 0.021, 0.058, ... 0.999, 1);   /* 65 paradas */

--ds-modal-enter:    250ms cubic-bezier(0.4, 0, 0, 1) ScaleIn95to100 backwards;
--ds-modal-exit:     200ms cubic-bezier(0.6, 0, 0.8, 0.6) ScaleOut100to95 forwards;
--ds-blanket-enter:  250ms cubic-bezier(0.4, 0, 0, 1) FadeIn0to100 backwards;
--ds-blanket-exit:   200ms cubic-bezier(0.6, 0, 0.8, 0.6) FadeOut100to0 forwards;
--ds-popup-enter-bottom: 150ms cubic-bezier(0.4, 1, 0.6, 1) SlideInBottom8px backwards, ... ;
--ds-popup-exit-bottom:  100ms cubic-bezier(0.6, 0, 0.8, 0.6) SlideOutBottom8px forwards, ... ;
--ds-flag-reposition: transform 250ms cubic-bezier(0.4, 0, 0, 1);
--ds-button-hovered:  background-color 150ms cubic-bezier(0.4, 1, 0.6, 1);
--ds-listitem-hovered: background-color 50ms cubic-bezier(0.4, 1, 0.6, 1), ... ;
```

Três fatos saem daí, e nenhum deles é questão de gosto:

1. **Entrar e sair não são simétricos.** O que entra leva 150–250 ms e desacelera (`out-*`,
   `inout-bold`); o que sai leva 100–200 ms e acelera embora (`in-practical`). Uma curva só para
   as duas direções é o que produz a sensação de "quase certo".
2. **Reposicionar um elemento tem um token próprio** — `--ds-flag-reposition`, 250 ms em
   `inout-bold`. É a resposta da própria evidência para "uma coisa indo para outro lugar".
3. **As durações são uma escala**, não números avulsos: 50/100/150/200/250/400/600.

Os outros bundles confirmam a escala em uso: `preferences/index.js` tem
`animation-timing-function:cubic-bezier(0.4, 0.15, 0.6, 0.85)` em um spinner, e os preloads trazem
três keyframes de carregamento e `transition: all .2s ease` no cromo injetado em `trello.com`.

**Arrastar e soltar não está no asar.** Varredura dos 25 bundles por `beautiful-dnd`,
`pragmatic-drag`, `isDragging` e `droppable`: zero ocorrências. O `cubic-bezier` só aparece nos
dois arquivos acima. Ou seja: a *gramática* do movimento foi recuperada, o comportamento do
quadro continua fora do binário, pelo mesmo motivo de sempre — ele vem de `trello.com`.

### Armazenamento

Chaves de `local-storage` observadas, todas do cliente de analytics:
`analytics-web-client`, `awc.ui.viewed.last.sent`, `awc-dev.*`, `awc-staging.*`, `awc-local.*`.

## O que não está no app

**A interface de quadros do Trello não está no binário.** O asar contém o shell desktop; o produto
(quadros, listas, cartões, arrastar e soltar, permissões, sincronização) é carregado de `trello.com`
em tempo de execução dentro do `webContents`. A análise estática confirma isso por ausência: 676
módulos, 1.676 findings, zero relacionado a domínio de quadros.

Consequência prática: a engenharia reversa reproduz fielmente a **casca**, e a interface tem que ser
implementação original. É o que foi feito aqui.

## Limitações declaradas pela própria análise

O REA reporta 17 limitações. As que importam para este trabalho:

1. **Sete bundles de renderer não foram analisados** por esgotamento de heap do worker:
   `auth/index.js`, `downloads/index.js`, `find_in_page/index.js`, `newcard/index.js`,
   `preferences/index.js`, `prompt/index.js`, `welcome/index.js`. O que esses arquivos fazem
   internamente está fora da evidência — por isso a UI dessas janelas aqui é projeto próprio, não
   reconstrução.
2. **Um corpo de JavaScript inline em `auth/index.html` não foi analisado.**
3. **Expressões dinâmicas de canal permanecem sem resolução** e nunca são pareadas por semelhança
   textual. Daí os sete símbolos sem valor literal acima.
4. **Tudo foi lido como texto inerte.** Nada do bootstrap do bundle foi executado, então registro em
   runtime, alcançabilidade e enforcement seguem não provados.
5. **Cobertura do grafo é incompleta**, e o próprio relatório avisa: ausência de fato não deve ser
   lida como fato ausente.

## Mapeamento: evidência → este repositório

| Evidência | Onde foi aplicada |
|---|---|
| 10 renderers + 1 main | `electron/windows.ts` — as dez janelas registradas (a `preferences` é exibida como "Configurações") |
| Geometria (`frame:!1`, 500×325, 900×620, 900×640, minWidth/minHeight) | `electron/windows.ts` |
| `exposeInMainWorld("electron", { logger, ipc })` com 7 membros | `electron/preload/bridge.ts` |
| `init_config` só na janela main | `electron/preload/main.ts` vs. `electron/preload/window.ts` |
| Guard de canal antes de encaminhar | `SUPPORTED_CHANNELS` em `electron/channels.ts` |
| Canais literais `window-*`, `app-*`, `find-in-page-*`, `prefs.locale` | `electron/channels.ts` |
| Símbolos `TRIGGER_*`, `TITLE_CHANGE`, `FOCUS`, `BLUR` | `electron/channels.ts`, com literal próprio e marcado como `SYMBOL` |
| `app-store` + `node-persist` | `electron/store.ts` — um JSON em `userData`, escrita atômica |
| Titlebar desenhada pelo renderer (porque `frame:!1`) | `src/renderer/shared/components/TitleBar.tsx` |
| Seis canais de `find-in-page` | `electron/main.ts` + `src/renderer/find_in_page/` |
| Estrutura dos tokens Atlaskit (light/dark/typography/spacing/shape) | `src/renderer/shared/styles/tokens.css`, com valores próprios |
| Escala de duração, quatro curvas e a mola do `atlassian-motion` | `src/renderer/shared/styles/tokens.css`, **com os valores do bundle** |
| Formas de `FadeIn0to100`, `ScaleIn95to100`, `SlideInBottom8px` | `tokens.css`, com nomes da casa |
| Pareamentos `--ds-blanket-enter`, `--ds-modal-enter`, `--ds-popup-enter-bottom` | `--enter-blanket`, `--enter-modal`, `--enter-popup` em `tokens.css`, aplicados ao modal do cartão, ao painel de arquivados, às Configuracoes, ao editor de etiquetas, ao menu da lista e ao dock |
| `--ds-flag-reposition` (transform 250 ms `inout-bold`) | `src/renderer/main/useFlip.ts`, a animação de reposicionar cartões e listas |
| `--ds-button-hovered` (150 ms `out-practical`) | `--ease` em `tokens.css`, a curva de todo `transition` de estado do app |
| React 18.3.1 | `package.json` |

**Sobre os valores de movimento.** As cores dos temas são projeto próprio e seguem só a *estrutura*
dos bundles Atlaskit. O movimento é a exceção declarada: durações e curvas foram adotadas como
estão no bundle, anotadas como recuperadas em `tokens.css`. Uma curva é a medida de como o app se
move, da mesma categoria que a geometria das janelas e os nomes de canal que este repositório já
copiou — e a correspondência é justamente o que foi pedido. O ângulo do cartão em voo, a aparência
da vaga aberta e o tempo de vida do arraste não vêm daí: são nossos, porque o quadro não está no
binário.

**Implementação original, sem correspondência no binário:** todo o modelo de dados
(`src/renderer/shared/types.ts`), o reducer (`reducer.ts`), arrastar e soltar, etiquetas, prazos,
checklists, filtro, sidebar de quadros e o modal de cartão.

### Funcionalidades que a evidência não cobre

Fundo do quadro, anexos, imagens e automações foram pedidos depois, inspirados no Trello, e **nada
neles veio desta análise** — a UI do Trello não está no binário, e os sete bundles de renderer que
poderiam conter pistas são justamente os que o REA não conseguiu parsear (limitação 1). São projeto
próprio:

| Funcionalidade | Onde | Observação |
|---|---|---|
| Fundo do quadro | `shared/background.ts`, `shared/settings/BackgroundSettings.tsx` | Cores, gradientes próprios e imagem local. O Trello usa fotos do Unsplash, que exigem rede e chave de API; o Nivora é offline. |
| Estado "concluído" do cartão | `shared/types.ts`, `main/CardModal.tsx` | O Trello marca conclusão pelo `dueComplete` do prazo; aqui é um booleano no cartão, que funciona sem prazo e sem checklist. |
| Anexos e imagens | `electron/assets.ts`, `main/Attachments.tsx` | Loja de ativos em `userData/assets` e protocolo `nivora://`. Os canais `assets-*` são invenção do Nivora, marcados como tal em `electron/channels.ts`. |
| Automações | `shared/automations.ts`, `shared/settings/AutomationsSettings.tsx` | Inspirado no Butler do Trello, mas o motor, os gatilhos, as ações e as travas contra loop são desenho próprio. |
| Texto formatado em descrição e comentários | `shared/markdown.ts`, `shared/textEdit.ts`, `main/RichEditor.tsx`, `main/RichText.tsx` | O editor do Trello não está no asar: varredura dos bundles por `prosemirror`, `tiptap`, `@atlaskit/editor`, `markdown-it` e `remark` dá zero, e os acertos de "Bold" são tokens de cor (`color.background.brand.bold`). Do Trello vem só o contrato - o texto é guardado em Markdown. O Trello edita em WYSIWYG; aqui é um textarea de Markdown com a barra de ferramentas e uma pré-visualização. |

Os temas Atlaskit embutidos no asar provam que o app original usa um sistema de tokens, e
`tokens.css` segue essa mesma estrutura — mas com cores e escalas próprias, nunca os valores da
Atlassian.

## Nota sobre direito autoral

O que foi copiado daqui: nomes de canais IPC, nomes de arquivos, dimensões de janela e a forma do
contrato do `contextBridge` — fatos de interface, do tipo que existe para interoperabilidade.

O que não foi copiado: código, assets, ícones, marca ou os valores dos tokens do Atlaskit. A
interface de quadros é escrita do zero. Os temas têm a mesma estrutura dos pacotes Atlaskit, com
cores próprias. O nome e a identidade visual do Trello pertencem à Atlassian; este projeto não os
usa e não se apresenta como Trello.

Reproduzir código ou assets proprietários, ou distribuir algo que se passe pelo app oficial, não é
o que este repositório faz e não é o que a análise habilita.
