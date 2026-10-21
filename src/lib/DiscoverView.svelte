<script lang="ts">
  import { tick, untrack } from 'svelte'
  import { feed } from './feed.svelte'
  import { triage } from './triage.svelte'
  import { TIMEFRAMES, type Repo, type Timeframe } from './types'
  import RepoRow from './RepoRow.svelte'

  interface Props {
    selectedKey: string | null
    expanded?: boolean
    onselect: (name: string) => void
    onsave: (repo: Repo) => void
    ondismiss: (repo: Repo) => void
  }

  let { selectedKey, onselect, onsave, ondismiss }: Props = $props()

  // Periods are rendered a few at a time so the DOM stays bounded however far the feed runs.
  const PERIODS_FIRST = 1
  const PERIODS_STEP = 3
  const SKELETON_ROWS = [0, 1, 2, 3, 4, 5]
  const WINDOW: Record<Timeframe, string> = {
    daily: 'today',
    weekly: 'this week',
    monthly: 'this month',
    yearly: 'this year',
  }

  let shown = $state(PERIODS_FIRST)
  let sentinel = $state<HTMLElement | null>(null)

  const listKey = $derived(`${feed.timeframe}|${feed.language}|${feed.sort}`)
  const visible = $derived(feed.periods.slice(0, shown))
  const hasMore = $derived(shown < feed.periods.length)
  const booting = $derived(
    !triage.ready || feed.status === 'idle' || (feed.status === 'loading' && feed.periods.length === 0),
  )
  const windowLabel = $derived(WINDOW[feed.timeframe])
  const nextTimeframe = $derived(
    TIMEFRAMES[(TIMEFRAMES.findIndex((t) => t.id === feed.timeframe) + 1) % TIMEFRAMES.length],
  )

  // A different listing starts again from its current period.
  $effect(() => {
    void listKey
    shown = PERIODS_FIRST
  })

  // Keyboard moves can land on a period that is not rendered yet: reveal it, then bring the row into view.
  $effect(() => {
    const key = selectedKey
    if (key === null) return
    const at = untrack(() => feed.periods.findIndex((p) => p.repos.some((r) => r.full_name === key)))
    if (at >= 0 && at >= untrack(() => shown)) shown = at + 1
    void tick().then(() => document.getElementById(`repo-${key}`)?.scrollIntoView({ block: 'nearest' }))
  })

  // The sentinel reveals the next periods as the reader reaches the end of what is rendered.
  $effect(() => {
    // Re-arm after every reveal so a sentinel that is still on screen fires again.
    void shown
    if (!hasMore || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) shown += PERIODS_STEP
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })
</script>

{#if feed.status === 'error' && feed.periods.length === 0}
  <div class="state" role="alert">
    <h2>Could not load trends</h2>
    <p>{feed.error ?? 'Check your connection and try again.'}</p>
    <button type="button" class="btn" onclick={() => void feed.load()}>Retry</button>
  </div>
{:else if booting}
  <div class="skeleton" role="status">
    <span class="sr-only">Loading repositories</span>
    {#each SKELETON_ROWS as row (row)}
      <div class="sk" aria-hidden="true"></div>
    {/each}
  </div>
{:else if feed.periods.length === 0}
  <div class="state">
    <h2>{feed.currentTotal > 0 ? 'All caught up' : 'Nothing new here'}</h2>
    <p>
      {feed.currentTotal > 0
        ? `You have triaged all ${feed.currentTotal} repos for ${windowLabel}.`
        : `No repos trended ${windowLabel} for this filter.`}
    </p>
    <button type="button" class="btn" onclick={() => feed.setTimeframe(nextTimeframe.id)}>
      Switch to {nextTimeframe.label}
    </button>
  </div>
{:else}
  <div class="refresh" class:on={feed.status === 'loading'} role="status">
    <span class="sr-only">{feed.status === 'loading' ? 'Updating list' : ''}</span>
  </div>
  {#if feed.status === 'error'}
    <p class="stale">
      Could not refresh: {feed.error}. Showing the last list you loaded.
      <button type="button" class="link" onclick={() => void feed.load()}>Retry</button>
    </p>
  {/if}
  <div class="lg">
    {#each visible as period (period.key)}
      {@const gainMax = Math.max(...period.repos.map((r) => r.stars_gained))}
      <section>
        <h2 class="period-label" class:current={period.current}>
          <span>{period.label}</span>
          <span>{period.repos.length}</span>
        </h2>
        <ol class="lg-list">
          {#each period.repos as repo (repo.full_name)}
            <RepoRow
              {repo}
              index={repo.rank}
              {gainMax}
              mode="discover"
              selected={selectedKey === repo.full_name}
              onselect={() => onselect(repo.full_name)}
              onsave={() => onsave(repo)}
              ondismiss={() => ondismiss(repo)}
            />
          {/each}
        </ol>
      </section>
    {/each}

    {#if hasMore}
      <div class="sentinel" bind:this={sentinel} aria-hidden="true"></div>
    {/if}
  </div>
{/if}

<style>
  .period-label {
    position: sticky;
    top: var(--top-h);
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0;
    padding: 14px 12px 8px;
    background: var(--bg);
    font: 500 11px/1 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
  }

  .period-label.current {
    color: var(--ink);
  }

  .sentinel {
    height: 1px;
  }

  /* Hairline sweep under the top bar while a fetch runs; the list stays on screen meanwhile. */
  .refresh {
    position: relative;
    height: 2px;
    overflow: hidden;
  }

  .refresh.on::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    animation: sweep 1.1s linear infinite;
  }

  @keyframes sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(100%);
    }
  }

  .stale {
    margin: 0;
    padding: 10px 12px;
    border-bottom: 1px solid var(--hair);
    font-size: 13px;
    color: var(--ink-2);
  }

  .link {
    margin-left: 8px;
    color: var(--accent);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .state {
    max-width: 460px;
    padding: 56px 12px;
  }

  .state h2 {
    margin: 0 0 6px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .state p {
    margin: 0 0 16px;
    color: var(--ink-2);
  }

  .skeleton {
    display: grid;
  }

  .sk {
    height: 58px;
    border-bottom: 1px solid var(--hair);
    background: var(--panel);
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.5;
    }
  }

  @media (max-width: 719px) {
    .period-label {
      padding: 12px 16px 6px;
    }

    .state {
      padding: 44px 16px;
    }
  }
</style>
