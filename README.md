# RepoRadar

**RepoRadar** is an ultra-fast, zero-duplicate GitHub trending repository discovery web app. Built with an editorial utilitarian aesthetic, it streams trending repositories concurrently from the static CDN while ensuring you never see the same repository twice.

---

## Features

- **Real trending windows**: Today / Week / Month / Year tabs load the matching archive from the Trendshift CDN. The newest period is "current"; older periods follow as an archive you can keep scrolling.
- **Ledger list**: one hairline row per repo with stars gained, total stars, language, age and social signal (HN / Reddit / X). Open a row for tags, the "why it is here" line and actions.
- **Triage, not pagination**: **Save** or **Dismiss** removes a repo from Discover and is undoable. Saved and Seen are searchable, sortable lists with Unsave / Restore.
- **Phone, tablet, desktop**: bottom dock and swipe gestures on touch (right = save, left = dismiss), full ledger columns on desktop.
- **Local only**: saved and seen repos live in IndexedDB (`idb-keyval`) and sync across tabs. Export and import JSON from Settings.
- **Themes**: System, Light and Dark.

## Keyboard

| Key | Action |
|:---:|---|
| <kbd>S</kbd> | Save the selected repo |
| <kbd>D</kbd> | Dismiss the selected repo |
| <kbd>O</kbd> | Open it on GitHub |

Arrow keys move the selection and <kbd>Esc</kbd> collapses the open row.

## Technology Stack

Svelte 5 (runes), Vite 8, Tailwind CSS v4, `idb-keyval`, Bun, Vitest. Data: `https://quantavil.github.io/trendshift/data/` (static JSON from [quantavil/trendshift](https://github.com/quantavil/trendshift), scraped from trendshift.io).

---

## Quick Start

### 1. Install Dependencies
```bash
bun install
```

### 2. Start Development Server
```bash
bun run dev
```

### 3. Run Unit Tests
```bash
bun run test
```

### 4. Full Verification (Typecheck + Tests + Build)
```bash
bun run verify
```

---

## License

[MIT License](LICENSE) © 2026 quantavil
