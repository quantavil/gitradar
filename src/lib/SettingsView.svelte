<script lang="ts">
  import Icon from './Icon.svelte'
  import { tick } from 'svelte'
  import { seenStore } from './seen.svelte'
  import ToggleSwitch from './ToggleSwitch.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import { parseHistoryImport, validateImportFile } from './history-import'
  let {
    isDark = $bindable(true),
    characterShortcuts = $bindable(true),
  } = $props<{
    isDark?: boolean
    characterShortcuts?: boolean
  }>()

  let importStatus = $state<{ message: string; isError: boolean } | null>(null)
  let isImporting = $state(false)
  // A file that passed validation and parsing, waiting for the user to confirm the replacement.
  let pendingImport = $state<{ content: string; count: number } | null>(null)
  let importInputRef = $state<HTMLInputElement | null>(null)

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

  function resetImportInput() {
    if (importInputRef) importInputRef.value = ''
  }

  function handleImportHistory(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const validation = validateImportFile(file)
    if (!validation.ok) {
      importStatus = { message: validation.error, isError: true }
      resetImportInput()
      return
    }

    isImporting = true
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        if (!content) {
          importStatus = { message: 'File is empty.', isError: true }
          resetImportInput()
          return
        }
        const parsed = parseHistoryImport(content)
        if (!parsed.ok) {
          importStatus = { message: parsed.error, isError: true }
          resetImportInput()
          return
        }
        // Nothing is written yet. The user confirms the replacement first.
        importStatus = null
        pendingImport = { content, count: parsed.count }
      } finally {
        isImporting = false
      }
    }
    reader.onerror = () => {
      importStatus = { message: 'Failed to read file.', isError: true }
      isImporting = false
      resetImportInput()
    }
    reader.readAsText(file)
  }

  function cancelImport() {
    pendingImport = null
    resetImportInput()
  }

  async function confirmImport() {
    const pending = pendingImport
    if (!pending) return
    pendingImport = null
    isImporting = true
    try {
      const res = await seenStore.importHistoryJSON(pending.content)
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
      resetImportInput()
      // The input was disabled during the import, so return focus to it once it is enabled again.
      await tick()
      importInputRef?.focus()
    }
  }

  const shortcuts: { keys: string[]; action: string }[] = [
    { keys: ['1'], action: 'Go to the Feed' },
    { keys: ['2'], action: 'Go to Saved' },
    { keys: ['3'], action: 'Go to History' },
    { keys: ['4', 'Shift+?'], action: 'Open Settings' },
    { keys: ['J'], action: 'Move focus to the next card' },
    { keys: ['K'], action: 'Move focus to the previous card' },
    { keys: ['S'], action: 'Bookmark the focused card' },
    { keys: ['D'], action: 'Mark the focused card as seen' },
    { keys: ['U'], action: 'Undo the last seen mark while the "Marked as seen" notice is showing (about 4 seconds)' },
    { keys: ['Esc'], action: 'Close a dialog, or return to the Feed' },
  ]
</script>

