# Scroll and Source Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent virtualized feed removals from cascading at a fixed scroll position and display one relevant timeframe source.

**Architecture:** Add a small DOM-independent scroll-past tracker that compares row movement with the actual window scroll delta. `VirtualFeed` will take one measured row snapshot per scroll frame and emit a fixed batch of genuinely crossed repositories; `RepoCard` will no longer react to layout-only intersections. `App` will render the first remaining repository's timeframe as the single source label.

**Tech Stack:** Svelte 5 runes, TypeScript, TanStack Svelte Virtual, Vitest unit tests, Vitest Browser with Playwright Chromium.

---

## File Structure

- Create `src/lib/scroll-past.ts`: Pure state machine for deciding which previously visible rows crossed the header because of downward scrolling.
- Create `src/lib/scroll-past.test.ts`: Unit regressions for genuine crossing, same-position layout movement, and upward scrolling.
- Modify `src/lib/VirtualFeed.svelte`: Measure mounted virtual rows once per window scroll frame and emit auto-seen callbacks.
- Modify `src/lib/VirtualFeed.browser.test.ts`: Browser regression for callback stability at an unchanged scroll position.
- Modify `src/lib/RepoCard.svelte`: Remove the per-card `IntersectionObserver`; retain swipe and explicit actions.
- Modify `src/App.svelte`: Connect auto-seen persistence and render one source timeframe.
- Modify `src/lib/App.browser.test.ts`: Lock the single-source status behavior.

### Task 1: Scroll-Past State Machine

**Files:**
- Create: `src/lib/scroll-past.ts`
- Create: `src/lib/scroll-past.test.ts`

- [ ] **Step 1: Write the failing tracker tests**

Create tests that initialize a visible row, move it above the 56px header by the same amount as a downward scroll, and expect its key once. Add a layout-shift case where the row moves farther than the scroll delta and an upward-scroll case; both must return an empty array.

```ts
import { describe, expect, it } from 'vitest'
import { ScrollPastTracker } from './scroll-past'

describe('ScrollPastTracker', () => {
  it('reports a previously visible row crossed by a downward scroll once', () => {
    const tracker = new ScrollPastTracker(56, 2)
    tracker.update(0, 800, [{ key: 'owner/a', top: 100, bottom: 200 }])

    expect(
      tracker.update(160, 800, [{ key: 'owner/a', top: -60, bottom: 40 }]),
    ).toEqual(['owner/a'])
    expect(
      tracker.update(160, 800, [{ key: 'owner/a', top: -160, bottom: -60 }]),
    ).toEqual([])
  })

  it('ignores movement caused by layout removal at the same scroll position', () => {
    const tracker = new ScrollPastTracker(56, 2)
    tracker.update(100, 800, [{ key: 'owner/a', top: 60, bottom: 160 }])

    expect(
      tracker.update(100, 800, [{ key: 'owner/a', top: -80, bottom: 20 }]),
    ).toEqual([])
  })

  it('ignores rows while scrolling upward', () => {
    const tracker = new ScrollPastTracker(56, 2)
    tracker.update(200, 800, [{ key: 'owner/a', top: 60, bottom: 160 }])

    expect(
      tracker.update(100, 800, [{ key: 'owner/a', top: -40, bottom: 40 }]),
    ).toEqual([])
  })
})
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `bun run test -- src/lib/scroll-past.test.ts`

Expected: FAIL because `./scroll-past` does not exist.

- [ ] **Step 3: Implement the minimal tracker**

Implement `ScrollPastTracker.update(scrollY, viewportHeight, rows)`. Keep only rows intersecting the usable viewport in the next snapshot. Report a key only when it was previously visible, crosses from at/below the header to above it, moves upward by no more than `scrollDelta + tolerance`, and has not already been reported.

```ts
export interface ScrollRowSnapshot {
  key: string
  top: number
  bottom: number
}

export class ScrollPastTracker {
  private previousScrollY: number | null = null
  private previousRows = new Map<string, ScrollRowSnapshot>()
  private handled = new Set<string>()

  constructor(
    private headerOffset = 56,
    private movementTolerance = 2,
  ) {}

  update(
    scrollY: number,
    viewportHeight: number,
    rows: ScrollRowSnapshot[],
  ): string[] {
    const scrollDelta =
      this.previousScrollY === null ? 0 : scrollY - this.previousScrollY
    const crossed: string[] = []

    if (scrollDelta > 0) {
      for (const row of rows) {
        const previous = this.previousRows.get(row.key)
        if (!previous || this.handled.has(row.key)) continue
        const upwardMovement = previous.bottom - row.bottom
        if (
          previous.bottom >= this.headerOffset &&
          row.bottom < this.headerOffset &&
          upwardMovement > 0 &&
          upwardMovement <= scrollDelta + this.movementTolerance
        ) {
          crossed.push(row.key)
          this.handled.add(row.key)
        }
      }
    }

    this.previousScrollY = scrollY
    this.previousRows = new Map(
      rows
        .filter(
          (row) =>
            row.bottom >= this.headerOffset && row.top < viewportHeight,
        )
        .map((row) => [row.key, row]),
    )
    return crossed
  }
}
```

- [ ] **Step 4: Run focused and full unit tests and verify GREEN**

Run: `bun run test -- src/lib/scroll-past.test.ts && bun run test`

Expected: both commands exit 0 with no failed tests.

- [ ] **Step 5: Commit the tracker**

```bash
git add src/lib/scroll-past.ts src/lib/scroll-past.test.ts
git commit -m "fix: distinguish scroll-past from layout movement"
```

### Task 2: Centralize Virtual Feed Auto-Seen Tracking

**Files:**
- Modify: `src/lib/VirtualFeed.svelte`
- Modify: `src/lib/RepoCard.svelte`

- [ ] **Step 1: Add a failing source-level regression**

Add a test in `src/lib/VirtualFeed.browser.test.ts` that reads mounted cards before and after a controlled downward window scroll and uses an `onAutoSeen` spy. Assert that callback count stops changing while `window.scrollY` stays unchanged.

```ts
import { expect, test, vi } from 'vitest'

