# Nivora

**An offline kanban board for the desktop, whose Electron shell was rebuilt from a reverse
engineering analysis of the official Trello desktop app.**

[![License: MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-44-47848f?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Nivora is two things at once. The **desktop shell** — the window inventory, the IPC contract, the
frameless title bar, the geometry — was reconstructed from evidence extracted out of the Trello
desktop app's `app.asar` with [REA](https://github.com/morluto/rea). The **board interface** —
cards, drag and drop, labels, attachments, automations — is original work, because Trello's own UI
is not in the binary at all: it is loaded from `trello.com` at runtime.

Everything runs offline. No account, no server, no network.

The full analysis — what was recovered, what was not in the binary, and which part of this
repository came from which piece of evidence — is in
[`docs/REVERSE-ENGINEERING.md`](docs/REVERSE-ENGINEERING.md) (written in Portuguese).

---

## Features

- **Boards** — several of them, each with its own background
- **Lists** — rename in place, reorder by dragging, delete
- **Cards** — drag and drop between lists and within a list, with a live insertion line
- **Card detail** — done state, description, labels, due date, checklist with progress, attachments
- **Board background** — solid colors, eight gradients, or an image from disk
- **Attachments and images** — pick files or drop them on a card; images get a thumbnail and can
  become the card cover; open with the system app or reveal in the folder
- **Automations** — per-board rules, in the spirit of Trello's Butler
- **Filter** — by title and description, preserving real indices so a drop still lands correctly
- **Light and dark themes**
- **Shortcuts** — `Ctrl+N` new card, `Ctrl+F` find, `Ctrl+K` filter, `Ctrl+,` settings
- **Local storage** — one JSON file in `userData`, written atomically

### Settings

A single **Settings** button on the toolbar opens four tabs: Appearance (theme and delete
confirmation), Background, Automations, and Data. The Settings window (`Ctrl+,`) renders **the same
component** as the in-board modal, so the two surfaces cannot drift apart.

### Automations

A rule is one trigger plus a list of actions.

| Triggers | Actions |
|---|---|
| card created in *list* | mark / unmark the card as done |
| card moved to *list* | move to *list* |
| *label* added | add / remove *label* |
| checklist completed | set due date in *N* days, or clear it |
| | add a checklist item, or mark the checklist complete |

Rules run inside the reducer, right after the user's action, and they chain: a rule that moves a
card can trigger the rule on the destination list. Two guards prevent loops — chaining stops after
the third pass, and **a rule fires at most once per card per dispatch**. The second one is what
guarantees termination: the (rule, card) pairs only ever grow, so a cycle runs out of fresh pairs
and stops. Loading a document from disk never fires a rule.

Some actions quietly do nothing unless the card is in the right shape — *mark the checklist
complete* has nothing to do on a card with no pending items, for instance. The rule editor shows
that caveat inline, so a rule that cannot act is not mistaken for a broken one. To complete the
card itself, regardless of checklist or due date, the action is **mark the card as done**.

### Background and attachments

Files are copied into `userData/assets`, named by their content hash (so the same file is never
stored twice), capped at 25 MB. The renderer reads them through a dedicated privileged scheme,
`nivora://assets/<name>`, registered in the main process — not through `file://`. That keeps the
page's CSP tight and never hands it a path into the rest of the disk; the handler rejects anything
that tries to escape the asset folder.

Removing an attachment, replacing the background image, or deleting a card drops the file right
away. There is also an orphan sweep at startup, which only runs when a document was genuinely read
from disk — a seeded document references nothing, and the sweep would think everything is an orphan.

Trello offers Unsplash photos, which needs the network and an API key. Nivora is offline, so the
equivalent here is picking a local file.

---

## Running it

```bash
npm install          # installs dependencies and downloads the Electron binary
npm run dev          # Vite + Electron with renderer reload
npm start            # production build, then launch
```

Other commands:

```bash
npm test             # 41 reducer and automation-engine tests (Node's test runner)
npm run smoke        # 13 end-to-end checks against the packaged app (Playwright)
npm run typecheck    # tsc --noEmit
npm run build        # main/preload bundle (esbuild) + renderers (Vite)
```

> npm 12 blocks install scripts by default. `package.json` declares
> `allowScripts: ["electron", "esbuild"]`, because Electron needs its postinstall to download the
> platform binary. If it does not download, run `node node_modules/electron/install.js`.

---

## Architecture

```
electron/
  channels.ts        IPC contract; marks what is a literal from the evidence and what is a symbol
  windows.ts         the 10 windows of the original app, with the recovered geometry
  main.ts            IPC handlers, menu, find-in-page, lifecycle, navigation lock
  store.ts           JSON persistence in userData, atomic write via rename
  assets.ts          asset store, nivora:// protocol, orphan sweep
  preload/
    bridge.ts        contextBridge: electron.{logger, ipc} with a channel allowlist
    main.ts          preload for the main window (also exposes init_config)
    window.ts        preload for every other window
src/renderer/
  shared/            types, document, reducer, automations, assets, tokens, TitleBar
  shared/settings/   the Settings tabs, used by both the modal and the window
  main/              the board app
  newcard/           quick-card window (500x325)
  preferences/       Settings window (900x640)
  find_in_page/      search overlay
  welcome/           intro screen (900x620)
tests/
  reducer.test.ts      move maths and document normalization
  automations.test.ts  triggers, actions, chaining, termination
  smoke.mjs            preload, allowlist, title bar, persistence, background, assets, contrast
docs/
  REVERSE-ENGINEERING.md      the analysis report
  rea-evidence-summary.json   extract of the REA evidence
```

### Why the shell looks like this

The original app creates every window with `frame: false`, so minimise, maximise and close all have
to round-trip through IPC — which is what `TitleBar` does. The ten renderers, the geometry, the
seven members of `electron.ipc`, the `init_config` that only the `main` window gets, and the
`window-*` / `app-store` / `find-in-page-*` channels all came out of the `app.asar` analysis.

Renderers talk to each other through the document: any window writes via `app-store`, the main
process broadcasts the change, and the others adopt it. That is how the `newcard` window stays
independent of the main app.

### What did not come from the binary

Trello's board interface is not in the app — it is loaded from `trello.com` at runtime. So the data
model, the reducer, drag and drop, labels, due dates, checklists, the card modal, attachments, the
background picker and the automation engine are all original. No proprietary code, assets, icons or
Atlaskit token values were copied.

---

## License

[MIT](LICENSE) © 2026 Mateus Rezende

"Trello" and its visual identity belong to Atlassian. Nivora does not use the trademark, does not
reuse proprietary code or assets, and does not present itself as the official product. The reverse
engineering covered interface facts — IPC channel names, file names, window dimensions, the shape
of the `contextBridge` contract — the kind of fact that exists for interoperability.

## Author

**Mateus Rezende** — [LinkedIn](https://www.linkedin.com/in/mateus-rezende-626687310) ·
[GitHub](https://github.com/mateusrezendeps19)
