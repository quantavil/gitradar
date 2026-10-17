# Project Agent (AGENT.md)

## Project Overview
- **Name**: RepoRadar — Zero-duplicate GitHub trending repository discovery web app.
- **Tech Stack**: Svelte 5 Runes, Bun, Vite 8, Tailwind CSS v4, `@tanstack/hotkeys`, `@tanstack/svelte-virtual`, Playwright Chromium Vitest.
- **Data Source**: Trendshift Static CDN API (`https://quantavil.github.io/trendshift/data/`).

---

## Key Architecture & Components
- `src/lib/storage/repo-db.ts`: IndexedDB transactional persistence with atomic schema migration from legacy localStorage keys.
- `src/lib/storage/preferences.ts`: Guarded preference storage adapter for UI switches and theme.
- `src/lib/seen.svelte.ts`: `SeenStore` rune class managing IndexedDB persistence, in-memory `Map<string, SeenEntry>` and `Map<string, SavedEntry>`, and cross-tab `BroadcastChannel` synchronization.
- `src/lib/trendshift-client.ts`: Concurrent CDN catalog client with timeout, source priority deduplication, and timeframe availability tracking.
- `src/lib/api.svelte.ts`: `RepoFeed` orchestrator maintaining raw catalog and derived unseen/filtered repos.
- `src/lib/VirtualFeed.svelte`: Window virtualizer feed for single-column continuous discovery with dynamic item height measurement.
- `src/lib/VirtualRepoGrid.svelte`: 2-column (desktop) / 1-column (mobile) window virtualizer for Saved and History collections.
- `src/lib/saved-sort.ts`: Daily-equivalent star growth calculation and multi-criteria sorting for saved bookmarks.
- `src/lib/history-import.ts`: Atomic, validated import parser supporting all legacy history shapes up to 2 MiB.
- `src/lib/RepoItem.svelte`: Shared canonical card component with single-border utilitarian styling and sanitized GitHub URLs.
- `src/lib/RepoCard.svelte`: Swipeable card with save and seen actions. Scroll-past is measured by `VirtualFeed.svelte` through `scroll-past.ts`; there is no IntersectionObserver.
- `src/lib/ConfirmModal.svelte`: Native `<dialog>` confirmation modal. It moves to `document.body`, marks the app shell `inert` while open, restores focus, and Escape cancels it.
- `src/lib/LanguageSelect.svelte`: Combobox dropdown with `aria-activedescendant`, Home/End keys, and prefix typeahead.
- `src/lib/Navbar.svelte`: Sticky header (`data-site-header`, measured for the feed offset) with a labeled `<nav aria-label="Primary">`; the active view has `aria-current="page"`.
- `src/lib/hotkeys.ts`: Keyboard shortcut bindings (<kbd>1</kbd>–<kbd>4</kbd>, <kbd>Shift+?</kbd>, <kbd>J</kbd>, <kbd>K</kbd>, <kbd>S</kbd>, <kbd>D</kbd>, <kbd>U</kbd>, <kbd>Esc</kbd>) with modal and input guards. Single-key shortcuts can be turned off (preference `repo_radar_shortcuts`); Escape always works.

---

## Blunders Log
- **Svelte 5 Virtualizer Effect Loop**: Accessing and setting options on `$virtualizer` inside `$effect` creates an infinite reactive loop. Fix: wrap `virtualizer.setOptions` inside `untrack(() => ...)`.
- **Svelte 5 Set/Map Reactivity**: Mutating Svelte 5 `$state(new Set())` or `$state(new Map())` in-place does NOT notify `$derived` listeners. Reference must be reassigned (`this.seenEntries = new Map(...)`).
- **Vitest Browser Dynamic Reload Crash**: `@tanstack/svelte-virtual` requires explicit `optimizeDeps.include` in `vitest.config.ts` to prevent dynamic reload errors during headless browser tests.
- **EventTarget vs Element closest**: `KeyboardEvent.target` can be `window` or `Document` without `.closest()`. Fix: check `target && typeof target.closest === 'function'`.
- **Storage Key Normalization & Metadata**: `markSeen` with string keys omitted `seenDetails` entries, causing empty history metadata. Fixed by storing full `TrendshiftRepo` objects and normalizing keys on storage load.
- **Mobile Touch Gesture Collision**: Swiping cards horizontally without `style="touch-action: pan-y"` collided with browser vertical scrolling. Fixed by applying `touch-action: pan-y` and `e.preventDefault()` during active horizontal swipe.
- **Explicit Dismiss State Flip**: `handleExplicitDismiss` called `toggleSeen` instead of `markSeen`, un-marking previously seen repos when dismissed. Fixed by explicitly calling `markSeen(repo)`.
- **Swipe Overlay Text Contrast**: Light mode swipe action text on green/red background had 1.4:1 contrast (`text-zinc-950`). Fixed by setting `text-white dark:text-zinc-950`.
- **Unmounted Card Auto-Seen Trigger**: `IntersectionObserver` callback in `RepoCard.svelte` triggered on card unmount when switching views. Fixed by checking `entry.target.isConnected`. (Historical: the IntersectionObserver was later replaced by scroll measurement in `VirtualFeed.svelte`.)
- **Malformed Storage Parse Crash**: `JSON.parse` of `localStorage` threw `TypeError` on non-tuple array items. Fixed by checking `Array.isArray(item) && item.length >= 2`.
- **Hotkey Leak Behind Open Modals**: Global hotkeys (<kbd>1</kbd>–<kbd>4</kbd>, <kbd>S</kbd>, <kbd>D</kbd>) remained active while modal dialogs were open. Fixed by checking for active modal dialogs in global listener.
- **Unfocused Hotkey Target Defaulting**: Pressing <kbd>S</kbd> or <kbd>D</kbd> without explicit card focus (`focusedIndex === -1`) defaulted to `repos[0]`. Fixed with explicit `focusedIndex < 0` guard.
- **Combobox ARIA Role**: `aria-activedescendant` on `<button>` without `role="combobox"` triggered Svelte 5 a11y compiler warnings. Fixed by adding `role="combobox"`.
- **Listbox Hotkey Leak**: Global hotkeys triggered when custom combobox listboxes were open. Fixed by adding `[role="listbox"]` to modal detector in `hotkeys.ts`.
- **Feed Truncation at 10 Unseen Repos**: `api.svelte.ts` broke the timeframe loop as soon as `collected.length >= 10`, cutting off the feed prematurely. Fixed by removing the artificial break to sweep all available unseen repos across `daily`, `weekly`, and `monthly` timeframes.
- **Card Focus Selector Failure**: `scrollFocusedIntoView` queried `[role="article"]`, but `<article>` lacked explicit role attribute, returning `null`. Fixed by adding `role="article"` and querying `article`.
- **Modal Escape Event Collision**: `hotkeys.ts` fired global `actions.onEscape` when modals were open, unexpectedly switching view to feed. Fixed by delegating Escape to the open modal.
- **History View Order**: `seenStore.seenDetails` keys were rendered oldest-first. Fixed by reversing the array so newest seen repos render first.

---

## File Structure & Map
- `src/lib/storage/`: IndexedDB repository storage and synchronous preferences helpers.
- `src/lib/icons/`: Typed SVG icon components, re-exported by `src/lib/icons.ts` (import from `./icons`).
- `src/app.css`: Tailwind v4 base styles, Geist typography, physical `<kbd>` styling, micro-animations, minimal scrollbars.