test('does not auto-see more rows without another scroll event', async () => {
  const onAutoSeen = vi.fn()
  const screen = await render(VirtualFeed, {
    props: {
      repos: makeRepos(100),
      focusedIndex: -1,
      onFocusIndex: () => {},
      onDismiss: () => {},
      onAutoSeen,
    },
  })

  await expect.element(screen.getByRole('article').first()).toBeInTheDocument()
  window.scrollTo(0, 400)
  window.dispatchEvent(new Event('scroll'))

  await expect.poll(() => onAutoSeen.mock.calls.length).toBeGreaterThan(0)
  const callsAfterScroll = onAutoSeen.mock.calls.length
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(onAutoSeen).toHaveBeenCalledTimes(callsAfterScroll)
  window.scrollTo(0, 0)
})
```

- [ ] **Step 2: Run the focused browser test and verify RED**

Run: `bun run test:browser -- src/lib/VirtualFeed.browser.test.ts`

Expected: FAIL because `VirtualFeed` does not accept `onAutoSeen` and the current per-card observers bypass the callback.

- [ ] **Step 3: Wire the tracker into `VirtualFeed`**

Add `onAutoSeen?: (repo: TrendshiftRepo) => void`, a `ScrollPastTracker`, and a passive window scroll listener. Coalesce events with `requestAnimationFrame`, measure `[data-repo-key]` wrappers through `getBoundingClientRect()`, call `tracker.update(window.scrollY, window.innerHeight, rows)`, and resolve the returned keys against current `repos` before invoking `onAutoSeen`.

Add `data-repo-key={repo.full_name}` to each measured virtual row. Seed the tracker in one initial animation frame. Cancel the frame and remove the listener on teardown.

- [ ] **Step 4: Remove card-level observation**

Delete `observer`, `hasBeenVisible`, the `IntersectionObserver` creation, and observer cleanup from `RepoCard.svelte`. Keep all touch handlers and explicit save/dismiss functions unchanged.

- [ ] **Step 5: Run the focused browser test and verify GREEN**

Run: `bun run test:browser -- src/lib/VirtualFeed.browser.test.ts`

Expected: PASS, with no additional callback at a fixed scroll position.

- [ ] **Step 6: Commit centralized tracking**

```bash
git add src/lib/VirtualFeed.svelte src/lib/VirtualFeed.browser.test.ts src/lib/RepoCard.svelte
git commit -m "fix: prevent virtual feed auto-seen cascade"
```

### Task 3: Restore a Single Relevant Source Label

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/lib/App.browser.test.ts`

- [ ] **Step 1: Change the existing browser expectation to RED**

Rename the status test to `shows the current repository source and live remaining count inline`. Keep all three mocked requests successful, then assert `Source: Daily`, assert the text does not contain `Daily + Weekly + Monthly`, and retain the `Remaining 3 / 3` assertion.

- [ ] **Step 2: Run the focused browser test and verify RED**

Run: `bun run test:browser -- src/lib/App.browser.test.ts`

Expected: FAIL because the current label joins all successful timeframes.

- [ ] **Step 3: Implement the single-source label and connect auto-seen**

In `App.svelte`, derive the timeframe from `repos[0]?.timeframe ?? repoFeed.successfulTimeframes[0]`, return `Unavailable`/`Loading` when no timeframe exists, and title-case the one selected value. Pass `onAutoSeen={(repo) => { if (seenStore.autoSeenOnScroll) void seenStore.markSeen(repo) }}` to `VirtualFeed`.

- [ ] **Step 4: Run focused browser tests and verify GREEN**

Run: `bun run test:browser -- src/lib/App.browser.test.ts src/lib/VirtualFeed.browser.test.ts`

Expected: PASS with one source label and stable scroll-past callback counts.

- [ ] **Step 5: Commit the UI behavior**

```bash
git add src/App.svelte src/lib/App.browser.test.ts
git commit -m "fix: show the active feed source"
```

### Task 4: Full Verification and Push

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run formatting and diff checks**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intended changes, if any.

- [ ] **Step 2: Run the complete project verification**

Run: `bun run verify`

Expected: Svelte/TypeScript checks pass, all unit and browser tests pass, and the production build exits 0.

- [ ] **Step 3: Reproduce the original interaction locally**

Reload the local app, record remaining count and `window.scrollY`, perform one controlled downward scroll, and verify the remaining count stabilizes without additional removals at the same `window.scrollY`. Verify the source status contains one of `Daily`, `Weekly`, or `Monthly` and never the combined label.

- [ ] **Step 4: Push the completed commits**

Run: `git push origin main`

Expected: remote `origin/main` advances to the final local commit.
