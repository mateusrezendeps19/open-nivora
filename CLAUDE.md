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

### Dragging a card

The board draws a drag by rendering the move **as though it had already happened**
(`previewMove` in `main/cardDrag.ts`): the card sits in the slot it would land in, its old space
is closed, and `useFlip` animates every card that ended up somewhere else. The commit therefore
changes nothing on screen.

Two coordinate systems meet here and they are off by one. `card/move`'s `toIndex` counts slots
with the card **still in the list**; the board counts them with the card **already out**, because
that is the order it is drawing. `toActionIndex` converts, and `tests/carddrag.test.ts` walks
every card into every slot of every list asserting that the drawing and the commit agree. Change
one side without the other and the card lands one slot away from where the drag promised.

**Chromium decides a lot of this, and it is not negotiable.** A native drag source must keep
being painted, keep its box and stay uncovered, for the whole drag. Each of these was tried and
each one fails hard:

| On the drag source | What happens |
|---|---|
| `display: none`, `position: absolute` | renderer process dies on the first drag |
| `height: 0`, or `opacity: 0` | renderer process dies |
| `pointer-events: none` | the drag never starts |
| another element laid over it | `dragend` fires immediately, drag over |

`opacity: 0.35` is fine, and moving the node in the DOM is fine - which is exactly why the card
in flight is drawn as a dimmed, dashed, *moved* card and not as a hole with a placeholder
somewhere else. There is no version of "hide it and draw a gap" that Chromium survives.

Two more consequences, both already paid for:

- **The drop target is never read off the element under the pointer.** `freezeLists` measures
  every card's midpoint when the drag starts and the target is resolved against that frozen
  ruler, from the pointer's coordinates alone. Reading the live DOM makes the drag chase itself:
  the card is inserted above the pointer, the layout shifts, the pointer lands on the card it
  just moved, and the drag stalls there.
- **The move is committed on `dragend`, not on `drop`.** Chromium never delivers a drop when the
  pointer comes up over the element the drag started from - which is precisely where the board
  draws the card. `onDragLeave` on the canvas clears the pending drop when the pointer leaves the
  board, and that is the whole reason a release on the dock archives or deletes the card instead
  of also moving it.

`dragPreview.ts` replaces Chromium's drag image, which is a flat snapshot that cannot be tilted,
with a transparent GIF so the board can draw the card itself (`.drag-layer`, z 30). It reports
whether that took: on false the board leaves the native ghost alone and draws no card of its own,
or there would be two.

### Motion

Durations and easing curves in `tokens.css` are **recovered LITERAL** from
`@atlaskit-internal_atlassian-motion` in the asar - unlike the colours, which are ours. The
asymmetry is the point: what enters is slower and decelerates, what leaves is quicker and
accelerates away. `--enter-blanket` / `--enter-modal` / `--enter-popup` are the recovered
pairings; `useFlip` repositions on `--duration-long` + `--ease-inout-bold`, which is what the
real app's own reposition token is made of. New motion belongs on that scale, and a new overlay
gets the pairing that matches what it is. Every animation is switched off under
`prefers-reduced-motion`.

### Archived cards

`card/archive` sets `archivedAt` rather than moving the card: it stays in its list at its own
index, so `card/restore` puts it back where it was without having to remember a target. The cost
is that **everything which draws or counts cards has to filter it out** - `BoardCanvas`, the
column badge, the sidebar count, `groupByDay`. A new surface that lists cards has to filter it
too, or archived cards quietly come back. The exception is the Dados tab, which reports what the
file holds and so counts them, on a line of their own. The only way back for the user is the panel reached from
the foot of the sidebar; the entry is hidden when the board has none.

### Card history

`reducer()` wraps `baseReducer` in `applyAndLog` (`shared/activity.ts`), which appends a line to
`card.activity` for the changes worth remembering, and hands that same wrapper to
`runAutomations` - so what a rule does to a card is logged like what the user does.

The feed is the right-hand column of the card modal (`.modal__body` is a two-column grid,
`modal__main` + `modal__side`), and stacks back under the card below 880px, because the main
window's recovered `minWidth` is 760. The layout is ours: the board interface is not in the asar.

The card is a fixed shell - `height: min(720px, 100%)`, header and footer pinned, `.modal__body`
the one scrolling surface, backdrop `overflow: hidden`. **Nothing inside the body may be a second
scroller**: Chromium latches a wheel gesture to whatever is under the pointer, so a textarea with
its own scrollbar leaves the card sitting still while the user scrolls. That is why the
description uses `field-sizing: content` and grows instead. The label editor is a popover
positioned against `.modal__section--labels` (z 5, the list menu's layer) so that opening it
overlays the card rather than pushing what is under the pointer out of the way; it closes on
Escape, on its own x, and on a mousedown outside - which skips `.modal__section-action`, or the
click that closes it would reopen it.

Two rules hold the feed together:

- The line's **text is composed when it happens** and never recomputed. A list renamed or deleted
  later must not rewrite what the history says.
- `comment/update` and `comment/remove` **guard on `kind === 'comment'`**. Events are the record
  of what happened; only what the user wrote is the user's to change.

`replace` is excluded, like it is from automations: a document arriving from disk or from another
window would otherwise log its whole history a second time.

Labels live on the **document**, not on a board (`label/add` and `label/update` do not go through
`mapActiveBoard`), so an edit from one card reaches every board. There is deliberately no
`label/remove`: cards and automation rules point at label ids, and deleting one would have to
decide what becomes of the rules that trigger on it.

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
  z-index layers in use: list menu 5, floating dock 20, the dragged card 30, card modal and
  archive panel 50, settings panel 60. The dragged card is above the dock so it passes over the
  trash rather than under it.
- Commits follow Conventional Commits with a Portuguese body (also unaccented) that explains the
  reasoning, not just the change. When a fix is subtle, the history records that the test was
  validated against the bug by reverting the fix and watching it fail.
