<script lang="ts">
  import { formatAge, formatCount, formatGain, isNewRepo, languageColor } from './format'
  import type { Repo } from './types'
  import Icon from './Icon.svelte'

  type Mode = 'discover' | 'saved' | 'seen'

  interface Props {
    repo: Repo
    index?: number
    gainMax?: number
    mode?: Mode
    selected?: boolean
    expanded?: boolean
    onselect?: () => void
    onsave?: () => void
    ondismiss?: () => void
    onunsave?: () => void
    onrestore?: () => void
    swipe?: boolean
  }

  let {
    repo,
    index,
    gainMax,
    mode = 'discover',
    selected = false,
    expanded = false,
    onselect,
    onsave,
    ondismiss,
    onunsave,
    onrestore,
    swipe,
  }: Props = $props()

  const SWIPE_PX = 80
  const SLOP_PX = 8
  // Taps that follow a gesture within this window are swallowed (touch fires a click after a drag).
  const GESTURE_GRACE_MS = 400
  const LEAVE_MS = 180

  const SOCIALS = [
    { id: 'hackernews', name: 'Hacker News', tag: 'HN' },
    { id: 'reddit', name: 'Reddit', tag: 'RD' },
    { id: 'x', name: 'X', tag: 'X' },
  ]
  const CREATED = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

  const swipeOn = $derived(swipe ?? mode === 'discover')
  const owner = $derived(repo.full_name.split('/')[0])
  const name = $derived(repo.full_name.slice(owner.length + 1))
  const socials = $derived(SOCIALS.filter((s) => repo.social_mention_platforms.includes(s.id)))
  const isNew = $derived(isNewRepo(repo.created_at))
  const barPct = $derived(gainMax && gainMax > 0 ? Math.max(2, Math.round((repo.stars_gained / gainMax) * 100)) : 0)
  const detailId = $derived(`details-${repo.full_name}`)

  // Swipe state. `drag` is only read inside the pointer handlers, so it stays out of reactivity.
  let drag: { id: number; x: number; y: number; active: boolean } | null = null
  let offset = $state(0)
  let settling = $state(false)
  let leaving = $state(false)
  let lastGesture = 0
  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  let rowButton: HTMLButtonElement | undefined

  $effect(() => () => clearTimeout(leaveTimer))

  const dir = $derived(offset > 0 ? 'save' : offset < 0 ? 'dismiss' : undefined)
  const reveal = $derived(leaving ? 0 : Math.min(1, Math.abs(offset) / SWIPE_PX))

  function pointerDown(e: PointerEvent) {
    if (!swipeOn || e.pointerType === 'mouse' || !e.isPrimary) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false }
    settling = false
  }

  function pointerMove(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId) return
    const dx = e.clientX - drag.x
    if (!drag.active) {
      const dy = e.clientY - drag.y
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return
      // A mostly vertical gesture belongs to the page scroll.
      if (Math.abs(dy) > Math.abs(dx)) {
        drag = null
        return
      }
      drag.active = true
      rowButton?.setPointerCapture(e.pointerId)
    }
    offset = dx
  }

  function settle(pointerId: number, allowed: boolean) {
    if (!drag || drag.id !== pointerId) return
    const moved = drag.active
    drag = null
    if (!moved) return
    lastGesture = performance.now()
    settling = true
    const action = offset >= SWIPE_PX ? onsave : offset <= -SWIPE_PX ? ondismiss : undefined
    if (allowed && action) {
      leaving = true
      offset = Math.sign(offset) * window.innerWidth
      leaveTimer = setTimeout(action, LEAVE_MS)
    } else {
      offset = 0
    }
  }

  function select() {
    if (performance.now() - lastGesture < GESTURE_GRACE_MS) return
    onselect?.()
  }
</script>

