<script lang="ts">
  import { onMount } from 'svelte'
  import { feed } from './lib/feed.svelte'
  import { triage } from './lib/triage.svelte'
  import type { Repo, View } from './lib/types'
  import Topbar from './lib/Topbar.svelte'
  import BottomDock from './lib/BottomDock.svelte'
  import DiscoverView from './lib/DiscoverView.svelte'
  import Toast from './lib/Toast.svelte'

  let view = $state<View>('discover')
  // The selected row is what S, D, O act on. `expanded` applies to that row only.
  let selectedKey = $state<string | null>(null)
  let expanded = $state(true)
  let topHeight = $state(0)
  let toast = $state<{ id: number; message: string } | null>(null)
  let toastSeq = 0

  // Walks the rendered order, so keyboard moves cross period boundaries.
  const flat = $derived(feed.periods.flatMap((p) => p.repos))
  const activeKey = $derived(
    flat.some((r) => r.full_name === selectedKey) ? selectedKey : (flat[0]?.full_name ?? null),
  )

  onMount(() => {
    void feed.load()
  })

  function setView(next: View) {
    view = next
    selectedKey = null
    expanded = true
    window.scrollTo({ top: 0 })
  }

  function select(name: string) {
    if (name === activeKey) {
      expanded = !expanded
    } else {
      selectedKey = name
      expanded = true
    }
  }

  // Save or dismiss, then move the selection to the neighbouring row so the next key press has a target.
  function triageRepo(repo: Repo, kind: 'save' | 'dismiss') {
    const at = flat.findIndex((r) => r.full_name === repo.full_name)
    const after: Repo | undefined = at < 0 ? undefined : (flat[at + 1] ?? flat[at - 1])
    if (kind === 'save') triage.save(repo)
    else triage.dismiss(repo)
    selectedKey = after?.full_name ?? null
    expanded = true
    toast = { id: ++toastSeq, message: `${kind === 'save' ? 'Saved' : 'Dismissed'} ${repo.full_name}` }
  }

  function undoLast() {
    const last = triage.lastAction?.repo
    triage.undo()
    toast = null
    if (last) {
      selectedKey = last.full_name
      expanded = true
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
    // A dialog or an open dropdown owns the keyboard, including Escape and S, D, O.
    if (document.querySelector('dialog[open], [role="listbox"]')) return
    const target = e.target
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea'))) return

    if (e.key === 'Escape') {
      expanded = false
      return
    }
    if (view !== 'discover') return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (flat.length === 0) return
      e.preventDefault()
      const at = Math.max(0, flat.findIndex((r) => r.full_name === activeKey))
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next = flat[Math.min(flat.length - 1, Math.max(0, at + step))]
      selectedKey = next.full_name
      expanded = true
      return
    }

    const current = flat.find((r) => r.full_name === activeKey)
    if (!current) return
    const key = e.key.toLowerCase()
    if (key === 's') triageRepo(current, 'save')
    else if (key === 'd') triageRepo(current, 'dismiss')
    else if (key === 'o') window.open(current.github_url, '_blank', 'noopener')
  }
</script>

<svelte:window onkeydown={onkeydown} />

<div class="app" style:--top-h="{topHeight}px">
  <Topbar {view} onview={setView} bind:height={topHeight} />

  <main class="page">
    {#if view === 'discover'}
      <DiscoverView
        selectedKey={activeKey}
        {expanded}
        onselect={select}
        onsave={(repo) => triageRepo(repo, 'save')}
        ondismiss={(repo) => triageRepo(repo, 'dismiss')}
      />
    {:else if view === 'settings'}
      {#await import('./lib/SettingsView.svelte') then { default: Settings }}
        <Settings />
      {/await}
    {:else}
      <!-- Saved, Seen and Settings load on first visit, outside the first bundle. -->
      {#await import('./lib/CollectionView.svelte') then { default: Collection }}
        <Collection mode={view} />
      {/await}
    {/if}
  </main>

  <BottomDock {view} onview={setView} />

  {#if toast}
    {#key toast.id}
      <Toast message={toast.message} actionLabel="Undo" onaction={undoLast} ondismiss={() => (toast = null)} />
    {/key}
  {/if}
</div>
