<script lang="ts">
  import Icon from './Icon.svelte'
  import type { ViewMode } from './types'

  let {
    activeView = 'feed',
    onSelectView,
  } = $props<{
    activeView?: ViewMode
    onSelectView: (view: ViewMode) => void
  }>()

  // Hotkeys 1-4 open these views (see hotkeys.ts).
  const NAV_ITEMS: { view: ViewMode; label: string; hotkey: string }[] = [
    { view: 'feed', label: 'Feed', hotkey: '1' },
    { view: 'saved', label: 'Saved', hotkey: '2' },
    { view: 'history', label: 'History', hotkey: '3' },
    { view: 'settings', label: 'Settings', hotkey: '4' },
  ]

  // Navigation, not a toggle: selecting the active view does nothing.
  function selectNavItem(view: ViewMode) {
    if (view !== activeView) onSelectView(view)
  }
</script>

{#snippet navIcon(view: ViewMode, active: boolean)}
  <span aria-hidden="true" class="flex shrink-0 items-center justify-center">
    {#if view === 'feed'}
      <!-- Radar sweep: matches the wordmark mark -->
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 12 17 7" />
      </svg>
    {:else if view === 'saved'}
      <Icon name="bookmark" size={16} filled={active} />
    {:else if view === 'history'}
      <Icon name="clock" size={16} />
    {:else}
      <Icon name="settings" size={16} />
    {/if}
  </span>
{/snippet}

<header data-site-header class="sticky top-0 z-30 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 backdrop-blur-md transition-colors">
  <div class="mx-auto flex max-w-3xl flex-col px-4 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
    <!-- Wordmark -->
    <button
      type="button"
      onclick={() => onSelectView('feed')}
      aria-label="RepoRadar Feed Home"
      class="-mx-1 flex h-12 items-center gap-2 self-start rounded-md px-1 font-display text-lg font-semibold tracking-tight text-[var(--text-main)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] sm:h-auto sm:self-auto sm:py-1"
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

    <!-- Primary navigation: four equal columns on phones, a compact row from sm up -->
    <nav aria-label="Primary" class="grid w-full grid-cols-4 gap-1 pb-1.5 sm:flex sm:w-auto sm:items-center sm:gap-1 sm:pb-0">
      {#each NAV_ITEMS as item (item.view)}
        {@const active = activeView === item.view}
        <button
          type="button"
          onclick={() => selectNavItem(item.view)}
          aria-current={active ? 'page' : undefined}
          title={`${item.label} (${item.hotkey})`}
          class="btn-press relative flex min-h-11 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-md px-1 py-1.5 font-sans text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] sm:min-h-9 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm {active ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}"
        >
          {@render navIcon(item.view, active)}
          <span>{item.label}</span>
          {#if active}
            <!-- Active state is a shape as well as a color -->
            <span aria-hidden="true" class="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent-signal)] sm:inset-x-3"></span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>
</header>
