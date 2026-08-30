# Scroll and Source Regression Design

## Goal

Restore predictable feed scrolling after the virtualization change and replace the redundant combined source status with one source that describes the next remaining repository.

## Root Cause

Each mounted `RepoCard` owns an `IntersectionObserver`. When one card crosses above the header, it is marked seen and immediately removed from the derived unseen list. Virtual rows are then reindexed and shifted upward while the window remains at the same scroll offset. Those layout changes make additional observers report that their cards crossed the header, producing a dismissal cascade without another user scroll.

The combined `Daily + Weekly + Monthly` status reports every successful network request rather than the source relevant to the current feed position.

## Design

`VirtualFeed` will own scroll-past tracking because it owns row virtualization and can distinguish an actual window scroll from a reactive layout change. It will record repository keys that have occupied the visible viewport. On a genuine downward window scroll, it will take one DOM snapshot, collect previously visible rows whose bottoms crossed above the sticky header, and report that fixed batch through a dedicated `onAutoSeen` callback. Reactive row removal will not run another scan, so it cannot cascade at an unchanged scroll position. Fast-scroll behavior remains conservative: virtual rows that were never visible are not marked seen.

`RepoCard` will retain swipe, save, and explicit dismiss behavior, but it will no longer create an `IntersectionObserver` or mark items seen from layout changes.

`App` will connect `VirtualFeed.onAutoSeen` directly to `seenStore.markSeen` without showing the explicit-dismiss undo toast. The displayed source will be a single title-cased timeframe from the first remaining repository, falling back to the first successful timeframe while loading or when the remaining feed is empty. The catalog still combines and deduplicates all successful timeframes.

## Error and Edge Handling

- Upward scrolling never marks repositories seen.
- A layout change at an unchanged scroll position never marks another repository.
- A repository can be reported at most once by the tracker.
- Auto-seen remains governed by the existing setting.
- Programmatic keyboard scrolling uses the same native scroll events and may mark genuinely crossed, previously visible cards, matching manual navigation semantics.
- Loading and total-feed failure continue to show `Loading` and `Unavailable` respectively.

## Testing

- Add a failing unit regression around the scroll-past state machine showing that a downward scroll reports crossed visible keys once and a same-position layout update reports nothing.
- Add a browser integration regression showing one source label rather than the combined source list.
- Keep the bounded DOM virtualization test and run the complete check, unit, browser, and build verification before pushing.
