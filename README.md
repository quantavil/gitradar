# RepoRadar

**RepoRadar** is an ultra-fast, zero-duplicate GitHub trending repository discovery web app. Built with an editorial utilitarian aesthetic, it streams trending repositories concurrently from the static CDN while ensuring you never see the same repository twice.

---

## Features

- **Zero-Duplicate Discovery**: IndexedDB persistence (backed by synchronous preference storage and cross-tab `BroadcastChannel` synchronization) tracks seen history across sessions and tabs.
- **Continuous Virtualized Feed**: Window-virtualized feed (`@tanstack/svelte-virtual`) handles thousands of repositories smoothly with bounded DOM nodes—no pagination, next/previous buttons, or load-more clicks required.
- **Live Feed & Source Status**: Dynamic status banner shows active timeframe sources (`Daily + Weekly + Monthly`) and remaining unseen count (`Remaining X / Y`) updating in real time.
- **Scroll-Past Auto-Seen**: Mounted cards are automatically marked as seen when scrolled past.
- **Mobile Touch Gestures**:
  - **Swipe Right** (> 120px): Bookmark / Save repository.
  - **Swipe Left** (> 120px): Mark seen.
  - Native touch pan support (`touch-action: pan-y`) for smooth mobile vertical scrolling.
- **Inline Language Filtering**: Fast language selector with keyboard navigation, Home/End, and prefix typeahead support.
- **Saved Bookmarks View**: 2-column virtualized bookmarks grid with search filter, daily-equivalent growth sort, star count sort, newest saved sort, JSON export, and clear-all modal.
- **Seen History Inspector**: Virtualized seen history grid sorted newest-seen-first, with instant restore to feed and clear history modal.
- **Settings & Preferences**: Theme toggle (Dark / Light), auto-seen on scroll toggle, mobile swipe gestures toggle, validated atomic history import (up to 2 MiB), and keyboard shortcuts reference.
- **Full Keyboard & Screen Reader Accessibility**: WCAG AA compliant contrast, native `<dialog>` modals with `inert` backdrop trapping, visible focus rings, and `@tanstack/hotkeys`.

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
| <kbd>Esc</kbd> | Close active modal or return to feed stream |

---

## Technology Stack

- **Framework**: [Svelte 5](https://svelte.dev/) with Svelte 5 Runes (`$state`, `$derived`, `$props`, `$effect`)
- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Virtualization**: [@tanstack/svelte-virtual](https://tanstack.com/virtual)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Geist Typography
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
