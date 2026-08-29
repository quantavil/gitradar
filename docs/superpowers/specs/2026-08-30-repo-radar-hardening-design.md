# RepoRadar Hardening and Continuous Feed Design

## Goal

Fix the correctness, persistence, performance, accessibility, and UX findings from the senior audit while preserving RepoRadar's continuous-card experience. The feed must not expose pagination controls. Its subheader must show the contributing CDN sources and a live `Remaining X / Y` count.

## Product Decisions

- Keep one continuous page-level scroll; do not add page numbers, next/previous controls, a load-more section, or a nested scrolling panel.
- Fetch daily, weekly, and monthly datasets concurrently so `Y` represents the complete unique catalog available for the selected language.
- Display `Source: Daily + Weekly + Monthly · Remaining X / Y` inline. Only successful sources appear in the source list.
- Define `Y` as all unique repositories loaded for the selected language, including repositories already seen. Define `X` as catalog repositories that are not currently marked seen.
- Marking a card seen removes it from the active feed immediately. Undo or restoring from History makes it eligible for the feed immediately without another network request.
- Preserve the current visual card design and responsive layout.

## Approaches Considered

### 1. Window virtualization — selected

Keep the complete deduplicated catalog in application memory, derive the unseen feed from it, and render only visible cards plus a small overscan buffer with `@tanstack/svelte-virtual`. Dynamic measurement supports variable-height descriptions and tags, while `createWindowVirtualizer` preserves the existing page scroll.

This keeps continuous scrolling, accurate counts, keyboard navigation, and low DOM/image/listener counts even when the CDN returns thousands of repositories.

### 2. Sentinel-driven incremental rendering

Render an initial batch and append another batch when a bottom sentinel becomes visible. This is simpler, but the DOM grows back to thousands of cards after a long session and does not solve history/saved scalability.

### 3. Hard feed cap

Load or display only the first 50–100 repositories. This is fastest, but hides valid results and makes `Remaining X / Y` misleading. It conflicts with the goal of browsing the complete catalog.

## Architecture

### Validated network client

Move raw CDN access from `RepoFeed` into a pure `trendshift-client.ts` module. It will:

- request daily, weekly, and monthly endpoints concurrently;
- use an `AbortController` timeout per request;
- validate that each successful response is an array of valid repository records;
- return successful source names, normalized records, and per-source failures;
- treat malformed HTTP 200 responses as failures rather than empty feeds;
- abort the prior language request when a new request begins.

`RepoFeed` remains the reactive orchestration layer. It owns the complete `catalog`, derives `repos` from `catalog` and `SeenStore`, and exposes `totalCount`, `remainingCount`, `successfulTimeframes`, loading, and partial/full error state.

### Persistent seen/saved state

Replace duplicated repository payloads with one IndexedDB-backed persistence adapter. `SeenStore.init()` completes legacy migration before the initial feed request. Store normalized records with timestamps:

- seen record: `{ key, repo, seenAt }`;
- saved record: `{ key, repo, savedAt }`;

Keep the small theme, language, auto-seen, and swipe preferences in a guarded localStorage adapter so the pre-render theme script can remain synchronous. Validate each preference independently and fall back to its default when corrupt.

The in-memory Maps remain Svelte-reactive. Persistence writes are serialized and errors become observable store state rather than console-only failures. A `BroadcastChannel` keeps tabs synchronized. Legacy localStorage values are migrated once, validated independently, and removed only after a successful IndexedDB transaction.

Imported JSON is schema-validated and size-limited before an atomic replacement. Repository URLs are normalized to `https://github.com/<full_name>`; imported or CDN-provided arbitrary schemes are never rendered.

### Virtualized presentation

Create `VirtualFeed.svelte` using the official Svelte adapter for TanStack Virtual. It uses window virtualization, stable repository keys, dynamic element measurement, and an overscan buffer. Keyboard `J/K` navigation calls `scrollToIndex` instead of querying cards that may not currently exist in the DOM.

Move scroll-past tracking from one observer/listener bundle per catalog item to the small set of mounted virtual cards. A card is only auto-seen after it was intersecting and then passes above the sticky header. Virtual rows that were skipped during a fast scroll are not marked seen.

Saved and History views use a shared virtualized responsive grid so their DOM size also remains bounded without adding pagination UI.

### Count and source UI

The feed subheader renders one compact status sentence:

`Filter: ALL LANGUAGES | Source: Daily + Weekly + Monthly · Remaining 1,838 / 1,843`

On narrow screens it may wrap as one flex row, but the source and count remain adjacent. The count is exposed through a polite live region that announces changes without repeating the entire subheader.

### Behavior synchronization

Because the active feed is derived from the complete catalog and current seen keys:

- dismiss/auto-seen decrements `X` and removes the card;
- undo/unsee increments `X` and restores the card at catalog order;
- reset history changes `X` to `Y` immediately;
- importing history recomputes `X` immediately;
- cross-tab updates recompute the feed and count immediately;
- changing language replaces the catalog and resets keyboard focus safely.

Saved ordering records bookmark time. “Newest” means most recently bookmarked. Growth sorts by daily-equivalent gain: daily unchanged, weekly divided by 7, and monthly divided by 30.

## Accessibility and UX

- Wrap header controls in a named navigation landmark and expose the active view with `aria-current`.
- Use native `<dialog>` where supported, with a focused fallback and inert application shell.
- Register the shortcut as `Shift+?`; remove or document the misleading `R` and `Z` aliases.
- Preserve a global browser focus-visible fallback instead of clearing every outline.
- Add Home, End, and typeahead behavior to the language combobox.
- Announce loading, partial-source failures, remaining-count changes, and persistence failures.

## Testing

Add Vitest for pure store/client tests and Vitest Browser Mode with Chromium for Svelte interaction tests.

Required regression coverage:

- concurrent source fetch, timeout, cancellation, partial failure, malformed HTTP 200, and deduplication;
- legacy storage migration, invalid values, atomic import, persistence failure, and cross-tab merge;
- stub metadata enrichment and stable seen/saved timestamps;
- immediate dismiss, undo, history restore, reset, import, and remaining-count changes;
- `Shift+?`, `J/K`, modal focus/inertness, combobox navigation, and active navigation semantics;
- virtual feed with 2,000 fixture repositories rendering a bounded number of cards;
- desktop and 390px visual smoke checks with no pagination controls.

## Documentation and Cleanup

Update README and AGENT documentation to describe bounded browser persistence accurately, remove the duplicate `seen_repos` write after migration, remove unused helpers, validate dates before formatting, restore canonical MIT license text, and use typed SVG attributes instead of catch-all `any` props.

## Acceptance Criteria

- A 2,000-item catalog renders no more than 40 repository cards at rest.
- No pagination or load-more UI exists.
- The subheader displays successful sources and `Remaining X / Y` inline on desktop and mobile.
- Count and feed update immediately for seen, undo, restore, reset, import, and cross-tab changes.
- New language selections cancel obsolete requests; a request cannot load forever.
- Malformed CDN/storage/import data cannot produce a false caught-up state or unsafe repository link.
- Static checks, unit tests, browser tests, and production build pass.
