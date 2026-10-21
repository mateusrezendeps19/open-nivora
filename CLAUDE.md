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

- **`drag` and `dragend` are native listeners on the source element, not React props.** Moving
  the card into another list in the preview means another `ListColumn` renders it, so React
  unmounts the tile the drag started on. Chromium keeps dispatching to that detached element,
  where React's root-delegated listeners never hear it: the card under the pointer froze at the
  list boundary and the drag never ended. `beginDrag` attaches both on the element itself and
  reaches the current handlers through a ref.

`dragPreview.ts` replaces Chromium's drag image, which is a flat snapshot that cannot be tilted,
with a transparent GIF so the board can draw the card itself (`.drag-layer`, z 30). It reports
whether that took: on false the board leaves the native ghost alone and draws no card of its own,
or there would be two.

### The done circle on a card

Hovering a tile opens a circle beside the title (`.tile__check`) and pushes the title right;
clicking it toggles `done` with the same `card/update` the card modal sends, so history and
automations follow. It animates `width`, not a transform, so the title rewraps instead of
sliding over the edge - which means it changes layout, and that has two consequences:

- It is **frozen open while the card is being dragged**. Letting it close at drag start reflows
  the title inside the drag source, and a run of the smoke suite failed every drag test in the
  one run where that could happen. Not proven to be the cause, but it is the one thing that
  changes the drag source and it costs nothing to freeze.
- The tile is a `<button>`, so the circle is a `span role="checkbox"` that stops the click (or
  the card would open). It takes no focus; from the keyboard, the modal's Marcar como concluido
  is the same action.

The pop on ticking is gated on a `ticked` state set by the click, not on `card.done`, or every
finished card would pop on each load. In tests, the first synthetic mouse move after another
action does not always update `:hover` in Chromium: move twice and wait for the circle's width.

### Motion

Durations and easing curves in `tokens.css` are **recovered LITERAL** from
`@atlaskit-internal_atlassian-motion` in the asar - unlike the colours, which are ours. The
asymmetry is the point: what enters is slower and decelerates, what leaves is quicker and
accelerates away. `--enter-blanket` / `--enter-modal` / `--enter-popup` are the recovered
pairings; `useFlip` repositions on `--duration-long` + `--ease-inout-bold`, which is what the
real app's own reposition token is made of. New motion belongs on that scale, and a new overlay
gets the pairing that matches what it is. Every animation is switched off under
`prefers-reduced-motion`.

### Formatted text

Descriptions and comments are stored as **Markdown**, as Trello stores them; text written before
the editor existed is plain text, which is already valid, so nothing is migrated. Three pieces:

- `shared/markdown.ts` parses a subset into a tree. `RichText` turns the tree into React
  elements. **There is no HTML string anywhere** and there must never be one - no
  `dangerouslySetInnerHTML` - because that is the whole of the XSS story. Links are only
  `http(s)`/`mailto`; anything else stays text. They open with `target="_blank"`, which the
  main process routes to the system browser; nothing may navigate the app window.
- `shared/textEdit.ts` is what the toolbar does, as pure functions over value + selection, all
  unit-tested. Blank lines do not count when deciding whether a toggle adds or removes.
- `RichEditor` applies those edits through `execCommand('insertText')` on just the changed span,
  so they land on the textarea's own undo stack. The selection is parked for after a render only
  on the fallback path: parked by an edit that rendered nothing, it waited for the next
  keystroke's render and scrambled the typing.

Activity **events** stay plain text on purpose: they quote card and list titles, and a title with
an asterisk must not italicise the history.

Neither editor folds up when it loses focus. Folding moves everything below it in the middle of
the click that took the focus away, and the click lands on whatever slid under the pointer -
which is how "Editar" on the comment right under the comment box stopped working. The editor
also owns `Escape` and `Ctrl+K` while focused (`stopPropagation`), because `App` listens for
both on the window to close the card and to focus the search.

The comment box's toolbar drops Titulo and Bloco de codigo (`fullOnly`): the side column is
300px wide at the window's minimum size and the full toolbar does not fit on one row.

### Stored files are shared, and only App deletes them

The asset store names an imported file by its **content hash**, so the same picture attached to
two cards - or used as two boards' background - is one file. A copied list's cards point at the
original's files too. Deleting a file from the place that dropped it therefore deletes it for
everyone else using it; that is what every delete path used to do.

