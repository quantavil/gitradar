<script lang="ts">
  import { seenStore } from './seen.svelte'
  import ToggleSwitch from './ToggleSwitch.svelte'
  import { validateImportFile } from './history-import'
  import { SettingsIcon, SunIcon, MoonIcon, KeyboardIcon, ClockIcon } from './icons'

  let { isDark = $bindable(true) } = $props<{
    isDark?: boolean
  }>()

  let importStatus = $state<{ message: string; isError: boolean } | null>(null)
  let isImporting = $state(false)

  function handleExportHistory() {
    const jsonStr = seenStore.exportHistoryJSON()
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.href = url
    downloadAnchor.download = `reporadar-history-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    URL.revokeObjectURL(url)
  }

  function handleImportHistory(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const validation = validateImportFile(file)
    if (!validation.ok) {
      importStatus = { message: validation.error, isError: true }
      target.value = ''
      return
    }

    isImporting = true
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        if (!content) {
          importStatus = { message: 'File is empty.', isError: true }
          return
        }
        const res = await seenStore.importHistoryJSON(content)
        if (res.success) {
          importStatus = {
            message: `Successfully imported ${res.count} history records (overwritten).`,
            isError: false,
          }
        } else {
          importStatus = {
            message: res.error || 'Failed to import history JSON.',
            isError: true,
          }
        }
      } finally {
        isImporting = false
        target.value = ''
      }
    }
    reader.onerror = () => {
      importStatus = { message: 'Failed to read file.', isError: true }
      isImporting = false
      target.value = ''
    }
    reader.readAsText(file)
  }

  const shortcuts = [
    { key: '1', action: 'Switch to Feed View (Home)' },
    { key: '2', action: 'Switch to Bookmarks View' },
    { key: '3', action: 'Switch to History View' },
    { key: '4 / Shift+?', action: 'Open Shortcuts & Settings' },
    { key: 'J', action: 'Move focus to next repository card' },
    { key: 'K', action: 'Move focus to previous repository card' },
    { key: 'S', action: 'Save / Bookmark active repository' },
    { key: 'D', action: 'Mark Seen for active repository' },
    { key: 'U', action: 'Undo last dismissed repository' },
    { key: 'Esc', action: 'Return to Feed stream' },
  ]
</script>

{#snippet sunIconSnippet()}
  <SunIcon size={13} aria-hidden="true" />
{/snippet}

{#snippet moonIconSnippet()}
  <MoonIcon size={13} aria-hidden="true" />
{/snippet}

<div class="space-y-6 w-full">
  {#if seenStore.persistenceError}
    <div
      role="alert"
      class="p-3 bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] border border-[var(--badge-red-text)]/30 rounded-lg text-xs font-mono flex items-center justify-between gap-2"
    >
      <span>Storage Warning: {seenStore.persistenceError}</span>
      <button
        onclick={() => (seenStore.persistenceError = null)}
        class="underline font-semibold hover:opacity-80"
      >
        Dismiss
      </button>
    </div>
  {/if}

  <!-- Preferences Card -->
  <div class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] p-5 sm:p-6 space-y-5">
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <SettingsIcon size={18} class="text-[var(--accent-signal)]" aria-hidden="true" />
      <h2 class="font-bold text-base text-[var(--text-main)] font-display tracking-tight">
        Application Preferences
      </h2>
    </div>

    <div class="space-y-4">
      <!-- 1. Theme Preference -->
      <ToggleSwitch
        checked={isDark}
        onChange={(val) => (isDark = val)}
        label="Appearance Theme"
        description="Select your preferred color theme (Dark / Light)"
        iconInactive={sunIconSnippet}
        iconActive={moonIconSnippet}
        ariaLabel="Dark mode appearance theme"
      />

      <div class="border-t border-[var(--border-subtle)] pt-2">
        <!-- 2. Scroll-Past Auto-Seen -->
        <ToggleSwitch
          checked={seenStore.autoSeenOnScroll}
          onChange={(val) => (seenStore.autoSeenOnScroll = val)}
          label="Scroll-Past Auto-Seen"
          description="Automatically mark repositories as seen when scrolled past"
          ariaLabel="Toggle Scroll-Past Auto-Seen"
        />
      </div>

      <div class="border-t border-[var(--border-subtle)] pt-2">
        <!-- 3. Mobile Touch Swipe Gestures -->
        <ToggleSwitch
          checked={seenStore.swipeGesturesEnabled}
          onChange={(val) => (seenStore.swipeGesturesEnabled = val)}
          label="Mobile Touch Swipe Gestures"
          description="Enable swipe right (bookmark) & swipe left (seen) on mobile devices"
          ariaLabel="Toggle Mobile Touch Swipe Gestures"
        />
      </div>
    </div>
  </div>

  <!-- History Data Management Card -->
  <div class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] p-5 sm:p-6 space-y-4">
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <ClockIcon size={18} class="text-[var(--accent-signal)]" aria-hidden="true" />
      <h2 class="font-bold text-base text-[var(--text-main)] font-display tracking-tight">
        History Data Management
      </h2>
    </div>

    <p class="text-xs text-[var(--text-muted)] leading-relaxed">
      Export your seen repository history as a JSON file or import history from a file. <strong class="text-[var(--text-main)]">Note: Importing will always overwrite current history.</strong>
    </p>

    <div class="flex flex-wrap items-center gap-3 pt-1 font-mono text-xs">
      <button
        onclick={handleExportHistory}
        class="px-3 py-1.5 bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded text-xs font-mono font-medium hover:border-[var(--border-strong)] transition-all btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Export History ({seenStore.seenSize})
      </button>

      <label class="px-3 py-1.5 bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)] border border-[var(--accent-signal)]/30 rounded text-xs font-mono font-medium hover:opacity-90 transition-all cursor-pointer btn-press focus-within:ring-2 focus-within:ring-[var(--accent-signal)] {isImporting ? 'opacity-50 pointer-events-none' : ''}">
        <span>{isImporting ? 'Importing...' : 'Import History (.json)'}</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={isImporting}
          onchange={handleImportHistory}
          class="sr-only"
        />
      </label>
    </div>

    {#if importStatus}
      <div
        role={importStatus.isError ? 'alert' : 'status'}
        class="p-2.5 rounded text-xs font-mono border {importStatus.isError ? 'bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] border-[var(--badge-red-text)]/30' : 'bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)] border-[var(--accent-signal)]/30'}"
      >
        {importStatus.message}
      </div>
    {/if}
  </div>

  <!-- Keyboard Shortcuts Cheat-sheet Card -->
  <div class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] p-5 sm:p-6 space-y-4">
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <KeyboardIcon size={18} class="text-[var(--accent-signal)]" aria-hidden="true" />
      <h2 class="font-bold text-base text-[var(--text-main)] font-display tracking-tight">
        Keyboard Shortcuts Reference
      </h2>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
      {#each shortcuts as item}
        <div class="flex items-center justify-between text-xs p-2.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
          <span class="text-[var(--text-muted)] font-mono">{item.action}</span>
          <kbd class="ml-2 font-mono font-bold shrink-0 px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-main)] shadow-xs">{item.key}</kbd>
        </div>
      {/each}
    </div>
  </div>
</div>
