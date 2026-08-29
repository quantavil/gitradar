# RepoRadar Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make RepoRadar reliable with thousands of repositories while retaining one continuous, non-paginated feed and displaying successful CDN sources plus a live Remaining X / Y count inline.

**Architecture:** Fetch and validate all timeframes concurrently into a complete catalog, derive the active feed from catalog entries not present in the reactive seen store, and render the feed through window virtualization. Move repository persistence to an IndexedDB adapter with legacy migration and cross-tab synchronization; keep small synchronous preferences behind a guarded localStorage adapter.

**Tech Stack:** Svelte 5 runes, TypeScript 6, Bun, Vite 8, TanStack Virtual for Svelte, Vitest, Vitest Browser Mode, Playwright Chromium, native IndexedDB, BroadcastChannel.

---

## Design constraints

- No page numbers, next/previous controls, load-more button, pagination footer, or nested feed scroller.
- Use the browser window as the virtualizer scroll element.
- Render this exact information inline in the feed subheader:

  Filter: ALL LANGUAGES | Source: Daily + Weekly + Monthly · Remaining 1,838 / 1,843

- Total is the complete unique catalog loaded from successful timeframes.
- Remaining is the number of catalog entries not currently seen.
- Marking seen removes a card immediately; undo, restore, reset, import, and cross-tab changes recompute the feed without refetching.
- Preserve existing card styling, gestures, keyboard controls, theme behavior, and responsive breakpoints.

## File map

**Create**

- src/lib/repo-schema.ts — runtime normalization and validation for CDN, storage, and import records.
- src/lib/repo-schema.test.ts — schema, URL, date, and malformed-data tests.
- src/lib/trendshift-client.ts — concurrent, cancellable, timeout-bound CDN client.
- src/lib/trendshift-client.test.ts — fetch, timeout, cancellation, partial failure, and dedupe tests.
- src/lib/storage/preferences.ts — guarded localStorage access for theme/language/boolean preferences.
- src/lib/storage/preferences.test.ts — unavailable/corrupt storage tests.
- src/lib/storage/repo-db.ts — IndexedDB repository persistence and legacy migration.
- src/lib/storage/repo-db.browser.test.ts — real-browser IndexedDB migration and transaction tests.
- src/lib/VirtualFeed.svelte — variable-height window-virtualized feed.
- src/lib/VirtualFeed.browser.test.ts — large-feed DOM-bound and interaction tests.
- src/lib/VirtualRepoGrid.svelte — virtualized responsive rows for Saved and History.
- src/lib/App.browser.test.ts — count, source, hotkey, modal, and synchronization regressions.
- vitest.config.ts — unit and Chromium browser test projects.
- src/test/fixtures.ts — deterministic repository fixtures.

**Modify**

