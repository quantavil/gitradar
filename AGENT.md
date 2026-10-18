# Project Agent (AGENT.md)

## Project Overview
- **RepoRadar**: trending GitHub repository discovery. Svelte 5 runes, Vite 8, Tailwind v4, `idb-keyval`, Bun, Vitest.
- **Data**: `https://quantavil.github.io/trendshift/data/{daily|weekly|monthly|yearly}/{tf}-{lang}.json`. Each file is a newest-first archive of 25-repo periods; `period_key` is `2026-10-18`, `2026-W42`, `2026-M10` or `2026`.

## Architecture (`src/lib`)
- `types.ts`, `repo-schema.ts`: shared types and validation (`normalizeRepo` keeps `period_key`).
- `client.ts`: fetches and caches one archive per (timeframe, language).
- `feed.svelte.ts`: selected timeframe/language/sort, deduped and sorted `periods`, progress counts.
- `triage.svelte.ts`: saved and seen entries (IndexedDB + BroadcastChannel), undo, JSON export/import, theme.
- `format.ts`, `collection.ts`: pure helpers.
- UI: `App.svelte` (shell and keys), `Topbar`, `BottomDock`, `DiscoverView`, `CollectionView` (Saved and Seen), `SettingsView`, `RepoRow` (single row for every list), `ConfirmDialog`, `Toast`, `Icon`.

## Rules
- Only three shortcuts exist: S save, D dismiss, O open (plus arrows and Esc). No keyboard hints in the UI.
- No virtualization library: rows use `content-visibility: auto` and further periods load through an `IntersectionObserver` sentinel.
- `data-theme` on `<html>` is `system`, `light` or `dark`; `index.html` sets it before paint.
- Reassign `$state` Maps and Sets; mutating them in place does not notify `$derived`.
- Verify with `bun run verify` (type check, unit tests, build).
