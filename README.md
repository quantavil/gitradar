# RepoRadar

**RepoRadar** is an ultra-fast, zero-duplicate GitHub trending repository discovery web app. Built with an editorial utilitarian aesthetic, it streams trending repositories concurrently from the static CDN while ensuring you never see the same repository twice.

---

## Features

- **Zero-Duplicate Discovery**: IndexedDB persistence (backed by synchronous preference storage and cross-tab `BroadcastChannel` synchronization) tracks seen history across sessions and tabs.
- **Continuous Virtualized Feed**: Window-virtualized feed (`@tanstack/svelte-virtual`) handles thousands of repositories smoothly with bounded DOM nodes—no pagination, next/previous buttons, or load-more clicks required.
- **Live Feed & Source Status**: The masthead shows the active timeframe (for example `Daily`), the remaining unseen count (`Remaining X / Y`) and a progress bar, updated in real time.
- **Scroll-Past Auto-Seen**: A card is marked as seen when you scroll down past it, once its bottom edge crosses the sticky header. Cards stay visible, greyed out, until you leave the feed.
- **Mobile Touch Gestures**:
  - **Swipe Right** (> 100px): Bookmark / Save repository.
  - **Swipe Left** (> 100px): Mark seen, or unmark it on a seen card.
  - Native touch pan support (`touch-action: pan-y`) for smooth mobile vertical scrolling.
- **Inline Language Filtering**: Fast language selector with keyboard navigation, Home/End, and prefix typeahead support.
- **Saved Bookmarks View**: 2-column virtualized bookmarks grid with search filter, daily-equivalent growth sort, star count sort, newest saved sort, JSON export, and clear-all modal.
- **Seen History Inspector**: Virtualized seen history grid sorted newest-seen-first, with instant restore to feed and clear history modal.
- **Settings & Preferences**: Theme toggle (Dark / Light), auto-seen on scroll toggle, mobile swipe gestures toggle, single-key shortcuts toggle, history export, and a confirmed history import (up to 2 MiB). Importing asks before it replaces your current history.
- **Keyboard & Screen Reader Accessible**: Text colours meet WCAG AA contrast in both themes (checked with computed ratios), confirmation dialogs use native `<dialog>`, focus rings are visible, and single-key shortcuts can be turned off in Settings. Escape always works.

---

## Keyboard Shortcuts

| Shortcut | Action |
|:---:|---|
| <kbd>1</kbd> | Switch to Feed View (Home) |
| <kbd>2</kbd> | Switch to Saved Bookmarks View |
| <kbd>3</kbd> | Switch to Seen History View |
| <kbd>4</kbd> or <kbd>Shift+?</kbd> | Switch to Settings & Shortcuts View |
| <kbd>J</kbd> | Focus next repository card |
| <kbd>K</kbd> | Focus previous repository card |
| <kbd>S</kbd> | Save / Bookmark active repository |
| <kbd>D</kbd> | Mark active repository as seen |
| <kbd>U</kbd> | Undo last dismissed repository |
| <kbd>Esc</kbd> | Close a dialog, or return to the feed |

---

## Technology Stack

- **Framework**: [Svelte 5](https://svelte.dev/) with Svelte 5 Runes (`$state`, `$derived`, `$props`, `$effect`)
- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Virtualization**: [@tanstack/svelte-virtual](https://tanstack.com/virtual)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with Newsreader (display), Geist (UI) and Geist Mono (data) typography
- **Keyboard Navigation**: [@tanstack/hotkeys](https://tanstack.com/hotkeys)
- **Testing**: [Vitest](https://vitest.dev/) (Unit & Browser Playwright Chromium)

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

### 4. Run Browser Integration Tests (Headless Chromium)
The browser suite needs the Playwright Chromium build pinned by this project: run `bunx playwright install chromium` once.
```bash
bun run test:browser
```

### 5. Full Verification (Typecheck + All Tests + Build)
```bash
bun run verify
```

---

## License

[MIT License](LICENSE) © 2026 quantavil
