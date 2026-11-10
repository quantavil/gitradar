# Project Agent (AGENT.md)

## Project Overview
- **GitRadar**: trending GitHub repository discovery. Svelte 5 runes, Vite+ (`vp`: Vite, Vitest, Oxlint, Oxfmt), Tailwind v4, `idb-keyval`, Bun.
- **Data**: `https://quantavil.github.io/trendshift/data/{daily|weekly|monthly|yearly}/{tf}-{lang}.json`. Each file is a newest-first archive of 25-repo periods; `period_key` is `2026-10-18`, `2026-W42`, `2026-M10` or `2026`.

## Architecture (`src/lib`)
- `types.ts`, `repo-schema.ts`: shared types and validation (`normalizeRepo` keeps `period_key`).
- `client.ts`: fetches and caches one archive per (timeframe, language).
- `feed.svelte.ts`: selected timeframe/language/sort, deduped and sorted `periods`, progress counts.
- `triage.svelte.ts`: saved and seen entries (IndexedDB + BroadcastChannel), undo, JSON export/import, theme.
- `format.ts`, `collection.ts`: pure helpers (`collection.ts` also holds the Saved/Seen language and period filters).
- `toast.svelte.ts`: the one shared toast; `motion.ts`: `reduced()` for JS-driven animation.
- UI: `App.svelte` (shell and keys), `Topbar`, `BottomDock`, `DiscoverView`, `CollectionView` (Saved and Seen), `SettingsView`, `RepoRow` (single row for every list), `Select` (the only dropdown), `ConfirmDialog`, `Toast`, `Icon`.

## Rules
- Only three shortcuts exist: S save, D dismiss, O open (plus arrows and Esc). No keyboard hints in the UI.
- Every filter uses `Select.svelte`; no native `<select>` comes back. Its popup is a `[role="listbox"]`, and the global key handlers ignore keys while a dialog or listbox is open.
- The timeframe is a segmented control at 720px and wider and a `Select` below that; both exist in the markup and CSS shows one.
- Options may carry a `short` label for phone-width triggers; the popup always shows the full label.
- No virtualization library: rows use `content-visibility: auto` and further periods load through an `IntersectionObserver` sentinel.
- `data-theme` on `<html>` is `system` or a named theme (`THEMES` in `types.ts`: light, dark, nord, dracula, solarized, rosepine); `index.html` sets it before paint, so a new theme needs its token block in `app.css`, its entry in `THEMES` and its id in the `index.html` list.
- `RepoRow` swipe writes transform/CSS vars straight to the DOM in a `requestAnimationFrame`; never route pointer-move through `$state`. Commit is distance >= clamp(56, 20% width, 88) or a flick.
- Reassign `$state` Maps and Sets; mutating them in place does not notify `$derived`.
- Verify with `bun run verify` (type check, unit tests, build); `bunx vp check` runs format and lint.