- package.json and bun.lock — test and virtualization dependencies/scripts.
- src/lib/types.ts — validated record, timeframe, persistence, and saved-entry types.
- src/lib/seen.svelte.ts — async initialization, reactive Maps, timestamps, errors, and broadcast sync.
- src/lib/api.svelte.ts — catalog-based feed state and derived counts.
- src/App.svelte — startup sequencing, inline feed status, virtual feed, and hotkey focus.
- src/lib/RepoCard.svelte — mounted-card-only observer and idempotent dismissal.
- src/lib/RepoItem.svelte — canonical GitHub URL and valid date formatting.
- src/lib/HistoryView.svelte and src/lib/SavedView.svelte — derived state and virtual grid.
- src/lib/SettingsView.svelte — validated atomic import and persistence status.
- src/lib/hotkeys.ts — Shift+? and documented bindings.
- src/lib/Navbar.svelte — navigation landmark and active state.
- src/lib/LanguageSelect.svelte — Home, End, and typeahead.
- src/lib/ConfirmModal.svelte — native dialog/inert behavior.
- src/app.css — focus fallback and virtual row styles.
- src/lib/icons/*.svelte — typed SVG attributes.
- index.html — guarded synchronous theme restoration.
- README.md, AGENT.md, LICENSE — accurate behavior and canonical text.

### Task 1: Establish the test and virtualization toolchain

**Files:**

- Modify: package.json
- Modify: bun.lock
- Create: vitest.config.ts
- Create: src/test/fixtures.ts

- [ ] **Step 1: Add the dependencies**

Run:

~~~bash
bun add @tanstack/svelte-virtual
bun add -D vitest @vitest/browser-playwright vitest-browser-svelte playwright
~~~

Expected: package.json contains the virtualizer under dependencies and the four test packages under devDependencies; bun.lock changes.

- [ ] **Step 2: Add repeatable scripts**

Add these package.json scripts:

~~~json
{
  "test": "vitest run --project unit",
  "test:browser": "vitest run --project browser",
  "test:all": "bun run test && bun run test:browser",
  "verify": "bun run check && bun run test:all && bun run build"
}
~~~

- [ ] **Step 3: Configure unit and browser projects**

Create vitest.config.ts:

~~~ts
import { playwright } from '@vitest/browser-playwright'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte()],
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts'],
        },
      },
      {
        plugins: [svelte()],
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
~~~

- [ ] **Step 4: Add deterministic fixture builders**

Create src/test/fixtures.ts with a builder that produces valid records without shared mutable arrays:

~~~ts
import type { TrendshiftRepo } from '../lib/types'

export function makeRepo(
  index: number,
  overrides: Partial<TrendshiftRepo> = {},
): TrendshiftRepo {
  return {
    rank: index + 1,
    score: 1000 - index,
    full_name: 'owner/repo-' + index,
    github_url: 'https://github.com/owner/repo-' + index,
    description: 'Repository ' + index,
    language: 'TypeScript',
    stars_total: 100 + index,
    stars_gained: 10,
    forks_total: index,
    forks_gained: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    tags: ['test'],
    social_mention_platforms: [],
    timeframe: 'daily',
    ...overrides,
  }
}

export function makeRepos(count: number): TrendshiftRepo[] {
  return Array.from({ length: count }, (_, index) => makeRepo(index))
}
~~~

- [ ] **Step 5: Prove both runners start**

Run:

~~~bash
bun run test
bun run test:browser
~~~

Expected: both commands exit 0 and report no matching test files or the initial smoke test passes; Chromium launches headlessly.

- [ ] **Step 6: Commit**

~~~bash
git add package.json bun.lock vitest.config.ts src/test/fixtures.ts
git commit -m "test: add unit and browser test harness"
~~~

### Task 2: Validate and normalize repository data

**Files:**

- Create: src/lib/repo-schema.ts
- Create: src/lib/repo-schema.test.ts
- Modify: src/lib/types.ts
- Modify: src/lib/RepoItem.svelte

- [ ] **Step 1: Write failing schema tests**

Create src/lib/repo-schema.test.ts:

~~~ts
import { describe, expect, it } from 'vitest'
import { normalizeRepo, normalizeRepoArray, safeGithubUrl } from './repo-schema'
import { makeRepo } from '../test/fixtures'

describe('repository schema', () => {
  it('normalizes identity and forces the canonical GitHub URL', () => {
    const result = normalizeRepo({
      ...makeRepo(1),
      full_name: ' OpenAI/Codex ',
      github_url: 'javascript:alert(1)',
    })
    expect(result?.full_name).toBe('OpenAI/Codex')
    expect(result?.github_url).toBe('https://github.com/OpenAI/Codex')
  })

  it('rejects records without owner/name identity', () => {
    expect(normalizeRepo({ ...makeRepo(1), full_name: 'invalid' })).toBeNull()
  })

  it('rejects a non-array response', () => {
    expect(normalizeRepoArray({ repos: [] })).toEqual({
      ok: false,
      repos: [],
      reason: 'Expected an array',
    })
  })

  it('drops malformed records without poisoning valid records', () => {
    const result = normalizeRepoArray([makeRepo(1), null, { full_name: '' }])
    expect(result.ok).toBe(true)
    expect(result.repos).toHaveLength(1)
  })

  it('never returns a non-GitHub scheme', () => {
    expect(safeGithubUrl('owner/repo')).toBe('https://github.com/owner/repo')
  })
})
~~~

- [ ] **Step 2: Run the test and verify RED**

Run:

~~~bash
bun run test -- src/lib/repo-schema.test.ts
~~~

Expected: FAIL because repo-schema.ts does not exist.

- [ ] **Step 3: Implement the strict normalizer**

Create src/lib/repo-schema.ts with these public contracts:

~~~ts
import type { TrendshiftRepo } from './types'

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export type RepoArrayResult =
  | { ok: true; repos: TrendshiftRepo[] }
  | { ok: false; repos: []; reason: string }

export function safeGithubUrl(fullName: string): string {
  return 'https://github.com/' + fullName
}

export function normalizeRepo(value: unknown): TrendshiftRepo | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const fullName = typeof raw.full_name === 'string' ? raw.full_name.trim() : ''
  if (!FULL_NAME.test(fullName)) return null

  const stringValue = (key: string) =>
    typeof raw[key] === 'string' ? raw[key] as string : ''
  const numberValue = (key: string) =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] as number : 0
  const stringArray = (key: string) =>
    Array.isArray(raw[key])
      ? (raw[key] as unknown[]).filter((item): item is string => typeof item === 'string')
      : []

  return {
    rank: numberValue('rank'),
    score: numberValue('score'),
    full_name: fullName,
    github_url: safeGithubUrl(fullName),
    description: stringValue('description'),
    language: stringValue('language'),
    stars_total: numberValue('stars_total'),
    stars_gained: numberValue('stars_gained'),
    forks_total: numberValue('forks_total'),
    forks_gained: numberValue('forks_gained'),
    created_at: stringValue('created_at'),
    tags: stringArray('tags'),
    social_mention_platforms: stringArray('social_mention_platforms'),
  }
}

export function normalizeRepoArray(value: unknown): RepoArrayResult {
  if (!Array.isArray(value)) {
    return { ok: false, repos: [], reason: 'Expected an array' }
  }
  return {
    ok: true,
    repos: value.map(normalizeRepo).filter((repo): repo is TrendshiftRepo => repo !== null),
  }
}
~~~

Add a Timeframe union and persisted entry types to src/lib/types.ts:

~~~ts
export type Timeframe = 'daily' | 'weekly' | 'monthly'

export interface SeenEntry {
  key: string
  repo: TrendshiftRepo
  seenAt: number
}

export interface SavedEntry {
  key: string
  repo: TrendshiftRepo
  savedAt: number
}
~~~

- [ ] **Step 4: Make RepoItem use canonical URLs and valid dates**

Import safeGithubUrl and replace the current href expression:

~~~svelte
href={safeGithubUrl(repo.full_name)}
~~~

Replace formatDate with:

~~~ts
function formatDate(isoStr?: string) {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
~~~

- [ ] **Step 5: Run tests and static checks**

Run:

~~~bash
bun run test -- src/lib/repo-schema.test.ts
bun run check
~~~

Expected: schema tests pass and Svelte diagnostics report 0 errors and 0 warnings.

- [ ] **Step 6: Commit**

~~~bash
git add src/lib/repo-schema.ts src/lib/repo-schema.test.ts src/lib/types.ts src/lib/RepoItem.svelte
git commit -m "fix: validate repository records and links"
~~~

### Task 3: Extract a cancellable concurrent CDN client

**Files:**

- Create: src/lib/trendshift-client.ts
- Create: src/lib/trendshift-client.test.ts
- Modify: src/lib/types.ts

- [ ] **Step 1: Write failing client tests**

Cover all of these cases in src/lib/trendshift-client.test.ts using vi.stubGlobal('fetch', fetchMock):

~~~ts
it('fetches all timeframes concurrently and preserves source priority', async () => {
  const started: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    started.push(url)
    return new Response(JSON.stringify([makeRepo(started.length)]), { status: 200 })
  }))

  const result = await fetchTrendshiftCatalog('all', { timeoutMs: 1000 })

  expect(started).toHaveLength(3)
  expect(result.successfulTimeframes).toEqual(['daily', 'weekly', 'monthly'])
})

it('deduplicates by normalized full_name and keeps daily before weekly', async () => {
  // Return the same identity from daily and weekly with different casing.
  // Assert one catalog record and daily timeframe metadata.
})

it('reports malformed HTTP 200 as a source failure', async () => {
  // Return an object for daily and arrays for the other sources.
  // Assert daily is absent from successfulTimeframes and appears in failures.
})

it('returns partial data when one source times out', async () => {
  // Keep one request pending until its AbortSignal fires.
  // Assert the two completed source datasets remain available.
})

it('propagates caller cancellation without publishing stale data', async () => {
  // Abort the caller controller.
  // Assert an AbortError is thrown.
})
~~~

- [ ] **Step 2: Run the tests and verify RED**

Run:

~~~bash
bun run test -- src/lib/trendshift-client.test.ts
~~~

Expected: FAIL because fetchTrendshiftCatalog is undefined.

- [ ] **Step 3: Implement the client contracts**

Create src/lib/trendshift-client.ts with:

~~~ts
export interface CatalogFailure {
  timeframe: Timeframe
  message: string
}

export interface CatalogResult {
  catalog: TrendshiftRepo[]
  successfulTimeframes: Timeframe[]
  failures: CatalogFailure[]
}

export async function fetchTrendshiftCatalog(
  language: LanguageOption,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CatalogResult>
~~~

Implementation requirements:

1. Start all three fetch promises before awaiting Promise.allSettled.
2. Use one child AbortController per source.
3. Forward caller abort to all child controllers.
4. Clear each timeout in finally.
5. Validate response.ok and normalize await response.json().
6. Deduplicate in daily, weekly, monthly order using lowercase full_name.
7. Attach the winning timeframe to each repository.
8. Throw AbortError only for caller cancellation; record timeout/network/schema errors per source.
9. Remove abort listeners after completion.

Use this merge loop:

~~~ts
const byName = new Map<string, TrendshiftRepo>()
for (const timeframe of TIMEFRAMES) {
  const source = successful.get(timeframe) ?? []
  for (const repo of source) {
    const key = repo.full_name.toLowerCase()
    if (!byName.has(key)) byName.set(key, { ...repo, timeframe })
  }
}
~~~

- [ ] **Step 4: Run the client tests**

Run:

~~~bash
bun run test -- src/lib/trendshift-client.test.ts
~~~

Expected: all concurrency, timeout, cancellation, malformed-response, and dedupe tests pass.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/trendshift-client.ts src/lib/trendshift-client.test.ts src/lib/types.ts
git commit -m "feat: add validated concurrent trendshift client"
~~~

### Task 4: Guard synchronous preferences

**Files:**

- Create: src/lib/storage/preferences.ts
- Create: src/lib/storage/preferences.test.ts
- Modify: index.html
- Modify: src/lib/api.svelte.ts
- Modify: src/lib/seen.svelte.ts

- [ ] **Step 1: Write failing preference tests**

Test unavailable storage, malformed JSON, wrong types, and write failures:

~~~ts
it('returns the default when localStorage throws', () => {
  const storage = {
    getItem() { throw new DOMException('denied') },
    setItem() { throw new DOMException('denied') },
  } as Storage
  expect(readBooleanPreference(storage, 'auto_seen_on_scroll', true)).toBe(true)
})

it('rejects a non-boolean JSON preference', () => {
  const storage = memoryStorage({ auto_seen_on_scroll: '"yes"' })
  expect(readBooleanPreference(storage, 'auto_seen_on_scroll', true)).toBe(true)
})

it('accepts only known language values', () => {
  const storage = memoryStorage({ repo_radar_lang: 'not-a-language' })
  expect(readLanguagePreference(storage)).toBe('all')
})
~~~

- [ ] **Step 2: Run RED**

~~~bash
bun run test -- src/lib/storage/preferences.test.ts
~~~

Expected: FAIL because preferences.ts does not exist.

- [ ] **Step 3: Implement guarded helpers**

Expose:

~~~ts
export function getBrowserStorage(): Storage | null
export function readBooleanPreference(storage: Storage | null, key: string, fallback: boolean): boolean
export function writeBooleanPreference(storage: Storage | null, key: string, value: boolean): boolean
export function readLanguagePreference(storage?: Storage | null): LanguageOption
export function writeLanguagePreference(value: LanguageOption, storage?: Storage | null): boolean
export function readThemePreference(storage?: Storage | null): 'dark' | 'light'
export function writeThemePreference(value: 'dark' | 'light', storage?: Storage | null): boolean
~~~

Every helper catches storage exceptions and returns a success boolean for writes. Do not log inside the adapter; callers expose one user-facing persistence warning.

- [ ] **Step 4: Replace direct localStorage access**

Use the adapter in RepoFeed construction/language changes and SeenStore preference getters/setters. Update the inline index.html script with a self-contained guarded type check:

~~~js
try {
  const theme = localStorage.getItem('repo_radar_theme')
  document.documentElement.classList.toggle('dark', theme !== 'light')
} catch {
  document.documentElement.classList.add('dark')
}
~~~

- [ ] **Step 5: Run tests and checks**

~~~bash
bun run test -- src/lib/storage/preferences.test.ts
bun run check
~~~

Expected: tests pass; diagnostics stay clean.

- [ ] **Step 6: Commit**

~~~bash
git add src/lib/storage/preferences.ts src/lib/storage/preferences.test.ts index.html src/lib/api.svelte.ts src/lib/seen.svelte.ts
git commit -m "fix: guard browser preference storage"
~~~

### Task 5: Add IndexedDB persistence and atomic legacy migration

**Files:**

- Create: src/lib/storage/repo-db.ts
- Create: src/lib/storage/repo-db.browser.test.ts
- Modify: src/lib/types.ts

- [ ] **Step 1: Write browser tests for persistence**

Create a unique database name per test and cover:

~~~ts
it('stores and retrieves seen and saved records with timestamps', async () => {
  const db = await RepoDatabase.open(testDbName())
  await db.replaceSeen([{ key: 'owner/repo', repo: makeRepo(1), seenAt: 10 }])
  await db.replaceSaved([{ key: 'owner/saved', repo: makeRepo(2), savedAt: 20 }])
  expect(await db.getAllSeen()).toHaveLength(1)
  expect(await db.getAllSaved()).toHaveLength(1)
})

it('does not partially replace history when validation fails', async () => {
  // Seed one record, reject invalid input before the transaction,
  // and assert the seed remains.
})

it('migrates valid legacy records and ignores corrupt keys independently', async () => {
  // Seed seen_details, seen_repos, and saved_repos in localStorage.
  // Corrupt one preference value.
  // Assert repository data migrates and valid preferences still load.
})

it('removes legacy repository keys only after commit succeeds', async () => {
  // Force transaction abort and assert legacy keys remain.
})
~~~

- [ ] **Step 2: Run RED**

~~~bash
bun run test:browser -- src/lib/storage/repo-db.browser.test.ts
~~~

Expected: FAIL because RepoDatabase is undefined.

- [ ] **Step 3: Implement the database**

Create version 1 with stores seen and saved, both keyed by normalized key. Expose:

~~~ts
export class RepoDatabase {
  static open(name?: string): Promise<RepoDatabase>
  getAllSeen(): Promise<SeenEntry[]>
  getAllSaved(): Promise<SavedEntry[]>
  putSeen(entry: SeenEntry): Promise<void>
  deleteSeen(key: string): Promise<void>
  replaceSeen(entries: SeenEntry[]): Promise<void>
  putSaved(entry: SavedEntry): Promise<void>
  deleteSaved(key: string): Promise<void>
  replaceSaved(entries: SavedEntry[]): Promise<void>
  clearSeen(): Promise<void>
  clearSaved(): Promise<void>
  close(): void
}
~~~

Use a transaction helper that resolves on transaction.oncomplete and rejects on transaction.onerror or transaction.onabort. All replacement methods clear and insert within one readwrite transaction.

- [ ] **Step 4: Implement migration**

Expose:

~~~ts
export async function migrateLegacyStorage(
  db: RepoDatabase,
  storage: Storage | null,
): Promise<{ seen: number; saved: number }>
~~~

Migration rules:

1. Parse seen_details, seen_repos, and saved_repos independently.
2. Normalize every repository with repo-schema.ts.
3. Use stubs only for valid owner/name strings missing metadata.
4. Preserve insertion order with monotonically increasing timestamps.
5. Write both stores transactionally before deleting legacy repository keys.
6. Never delete theme, language, auto-seen, or swipe preferences.
7. Set repo_radar_storage_migrated to 1 only after success.

- [ ] **Step 5: Run browser tests**

~~~bash
bun run test:browser -- src/lib/storage/repo-db.browser.test.ts
~~~

Expected: all IndexedDB and migration tests pass in Chromium.

- [ ] **Step 6: Commit**

~~~bash
git add src/lib/storage/repo-db.ts src/lib/storage/repo-db.browser.test.ts src/lib/types.ts
git commit -m "feat: persist repository state in indexeddb"
~~~

### Task 6: Refactor SeenStore around explicit state transitions

**Files:**

- Modify: src/lib/seen.svelte.ts
- Create: src/lib/seen.svelte.test.ts

- [ ] **Step 1: Write failing SeenStore tests**

Inject a RepoPersistence interface and a clock function so tests do not depend on browser globals:

~~~ts
it('enriches an existing stub without changing seenAt', async () => {
  const store = await makeStore({
    seen: [{ key: 'owner/repo', repo: stubRepo('owner/repo'), seenAt: 10 }],
  })
  await store.enrichSeenDetails([makeRepo(1, { full_name: 'owner/repo' })])
  expect(store.seenDetails.get('owner/repo')?.description).toBe('Repository 1')
  expect(store.seenEntries.get('owner/repo')?.seenAt).toBe(10)
})

it('markSeen is idempotent and toggleSeen is explicit', async () => {
  const store = await makeStore()
  await store.markSeen(makeRepo(1))
  await store.markSeen(makeRepo(1))
  expect(store.seenSize).toBe(1)
  await store.unsee('owner/repo-1')
  expect(store.seenSize).toBe(0)
})

it('stores savedAt and orders saved entries without repository creation time', async () => {
  // Advance the fake clock between saves and assert savedAt values.
})

it('surfaces persistence errors without discarding in-memory state', async () => {
  // Make persistence reject, assert the Map changed and persistenceError is non-null.
})
~~~

- [ ] **Step 2: Run RED**

~~~bash
bun run test -- src/lib/seen.svelte.test.ts
~~~

Expected: FAIL against the current constructor and methods.

- [ ] **Step 3: Define the persistence boundary**

Add:

~~~ts
export interface RepoPersistence {
  getAllSeen(): Promise<SeenEntry[]>
  getAllSaved(): Promise<SavedEntry[]>
  putSeen(entry: SeenEntry): Promise<void>
  deleteSeen(key: string): Promise<void>
  replaceSeen(entries: SeenEntry[]): Promise<void>
  clearSeen(): Promise<void>
  putSaved(entry: SavedEntry): Promise<void>
  deleteSaved(key: string): Promise<void>
  clearSaved(): Promise<void>
}
~~~

SeenStore constructor accepts persistence, clock, and optional BroadcastChannel factory. The singleton creates the real RepoDatabase adapter.

- [ ] **Step 4: Replace state and methods**

Use these reactive fields and contracts:

~~~ts
seenEntries = $state<Map<string, SeenEntry>>(new Map())
savedEntries = $state<Map<string, SavedEntry>>(new Map())
ready = $state(false)
persistenceError = $state<string | null>(null)

async init(): Promise<void>
async markSeen(repo: TrendshiftRepo): Promise<void>
async unsee(fullName: string): Promise<void>
async resetSeen(): Promise<void>
async enrichSeenDetails(repos: TrendshiftRepo[]): Promise<void>
async toggleSave(repo: TrendshiftRepo): Promise<void>
async removeSaved(fullName: string): Promise<void>
async clearSaved(): Promise<void>
~~~

Keep compatibility getters seenDetails, saved, seenKeys, seenSize, isSeen, and isSaved during the component migration. Remove MAX_SEEN_ITEMS, the Debouncer, duplicate seen_repos writes, and console-only persistence handling.

- [ ] **Step 5: Add cross-tab synchronization**

Broadcast only normalized mutations:

~~~ts
type RepoStateMessage =
  | { type: 'seen-put'; entry: SeenEntry }
  | { type: 'seen-delete'; key: string }
  | { type: 'seen-replace'; entries: SeenEntry[] }
  | { type: 'saved-put'; entry: SavedEntry }
  | { type: 'saved-delete'; key: string }
  | { type: 'saved-clear' }
~~~

Apply incoming messages to new Map references without rebroadcasting them. Close the channel from a destroy method used by tests/HMR.

- [ ] **Step 6: Run tests**

~~~bash
bun run test -- src/lib/seen.svelte.test.ts
bun run check
~~~

Expected: all store tests pass; no Svelte diagnostics.

- [ ] **Step 7: Commit**

~~~bash
git add src/lib/seen.svelte.ts src/lib/seen.svelte.test.ts
git commit -m "refactor: synchronize persistent seen state"
~~~

### Task 7: Make RepoFeed catalog-based and expose live counts

**Files:**

- Modify: src/lib/api.svelte.ts
- Create: src/lib/api.svelte.test.ts

- [ ] **Step 1: Write failing feed-state tests**

Use injected client and SeenStore doubles:

~~~ts
it('counts total catalog and remaining unseen repositories', async () => {
  const seen = fakeSeenStore(['owner/repo-1'])
  const feed = new RepoFeed(fakeClient(makeRepos(3)), seen)
  await feed.fetchFeed()
  expect(feed.totalCount).toBe(3)
  expect(feed.remainingCount).toBe(2)
  expect(feed.repos.map((repo) => repo.full_name)).toEqual([
    'owner/repo-0',
    'owner/repo-2',
  ])
})

it('reacts immediately when history is reset or restored', async () => {
  // Fetch with one seen key, unsee it, and assert remainingCount changes
  // without invoking the client a second time.
})

it('does not publish an obsolete language response', async () => {
  // Resolve the first deferred client call after the second.
  // Assert only the second catalog is visible.
})

it('shows partial source state without discarding successful data', async () => {
  // Return daily and weekly plus one monthly failure.
  // Assert data is available and partialWarning is non-null.
})
~~~

- [ ] **Step 2: Run RED**

~~~bash
bun run test -- src/lib/api.svelte.test.ts
~~~

Expected: FAIL because catalog/count fields and injection do not exist.

- [ ] **Step 3: Implement catalog-derived state**

Use:

~~~ts
catalog = $state<TrendshiftRepo[]>([])
successfulTimeframes = $state<Timeframe[]>([])
partialWarning = $state<string | null>(null)

repos = $derived(
  this.catalog.filter((repo) => !this.seenStore.isSeen(repo.full_name)),
)
totalCount = $derived(this.catalog.length)
remainingCount = $derived(this.repos.length)
~~~

fetchFeed must:

1. Abort the previous controller.
2. Set loading/error state without clearing the prior catalog until the new request succeeds.
3. Call fetchTrendshiftCatalog with the selected language and signal.
4. Ignore AbortError from replacement requests.
5. Publish catalog and successfulTimeframes atomically for the current request.
6. Call enrichSeenDetails with catalog records already in seen state.
7. Show a full error only when no source succeeded.
8. Show partialWarning when at least one source failed.
9. Set loading false only for the current request.

- [ ] **Step 4: Run tests and checks**

~~~bash
bun run test -- src/lib/api.svelte.test.ts
bun run check
~~~

Expected: tests and diagnostics pass.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/api.svelte.ts src/lib/api.svelte.test.ts
git commit -m "refactor: derive feed and counts from catalog"
~~~

### Task 8: Build the continuous virtual feed

**Files:**

- Create: src/lib/VirtualFeed.svelte
- Create: src/lib/VirtualFeed.browser.test.ts
- Modify: src/lib/RepoCard.svelte
- Modify: src/app.css

- [ ] **Step 1: Write the 2,000-card browser regression**

Render VirtualFeed with makeRepos(2000):

~~~ts
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-svelte'
import VirtualFeed from './VirtualFeed.svelte'
import { makeRepos } from '../test/fixtures'

test('keeps the rendered card count bounded without pagination controls', async () => {
  const screen = await render(VirtualFeed, {
    props: {
      repos: makeRepos(2000),
      focusedIndex: -1,
      onFocusIndex: () => {},
      onDismiss: () => {},
    },
  })

  await expect.poll(() => screen.getByRole('article').all().then((items) => items.length))
    .toBeLessThanOrEqual(40)
  await expect.element(screen.getByRole('button', { name: /next page|load more/i }))
    .not.toBeInTheDocument()
})
~~~

Add tests that scroll near index 1,500, assert that repository becomes rendered, and assert a previously visible card triggers onDismiss only after crossing above the header.

- [ ] **Step 2: Run RED**

~~~bash
bun run test:browser -- src/lib/VirtualFeed.browser.test.ts
~~~

Expected: FAIL because VirtualFeed.svelte does not exist.

- [ ] **Step 3: Implement window virtualization**

Use createWindowVirtualizer with:

~~~ts
const virtualizer = createWindowVirtualizer({
  count: repos.length,
  estimateSize: () => 190,
  overscan: 6,
  getItemKey: (index) => repos[index]?.full_name ?? index,
  scrollMargin: listTop,
})
~~~

Render a relative spacer at virtualizer.getTotalSize() and only virtual items. Every row must have data-index, stable key, full width, measurement action, and transform based on row.start minus scrollMargin. Recalculate listTop with ResizeObserver when the subheader wraps.

Expose:

~~~ts
export function scrollToIndex(index: number): void
~~~

Use align auto for J/K and start for language changes. Do not use smooth scrolling for unmeasured distant rows.

- [ ] **Step 4: Keep auto-seen scoped to mounted cards**

RepoCard must:

1. Use markSeen, never toggleSeen, for explicit dismissal and scroll-past.
2. Keep touch listeners only while mounted.
3. Observe with rootMargin matching the 56px sticky header.
4. Require entry.isIntersecting before a later above-header exit.
5. Disconnect observer and remove all touch listeners in the same teardown.
6. Do nothing for virtual rows never intersected.

- [ ] **Step 5: Run browser tests at desktop and 390px**

~~~bash
bun run test:browser -- src/lib/VirtualFeed.browser.test.ts
~~~

Expected: <=40 articles at rest for 2,000 repositories in both configured viewport cases; target repository appears after scrollToIndex; no pagination control exists.

- [ ] **Step 6: Commit**

~~~bash
git add src/lib/VirtualFeed.svelte src/lib/VirtualFeed.browser.test.ts src/lib/RepoCard.svelte src/app.css
git commit -m "feat: virtualize the continuous repository feed"
~~~

### Task 9: Integrate counts, sources, focus, and startup in App

**Files:**

- Modify: src/App.svelte
- Modify: src/lib/hotkeys.ts
- Create: src/lib/App.browser.test.ts

- [ ] **Step 1: Write failing App behavior tests**

Cover:

~~~ts
test('shows successful sources and live remaining count inline', async () => {
  // Inject a three-item catalog with one seen item.
  // Assert one visible status line contains:
  // Source: Daily + Weekly + Monthly · Remaining 2 / 3
})

test('dismiss, undo, restore, reset, and import update count without refetch', async () => {
  // Perform each user action and assert count changes.
  // Assert fetch mock call count remains one.
})

test('Shift+? opens settings and J/K use virtualizer focus', async () => {
  // Press Shift+?, assert settings heading.
  // Return to feed, press J twice, assert the second repo article is focused.
})

test('startup waits for seenStore initialization before fetching', async () => {
  // Hold init pending and assert client has not run.
  // Resolve init and assert exactly one request.
})
~~~

- [ ] **Step 2: Run RED**

~~~bash
bun run test:browser -- src/lib/App.browser.test.ts
~~~

Expected: current count/source/startup/hotkey behavior fails.

- [ ] **Step 3: Sequence initialization**

Change onMount to:

~~~ts
onMount(() => {
  let cancelled = false
  const cleanupHotkeys = setupHotkeys(actions)

  void (async () => {
    await seenStore.init()
    if (!cancelled) await repoFeed.fetchFeed()
  })()

  return () => {
    cancelled = true
    repoFeed.cancel()
    cleanupHotkeys()
  }
})
~~~

- [ ] **Step 4: Render VirtualFeed and the inline status**

Replace the each block with VirtualFeed. Render sources and count in one adjacent group:

~~~svelte
<span>
  Source:
  <strong>{sourceLabel}</strong>
  <span aria-hidden="true"> · </span>
  <strong>Remaining {repoFeed.remainingCount.toLocaleString()} / {repoFeed.totalCount.toLocaleString()}</strong>
</span>
<span class="sr-only" role="status" aria-live="polite">
  {repoFeed.remainingCount} of {repoFeed.totalCount} repositories remaining
</span>
~~~

sourceLabel is successfulTimeframes mapped to title case and joined with ' + '. During loading show Source: Loading. If all fail show Source: Unavailable.

- [ ] **Step 5: Correct hotkeys and focus**

In hotkeys.ts:

~~~ts
'Shift+?': () => actions.onViewSettings?.(),
~~~

Remove the bare ? binding. Remove R unless it is displayed in Settings; keep U as the sole undo shortcut and remove undocumented Z. In App, clamp focusedIndex whenever repos changes and call VirtualFeed.scrollToIndex for J/K.

- [ ] **Step 6: Run browser tests**

~~~bash
bun run test:browser -- src/lib/App.browser.test.ts
~~~

Expected: status, synchronization, startup order, Shift+?, and J/K tests pass.

- [ ] **Step 7: Commit**

~~~bash
git add src/App.svelte src/lib/hotkeys.ts src/lib/App.browser.test.ts
git commit -m "feat: show live feed sources and remaining count"
~~~

### Task 10: Virtualize History and Saved, and correct Saved sorting

**Files:**

- Create: src/lib/VirtualRepoGrid.svelte
- Modify: src/lib/HistoryView.svelte
- Modify: src/lib/SavedView.svelte
- Create: src/lib/VirtualRepoGrid.browser.test.ts
- Create: src/lib/saved-sort.ts
- Create: src/lib/saved-sort.test.ts

- [ ] **Step 1: Write failing saved-sort tests**

~~~ts
it('sorts newest by savedAt, not repository created_at', () => {
  const older = { key: 'a/a', repo: makeRepo(1, { created_at: '2026-08-01' }), savedAt: 10 }
  const newer = { key: 'b/b', repo: makeRepo(2, { created_at: '2020-01-01' }), savedAt: 20 }
  expect(sortSaved([older, newer], 'newest')[0].key).toBe('b/b')
})

it('sorts growth by daily-equivalent gains', () => {
  const daily = saved(makeRepo(1, { stars_gained: 20, timeframe: 'daily' }))
  const weekly = saved(makeRepo(2, { stars_gained: 70, timeframe: 'weekly' }))
  expect(sortSaved([weekly, daily], 'growth')[0].key).toBe(daily.key)
})
~~~

- [ ] **Step 2: Implement exact sorting**

~~~ts
export function dailyEquivalent(repo: TrendshiftRepo): number {
  if (repo.timeframe === 'weekly') return repo.stars_gained / 7
  if (repo.timeframe === 'monthly') return repo.stars_gained / 30
  return repo.stars_gained
}
~~~

sortSaved accepts SavedEntry[] and supports newest, stars, growth, and name without mutating the source array.

- [ ] **Step 3: Write virtual grid browser tests**

Render 2,000 entries at 390px and 1024px. Assert a bounded number of cards, one column on mobile, two columns on desktop, and no pagination/load-more controls.

- [ ] **Step 4: Implement VirtualRepoGrid**

Virtualize rows, not individual cards:

- mobile row size: one item;
- desktop row size: two items;
- derive rows from matchMedia('(min-width: 768px)');
- measure each row after cards render;
- use window virtualization and the same listTop/ResizeObserver approach as VirtualFeed;
- use stable row keys derived from contained repository keys;
- expose an item action snippet so History can restore and Saved can remove.

- [ ] **Step 5: Migrate views**

History maps SeenEntry values newest seenAt first. Restore calls unsee and requires no feed callback.

Saved filters SavedEntry values, calls sortSaved, and passes entry.repo to RepoItem. Export JSON includes repo plus savedAt. Update the select label from Growth to Daily-equivalent growth.

- [ ] **Step 6: Run tests**

~~~bash
bun run test -- src/lib/saved-sort.test.ts
bun run test:browser -- src/lib/VirtualRepoGrid.browser.test.ts
bun run check
~~~

Expected: sort tests pass, virtual grid stays bounded at both breakpoints, diagnostics stay clean.

- [ ] **Step 7: Commit**

~~~bash
git add src/lib/VirtualRepoGrid.svelte src/lib/VirtualRepoGrid.browser.test.ts src/lib/HistoryView.svelte src/lib/SavedView.svelte src/lib/saved-sort.ts src/lib/saved-sort.test.ts
git commit -m "feat: virtualize repository collections"
~~~

### Task 11: Make import atomic, validated, and visible

**Files:**

- Modify: src/lib/seen.svelte.ts
- Modify: src/lib/SettingsView.svelte
- Create: src/lib/history-import.ts
- Create: src/lib/history-import.test.ts

- [ ] **Step 1: Write failing import tests**

~~~ts
it('rejects files larger than 2 MiB before FileReader parsing', () => {
  expect(validateImportFile({ size: 2 * 1024 * 1024 + 1 })).toEqual({
    ok: false,
    error: 'History file must be 2 MiB or smaller.',
  })
})

it('rejects a non-array and keeps existing history', async () => {
  // Seed one seen record, import an object, assert failure and seed remains.
})

it('normalizes tuple, string, and object legacy entries atomically', () => {
  // Assert canonical keys, safe URLs, timestamps, and exact record count.
})
~~~

- [ ] **Step 2: Implement import parsing**

Expose:

~~~ts
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024
export function validateImportFile(file: Pick<File, 'size'>): ImportValidation
export function parseHistoryImport(json: string, now?: () => number): ImportResult
~~~

Accept the three documented legacy shapes only. Normalize with repo-schema.ts, reject an array containing zero valid records unless the input array is empty, deduplicate by normalized key, and produce SeenEntry[].

- [ ] **Step 3: Replace history only after validation**

SeenStore.importHistoryJSON calls parseHistoryImport and then persistence.replaceSeen. Update the reactive Map only after the transaction succeeds. On failure retain the previous Map and return a user-facing error.

SettingsView checks file size before readAsText, disables the input during import, announces status with role status or alert, and shows persistenceError until dismissed.

- [ ] **Step 4: Run tests**

~~~bash
bun run test -- src/lib/history-import.test.ts
bun run test -- src/lib/seen.svelte.test.ts
bun run check
~~~

Expected: import and store tests pass; diagnostics stay clean.

- [ ] **Step 5: Commit**

~~~bash
git add src/lib/history-import.ts src/lib/history-import.test.ts src/lib/seen.svelte.ts src/lib/SettingsView.svelte
git commit -m "fix: validate and atomically import history"
~~~

### Task 12: Finish accessibility and interaction semantics

**Files:**

- Modify: src/App.svelte
- Modify: src/lib/Navbar.svelte
- Modify: src/lib/ConfirmModal.svelte
- Modify: src/lib/LanguageSelect.svelte
- Modify: src/lib/ToggleSwitch.svelte
- Modify: src/app.css
- Modify: src/lib/App.browser.test.ts

- [ ] **Step 1: Add failing browser assertions**

Assert:

- Navbar is a navigation landmark named Primary.
- Active destination has aria-current=page.
- Opening a confirmation dialog makes the app shell inert.
- Escape closes the dialog and restores trigger focus.
- LanguageSelect supports Home, End, and case-insensitive prefix typeahead.
- Every interactive control retains a visible focus indicator.

- [ ] **Step 2: Make Navbar semantic**

Wrap navigation buttons in:

~~~svelte
<nav aria-label="Primary">
~~~

Set aria-current={activeView === view ? 'page' : undefined}. Keep existing accessible labels and titles.

- [ ] **Step 3: Use native dialog behavior**

Add data-app-shell to the outer application div in App.svelte. Render the modal panel as dialog with showModal/close in an effect. On open:

1. store the active element;
2. set inert on the application shell;
3. call showModal;
4. focus Cancel.

On close:

1. close the dialog;
2. remove inert;
3. restore focus.

Handle cancel to prevent the browser from bypassing onClose. Keep the backdrop-click rule only when event.target is the dialog.

- [ ] **Step 4: Complete combobox keyboard support**

Add:

- Home -> first option;
- End -> last option;
- printable character -> first option whose label starts with the accumulated prefix;
- reset prefix after 500ms;
- aria-activedescendant only while open;
- scroll highlighted option into view.

- [ ] **Step 5: Restore focus fallback**

Remove:

~~~css
*:focus-visible, input:focus, select:focus {
  outline: none;
}
~~~

Add:

~~~css
:focus-visible {
  outline: 2px solid var(--accent-signal);
  outline-offset: 2px;
}
~~~

Component-specific rings may override this, but no control may have neither outline nor ring.

- [ ] **Step 6: Run browser tests**

~~~bash
bun run test:browser -- src/lib/App.browser.test.ts
bun run check
~~~

Expected: navigation, modal, combobox, and focus assertions pass.

- [ ] **Step 7: Commit**

~~~bash
git add src/App.svelte src/lib/Navbar.svelte src/lib/ConfirmModal.svelte src/lib/LanguageSelect.svelte src/lib/ToggleSwitch.svelte src/app.css src/lib/App.browser.test.ts
git commit -m "fix: complete keyboard and dialog accessibility"
~~~

### Task 13: Remove redundancy and correct documentation

**Files:**

- Modify: src/lib/types.ts
- Modify: src/lib/icons/*.svelte
- Modify: README.md
- Modify: AGENT.md
- Modify: LICENSE

- [ ] **Step 1: Remove dead and misleading API**

Remove getRepoOwner if no caller exists. Remove toggleSeen from public use; callers must choose markSeen or unsee. Remove the obsolete Debouncer dependency if no module imports @tanstack/pacer afterward:

~~~bash
rg -n "getRepoOwner|toggleSeen|@tanstack/pacer|seen_repos|MAX_SEEN_ITEMS" src
~~~

Expected before cleanup: matches identify every remaining call. Expected after cleanup: no matches except migration code intentionally reading seen_repos.

- [ ] **Step 2: Type icon props**

Replace catch-all any props with:

~~~ts
import type { SVGAttributes } from 'svelte/elements'

type IconProps = SVGAttributes<SVGSVGElement> & {
  size?: number
  class?: string
}
~~~

Use one shared src/lib/icons/types.ts definition. Preserve filled on BookmarkIcon.

- [ ] **Step 3: Update README and AGENT**

Document:

- continuous virtualized feed;
- no pagination controls;
- source and Remaining X / Y semantics;
- IndexedDB persistence bounded by browser storage, not an absolute 100% guarantee;
- current keyboard shortcuts only;
- import size/schema behavior;
- test and verify commands.

Remove stale claims that explicit dismiss toggles or that history is capped at 2,000.

- [ ] **Step 4: Restore canonical MIT license**

Replace the duplicated disclaimer line with:

~~~text
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
~~~

- [ ] **Step 5: Remove unused dependency**

If the rg check proves @tanstack/pacer has no imports:

~~~bash
bun remove @tanstack/pacer
~~~

- [ ] **Step 6: Run static verification**

~~~bash
bun run check
bun run test
~~~

Expected: 0 diagnostics; all unit tests pass.

- [ ] **Step 7: Commit**

~~~bash
git add src/lib/types.ts src/lib/icons README.md AGENT.md LICENSE package.json bun.lock
git commit -m "docs: align behavior and remove legacy code"
~~~

### Task 14: Run acceptance and performance verification

**Files:**

- Modify only if verification exposes a regression.

- [ ] **Step 1: Run the full automated gate**

~~~bash
bun run verify
~~~

Expected:

- svelte-check: 0 errors, 0 warnings;
- unit tests: all pass;
- browser tests: all pass in Chromium;
- production build: exits 0.

- [ ] **Step 2: Verify a 2,000-item fixture**

In the browser test result assert:

- <=40 article elements at rest;
- <=40 avatar img elements at rest;
- no next-page, previous-page, load-more, or pagination element;
- source/count text is one adjacent status group;
- body height represents the virtual total without 2,000 mounted rows.

- [ ] **Step 3: Manual desktop smoke check**

Run:

~~~bash
bun run dev
~~~

At a desktop viewport verify:

1. Status reads Source: Daily + Weekly + Monthly · Remaining X / Y after all sources succeed.
2. Dismiss decrements X and removes the card.
3. Undo increments X and restores catalog order.
4. History restore and reset update X without a network reload.
5. Shift+? opens Settings.
6. J/K can move beyond the initially mounted virtual rows.
7. No pagination section exists.

- [ ] **Step 4: Manual 390px smoke check**

At 390x844 verify:

1. Filter, source, and count wrap cleanly without horizontal scrolling.
2. Source and Remaining text stay adjacent.
3. Touch swipe and vertical scroll do not conflict.
4. Dialog fits, traps focus, and restores focus.
5. Feed, Saved, and History keep bounded DOM counts.

- [ ] **Step 5: Verify failure states**

Using fetch interception:

1. Delay monthly beyond timeout: daily/weekly render with a partial warning.
2. Return an object from daily: weekly/monthly render and daily is absent from source label.
3. Fail all sources: retry UI appears and no false All Caught Up state is shown.
4. Deny IndexedDB writes: in-memory action remains visible and a persistence warning appears.

- [ ] **Step 6: Verify clean repository state**

~~~bash
git status --short
git log --oneline -15
~~~

Expected: no uncommitted files; task commits appear in implementation order.

If any verification step fails, stop Task 14, return to the task owning that behavior, add a failing regression test, implement the correction, rerun that task's complete verification command, commit the correction with the files named by git diff --name-only, and restart Task 14 from Step 1.

## Reference documentation

- TanStack Svelte Virtual API: https://tanstack.com/virtual/latest/docs/framework/svelte/svelte-virtual
- TanStack dynamic measurement and stable keys: https://tanstack.com/virtual/latest/docs/api/virtualizer
- Vitest Browser Mode with Playwright: https://vitest.dev/guide/browser/
- Vitest component testing guidance: https://vitest.dev/guide/browser/component-testing

## Definition of done

- All fourteen tasks are complete and committed.
- No pagination or load-more UI was introduced.
- The inline source/count requirement is covered by browser tests at desktop and mobile widths.
- Current-CDN-scale and 2,000-fixture feeds keep the mounted DOM bounded.
- Store mutations and cross-tab messages update feed membership and Remaining X / Y immediately.
- Network, persistence, import, keyboard, dialog, combobox, sort, cleanup, and documentation audit findings have regression coverage.
- bun run verify passes from a clean worktree.
