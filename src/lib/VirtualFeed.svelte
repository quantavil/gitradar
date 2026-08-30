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
  } = $props<{
    repos: TrendshiftRepo[]
    focusedIndex?: number
    onFocusIndex?: (index: number) => void
    onDismiss?: (repo: TrendshiftRepo) => void
    onAutoSeen?: (repo: TrendshiftRepo) => void
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

  $effect(() => {
    const count = repos.length
    const margin = listTop
    untrack(() => {
      $virtualizer.setOptions({
        count,
        scrollMargin: margin,
        getItemKey: (index) => repos[index]?.full_name ?? index,
      })
    })
  })

  onMount(() => {
    if (!containerRef || typeof window === 'undefined') return

    const tracker = new ScrollPastTracker()
    let frame: number | null = null
    let disposed = false

    const measure = () => {
      frame = null
      if (disposed || !containerRef) return

      const rows = Array.from(
        containerRef.querySelectorAll<HTMLElement>('[data-repo-key]'),
      ).flatMap((element) => {
        const key = element.dataset.repoKey
        if (!key) return []
        const rect = element.getBoundingClientRect()
        return [{ key, top: rect.top, bottom: rect.bottom }]
      })

      const crossedKeys = tracker.update(window.scrollY, window.innerHeight, rows)
      for (const key of crossedKeys) {
        const repo = repos.find((candidate: TrendshiftRepo) => candidate.full_name === key)
        if (repo) onAutoSeen?.(repo)
      }
    }

    const scheduleMeasure = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(measure)
    }

    const handleScroll = () => scheduleMeasure()
    window.addEventListener('scroll', handleScroll, { passive: true })
    measure()
    scheduleMeasure()

    return () => {
      disposed = true
      window.removeEventListener('scroll', handleScroll)
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  })

  $effect(() => {
    if (!containerRef || typeof window === 'undefined') return
    const applyTop = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect()
        const nextTop = rect.top + window.scrollY
        if (nextTop !== listTop) listTop = nextTop
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
