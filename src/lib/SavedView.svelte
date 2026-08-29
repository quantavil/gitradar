<script lang="ts">
  import { seenStore } from './seen.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import VirtualRepoGrid from './VirtualRepoGrid.svelte'
  import { sortSaved, type SavedSortOption } from './saved-sort'
  import type { SavedEntry, TrendshiftRepo } from './types'
  import { BookmarkIcon, TrashIcon } from './icons'

  let searchQuery = $state('')
  let sortBy = $state<SavedSortOption>('growth')
  let isConfirmOpen = $state(false)

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

  function handleClearAllConfirmed() {
    void seenStore.clearSaved()
    searchQuery = ''
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
  <div class="flex flex-row items-center justify-between gap-2.5 sm:gap-3 p-3.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] shrink-0 flex-wrap sm:flex-nowrap">
    <!-- Inline Search & Filter Dropdown Group -->
    <div class="flex items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
      <div class="flex-1 min-w-0">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter saved repos by name, language, or tag..."
          class="w-full px-3 py-1.5 text-xs font-mono bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[var(--accent-signal)] placeholder-[var(--text-muted)] transition-colors"
          aria-label="Filter saved repositories"
        />
      </div>

      <select
        bind:value={sortBy}
        aria-label="Sort saved repositories"
        class="px-2.5 py-1.5 bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-strong)] focus:outline-none focus:border-[var(--accent-signal)] font-mono text-xs cursor-pointer shrink-0"
      >
        <option value="growth">Daily-equivalent growth</option>
        <option value="stars">Stars</option>
        <option value="newest">Newest</option>
        <option value="name">Name</option>
      </select>
    </div>

    <!-- Actions: Export & Clear All -->
    {#if savedList.length > 0}
      <div class="flex items-center gap-2 shrink-0 font-mono text-xs ml-auto sm:ml-0">
        <button
          onclick={exportJSON}
          title="Export Bookmarks as JSON"
          class="px-2.5 py-1.5 bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded text-xs hover:border-[var(--border-strong)] transition-all btn-press focus-visible:outline-none focus-visible:border-[var(--accent-signal)]"
        >
          Export JSON
        </button>
        <button
          onclick={() => (isConfirmOpen = true)}
          class="px-2.5 py-1.5 bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] border border-[var(--badge-red-text)]/30 rounded text-xs hover:opacity-90 transition-all btn-press focus-visible:outline-none focus-visible:border-[var(--accent-signal)]"
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
    <div class="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] p-8 w-full min-h-[360px] shadow-[var(--card-shadow)]">
      <div class="w-12 h-12 rounded-full bg-[var(--accent-signal-soft-bg)] border border-[var(--accent-signal)]/30 text-[var(--accent-signal-soft-text)] flex items-center justify-center mx-auto">
        <BookmarkIcon size={22} aria-hidden="true" />
      </div>
      <div class="space-y-1">
        <h3 class="font-bold text-base text-[var(--text-main)] tracking-tight font-display">
          No Saved Repos
        </h3>
        <p class="text-xs text-[var(--text-muted)] leading-relaxed">
          Press <kbd class="mx-0.5">S</kbd> or swipe right to bookmark repos.
        </p>
      </div>
    </div>
  {:else if filteredAndSortedList.length === 0}
    <div class="py-12 text-center space-y-2 text-[var(--text-muted)] font-mono text-xs border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] p-6 w-full">
      <p>No saved repositories match "{searchQuery}".</p>
      <button
        onclick={() => (searchQuery = '')}
        class="text-[var(--text-main)] underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] rounded px-1"
      >
        Clear Search
      </button>
    </div>
  {:else}
    <VirtualRepoGrid items={filteredAndSortedList}>
      {#snippet itemActions(repo: TrendshiftRepo)}
        <button
          onclick={() => void seenStore.removeSaved(repo.full_name)}
          title="Remove from saved"
          aria-label="Remove {repo.full_name} from saved"
          class="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--badge-red-text)] transition-colors btn-press shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
        >
          <TrashIcon size={14} aria-hidden="true" />
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
  confirmVariant="danger"
  onConfirm={handleClearAllConfirmed}
  onClose={() => (isConfirmOpen = false)}
/>
