<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import Navbar from './lib/Navbar.svelte'
  import LanguageSelect from './lib/LanguageSelect.svelte'
  import VirtualFeed from './lib/VirtualFeed.svelte'
  import SavedView from './lib/SavedView.svelte'
  import HistoryView from './lib/HistoryView.svelte'
  import SettingsView from './lib/SettingsView.svelte'
  import ConfirmModal from './lib/ConfirmModal.svelte'
  import { repoFeed } from './lib/api.svelte'
  import { seenStore } from './lib/seen.svelte'
  import { setupHotkeys } from './lib/hotkeys'
  import {
    readThemePreference,
    writeThemePreference,
  } from './lib/storage/preferences'
  import { ResetIcon, CheckIcon, GithubIcon, FilterIcon } from './lib/icons'
  import type { TrendshiftRepo, ViewMode } from './lib/types'

  let activeView = $state<ViewMode>('feed')
  let isResetConfirmOpen = $state(false)
  let focusedIndex = $state(-1)
  let isDark = $state(readThemePreference() === 'dark')

  // Undo Toast state for explicit dismiss
  let lastDismissedRepo = $state<TrendshiftRepo | null>(null)
  let toastVisible = $state(false)
  let toastTimeout: ReturnType<typeof setTimeout> | null = null
  let autoSeenKeys = $state<Set<string>>(new Set())

  let virtualFeedRef = $state<{ scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' | 'auto' }) => void } | null>(null)

  const repos = $derived(repoFeed.repos)
  const feedRepos = $derived.by(() =>
    repoFeed.catalog.filter(
      (repo) =>
        !seenStore.isSeen(repo.full_name) || autoSeenKeys.has(repo.full_name),
    ),
  )
  const loading = $derived(repoFeed.loading)
  const error = $derived(repoFeed.error)

  const sourceLabel = $derived.by(() => {
    if (loading && repoFeed.catalog.length === 0) return 'Loading'
    const timeframe = repos[0]?.timeframe ?? repoFeed.successfulTimeframes[0]
    if (!timeframe) return error ? 'Unavailable' : 'Loading'
    return timeframe.charAt(0).toUpperCase() + timeframe.slice(1)
  })

  function handleExplicitDismiss(repo: TrendshiftRepo) {
    const wasSeen = seenStore.isSeen(repo.full_name)
    void seenStore.markSeen(repo)
    if (!wasSeen) {
      lastDismissedRepo = repo
      toastVisible = true
      if (toastTimeout) clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => {
        toastVisible = false
      }, 4000)
    } else {
      toastVisible = false
    }
  }

  function handleUndoDismiss() {
    if (lastDismissedRepo) {
      void seenStore.unsee(lastDismissedRepo.full_name)
      toastVisible = false
      lastDismissedRepo = null
    }
  }

  function clearAutoSeen() {
    autoSeenKeys = new Set()
  }

  function handleAutoSeen(repo: TrendshiftRepo) {
    if (!seenStore.autoSeenOnScroll || seenStore.isSeen(repo.full_name)) return

    const next = new Set(autoSeenKeys)
    next.add(repo.full_name)
    autoSeenKeys = next
    void seenStore.markSeen(repo)
  }

  onDestroy(() => {
    if (toastTimeout) {
      clearTimeout(toastTimeout)
    }
  })

  $effect(() => {
    if (focusedIndex >= feedRepos.length) {
      focusedIndex = feedRepos.length > 0 ? feedRepos.length - 1 : -1
    }
  })

  onMount(() => {
    let cancelled = false

    const cleanupHotkeys = setupHotkeys({
      onNext: () => {
        if (activeView !== 'feed' || isResetConfirmOpen || feedRepos.length === 0) return
        if (focusedIndex === -1) {
          focusedIndex = 0
        } else {
          focusedIndex = Math.min(focusedIndex + 1, feedRepos.length - 1)
        }
        virtualFeedRef?.scrollToIndex(focusedIndex, { align: 'auto' })
      },
      onPrev: () => {
        if (activeView !== 'feed' || isResetConfirmOpen || feedRepos.length === 0) return
        if (focusedIndex === -1) {
          focusedIndex = 0
        } else {
          focusedIndex = Math.max(focusedIndex - 1, 0)
        }
        virtualFeedRef?.scrollToIndex(focusedIndex, { align: 'auto' })
      },
      onSave: () => {
        if (
          focusedIndex < 0 ||
          activeView !== 'feed' ||
          isResetConfirmOpen ||
          feedRepos.length === 0 ||
          !feedRepos[focusedIndex]
        )
          return
        void seenStore.toggleSave(feedRepos[focusedIndex])
      },
      onDismiss: () => {
        if (
          focusedIndex < 0 ||
          activeView !== 'feed' ||
          isResetConfirmOpen ||
          feedRepos.length === 0 ||
          !feedRepos[focusedIndex]
        )
          return
        handleExplicitDismiss(feedRepos[focusedIndex])
      },
      onUndo: () => {
        if (toastVisible && lastDismissedRepo) {
          handleUndoDismiss()
        }
      },
      onViewFeed: () => (activeView = 'feed'),
      onViewSaved: () => (activeView = 'saved'),
      onViewHistory: () => (activeView = 'history'),
      onViewSettings: () => (activeView = 'settings'),
      onEscape: () => {
        if (isResetConfirmOpen) {
          isResetConfirmOpen = false
        } else {
          activeView = 'feed'
        }
      },
    })

    void (async () => {
      await seenStore.init()
      if (!cancelled) {
        clearAutoSeen()
        await repoFeed.fetchFeed()
      }
    })()

    return () => {
      cancelled = true
      repoFeed.cancel()
      cleanupHotkeys()
    }
  })

  // Centralized Theme Sync Effect
  $effect(() => {
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      writeThemePreference(isDark ? 'dark' : 'light')
    }
  })

  function handleResetAll() {
    clearAutoSeen()
    void seenStore.resetSeen()
    void repoFeed.fetchFeed()
    focusedIndex = -1
  }
