<script lang="ts">
  import Icon from './lib/Icon.svelte'
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
    readCharacterShortcutsPreference,
    readThemePreference,
    writeCharacterShortcutsPreference,
    writeThemePreference,
  } from './lib/storage/preferences'
  import type { TrendshiftRepo, ViewMode } from './lib/types'

  let activeView = $state<ViewMode>('feed')
  let isResetConfirmOpen = $state(false)
  // Keyboard focus tracks the repo, not its list position, so removing another card keeps the highlight.
  let focusedKey = $state<string | null>(null)
  let navOffset = $state(56)
  let isDark = $state(readThemePreference() === 'dark')
  let characterShortcuts = $state(readCharacterShortcutsPreference())

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
  const focusedIndex = $derived(
    focusedKey === null
      ? -1
      : feedRepos.findIndex((repo) => repo.full_name === focusedKey),
  )
  const loading = $derived(repoFeed.loading)
  const error = $derived(repoFeed.error)

  const sourceLabel = $derived.by(() => {
    if (loading && repoFeed.catalog.length === 0) return 'Loading'
    const timeframe = repos[0]?.timeframe ?? repoFeed.successfulTimeframes[0]
    if (!timeframe) return error ? 'Unavailable' : 'Loading'
    return timeframe.charAt(0).toUpperCase() + timeframe.slice(1)
  })

  const unseenPercent = $derived(
    repoFeed.totalCount > 0
      ? Math.round((repoFeed.remainingCount / repoFeed.totalCount) * 100)
      : 0,
  )

  function handleExplicitDismiss(repo: TrendshiftRepo) {
    const wasSeen = seenStore.isSeen(repo.full_name)
    if (!wasSeen && repo.full_name === focusedKey) {
      // The focused card is leaving the feed, so move the highlight to a neighbour.
      const index = feedRepos.findIndex((item) => item.full_name === repo.full_name)
      focusedKey = (feedRepos[index + 1] ?? feedRepos[index - 1] ?? null)?.full_name ?? null
    }
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
    // Ignore scroll events fired while a catalog is still loading or replacing the list.
    if (!seenStore.autoSeenOnScroll || repoFeed.loading || seenStore.isSeen(repo.full_name)) return

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

  onMount(() => {
    let cancelled = false

    const cleanupHotkeys = setupHotkeys({
      onNext: () => {
        if (activeView !== 'feed' || isResetConfirmOpen || feedRepos.length === 0) return
        const next = focusedIndex === -1 ? 0 : Math.min(focusedIndex + 1, feedRepos.length - 1)
        focusedKey = feedRepos[next].full_name
        virtualFeedRef?.scrollToIndex(next, { align: 'auto' })
      },
      onPrev: () => {
        if (activeView !== 'feed' || isResetConfirmOpen || feedRepos.length === 0) return
        const prev = focusedIndex === -1 ? 0 : Math.max(focusedIndex - 1, 0)
        focusedKey = feedRepos[prev].full_name
        virtualFeedRef?.scrollToIndex(prev, { align: 'auto' })
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
    }, {
      characterShortcutsEnabled: () => characterShortcuts,
    })

    void (async () => {
      await seenStore.init()
      if (!cancelled) {
        clearAutoSeen()
        await repoFeed.fetchFeed()
      }
    })()

    // Track the sticky navbar height so the feed clears it when scrolling and scroll-past.
    const headerEl = document.querySelector<HTMLElement>('[data-site-header]')
    const headerObserver = headerEl ? new ResizeObserver(() => (navOffset = headerEl.offsetHeight)) : null
    if (headerEl && headerObserver) {
      navOffset = headerEl.offsetHeight
      headerObserver.observe(headerEl)
    }

    return () => {
      cancelled = true
      repoFeed.cancel()
      cleanupHotkeys()
      headerObserver?.disconnect()
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

  $effect(() => {
    writeCharacterShortcutsPreference(characterShortcuts)
  })

  function handleResetAll() {
    clearAutoSeen()
    void seenStore.resetSeen()
    void repoFeed.fetchFeed()
    focusedKey = null
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
  <main class="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-12 sm:pt-10 flex flex-col">
    <!-- Page header: editorial title, then the view's status or controls -->
    <header class="mb-6 sm:mb-8 space-y-4">
      {#if activeView === 'feed'}
        <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div class="min-w-0 space-y-2">
            <p class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <span class="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-signal)] opacity-60"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent-signal)]"></span>
              </span>
              Live radar
            </p>
            <h1 class="font-display text-4xl sm:text-5xl leading-none tracking-tight text-[var(--text-main)]">
              Trending
            </h1>
          </div>

          <div class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Icon name="filter" size={14} class="shrink-0" aria-hidden="true" />
            <span>Language</span>
            <LanguageSelect
              value={repoFeed.selectedLanguage}
              onChange={(lang) => {
                focusedKey = null
                clearAutoSeen()
                void repoFeed.setLanguage(lang)
              }}
            />
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-[var(--text-muted)]">
            <span>Source: <strong class="font-semibold text-[var(--text-main)]">{sourceLabel}</strong></span>
            <span>Remaining <strong class="font-semibold tabular-nums text-[var(--text-main)]">{repoFeed.remainingCount.toLocaleString()} / {repoFeed.totalCount.toLocaleString()}</strong></span>
          </div>
          <div
            class="h-1 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden"
            role="progressbar"
            aria-label="Unseen repositories"
            aria-valuemin="0"
            aria-valuemax={repoFeed.totalCount}
            aria-valuenow={repoFeed.remainingCount}
          >
            <div
              class="h-full rounded-full bg-[var(--accent-signal)] transition-[width] duration-300 ease-out"
              style="width: {unseenPercent}%"
            ></div>
          </div>
          <span class="sr-only" role="status" aria-live="polite">
            {repoFeed.remainingCount} of {repoFeed.totalCount} repositories remaining
          </span>
        </div>
      {:else}
        <button
          onclick={() => (activeView = 'feed')}
          class="inline-flex items-center gap-1.5 min-h-10 -ml-1 px-1 rounded font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        >
          <span>← Back to Feed</span>
        </button>

        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 class="font-display text-4xl sm:text-5xl leading-none tracking-tight text-[var(--text-main)]">
            {#if activeView === 'saved'}
              Saved
            {:else if activeView === 'history'}
              Seen history
            {:else if activeView === 'settings'}
              Settings
            {/if}
          </h1>
          <p class="font-mono text-xs text-[var(--text-muted)]">
            {#if activeView === 'saved'}
              {seenStore.saved.size} bookmarked
            {:else if activeView === 'history'}
              {seenStore.seenSize} seen
            {:else}
              Preferences and shortcuts
            {/if}
          </p>
        </div>
      {/if}
    </header>

    <!-- Active View Router -->
    {#if activeView === 'saved'}
      <SavedView onGoToFeed={() => (activeView = 'feed')} />
    {:else if activeView === 'history'}
      <HistoryView />
    {:else if activeView === 'settings'}
      <SettingsView bind:isDark bind:characterShortcuts />
    {:else}
      <!-- Feed Stream -->
      {#if loading && repos.length === 0}
        <!-- Skeleton Loading State -->
        <div class="space-y-3">
          <div class="py-8 flex flex-col items-center justify-center gap-3 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
            <div class="relative w-10 h-10 flex items-center justify-center">
              <div class="absolute inset-0 radar-sweep opacity-80"></div>
              <div class="relative z-10 w-7 h-7 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-signal)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" opacity="0.5" />
                  <path d="M12 12 L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                </svg>
              </div>
            </div>
            <p class="font-mono text-xs text-[var(--text-muted)] animate-pulse">Scanning trending repositories…</p>
          </div>

          {#each Array(3) as _, i}
            <div class="p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl animate-pulse space-y-3 shadow-[var(--card-shadow)]">
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-md bg-[var(--border-subtle)] shrink-0"></div>
                <div class="h-3 bg-[var(--border-subtle)] rounded w-1/4"></div>
              </div>
              <div class="h-5 bg-[var(--border-subtle)] rounded w-1/2"></div>
              <div class="h-4 bg-[var(--border-subtle)] rounded w-11/12"></div>
              <div class="h-4 bg-[var(--border-subtle)] rounded w-2/3"></div>
              <div class="pt-3 border-t border-[var(--border-subtle)] flex justify-between">
                <div class="h-3 bg-[var(--border-subtle)] rounded w-1/4"></div>
                <div class="h-3 bg-[var(--border-subtle)] rounded w-1/6"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if error && repos.length === 0}
        <!-- Error State -->
        <div class="py-14 text-center space-y-4 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-surface)] p-6 shadow-[var(--card-shadow)]">
          <p role="alert" class="text-sm text-[var(--badge-red-text)]">{error}</p>
          <button
            onclick={() => {
              clearAutoSeen()
              void repoFeed.fetchFeed()
            }}
            class="min-h-10 px-4 bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-strong)] rounded-md text-sm font-medium hover:bg-[var(--bg-surface-hover)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
          >
            Try again
          </button>
        </div>
      {:else if repos.length === 0 && feedRepos.length === 0}
        <!-- Empty State -->
        <div class="py-14 text-center space-y-5 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-surface)] p-6 sm:p-8 shadow-[var(--card-shadow)]">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)]">
            <Icon name="check" size={22} aria-hidden="true" />
          </div>

          <div class="space-y-2">
            <h2 class="font-display text-2xl leading-tight text-[var(--text-main)]">
              All caught up
            </h2>
            <p class="text-sm text-[var(--text-muted)] leading-relaxed max-w-sm mx-auto">
              You've seen everything trending in <span class="font-medium text-[var(--text-main)]">{repoFeed.selectedLanguage === 'all' ? 'all languages' : repoFeed.selectedLanguage}</span> right now. Check back later, or reset to see it all again.
            </p>
          </div>

          <div class="pt-1 flex flex-wrap items-center justify-center gap-3">
            <button
              onclick={() => (isResetConfirmOpen = true)}
              class="inline-flex items-center gap-2 min-h-10 px-4 bg-[var(--accent-signal)] text-[var(--on-accent)] font-medium rounded-md text-sm hover:opacity-90 transition-opacity btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
            >
              <Icon name="reset" size={14} aria-hidden="true" />
              <span>Clear seen history ({seenStore.seenSize})</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Virtualized Feed Stream -->
        <VirtualFeed
          bind:this={virtualFeedRef}
          repos={feedRepos}
          {focusedIndex}
          onFocusIndex={(i) => (focusedKey = feedRepos[i]?.full_name ?? null)}
          onDismiss={handleExplicitDismiss}
          onAutoSeen={handleAutoSeen}
          headerOffset={navOffset}
        />
      {/if}
    {/if}
  </main>

  <!-- Floating Toast Notification for Explicit Dismiss Undo -->
  {#if toastVisible && lastDismissedRepo}
    <div
      role="status"
      aria-live="polite"
      class="popover-animate fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 pl-4 pr-2 py-2 bg-[var(--text-main)] text-[var(--bg-canvas)] rounded-lg shadow-[var(--card-shadow-lift)] text-sm"
    >
      <span class="truncate max-w-[200px] sm:max-w-[320px]">
        Marked <strong class="font-semibold">{lastDismissedRepo.full_name}</strong> as seen
      </span>
      <button
        onclick={handleUndoDismiss}
        class="min-h-9 px-3 rounded-md bg-[var(--bg-canvas)]/15 font-semibold hover:bg-[var(--bg-canvas)]/25 transition-colors btn-press shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Undo
      </button>
    </div>
  {/if}

  <!-- Footer -->
  <footer class="mt-auto border-t border-[var(--border-subtle)] py-4 text-xs text-[var(--text-muted)]">
    <div class="w-full max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">
      <span class="font-display text-sm text-[var(--text-main)]">RepoRadar</span>
      <a
        href="https://github.com/quantavil/trendshift"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 min-h-10 hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] rounded"
      >
        <Icon name="github" size={13} aria-hidden="true" />
        <span>Data from Trendshift</span>
      </a>
    </div>
  </footer>

  <!-- Reset History Confirmation Modal -->
  <ConfirmModal
    isOpen={isResetConfirmOpen}
    title="Clear seen history"
    message="Clear your seen history? RepoRadar will show these {seenStore.seenSize} repositories again."
    confirmText="Clear history"
    onConfirm={handleResetAll}
    onClose={() => (isResetConfirmOpen = false)}
  />
</div>