{#snippet sunIconSnippet()}
  <Icon name="sun" size={13} aria-hidden="true" />
{/snippet}

{#snippet moonIconSnippet()}
  <Icon name="moon" size={13} aria-hidden="true" />
{/snippet}

<div class="space-y-6 w-full">
  {#if seenStore.persistenceError}
    <div
      role="alert"
      class="flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-md border border-[var(--badge-red-text)]/40 bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] text-sm font-sans"
    >
      <span class="min-w-0 break-words">Storage Warning: {seenStore.persistenceError}</span>
      <button
        type="button"
        onclick={() => (seenStore.persistenceError = null)}
        class="shrink-0 min-h-11 sm:min-h-10 px-2 rounded font-medium underline underline-offset-2 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Dismiss
      </button>
    </div>
  {/if}

  <!-- Preferences Card -->
  <div class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] p-5 sm:p-6 space-y-5">
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <Icon name="settings" size={18} class="text-[var(--accent-signal)]" aria-hidden="true" />
      <h2 class="font-display text-lg font-semibold text-[var(--text-main)] tracking-tight">
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
      />

      <div class="border-t border-[var(--border-subtle)] pt-4">
        <!-- 2. Single-key Shortcuts -->
        <ToggleSwitch
          checked={characterShortcuts}
          onChange={(val) => (characterShortcuts = val)}
          label="Single-key shortcuts"
          description="J, K, S, D, U and 1–4 act on the feed. Turn them off if they clash with a screen reader or your keyboard layout. Escape always works."
        />
      </div>

      <div class="border-t border-[var(--border-subtle)] pt-4">
        <!-- 3. Scroll-Past Auto-Seen -->
        <ToggleSwitch
          checked={seenStore.autoSeenOnScroll}
          onChange={(val) => (seenStore.autoSeenOnScroll = val)}
          label="Scroll-Past Auto-Seen"
          description="Automatically mark repositories as seen when scrolled past"
        />
      </div>

      <div class="border-t border-[var(--border-subtle)] pt-4">
        <!-- 4. Mobile Touch Swipe Gestures -->
        <ToggleSwitch
          checked={seenStore.swipeGesturesEnabled}
          onChange={(val) => (seenStore.swipeGesturesEnabled = val)}
          label="Mobile Touch Swipe Gestures"
          description="Enable swipe right (bookmark) & swipe left (seen) on mobile devices"
        />
      </div>
    </div>
  </div>

  <!-- History Data Management Card -->
  <div class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] p-5 sm:p-6 space-y-4">
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <Icon name="clock" size={18} class="text-[var(--accent-signal)]" aria-hidden="true" />
      <h2 class="font-display text-lg font-semibold text-[var(--text-main)] tracking-tight">
        History Data Management
      </h2>
    </div>

    <p class="text-sm font-sans text-[var(--text-muted)] leading-relaxed">
      Export your seen repository history as a JSON file, or import one. Importing replaces your current history after you confirm. Files up to 2 MiB are accepted.
    </p>

    <div class="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
      <button
        type="button"
        onclick={handleExportHistory}
        class="inline-flex items-center justify-center w-full sm:w-auto min-h-11 sm:min-h-10 px-4 py-2 rounded-md border border-[var(--control-border)] bg-[var(--bg-surface)] text-sm font-sans font-medium text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-colors btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Export History ({seenStore.seenSize})
      </button>

      <label
        class="inline-flex items-center justify-center w-full sm:w-auto min-h-11 sm:min-h-10 px-4 py-2 rounded-md border border-[var(--accent-signal)]/40 bg-[var(--accent-signal-soft-bg)] text-sm font-sans font-medium text-[var(--accent-signal-soft-text)] hover:opacity-90 transition-opacity cursor-pointer btn-press has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent-signal)] {isImporting ? 'opacity-50 pointer-events-none' : ''}"
      >
        <span>{isImporting ? 'Importing...' : 'Import History (.json)'}</span>
        <input
          bind:this={importInputRef}
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
        class="px-3.5 py-2.5 rounded-md border text-sm font-sans {importStatus.isError ? 'bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] border-[var(--badge-red-text)]/40' : 'bg-[var(--accent-signal-soft-bg)] text-[var(--accent-signal-soft-text)] border-[var(--accent-signal)]/40'}"
      >
        {importStatus.message}
      </div>
    {/if}
  </div>

  <!-- Keyboard Shortcuts Cheat-sheet Card -->
  <div class="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--card-shadow)] p-5 sm:p-6 space-y-4">
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
      <Icon name="keyboard" size={18} class="text-[var(--accent-signal)]" aria-hidden="true" />
      <h2 class="font-display text-lg font-semibold text-[var(--text-main)] tracking-tight">
        Keyboard Shortcuts Reference
      </h2>
    </div>

    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
      {#each shortcuts as item}
        <div class="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)]">
          <dt class="shrink-0 min-w-[6.5rem] flex items-center gap-1.5">
            {#each item.keys as key, i}
              {#if i > 0}
                <span class="text-xs font-sans text-[var(--text-muted)]">or</span>
              {/if}
              <kbd>{key}</kbd>
            {/each}
          </dt>
          <dd class="text-sm font-sans text-[var(--text-main)] leading-snug">{item.action}</dd>
        </div>
      {/each}
    </dl>

    <p class="text-sm font-sans text-[var(--text-muted)] leading-relaxed">
      Single-key shortcuts can be turned off in Application Preferences. Escape always works.
    </p>
  </div>
</div>

<!-- Replace History Confirmation Modal -->
<ConfirmModal
  isOpen={pendingImport !== null}
  title="Replace seen history?"
  message="This replaces your current seen history with {pendingImport?.count ?? 0} repositories from the file. Your current history will be lost."
  confirmText="Replace history"
  onConfirm={confirmImport}
  onClose={cancelImport}
/>
