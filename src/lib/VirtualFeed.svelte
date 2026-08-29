<script lang="ts">
  import { untrack } from 'svelte'
  import { createWindowVirtualizer } from '@tanstack/svelte-virtual'
  import type { TrendshiftRepo } from './types'
  import RepoCard from './RepoCard.svelte'

  let {
    repos,
    focusedIndex = -1,
    onFocusIndex,
    onDismiss,
  } = $props<{
    repos: TrendshiftRepo[]
    focusedIndex?: number
    onFocusIndex?: (index: number) => void
    onDismiss?: (repo: TrendshiftRepo) => void
  }>()

  let containerRef: HTMLDivElement | null = null
  let listTop = $state(0)

  const virtualizer = createWindowVirtualizer({
    count: 0,
    estimateSize: () => 190,
    overscan: 6,
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

  $effect(() => {
    if (!containerRef || typeof window === 'undefined') return
    const updateTop = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect()
        listTop = rect.top + window.scrollY
      }
    }
    updateTop()
    const observer = new ResizeObserver(updateTop)
    observer.observe(containerRef)
    window.addEventListener('resize', updateTop)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateTop)
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
