<script lang="ts">
  import { BookmarkIcon, ClockIcon, SettingsIcon } from './icons'
  import type { ViewMode } from './types'

  let {
    activeView = 'feed',
    onSelectView,
  } = $props<{
    activeView?: ViewMode
    onSelectView: (view: ViewMode) => void
  }>()
</script>

<header class="sticky top-0 z-30 w-full bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)] transition-colors">
  <div class="max-w-4xl mx-auto px-2.5 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-3">
    <!-- Left: Branding Logo -->
    <div class="flex items-center gap-2 sm:gap-3 shrink-0">
      <button
        onclick={() => onSelectView('feed')}
        class="flex items-center gap-2 font-display font-bold text-base tracking-tight text-[var(--text-main)] hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] rounded-md px-1 -mx-1"
        aria-label="RepoRadar Feed Home"
      >
        <!-- Radar Mark Icon -->
        <svg class="w-6 h-6 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <circle cx="16" cy="16" r="14" class="stroke-[var(--text-main)]" stroke-width="2" fill="var(--bg-canvas)"/>
          <circle cx="16" cy="16" r="9" class="stroke-[var(--accent-signal)]" stroke-width="1.5" opacity="0.5" fill="none"/>
          <path d="M16 16 L16 4" class="stroke-[var(--accent-signal)]" stroke-width="2" stroke-linecap="round"/>
          <path d="M16 16 L24 8" class="stroke-[var(--accent-signal)]" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
          <circle cx="22" cy="8" r="2" class="fill-[var(--accent-signal)]"/>
          <circle cx="16" cy="16" r="2" class="fill-[var(--accent-signal)]"/>
        </svg>
        <span>RepoRadar</span>
      </button>
    </div>

    <!-- Right: Semantic Primary Navigation landmark -->
    <nav aria-label="Primary" class="flex items-center gap-1.5 sm:gap-2">
      <!-- 1. Saved Bookmarks Icon Button -->
      <button
        onclick={() => onSelectView(activeView === 'saved' ? 'feed' : 'saved')}
        aria-label="Saved Bookmarks View"
        aria-current={activeView === 'saved' ? 'page' : undefined}
        title="Saved Bookmarks (Key 2)"
        class="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[var(--bg-surface)] border rounded-md transition-all btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
          activeView === 'saved'
            ? 'border-[var(--accent-signal)] text-[var(--accent-signal)] bg-[var(--accent-signal-soft-bg)]'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
        }"
      >
        <BookmarkIcon size={15} filled={activeView === 'saved'} aria-hidden="true" />
      </button>

      <!-- 2. Seen History Inspector Icon Button -->
      <button
        onclick={() => onSelectView(activeView === 'history' ? 'feed' : 'history')}
        aria-label="Seen History View"
        aria-current={activeView === 'history' ? 'page' : undefined}
        title="Seen History (Key 3)"
        class="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[var(--bg-surface)] border rounded-md transition-all btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
          activeView === 'history'
            ? 'border-[var(--accent-signal)] text-[var(--accent-signal)] bg-[var(--accent-signal-soft-bg)]'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
        }"
      >
        <ClockIcon size={15} aria-hidden="true" />
      </button>

      <!-- 3. Settings & Shortcuts Icon Button -->
      <button
        onclick={() => onSelectView(activeView === 'settings' ? 'feed' : 'settings')}
        aria-label="Settings & Shortcuts View"
        aria-current={activeView === 'settings' ? 'page' : undefined}
        title="Settings & Shortcuts (Key 4)"
        class="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center bg-[var(--bg-surface)] border rounded-md transition-all btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
          activeView === 'settings'
            ? 'border-[var(--accent-signal)] text-[var(--accent-signal)] bg-[var(--accent-signal-soft-bg)]'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
        }"
      >
        <SettingsIcon size={15} aria-hidden="true" />
      </button>
    </nav>
  </div>
</header>
