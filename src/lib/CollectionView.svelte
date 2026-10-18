<script lang="ts">
  import { tick } from 'svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import RepoRow from './RepoRow.svelte'
  import {
    COLLECTION_SORTS,
    ROWS_PER_PAGE,
    filterEntries,
    sortEntries,
    stepIndex,
    type CollectionSort,
  } from './collection'
  import { triage } from './triage.svelte'
  import type { Repo } from './types'

  // Saved and Seen are the same list with different verbs: S undoes a save in Saved, saves in Seen; D restores in Seen.
  const COPY = {
    saved: {
      title: 'Saved',
      noun: 'saved',
      emptyTitle: 'Nothing saved yet',
      emptyBody: 'Save repos from Discover and they will wait here.',
      clear: 'Clear saved',
      clearTitle: 'Clear all saved repos?',
      clearBody: 'This removes every saved repo from this browser and cannot be undone. Export from Settings first to keep a copy.',
    },
    seen: {
      title: 'Seen',
      noun: 'seen',
      emptyTitle: 'No history yet',
      emptyBody: 'Repos you dismiss in Discover show up here.',
      clear: 'Clear seen',
      clearTitle: 'Clear all seen repos?',
      clearBody: 'This removes every seen repo from this browser and cannot be undone. Discover will show them again.',
    },
  } as const

  let { mode }: { mode: 'saved' | 'seen' } = $props()

  const copy = $derived(COPY[mode])
  const entries = $derived(mode === 'saved' ? triage.saved : triage.seen)

  let query = $state('')
  let sort = $state<CollectionSort>('recent')
  let limit = $state(ROWS_PER_PAGE)
  let selectedKey = $state<string | null>(null)
  let expandedKey = $state<string | null>(null)
  let confirmOpen = $state(false)
  let sentinel: HTMLElement | undefined = $state()

  const visible = $derived(filterEntries(sortEntries(entries, sort), query))
  const shown = $derived(visible.slice(0, limit))
  const selectedIndex = $derived(visible.findIndex((entry) => entry.repo.full_name === selectedKey))
  const gainMax = $derived(visible.reduce((max, entry) => Math.max(max, entry.repo.stars_gained), 1))
  const countLabel = $derived(
    query.trim()
      ? `${visible.length} of ${entries.length}`
      : `${entries.length} ${entries.length === 1 ? 'repo' : 'repos'}`,
  )

  // Re-observing after each page makes the observer report the sentinel's current position,
  // so short pages keep filling the viewport.
  $effect(() => {
    if (!sentinel || limit >= visible.length) return
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) limit += ROWS_PER_PAGE
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })

  function select(name: string) {
    selectedKey = name
    expandedKey = expandedKey === name ? null : name
  }

  function release() {
    selectedKey = null
    expandedKey = null
  }

  function unsave(name: string) {
    triage.unsave(name)
    release()
  }

  function restore(name: string) {
    triage.restore(name)
    release()
  }

  function save(repo: Repo) {
    triage.save(repo)
    release()
  }

  function clearAll() {
    if (mode === 'saved') triage.clearSaved()
    else triage.clearSeen()
    confirmOpen = false
    release()
  }

  async function move(delta: number) {
    const next = stepIndex(visible.length, selectedIndex, delta)
    if (next < 0) return
    const name = visible[next].repo.full_name
    limit = Math.max(limit, next + 1)
    selectedKey = name
    expandedKey = name
    await tick()
    document.querySelector(`[data-repo-key="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    if (isTyping(event.target) || document.querySelector('dialog[open]')) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      void move(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Escape') {
      expandedKey = null
      return
    }
    const selected = selectedIndex >= 0 ? visible[selectedIndex] : undefined
    if (!selected) return
    const key = event.key.toLowerCase()
    const name = selected.repo.full_name
    if (key === 'o') window.open(selected.repo.github_url, '_blank', 'noopener,noreferrer')
    else if (mode === 'saved' && key === 's') unsave(name)
    else if (mode === 'seen' && key === 's') save(selected.repo)
    else if (mode === 'seen' && key === 'd') restore(name)
  }
</script>

<svelte:window onkeydown={onkeydown} />

<section class="view">
  <header class="head">
    <div class="title">
      <h1>{copy.title}</h1>
      <span class="count">{countLabel}</span>
      {#if entries.length}
        <button type="button" class="btn clear-all" onclick={() => (confirmOpen = true)}>Clear all</button>
      {/if}
    </div>
    {#if entries.length}
      <div class="tools">
        <div class="search">
          <input
            type="search"
            bind:value={query}
            placeholder="Search {copy.noun}"
            aria-label="Search {copy.noun} repos"
            autocomplete="off"
            spellcheck="false"
          />
          {#if query}
            <button type="button" class="clear" aria-label="Clear search" onclick={() => (query = '')}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          {/if}
        </div>
        <label class="sel">
          <select bind:value={sort} aria-label="Sort {copy.noun} repos">
            {#each COLLECTION_SORTS as option (option.id)}
              <option value={option.id}>{option.label}</option>
            {/each}
          </select>
        </label>
      </div>
    {/if}
  </header>

  {#if !entries.length}
    <div class="empty">
      <h2>{copy.emptyTitle}</h2>
      <p>{copy.emptyBody}</p>
    </div>
  {:else if !visible.length}
    <div class="empty">
      <h2>No matches</h2>
      <p>Nothing {copy.noun} matches “{query.trim()}”.</p>
    </div>
  {:else}
    <div class="lg">
      <div class="lg-head" aria-hidden="true">
        <span class="lg-rk"></span>
        <span class="lg-nm">Repository</span>
        <span class="lg-gain">Gained</span>
        <span class="lg-tot">Stars</span>
        <span class="lg-lang">Language</span>
        <span class="lg-age">Age</span>
        <span class="lg-soc">Signal</span>
      </div>
      <ol class="lg-list">
        {#each shown as entry (entry.repo.full_name)}
          <RepoRow
            repo={entry.repo}
            {gainMax}
            {mode}
            selected={selectedKey === entry.repo.full_name}
            expanded={expandedKey === entry.repo.full_name}
            onselect={() => select(entry.repo.full_name)}
            onunsave={() => unsave(entry.repo.full_name)}
            onrestore={() => restore(entry.repo.full_name)}
            onsave={() => save(entry.repo)}
          />
        {/each}
      </ol>
    </div>
    {#if shown.length < visible.length}
      <div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>
    {/if}
  {/if}
</section>

<ConfirmDialog
  open={confirmOpen}
  title={copy.clearTitle}
  body={copy.clearBody}
  confirmLabel={copy.clear}
  danger
  onconfirm={clearAll}
  oncancel={() => (confirmOpen = false)}
/>

<style>
  .view {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 20px 56px;
  }
  .head {
    display: grid;
    gap: 14px;
    padding: 22px 12px 14px;
  }
  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .count {
    font: 500 12px/1 var(--mono);
    color: var(--ink-3);
  }
  .clear-all {
    margin-left: auto;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .search {
    position: relative;
    flex: 1 1 260px;
    max-width: 380px;
  }
  .search input {
    width: 100%;
    height: 34px;
    padding: 0 36px 0 12px;
    border: 1px solid var(--hair-2);
    border-radius: 8px;
    background: var(--panel);
    color: var(--ink);
    font: 400 13.5px/1 var(--ui);
  }
  .search input::placeholder {
    color: var(--ink-3);
  }
  .search input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    position: absolute;
    top: 50%;
    right: 2px;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    transform: translateY(-50%);
    border-radius: 6px;
    color: var(--ink-3);
  }
  .clear:hover {
    background: var(--hover);
    color: var(--ink);
  }
  .clear svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .sel {
    position: relative;
    display: inline-flex;
  }
  .sel select {
    appearance: none;
    height: 34px;
    padding: 0 28px 0 10px;
    border: 1px solid var(--hair-2);
    border-radius: 8px;
    background: var(--panel);
    color: var(--ink);
    font: 500 13px/1 var(--ui);
    cursor: pointer;
  }
  .sel::after {
    content: "";
    position: absolute;
    right: 12px;
    top: 50%;
    width: 5px;
    height: 5px;
    border: solid var(--ink-3);
    border-width: 0 1.5px 1.5px 0;
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .sentinel {
    height: 1px;
  }
  .empty {
    max-width: 460px;
    padding: 64px 12px;
  }
  .empty h2 {
    margin: 0 0 6px;
    font-size: 17px;
    font-weight: 600;
  }
  .empty p {
    margin: 0;
    color: var(--ink-2);
  }
  @media (pointer: coarse) {
    .search input,
    .sel select {
      height: 44px;
    }
    .clear {
      width: 44px;
      height: 44px;
    }
  }
  @media (max-width: 719px) {
    .view {
      padding: 0 0 calc(88px + env(safe-area-inset-bottom));
    }
    .head {
      padding: 18px 16px 12px;
    }
    .search {
      flex-basis: 100%;
      max-width: none;
    }
    .empty {
      padding: 44px 16px;
    }
  }
</style>