</script>

<div
  data-app-shell
  class="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-main)] font-sans antialiased"
>
  <!-- Top Navigation Header -->
  <Navbar
    {activeView}
    onSelectView={(view) => (activeView = view)}
  />

  <!-- Main View Area -->
  <main class="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-4 py-4 sm:py-6 flex flex-col">
    <!-- Subheader info banner / View Header -->
    <div class="flex items-center justify-between gap-x-4 mb-5 pb-3 border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
      {#if activeView === 'feed'}
        <!-- Feed Subheader -->
        <div class="flex items-center gap-2 font-mono text-[11px] sm:text-xs flex-wrap">
          <!-- Live Radar Sweep Indicator -->
          <span class="relative flex h-2 w-2 shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-signal)] opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-signal)]"></span>
          </span>
          <span class="flex items-center gap-1">
            <FilterIcon size={12} class="text-[var(--text-muted)] shrink-0" aria-hidden="true" />
            Filter:
            <LanguageSelect
              value={repoFeed.selectedLanguage}
              onChange={(lang) => {
                focusedIndex = -1
                clearAutoSeen()
                void repoFeed.setLanguage(lang)
              }}
            />
          </span>
          <span class="text-[var(--border-strong)]">|</span>
          <span>
            Source:
            <strong class="text-[var(--text-main)]">{sourceLabel}</strong>
            <span aria-hidden="true"> · </span>
            <strong class="text-[var(--text-main)]">Remaining {repoFeed.remainingCount.toLocaleString()} / {repoFeed.totalCount.toLocaleString()}</strong>
          </span>
          <span class="sr-only" role="status" aria-live="polite">
            {repoFeed.remainingCount} of {repoFeed.totalCount} repositories remaining
          </span>
        </div>
      {:else}
        <!-- Non-Feed View Header (Back Button & View Title) -->
        <div class="flex items-center justify-between w-full font-mono text-xs">
          <button
            onclick={() => (activeView = 'feed')}
            class="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--text-main)] hover:text-[var(--accent-signal)] font-semibold transition-colors btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] rounded"
          >
            <span>← Back to Feed</span>
          </button>

          <span class="font-display font-semibold text-[var(--text-main)] capitalize text-sm">
            {#if activeView === 'saved'}
              Saved Bookmarks ({seenStore.saved.size})
            {:else if activeView === 'history'}
              Seen History ({seenStore.seenSize})
            {:else if activeView === 'settings'}
              Settings & Shortcuts
            {/if}
          </span>
        </div>
      {/if}
    </div>

    <!-- Active View Router -->
    {#if activeView === 'saved'}
      <SavedView />
    {:else if activeView === 'history'}
      <HistoryView />
    {:else if activeView === 'settings'}
      <SettingsView bind:isDark />
    {:else}
      <!-- Feed Stream -->
      {#if loading && repos.length === 0}
        <!-- Skeleton Loading State -->
        <div class="space-y-4">
          <div class="py-8 flex flex-col items-center justify-center space-y-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
            <div class="relative w-10 h-10 flex items-center justify-center">
              <div class="absolute inset-0 radar-sweep opacity-80"></div>
              <div class="relative z-10 w-7 h-7 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-signal)] font-mono text-xs">
                📡
              </div>
            </div>
            <p class="font-mono text-xs text-[var(--text-muted)] animate-pulse">Sweeping radar for trending repositories...</p>
          </div>

          {#each Array(3) as _, i}
            <div class="p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg animate-pulse space-y-3 shadow-[var(--card-shadow)]">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-md bg-[var(--border-subtle)] shrink-0"></div>
                <div class="h-4 bg-[var(--border-subtle)] rounded w-12"></div>
                <div class="h-5 bg-[var(--border-subtle)] rounded w-1/3"></div>
                <div class="h-4 bg-[var(--border-subtle)] rounded w-16 ml-auto"></div>
              </div>
              <div class="h-4 bg-[var(--border-subtle)] rounded w-3/4"></div>
              <div class="h-4 bg-[var(--border-subtle)] rounded w-1/2"></div>
              <div class="pt-2 border-t border-[var(--border-subtle)] flex justify-between">
                <div class="h-3 bg-[var(--border-subtle)] rounded w-1/4"></div>
                <div class="h-3 bg-[var(--border-subtle)] rounded w-1/6"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if error && repos.length === 0}
        <!-- Error State -->
        <div class="py-16 text-center space-y-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
          <p class="text-sm font-mono text-[var(--badge-red-text)]">{error}</p>
          <button
            onclick={() => {
              clearAutoSeen()
              void repoFeed.fetchFeed()
            }}
            class="px-4 py-2 bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded-md text-xs font-mono font-medium hover:border-[var(--border-strong)] transition-all btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
          >
            Try Again
          </button>
        </div>
      {:else if repos.length === 0 && feedRepos.length === 0}
        <!-- Empty State -->
        <div class="py-16 text-center space-y-4 border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-surface)] p-6 sm:p-8 max-w-lg mx-auto shadow-[var(--card-shadow)]">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-signal-soft-bg)] border border-[var(--accent-signal)]/30 text-[var(--accent-signal-soft-text)]">
            <CheckIcon size={24} />
          </div>

          <div class="space-y-1.5">
            <h2 class="font-bold text-base text-[var(--text-main)] font-display">
              All Caught Up!
            </h2>
            <p class="text-xs text-[var(--text-muted)] leading-relaxed">
              You've seen everything trending in <span class="font-mono text-[var(--text-main)] font-semibold">{repoFeed.selectedLanguage === 'all' ? 'all languages' : repoFeed.selectedLanguage}</span> right now. Check back later, or reset to see it all again.
            </p>
          </div>

          <div class="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              onclick={() => (isResetConfirmOpen = true)}
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-signal)] text-white dark:text-zinc-950 font-semibold rounded-md text-xs hover:opacity-90 transition-all btn-press active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
            >
              <ResetIcon size={14} />
              <span>Reset Seen History ({seenStore.seenSize})</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Virtualized Feed Stream -->
        <VirtualFeed
          bind:this={virtualFeedRef}
          repos={feedRepos}
          {focusedIndex}
          onFocusIndex={(i) => (focusedIndex = i)}
          onDismiss={handleExplicitDismiss}
          onAutoSeen={handleAutoSeen}
        />
      {/if}
    {/if}
  </main>

  <!-- Floating Toast Notification for Explicit Dismiss Undo -->
  {#if toastVisible && lastDismissedRepo}
    <div
      role="status"
      aria-live="polite"
      class="popover-animate fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg shadow-xl text-xs font-mono"
    >
      <span class="text-[var(--text-main)] truncate max-w-[200px] sm:max-w-[300px]">
        Marked <strong class="font-semibold">{lastDismissedRepo.full_name}</strong> as seen
      </span>
      <button
        onclick={handleUndoDismiss}
        class="px-2.5 py-1 bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)] font-semibold rounded hover:opacity-90 transition-opacity btn-press active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Undo
      </button>
    </div>
  {/if}

  <!-- Footer -->
  <footer class="mt-auto border-t border-[var(--border-subtle)] py-3 text-[11px] text-[var(--text-muted)] font-mono">
    <div class="max-w-4xl mx-auto px-3.5 sm:px-4 flex items-center justify-between gap-2">
      <span>RepoRadar</span>
      <a
        href="https://github.com/quantavil/trendshift"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-[var(--text-main)] transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-signal)] rounded"
      >
        <GithubIcon size={12} />
        <span>Trendshift</span>
      </a>
    </div>
  </footer>

  <!-- Reset History Confirmation Modal -->
  <ConfirmModal
    isOpen={isResetConfirmOpen}
    title="Reset Seen History"
    message="Reset your seen history? RepoRadar will show these {seenStore.seenSize} repositories again."
    confirmText="Reset History"
    confirmVariant="danger"
    onConfirm={handleResetAll}
    onClose={() => (isResetConfirmOpen = false)}
  />
</div>
