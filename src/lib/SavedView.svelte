<script lang="ts">
  import Icon from './Icon.svelte'
  import { tick } from 'svelte'
  import { seenStore } from './seen.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import VirtualRepoGrid from './VirtualRepoGrid.svelte'
  import { sortSaved, type SavedSortOption } from './saved-sort'
  import type { SavedEntry, TrendshiftRepo } from './types'
  // When provided, the empty state offers a button that switches to the Feed.
  let { onGoToFeed } = $props<{
    onGoToFeed?: () => void
  }>()

  let searchQuery = $state('')
  let sortBy = $state<SavedSortOption>('growth')
  let isConfirmOpen = $state(false)
  let emptyHeadingRef = $state<HTMLHeadingElement | null>(null)

  const savedList = $derived(Array.from(seenStore.savedEntries.values()))

  const filteredAndSortedList = $derived.by(() => {
    const list = savedList.filter((entry) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const repo = entry.repo
      const fullNameMatch = repo.full_name?.toLowerCase().includes(q)
      const descMatch = repo.description?.toLowerCase().includes(q)
      const langMatch = repo.language?.toLowerCase().includes(q)
      const tagsMatch = repo.tags?.some((tag) => tag.toLowerCase().includes(q))
      return fullNameMatch || descMatch || langMatch || tagsMatch
    })

    return sortSaved(list, sortBy)
  })

  async function handleClearAllConfirmed() {
    const clearing = seenStore.clearSaved()
    searchQuery = ''
    // The list empties synchronously, so the Clear All button is about to be removed.
    // Move focus to the empty-state heading once the DOM reflects that.
    await tick()
    emptyHeadingRef?.focus()
    await clearing
  }

  function exportJSON() {
    const exportData = savedList.map((entry) => ({
      ...entry.repo,
      savedAt: entry.savedAt,
    }))
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.href = url
    downloadAnchor.download = `reporadar-saved-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    URL.revokeObjectURL(url)
  }
</script>

<div class="space-y-5 flex flex-col flex-1">
  <!-- Controls Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] shrink-0">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Filter saved repos by name, language, or tag..."
      class="w-full sm:flex-1 sm:min-w-0 min-h-11 sm:min-h-10 px-3 py-2 text-sm font-sans bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--control-border)] rounded-md placeholder:text-[var(--text-muted)] focus:border-[var(--accent-signal)] transition-colors"
      aria-label="Filter saved repositories"
    />

    <select
      bind:value={sortBy}
      aria-label="Sort saved repositories"
      class="w-full sm:w-auto min-h-11 sm:min-h-10 px-3 py-2 text-sm font-sans bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--control-border)] rounded-md cursor-pointer shrink-0 focus:border-[var(--accent-signal)] transition-colors"
    >
      <option value="growth">Daily-equivalent growth</option>
      <option value="stars">Stars</option>
      <option value="newest">Newest</option>
      <option value="name">Name</option>
    </select>

    <!-- Actions: Export & Clear All -->
    {#if savedList.length > 0}
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onclick={exportJSON}
          title="Export Bookmarks as JSON"
          class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-11 sm:min-h-10 px-3.5 py-2 rounded-md border border-[var(--control-border)] bg-[var(--bg-surface)] text-sm font-sans font-medium text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        >
          Export JSON
        </button>
        <button
          type="button"
          onclick={() => (isConfirmOpen = true)}
          class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-11 sm:min-h-10 px-3.5 py-2 rounded-md border border-[var(--badge-red-text)]/40 bg-[var(--badge-red-bg)] text-sm font-sans font-medium text-[var(--badge-red-text)] hover:opacity-90 transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        >
          Clear All
        </button>
      </div>
    {/if}
  </div>

  <div class="sr-only" role="status" aria-live="polite">
    Showing {filteredAndSortedList.length} of {savedList.length} saved repositories
  </div>

  <!-- Saved Items Grid -->
  {#if savedList.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center text-center gap-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] px-6 py-12 sm:p-8 w-full min-h-[280px] sm:min-h-[360px] shadow-[var(--card-shadow)]">
      <div class="w-12 h-12 rounded-full bg-[var(--accent-signal-soft-bg)] border border-[var(--accent-signal)]/30 text-[var(--accent-signal-soft-text)] flex items-center justify-center mx-auto">
        <Icon name="bookmark" size={22} aria-hidden="true" />
      </div>
      <div class="space-y-2 max-w-sm">
        <h2
          bind:this={emptyHeadingRef}
          tabindex="-1"
          class="font-display text-lg font-semibold text-[var(--text-main)] tracking-tight"
        >
          No Saved Repos
        </h2>
        <p class="text-sm font-sans text-[var(--text-muted)] leading-relaxed">
          Bookmark repos from the Feed: press <kbd class="mx-0.5">S</kbd>, or swipe a card right.
        </p>
      </div>
      {#if onGoToFeed}
        <button
          type="button"
          onclick={() => onGoToFeed?.()}
          class="inline-flex items-center justify-center min-h-11 sm:min-h-10 px-4 py-2 rounded-md bg-[var(--accent-signal)] text-[var(--on-accent)] text-sm font-sans font-semibold hover:opacity-90 transition-opacity btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
        >
          Go to the Feed
        </button>
      {/if}
    </div>
  {:else if filteredAndSortedList.length === 0}
    <div class="py-12 px-6 text-center space-y-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] w-full min-w-0">
      <p class="text-sm font-sans text-[var(--text-muted)] break-words">
        No saved repositories match "{searchQuery}".
      </p>
      <button
        type="button"
        onclick={() => (searchQuery = '')}
        class="inline-flex items-center justify-center min-h-11 sm:min-h-10 px-3.5 py-2 rounded-md border border-[var(--control-border)] bg-[var(--bg-surface)] text-sm font-sans font-medium text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Clear Search
      </button>
    </div>
  {:else}
    <VirtualRepoGrid items={filteredAndSortedList}>
      {#snippet itemActions(repo: TrendshiftRepo)}
        <button
          type="button"
          onclick={() => void seenStore.removeSaved(repo.full_name)}
          title="Remove from saved"
          aria-label="Remove {repo.full_name} from saved"
          class="inline-flex items-center justify-center shrink-0 min-h-11 min-w-11 sm:min-h-10 sm:min-w-10 rounded-md text-[var(--text-muted)] hover:text-[var(--badge-red-text)] hover:bg-[var(--badge-red-bg)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        >
          <Icon name="trash" size={16} aria-hidden="true" />
        </button>
      {/snippet}
    </VirtualRepoGrid>
  {/if}
</div>

<!-- Clear All Confirmation Modal -->
<ConfirmModal
  isOpen={isConfirmOpen}
  title="Clear All Saved Repositories"
  message="Are you sure you want to remove all {savedList.length} bookmarked repositories? This action cannot be undone."
  confirmText="Clear All"
  onConfirm={handleClearAllConfirmed}
  onClose={() => (isConfirmOpen = false)}
/>
