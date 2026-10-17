<script lang="ts">
  import Icon from './Icon.svelte'
  import { tick } from 'svelte'
  import { seenStore } from './seen.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import VirtualRepoGrid from './VirtualRepoGrid.svelte'
  import type { TrendshiftRepo } from './types'
  let searchQuery = $state('')
  let isConfirmOpen = $state(false)
  let emptyHeadingRef = $state<HTMLHeadingElement | null>(null)

  const seenList = $derived.by(() => {
    return Array.from(seenStore.seenEntries.values()).sort(
      (a, b) => b.seenAt - a.seenAt,
    )
  })

  const filteredSeenList = $derived.by(() => {
    if (!searchQuery.trim()) return seenList
    const q = searchQuery.toLowerCase().trim()

    return seenList.filter(({ key, repo }) => {
      if (key.includes(q)) return true
      if (repo) {
        const descMatch = repo.description?.toLowerCase().includes(q)
        const langMatch = repo.language?.toLowerCase().includes(q)
        const tagsMatch = repo.tags?.some((tag) => tag.toLowerCase().includes(q))
        return descMatch || langMatch || tagsMatch
      }
      return false
    })
  })

  async function handleClearAllConfirmed() {
    const clearing = seenStore.resetSeen()
    searchQuery = ''
    // The list empties synchronously, so the Clear History button is about to be removed.
    // Move focus to the empty-state heading once the DOM reflects that.
    await tick()
    emptyHeadingRef?.focus()
    await clearing
  }
</script>

<div class="space-y-5 flex flex-col flex-1">
  <!-- Controls Bar -->
  <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 p-3.5 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] shrink-0">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search seen repositories by name, language, or topic..."
      class="w-full sm:flex-1 sm:min-w-0 min-h-11 sm:min-h-10 px-3 py-2 text-sm font-sans bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--control-border)] rounded-md placeholder:text-[var(--text-muted)] focus:border-[var(--accent-signal)] transition-colors"
      aria-label="Filter seen repositories"
    />

    {#if seenList.length > 0}
      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onclick={() => (isConfirmOpen = true)}
          class="flex-1 sm:flex-none inline-flex items-center justify-center min-h-11 sm:min-h-10 px-3.5 py-2 rounded-md border border-[var(--badge-red-text)]/40 bg-[var(--badge-red-bg)] text-sm font-sans font-medium text-[var(--badge-red-text)] hover:opacity-90 transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        >
          Clear History
        </button>
      </div>
    {/if}
  </div>

  <div class="sr-only" role="status" aria-live="polite">
    Showing {filteredSeenList.length} of {seenList.length} seen repositories
  </div>

  <!-- Seen Repositories Grid -->
  {#if seenList.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center text-center gap-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] px-6 py-12 sm:p-8 w-full min-h-[240px] sm:min-h-[300px] shadow-[var(--card-shadow)]">
      <div class="w-12 h-12 rounded-full bg-[var(--accent-signal-soft-bg)] border border-[var(--accent-signal)]/30 text-[var(--accent-signal-soft-text)] flex items-center justify-center mx-auto">
        <Icon name="clock" size={22} aria-hidden="true" />
      </div>
      <div class="space-y-2 max-w-sm">
        <h2
          bind:this={emptyHeadingRef}
          tabindex="-1"
          class="font-display text-lg font-semibold text-[var(--text-main)] tracking-tight"
        >
          No History
        </h2>
        <p class="text-sm font-sans text-[var(--text-muted)] leading-relaxed">
          Viewed or dismissed repositories are tracked here to prevent duplicates.
        </p>
      </div>
    </div>
  {:else if filteredSeenList.length === 0}
    <div class="py-12 px-6 text-center space-y-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] w-full min-w-0">
      <p class="text-sm font-sans text-[var(--text-muted)] break-words">
        No seen repositories match "{searchQuery}".
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
    <VirtualRepoGrid items={filteredSeenList}>
      {#snippet itemActions(repo: TrendshiftRepo)}
        <button
          type="button"
          onclick={() => void seenStore.unsee(repo.full_name)}
          title="Restore to active feed"
          aria-label="Restore {repo.full_name} to active feed"
          class="inline-flex items-center justify-center shrink-0 min-h-11 min-w-11 sm:min-h-10 sm:min-w-10 rounded-md text-[var(--text-muted)] hover:text-[var(--accent-signal)] hover:bg-[var(--accent-signal-soft-bg)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        >
          <Icon name="undo" size={16} aria-hidden="true" />
        </button>
      {/snippet}
    </VirtualRepoGrid>
  {/if}
</div>

<!-- Clear History Confirmation Modal -->
<ConfirmModal
  isOpen={isConfirmOpen}
  title="Clear seen history"
  message="Clear your seen history? RepoRadar will show these {seenList.length} repositories again."
  confirmText="Clear history"
  onConfirm={handleClearAllConfirmed}
  onClose={() => (isConfirmOpen = false)}
/>
