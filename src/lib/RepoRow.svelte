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

  const CREATED = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

  const swipeOn = $derived(swipe ?? true)
  const owner = $derived(repo.full_name.split('/')[0])
  const name = $derived(repo.full_name.slice(owner.length + 1))
  const isNew = $derived(isNewRepo(repo.created_at))
  const barPct = $derived(gainMax && gainMax > 0 ? Math.max(2, Math.round((repo.stars_gained / gainMax) * 100)) : 0)

  // Swipe state. `drag` is only read inside the pointer handlers, so it stays out of reactivity.
  let drag: { id: number; x: number; y: number; active: boolean } | null = null
  let offset = $state(0)
  let settling = $state(false)
  let leaving = $state(false)
  let lastGesture = 0
  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  let cardElement: HTMLElement | undefined

  $effect(() => () => clearTimeout(leaveTimer))

  const dir = $derived(offset > 0 ? 'save' : offset < 0 ? 'dismiss' : undefined)
  const reveal = $derived(leaving ? 0 : Math.min(1, Math.abs(offset) / SWIPE_PX))

  function pointerDown(e: PointerEvent) {
    if (!swipeOn || !e.isPrimary) return
    // Allow touch/pen, or left click for mouse on desktop
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Prevent drag gesture when interacting with links
    const target = e.target as HTMLElement | null
    if (target?.closest('a')) return

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
      cardElement?.setPointerCapture(e.pointerId)
    }
    // Tactile resistance past threshold
    if (Math.abs(dx) > SWIPE_PX) {
      const extra = Math.abs(dx) - SWIPE_PX
      offset = Math.sign(dx) * (SWIPE_PX + extra * 0.45)
    } else {
      offset = dx
    }
  }

  function settle(pointerId: number, allowed: boolean) {
    if (!drag || drag.id !== pointerId) return
    const moved = drag.active
    drag = null
    if (!moved) return
    lastGesture = performance.now()
    settling = true
    const action =
      offset >= SWIPE_PX
        ? mode === 'saved' ? onunsave : onsave
        : offset <= -SWIPE_PX
          ? mode === 'seen' ? onrestore : ondismiss
          : undefined
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
      <div class="tag-reveal left" class:ready={offset >= SWIPE_PX}>
        <Icon name="save" size={16} />
        <span>{mode === 'saved' ? 'Unsave' : 'Save'}</span>
      </div>
      <div class="tag-reveal right" class:ready={offset <= -SWIPE_PX}>
        <Icon name={mode === 'seen' ? 'undo' : 'dismiss'} size={16} />
        <span>{mode === 'seen' ? 'Restore' : 'Dismiss'}</span>
      </div>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
    <article
      bind:this={cardElement}
      class="card"
      class:is-sel={selected}
      class:settling
      class:leaving
      style:transform={offset ? `translateX(${offset}px)` : null}
      tabindex="0"
      role="button"
      onclick={select}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          select()
        }
      }}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={(e) => settle(e.pointerId, true)}
      onpointercancel={(e) => settle(e.pointerId, false)}
    >
      <header class="card-head">
        <div class="head-title">
          {#if index !== undefined}
            <span class="card-rk">{String(index).padStart(2, '0')}</span>
          {/if}
          <a
            class="repo-link"
            href={repo.github_url}
            target="_blank"
            rel="noopener noreferrer"
            onclick={(e) => e.stopPropagation()}
          >
            <span class="own">{owner}/</span><span class="rep">{name}</span>
          </a>
          {#if isNew}<span class="badge new">New</span>{/if}
        </div>

        <div class="head-meta">
          <div class="gain">
            <span class="gain-val">{formatGain(repo.stars_gained)}</span>
            {#if gainMax !== undefined}
              <span class="hbar"><span style:width="{barPct}%"></span></span>
            {/if}
          </div>
        </div>
      </header>

      <p class="desc" class:none={!repo.description}>
        {repo.description || 'No description'}
      </p>

      {#if repo.tags.length}
        <ul class="tags">
          {#each repo.tags as tag (tag)}
            <li class="tag">{tag}</li>
          {/each}
        </ul>
      {/if}

      <footer class="card-foot">
        <div class="stats">
          {#if repo.language}
            <span class="stat lang">
              <span class="dot" style:background={languageColor(repo.language)}></span>
              <span class="lang-name">{repo.language}</span>
            </span>
          {/if}
          <span class="stat" title="Total Stars">
            <Icon name="star" size={14} />
            <span>{formatCount(repo.stars_total)}</span>
          </span>
          <span class="stat" title="Total Forks">
            <Icon name="fork" size={14} />
            <span>{formatCount(repo.forks_total)}</span>
          </span>
          <span class="stat" title="Created date">
            <Icon name="clock" size={14} />
            <span>{CREATED.format(new Date(repo.created_at))} · {formatAge(repo.created_at)}</span>
          </span>
        </div>
      </footer>
    </article>
  </div>
</li>

<style>
  .item {
    border-bottom: 1px solid var(--hair);
    scroll-margin-top: calc(var(--top-h) + 8px);
    content-visibility: auto;
    contain-intrinsic-size: auto 150px;
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
    padding: 0 28px;
    opacity: var(--p, 0);
    pointer-events: none;
    transition: background-color 0.15s ease;
  }

  .tag-reveal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font: 600 13px/1 var(--font-ui);
    letter-spacing: 0.02em;
    white-space: nowrap;
    opacity: 0.8;
    transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease;
  }

  .tag-reveal.left {
    color: var(--accent);
    transform: translateX(calc((var(--p, 0) - 1) * 14px));
  }

  .tag-reveal.right {
    color: var(--ink-2);
    transform: translateX(calc((1 - var(--p, 0)) * 14px));
  }

  .tag-reveal.ready {
    opacity: 1;
    transform: scale(1.06);
  }

  .tag-reveal.right.ready {
    color: var(--ink);
  }

  .track[data-dir="save"] .reveal {
    background: var(--accent-tint);
  }

  .track[data-dir="dismiss"] .reveal {
    background: var(--hover);
  }

  .track[data-dir="save"] .right,
  .track[data-dir="dismiss"] .left {
    visibility: hidden;
  }

  .card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px 16px;
    background: var(--bg);
    color: inherit;
    text-align: left;
    touch-action: pan-y;
    border-left: 3px solid transparent;
    transition: background-color 0.12s, border-left-color 0.12s;
    user-select: none;
    -webkit-user-select: none;
  }

  .card:hover {
    background: var(--hover);
  }

  .card.is-sel {
    background: var(--sel);
    border-left-color: var(--accent);
  }

  .card.settling {
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease;
  }

  .card.leaving {
    opacity: 0;
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .head-title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .card-rk {
    font: 600 13px/1 var(--font-mono);
    color: var(--ink-3);
  }

  .repo-link {
    font-size: 16px;
    line-height: 1.3;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    word-break: break-word;
  }

  .repo-link:hover {
    text-decoration: underline;
  }

  .own {
    color: var(--ink-3);
    font-weight: 500;
  }

  .rep {
    color: var(--ink);
    font-weight: 700;
  }

  .badge {
    flex: none;
    padding: 2px 5px;
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

  .head-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
  }

  .gain {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    min-width: 70px;
  }

  .gain-val {
    font: 600 15px/1 var(--font-mono);
    letter-spacing: -0.01em;
  }

  .hbar {
    display: block;
    width: 100%;
    max-width: 90px;
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

  .desc {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-2);
    word-break: break-word;
  }

  .desc.none {
    font-style: italic;
    color: var(--ink-3);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tag {
    padding: 4px 8px;
    border: 1px solid var(--hair-2);
    border-radius: 999px;
    font: 500 11px/1 var(--font-mono);
    color: var(--ink-2);
    background: var(--panel);
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px 20px;
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--hair);
  }

  .stats {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    font: 400 12.5px/1 var(--font-mono);
    color: var(--ink-2);
  }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
  }

  .stat.lang {
    font-family: inherit;
    font-size: 13px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  @media (max-width: 719px) {
    .card {
      padding: 14px 16px;
      gap: 10px;
    }

    .repo-link {
      font-size: 15px;
    }

    .head-meta {
      gap: 8px;
    }

    .hbar {
      max-width: 60px;
    }

    .stats {
      gap: 12px;
    }
  }
</style>