<li class="item" id={`repo-${repo.full_name}`} data-repo-key={repo.full_name}>
  <div class="track" data-dir={dir} style:--p={reveal}>
    <div class="reveal" aria-hidden="true">
      <span class="l">Save</span>
      <span class="r">Dismiss</span>
    </div>
    <button
      bind:this={rowButton}
      type="button"
      class="lg-row"
      class:is-sel={selected}
      class:settling
      class:leaving
      style:transform={offset ? `translateX(${offset}px)` : null}
      aria-expanded={expanded}
      aria-controls={expanded ? detailId : undefined}
      onclick={select}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={(e) => settle(e.pointerId, true)}
      onpointercancel={(e) => settle(e.pointerId, false)}
    >
      <span class="lg-rk">{index !== undefined ? String(index).padStart(2, '0') : ''}</span>
      <span class="lg-nm">
        <span class="nm-line">
          <span class="own">{owner}/</span><span class="rep">{name}</span>
          {#if isNew}<span class="badge new">New</span>{/if}
        </span>
        <span class="desc" class:none={!repo.description}>{repo.description || 'No description'}</span>
      </span>
      <span class="lg-gain">
        <span class="gain">
          <span class="gain-val">{formatGain(repo.stars_gained)}</span>
          {#if gainMax !== undefined}<span class="hbar"><span style:width="{barPct}%"></span></span>{/if}
        </span>
      </span>
      <span class="lg-tot">{formatCount(repo.stars_total)}</span>
      <span class="lg-lang">
        <span class="lang">
          <span class="dot" style:background={languageColor(repo.language)}></span>
          <span class="lang-name">{repo.language}</span>
        </span>
      </span>
      <span class="lg-age">{formatAge(repo.created_at)}</span>
      <span class="lg-soc">
        <span class="socs">
          {#each socials as s (s.id)}
            <span class="soc-i" title="Mentioned on {s.name}">{s.tag}</span>
          {/each}
        </span>
      </span>
    </button>
  </div>

  {#if expanded}
    <div class="detail" id={detailId}>
      <div class="main">
        {#if repo.description}<p class="full">{repo.description}</p>{/if}
        {#if repo.tags.length}
          <ul class="tags">
            {#each repo.tags as tag (tag)}<li class="tag">{tag}</li>{/each}
          </ul>
        {:else}
          <p class="none">No topics listed</p>
        {/if}
        <p class="why">
          Why it is here: rank <b>#{repo.rank}</b>, <b>{formatGain(repo.stars_gained)}</b> stars gained this period,
          trend score <b>{repo.score}</b>.
          {#if isNew}<span class="badge new">New repo</span>{/if}
          {#if socials.length}
            Mentioned on
            {#each socials as s, n (s.id)}{#if n > 0}{', '}{/if}<span class="via">{s.name}</span>{/each}.
          {:else}
            No social mentions in this window.
          {/if}
        </p>
      </div>
      <aside class="side">
        <dl class="meta">
          <dt>Stars</dt><dd>{formatCount(repo.stars_total)}</dd>
          <dt>Forks</dt><dd>{formatCount(repo.forks_total)}</dd>
          <dt>Language</dt><dd>{repo.language}</dd>
          <dt>Created</dt><dd>{CREATED.format(new Date(repo.created_at))} · {formatAge(repo.created_at)}</dd>
        </dl>
        <div class="acts">
          {#if mode === 'discover'}
            <button type="button" class="btn pri" onclick={onsave}><Icon name="save" />Save</button>
            <button type="button" class="btn" onclick={ondismiss}><Icon name="dismiss" />Dismiss</button>
          {:else if mode === 'saved'}
            <button type="button" class="btn" onclick={onunsave}><Icon name="save" />Unsave</button>
          {:else}
            <button type="button" class="btn pri" onclick={onrestore}><Icon name="undo" />Restore</button>
            <button type="button" class="btn" onclick={onsave}><Icon name="save" />Save</button>
          {/if}
          <a class="btn" href={repo.github_url} target="_blank" rel="noopener noreferrer">
            <Icon name="external-link" /><span class="long">Open on GitHub</span><span class="short">Open</span>
          </a>
        </div>
      </aside>
    </div>
  {/if}
</li>

<style>
  .item {
    border-bottom: 1px solid var(--hair);
    scroll-margin-top: calc(var(--top-h) + 8px);
    content-visibility: auto;
    contain-intrinsic-size: auto 64px;
  }

  .track {
    position: relative;
    overflow: hidden;
  }

  .reveal {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    font-size: 14px;
    font-weight: 600;
    opacity: var(--p, 0);
    pointer-events: none;
  }

  .reveal .l {
    color: var(--accent);
  }

  .reveal .r {
    color: var(--ink-2);
  }

  .track[data-dir="save"] .reveal {
    background: var(--accent-tint);
  }

  .track[data-dir="dismiss"] .reveal {
    background: var(--hover);
  }

  .track[data-dir="save"] .r,
  .track[data-dir="dismiss"] .l {
    visibility: hidden;
  }

  .lg-row.settling {
    transition: transform 0.18s ease, opacity 0.18s ease;
  }

  .lg-row.leaving {
    opacity: 0;
  }

  .lg-rk {
    font: 500 12px/1 var(--font-mono);
    color: var(--ink-3);
  }

  .nm-line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 14.5px;
    line-height: 1.3;
  }

  .own {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-3);
  }

  .rep {
    flex: none;
    font-weight: 600;
  }

  .desc {
    display: block;
    margin-top: 2px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 13px;
    color: var(--ink-2);
  }

  .desc.none {
    font-style: italic;
    color: var(--ink-3);
  }

  .badge {
    flex: none;
    padding: 3px 5px;
    border: 1px solid var(--hair-2);
    border-radius: 4px;
    font: 600 9.5px/1 var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-2);
  }

  .badge.new {
    color: var(--accent);
    border-color: var(--accent);
  }

  .gain {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    min-width: 0;
  }

  .gain-val {
    font: 600 16px/1 var(--font-mono);
    letter-spacing: -0.01em;
  }

  .hbar {
    display: block;
    width: 100%;
    max-width: 150px;
    height: 3px;
    border-radius: 2px;
    background: var(--hair);
    overflow: hidden;
  }

  .hbar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .lg-tot,
  .lg-age {
    font: 400 12.5px/1 var(--font-mono);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .lang {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12.5px;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .lang-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .socs {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
  }

  .soc-i {
    font: 600 10px/1 var(--font-mono);
    letter-spacing: 0.04em;
    color: var(--ink-3);
  }

  .detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 28px;
    padding: 4px 12px 20px 66px;
    background: var(--sel);
  }

  .full {
    margin-bottom: 12px;
    font-size: 14.5px;
    line-height: 1.55;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 14px;
    padding: 0;
    list-style: none;
  }

  .tag {
    padding: 5px 9px;
    border: 1px solid var(--hair-2);
    border-radius: 999px;
    font: 500 11.5px/1 var(--font-mono);
    color: var(--ink-2);
  }

  .none {
    margin: 0 0 14px;
    color: var(--ink-3);
  }

  .why {
    padding-top: 12px;
    border-top: 1px solid var(--hair);
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-2);
  }

  .why b {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--ink);
  }

  .why .badge {
    margin: 0 4px;
    vertical-align: 1px;
  }

  .via {
    color: var(--ink);
  }

  .meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 7px 16px;
    margin: 0 0 14px;
    font-size: 13px;
  }

  .meta dt {
    color: var(--ink-3);
  }

  .meta dd {
    margin: 0;
    text-align: right;
    font-family: var(--font-mono);
    color: var(--ink);
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .short {
    display: none;
  }

  @media (max-width: 1099px) {
    .detail {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      padding-left: 62px;
    }
  }

  @media (max-width: 719px) {
    .lg-rk {
      font-size: 11px;
    }

    .nm-line {
      font-size: 15px;
    }

    .gain-val {
      font-size: 15px;
    }

    .hbar {
      max-width: 64px;
    }

    .detail {
      padding: 0 16px 18px;
    }

    .acts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .acts :global(.btn) {
      height: 48px;
      padding: 0 8px;
      font-size: 15px;
    }

    .long {
      display: none;
    }

    .short {
      display: inline;
    }
  }
</style>
