<script lang="ts">
  import { feed } from './feed.svelte'
  import { triage } from './triage.svelte'
  import { LANGUAGES, SORTS, TIMEFRAMES, type Timeframe, type View } from './types'
  import Icon from './Icon.svelte'
  import Select from './Select.svelte'

  const TABS: { id: View; label: string }[] = [
    { id: 'discover', label: 'Discover' },
    { id: 'saved', label: 'Saved' },
    { id: 'seen', label: 'Seen' },
    { id: 'settings', label: 'Settings' },
  ]

  interface Props {
    view: View
    onview: (view: View) => void
    height?: number
  }

  let { view, onview, height = $bindable(0) }: Props = $props()

  const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)')
  let systemDark = $state(systemDarkQuery.matches)

  $effect(() => {
    const sync = () => {
      systemDark = systemDarkQuery.matches
    }
    systemDarkQuery.addEventListener('change', sync)
    return () => systemDarkQuery.removeEventListener('change', sync)
  })

  const dark = $derived(triage.theme === 'system' ? systemDark : triage.theme === 'dark')
  const progress = $derived(feed.currentTotal ? Math.round((feed.currentTriaged / feed.currentTotal) * 100) : 0)

  function count(id: View): number | null {
    if (id === 'saved') return triage.saved.length
    if (id === 'seen') return triage.seen.length
    return null
  }

  function toggleTheme() {
    triage.theme = dark ? 'light' : 'dark'
  }

  function pickSort(value: string) {
    const sort = SORTS.find((s) => s.id === value)
    if (sort) feed.setSort(sort.id)
  }

  function pickLanguage(value: string) {
    const language = LANGUAGES.find((l) => l.id === value)
    if (language) feed.setLanguage(language.id)
  }
</script>

<header class="top" bind:clientHeight={height}>
  <div class="bar">
    <div class="brand">
      <Icon name="radar" size={20} />
      <span>GitRadar</span>
    </div>

    {#if view === 'discover'}
      <div class="filters">
        <!-- Timeframe stays a segmented control on wide screens and becomes a dropdown
             under 720px; CSS shows one of the two, so no media query runs in JS. -->
        <div class="seg" role="group" aria-label="Timeframe">
          {#each TIMEFRAMES as tf (tf.id)}
            <button type="button" aria-pressed={feed.timeframe === tf.id} onclick={() => feed.setTimeframe(tf.id)}>
              {tf.label}
            </button>
          {/each}
        </div>
        <div class="slot tf">
          <Select
            value={feed.timeframe}
            options={TIMEFRAMES}
            onchange={(id) => feed.setTimeframe(id as Timeframe)}
            ariaLabel="Timeframe"
          />
        </div>
        <div class="slot">
          <Select value={feed.language} options={LANGUAGES} onchange={pickLanguage} ariaLabel="Language" />
        </div>
        <div class="slot">
          <Select value={feed.sort} options={SORTS} onchange={pickSort} ariaLabel="Sort" align="end" />
        </div>
      </div>
    {/if}

    <nav class="views" aria-label="Views">
      {#each TABS as tab (tab.id)}
        {@const n = count(tab.id)}
        <button type="button" class="tab" aria-current={view === tab.id ? 'page' : undefined} onclick={() => onview(tab.id)}>
          {tab.label}{#if n !== null} <span class="cnt">{n}</span>{/if}
        </button>
      {/each}
    </nav>

    <button type="button" class="icon-btn" aria-label="Switch light or dark theme" onclick={toggleTheme}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  </div>

  {#if view === 'discover'}
    <div class="prog">
      <div class="meter" role="progressbar" aria-label="Triage progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <i style:width="{progress}%"></i>
      </div>
      <span><b>{feed.currentTriaged}</b> of {feed.currentTotal} triaged</span>
      <span>{feed.currentRemaining} new</span>
    </div>
  {/if}
</header>

<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--bg);
    border-bottom: 1px solid var(--hair);
  }

  .bar,
  .prog {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    min-height: 56px;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--accent);
  }

  .brand span {
    color: var(--ink);
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  /* One flexible slot per filter; the Select inside fills it and ellipsizes when it must. */
  .slot {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
  }

  .slot.tf {
    display: none;
  }

  .views {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    color: var(--ink-3);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--ink);
    background: var(--hover);
  }

  .tab[aria-current="page"] {
    color: var(--ink);
    background: var(--hover);
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .cnt {
    min-width: 20px;
    padding: 0 4px;
    border: 1px solid var(--hair-2);
    border-radius: 4px;
    font: 500 11px/16px var(--font-mono);
    text-align: center;
    color: var(--ink-3);
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    color: var(--ink-2);
  }

  .icon-btn:hover {
    background: var(--hover);
    color: var(--ink);
  }

  .prog {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 9px;
    font: 500 11.5px/1 var(--font-mono);
    color: var(--ink-3);
  }

  .prog b {
    font-weight: 600;
    color: var(--ink);
  }

  .meter {
    position: relative;
    flex: 1;
    height: 2px;
    background: var(--hair);
    overflow: hidden;
  }

  .meter i {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--accent);
    transition: width 0.35s ease;
  }

  @media (max-width: 719px) {
    .bar {
      gap: 10px 12px;
      padding: 10px 16px 0;
    }

    .brand {
      flex: 1;
    }

    .views {
      display: none;
    }

    /* No horizontal sliding: the three filters share one row, shrink with ellipsis and
       wrap only when the screen is narrower than the labels can fit. */
    .filters {
      order: 3;
      width: 100%;
      flex-wrap: wrap;
      gap: 6px;
      padding-bottom: 10px;
    }

    .filters .seg {
      display: none;
    }

    .slot.tf {
      display: flex;
    }

    .filters > .slot {
      flex: 1 1 auto;
    }

    .icon-btn {
      width: 44px;
      height: 44px;
    }

    .prog {
      padding: 0 16px 10px;
    }
  }
</style>
