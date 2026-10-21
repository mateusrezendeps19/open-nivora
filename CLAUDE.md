# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # build main+preloads, start Vite, launch Electron against it
npm start          # production build, then launch
npm run build      # esbuild (main + preloads) then vite build
npm run typecheck  # tsc --noEmit over src, electron, scripts, vite.config.ts
npm test           # unit tests: esbuild tests/*.test.ts to CJS, run with node --test
npm run smoke      # npm run build, then drive the built app with Playwright
```

There is no linter. `npm run typecheck` is the static gate; it is strict with `noUnusedLocals`.

Running one unit test file or one test case means going around the runner, which always bundles
every `tests/*.test.ts`:

```bash
node scripts/test.mjs                                   # all of them
node --test --test-name-pattern "semana" dist/tests/calendar.test.cjs   # after a run has bundled
```

`npm run smoke` is the only check that exercises IPC, the preload allowlist, persistence to
`userData` and cross-window behaviour. Changes to anything in `electron/`, to `useDocument`, or to
a satellite window are not verified until it passes.

## Architecture

Two halves with different origins, and the distinction is the point of the project:

- **`electron/`** — the shell, reconstructed from evidence extracted out of the Trello desktop
  `app.asar` with REA. Window inventory, geometry, IPC names and the frameless title bar come from
  that analysis, written up in `docs/REVERSE-ENGINEERING.md` (Portuguese).
- **`src/renderer/`** — the board UI, original work. Trello's own interface is not in the binary;
  it is loaded from trello.com at runtime, so there was nothing to reconstruct.

Keep that line intact. Do not present renderer work as recovered, and do not change a recovered
constant to something more convenient without saying so.

### IPC contract

`electron/channels.ts` and `src/renderer/shared/channels.ts` are two copies of the same contract —
the main process cannot import renderer code. **Adding or renaming a channel or a store op means
editing both.** Channel names are annotated `LITERAL` (recovered verbatim) or `SYMBOL` (only the
minified symbol was recoverable, so the literal is ours); preserve those annotations. The preload
validates every channel against `SUPPORTED_CHANNELS`, which is derived from those objects, so a
channel missing from one copy fails the allowlist at runtime rather than at compile time.

### The document and who may write it

The whole app state is one JSON document (`BoardDocument`) persisted as `boards.json` in
`userData`, written atomically via rename. Every window loads it through `useDocument`.

**Only the window that owns the document writes it.** Satellite windows (`newcard`,
`preferences`) must not read-modify-write the document: two windows doing that lose updates, and
the second write silently drops the first one's change. Satellites call `commitToStore(action)`,
which sends `StoreOp.APPLY` to the main process, which forwards the action to the `main` window,
which applies it through the normal reducer so automations run and the usual save path persists
it. The read-modify-write fallback inside `commitToStore` exists only for when no `main` window
is open, where nothing else is writing.

Related invariants in `useDocument`, each of which has already caused a bug:

- A document that arrived from the store is tracked **by reference** (`fromStore`) and never
  echoed back. A "skip the next save" flag is wrong here: React batches, so two store updates can
  collapse into one render and leave such a flag raised, dropping the next real edit.
- A pending debounced write is flushed when the window stops being the active one, and
  `backgroundThrottling` is off in `webPreferences`, because Chromium otherwise suspends the
  debounce timer of a backgrounded window while another window is reading the store.
- Satellite windows render against the seed document before the real one arrives. Any id held in
  component state (a selected list, a selected board) must fall back when it is no longer among
  the current ones — filling only an *empty* selection leaves a stale id that matches nothing, and
  the reducer then drops the change without complaining.

`normalize()` in `shared/document.ts` tolerates partial and older documents; new fields on `Prefs`
need a default there and in `seedDocument()`, plus the two test fixtures that build a `Prefs`
literal.

### Reducer and automations

`reducer()` = `baseReducer()` + `runAutomations()`. `replace` is deliberately excluded from
automations: it is how a document arrives from disk or another window, and re-running rules over a
load would fire them again on state they already produced. `runAutomations` re-reads the card
between actions (an earlier rule may have moved or deleted it), dedupes on `rule.id:cardId`, and
caps passes, so rules that trigger each other terminate.

Card-level actions act on the **active board** (`mapActiveBoard`). Adding a card to a different
board therefore needs a `board/select` first — which is why `newcard` sends both actions in order.

### Due dates

Due dates are stored as ISO strings but belong to the day on the user's own clock. Everything goes
through the helpers in `shared/calendar.ts`: `new Date('2026-10-20')` parses as UTC midnight, which
is the previous day west of Greenwich, and that put cards on the wrong calendar day and showed a
date one day off on the card badge. Use `toDateInput`/`fromDateInput` for the date picker and
`moveDue` when rescheduling.

### Renderer windows

`vite.config.ts` builds one entry per window (`main`, `newcard`, `preferences`, `find_in_page`,
`welcome`), mirroring the asar's `.webpack/renderer/<window>/index.html` layout. `WindowName` lists
ten windows from the recovered inventory; the ones without a bundle fall back to the `main` entry.
Only the `main` preload exposes `window.init_config`, matching the real app — the smoke test
asserts this.

The Settings UI is one component rendered in two places (modal over the board, and the whole body
of the `preferences` window) so the two cannot drift.

## Conventions

- UI strings are Portuguese **without accents** ("Configuracoes", "cartoes", "Mes"). Text produced
  at runtime by `Intl`/`toLocaleDateString` keeps its accents and is fine.
- Comments and identifiers are English, and explain *why* — the constraint, the bug that motivated
  the shape — not what the line does.
- Styling is plain CSS per component with the tokens in `shared/styles/tokens.css`. There is no CSS
  framework. Both themes must work: dark is the default, light is `:root[data-theme='light']`.
  z-index layers in use: list menu 5, floating button 20, card modal 50, settings panel 60.
- Commits follow Conventional Commits with a Portuguese body (also unaccented) that explains the
  reasoning, not just the change. When a fix is subtle, the history records that the test was
  validated against the bug by reverting the fix and watching it fail.