So nothing calls `removeAsset` except one effect in `App`: after each document change it deletes
what `releasedAssets(before, after)` reports - files the old document referenced and the new one
references nowhere, archived cards included. It starts from the first loaded document, never
from the seed, for the same reason the startup sweep is guarded. A change made in the
preferences window reaches it too, because it is applied by the main window. **Do not add a
`removeAsset` call next to a dispatch**; dispatch, and let the document decide.

The startup sweep still exists for files orphaned in a session that ended before the effect ran.

### Lists: the menu, copy and move

`ListMenu` is a child of the column, not of the column header: the header is `draggable`, and a
text field inside it turns an attempt to select its text into a list drag. It closes on a
capture-phase mousedown outside it (skipping the "..." button, which is its own toggle) and on
Escape. `list/copy` gives the copy fresh ids all the way down, leaves archived cards behind and
starts each card's history over with one line saying where it came from. `list/transfer` takes a
list to another board; to the active board it is plain `list/move`.

### Filtering the board

The Filtros popover is Trello's (`FilterPanel`); the semantics are in `shared/filter.ts` and
unit-tested: options in one group add up, groups narrow each other, a group with nothing ticked
does not filter. The filter is state in `App` and is **not saved** - a filter still on the next
morning reads as cards gone missing. The keyword is one field of it, and the same field is the
search box, `Ctrl+K` and the Localizar window, so they can never disagree.

- A surface that lists cards goes through `isShown` (archived out, then the filter), like the
  board does; the calendar uses `matchesFilter` on top of its own archived check.
- A hidden card is still in its list, so **the drop slot counts visible cards and the reducer
  counts all of them**. `slotToIndex` converts, after `toActionIndex`'s own off-by-one. Without
  it, a drop after the last visible card landed before it.
- Clearing is in two places, the banner over the board and the popover's footer. The footer sits
  outside the popover's scrolling body and is always shown (disabled with nothing on): at the end
  of the list and only while filtering, nobody found it. There is deliberately no third beside the
  Filtros button: it came and went with the filter, changed the width of the centred group and
  made the search box jump.
- Any/all label matching is two buttons, not a `<select>`: the select was disabled until two
  labels were ticked and read as a dropdown that would not open.

The title bar is a three-column grid - views, search + Filtros, actions - whose side columns
share the leftover space, so the middle stays centred. At the window's minimum width (760) the
controls only fit because the window title gives way (ellipsis, down to nothing) and the search
box shrinks to 100px; the smoke test checks that nothing overlaps there with a filter on.

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

Labels live on the **document**, not on a board (`label/add`, `label/update` and `label/remove`
do not go through `mapActiveBoard`), so an edit from one card reaches every board. Cards and
automation rules point at label ids, so `label/remove` cleans up after itself on every board:

- the id leaves every card, **archived ones included**, or restoring one would bring back an id
  that names nothing;
- `rulesWithoutLabel` drops a rule that triggers on the label (it could never fire again), drops
  steps that add or remove it, and drops a rule left with no steps. Re-pointing a trigger at "any
  label" was rejected: it changes what the rule does without anyone asking;
- the editor's confirmation says how many cards and rules it touches (`labelUsage`), and there is
  no undo, as in Trello. Nothing is written to the cards' history.

The filter is the one place an id can outlive its label, since it is not in the document: `App`
draws against `withLabels(filter, ...)`, or a deleted label left ticked would hide every card
with no box anywhere to untick.

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
  z-index layers in use: list menu 5, floating dock 20, the dragged card 30, filter popover 40, card modal and
  archive panel 50, settings panel 60. The dragged card is above the dock so it passes over the
  trash rather than under it.
- Commits follow Conventional Commits and are written **entirely in English** - subject and body.
  The body explains the reasoning, not just the change. When a fix is subtle, the history records
  that the test was validated against the bug by reverting the fix and watching it fail. Commits
  up to `dd9e089` have Portuguese bodies; they are history and are not rewritten. UI strings
  stay Portuguese - this rule is about the git history only.
- **Every commit is pushed** to `origin` right after it is made. Run the gate first
  (`npm run typecheck`, `npm test`, and `npm run smoke` when the change touches what only the
  smoke reaches), and never force-push.
