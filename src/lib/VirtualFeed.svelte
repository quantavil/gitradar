<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { createWindowVirtualizer } from '@tanstack/svelte-virtual'
  import type { TrendshiftRepo } from './types'
  import { ScrollPastTracker } from './scroll-past'
  import RepoCard from './RepoCard.svelte'

  let {
    repos,
    focusedIndex = -1,
    onFocusIndex,
    onDismiss,
    onAutoSeen,
    headerOffset = 56,
  } = $props<{
    repos: TrendshiftRepo[]
    focusedIndex?: number
    onFocusIndex?: (index: number) => void
    onDismiss?: (repo: TrendshiftRepo) => void
    onAutoSeen?: (repo: TrendshiftRepo) => void
    /** Height of the sticky navbar in px. Scroll-past and keyboard scrolling clear it. */
    headerOffset?: number
  }>()

  let containerRef: HTMLDivElement | null = null
  let listTop = $state(0)

  const virtualizer = createWindowVirtualizer({
    count: 0,
    estimateSize: () => 190,
    overscan: 6,
    useAnimationFrameWithResizeObserver: true,
    getItemKey: (index) => repos[index]?.full_name ?? index,
    scrollMargin: 0,
  })

  const scrollPast = new ScrollPastTracker()
  let measureFrame: number | null = null

  function measureScrollPast() {
    if (typeof window === 'undefined' || !containerRef) return

    const rows = Array.from(
      containerRef.querySelectorAll<HTMLElement>('[data-repo-key]'),
    ).flatMap((element) => {
      const key = element.dataset.repoKey
      if (!key) return []
      const rect = element.getBoundingClientRect()
      return [{ key, top: rect.top, bottom: rect.bottom }]
    })

    const crossedKeys = scrollPast.update(
      window.scrollY,
      window.innerHeight,
      rows,
      headerOffset,
    )
    for (const key of crossedKeys) {
      const repo = repos.find((candidate: TrendshiftRepo) => candidate.full_name === key)
      if (repo) onAutoSeen?.(repo)
    }
  }

  // Scroll, resize, list replacement and row re-measurement all funnel through this one
  // rAF-throttled pass, so the row snapshot always matches the current layout.
  function scheduleMeasure() {
    if (typeof window === 'undefined' || measureFrame !== null) return
    measureFrame = window.requestAnimationFrame(() => {
      measureFrame = null
      measureScrollPast()
    })
  }

  $effect(() => {
    const count = repos.length
    const margin = listTop
    const padding = headerOffset
    untrack(() => {
      $virtualizer.setOptions({
        count,
        scrollMargin: margin,
        scrollPaddingStart: padding,
        getItemKey: (index) => repos[index]?.full_name ?? index,
      })
    })
  })

  // Replacing the list moves every row, so drop the old baseline and take a fresh one.
  $effect(() => {
    void repos
    scrollPast.reset()
    scheduleMeasure()
  })

  // Row size or position changes from the virtualizer also change the layout.
  $effect(() => {
    $virtualizer.getVirtualItems()
    scheduleMeasure()
  })

  onMount(() => {
    if (!containerRef || typeof window === 'undefined') return
    const container = containerRef

    // Clicking or focusing a card moves the keyboard highlight to that card.
    const syncFocusedRow = (event: Event) => {
      const row = (event.target as Element | null)?.closest<HTMLElement>('[data-index]')
      const index = Number(row?.dataset.index)
      if (row && Number.isInteger(index)) onFocusIndex?.(index)
    }
    // Capture phase, so a card button that stops propagation still syncs the highlight.
    container.addEventListener('focusin', syncFocusedRow)
    container.addEventListener('click', syncFocusedRow, { capture: true })

    const handleScroll = () => scheduleMeasure()
    const handleResize = () => scheduleMeasure()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize, { passive: true })
    scheduleMeasure()

    return () => {
      container.removeEventListener('focusin', syncFocusedRow)
      container.removeEventListener('click', syncFocusedRow, { capture: true })
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      if (measureFrame !== null) {
        window.cancelAnimationFrame(measureFrame)
        measureFrame = null
      }
    }
  })

  $effect(() => {
    if (!containerRef || typeof window === 'undefined') return
    const applyTop = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect()
        const nextTop = rect.top + window.scrollY
        if (nextTop !== untrack(() => listTop)) listTop = nextTop
      }
    }
    let frame: number | null = null
    const updateTop = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(() => {
        frame = null
        applyTop()
      })
    }
    applyTop()
    const observer = new ResizeObserver(updateTop)
    observer.observe(containerRef)
    window.addEventListener('resize', updateTop, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateTop)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  })

  export function scrollToIndex(
    index: number,
    options?: { align?: 'start' | 'center' | 'end' | 'auto' },
  ) {
    $virtualizer.scrollToIndex(index, { align: options?.align ?? 'auto' })
  }
</script>

<div bind:this={containerRef} class="relative w-full">
  <div
    style="height: {$virtualizer.getTotalSize()}px; width: 100%; position: relative;"
  >
    {#each $virtualizer.getVirtualItems() as row (row.key)}
      {@const repo = repos[row.index]}
      {#if repo}
        <div
          data-repo-key={repo.full_name}
          data-index={row.index}
          use:$virtualizer.measureElement
          style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({row.start - $virtualizer.options.scrollMargin}px);"
          class="pb-3"
        >
          <RepoCard
            {repo}
            index={row.index}
            isFocused={focusedIndex === row.index}
            onExplicitDismiss={onDismiss}
          />
        </div>
      {/if}
    {/each}
  </div>
</div>
