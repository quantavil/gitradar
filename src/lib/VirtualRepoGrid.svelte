<script lang="ts">
  import { untrack, type Snippet } from 'svelte'
  import { createWindowVirtualizer } from '@tanstack/svelte-virtual'
  import type { TrendshiftRepo } from './types'
  import RepoItem from './RepoItem.svelte'

  type GridItem = { key: string; repo: TrendshiftRepo } | TrendshiftRepo

  let {
    items,
    itemActions,
  } = $props<{
    items: GridItem[]
    itemActions?: Snippet<[TrendshiftRepo]>
  }>()

  let containerRef: HTMLDivElement | null = null
  let listTop = $state(0)
  let isDesktop = $state(
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : false,
  )

  $effect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const updateMatch = (e: MediaQueryListEvent) => {
      isDesktop = e.matches
    }
    isDesktop = mq.matches
    mq.addEventListener('change', updateMatch)
    return () => mq.removeEventListener('change', updateMatch)
  })

  let rows = $derived.by(() => {
    const cols = isDesktop ? 2 : 1
    const result: { id: string; items: GridItem[] }[] = []
    for (let i = 0; i < items.length; i += cols) {
      const slice = items.slice(i, i + cols)
      const id = slice
        .map((item: GridItem) => ('key' in item ? item.key : item.full_name))
        .join(';')
      result.push({ id, items: slice })
    }
    return result
  })

  const virtualizer = createWindowVirtualizer({
    count: 0,
    estimateSize: () => 180,
    overscan: 4,
    getItemKey: (index) => rows[index]?.id ?? index,
    scrollMargin: 0,
  })

  $effect(() => {
    const count = rows.length
    const margin = listTop
    untrack(() => {
      $virtualizer.setOptions({
        count,
        scrollMargin: margin,
        getItemKey: (index) => rows[index]?.id ?? index,
      })
    })
  })

  $effect(() => {
    if (!containerRef || typeof window === 'undefined') return
    let frame: number | null = null
    const applyTop = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect()
        listTop = rect.top + window.scrollY
      }
    }
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
    window.addEventListener('resize', updateTop)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateTop)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  })
</script>

<div bind:this={containerRef} class="relative w-full">
  <div
    style="height: {$virtualizer.getTotalSize()}px; width: 100%; position: relative;"
  >
    {#each $virtualizer.getVirtualItems() as virtualRow (virtualRow.key)}
      {@const rowData = rows[virtualRow.index]}
      {#if rowData}
        <div
          data-index={virtualRow.index}
          use:$virtualizer.measureElement
          style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({virtualRow.start - $virtualizer.options.scrollMargin}px);"
          class="pb-3.5"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {#each rowData.items as item (('key' in item ? item.key : item.full_name))}
              {@const repo = 'repo' in item ? item.repo : item}
              <div>
                <RepoItem {repo}>
                  {#snippet actions()}
                    {#if itemActions}
                      {@render itemActions(repo)}
                    {/if}
                  {/snippet}
                </RepoItem>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>
</div>
