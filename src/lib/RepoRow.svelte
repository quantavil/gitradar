<script lang="ts">
  import { formatAge, formatCount, formatGain, isNewRepo, languageColor } from './format'
  import { reduced } from './motion'
  import type { Repo } from './types'
  import Icon from './Icon.svelte'

  type Mode = 'discover' | 'saved' | 'seen'

  interface Props {
    repo: Repo
    gainMax?: number
    mode?: Mode
    selected?: boolean
    onselect?: () => void
    onsave?: () => void
    ondismiss?: () => void
    onunsave?: () => void
    onrestore?: () => void
    swipe?: boolean
  }

  let {
    repo,
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

  const SLOP_PX = 6
  const MIN_COMMIT_PX = 56
  const MAX_COMMIT_PX = 88
  // A short fast flick commits like a long slow drag.
  const FLICK_PX_PER_MS = 0.45
  const FLICK_MIN_PX = 24
  const RUBBER = 0.35
  // Taps that follow a gesture within this window are swallowed (touch fires a click after a drag).
  const GESTURE_GRACE_MS = 400
  const MAX_TAGS = 4

  const CREATED = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

  const swipeOn = $derived(swipe ?? true)
  const owner = $derived(repo.full_name.split('/')[0])
  const name = $derived(repo.full_name.slice(owner.length + 1))
  const isNew = $derived(isNewRepo(repo.created_at))
  const heat = $derived(gainMax && gainMax > 0 ? Math.min(1, Math.max(0, repo.stars_gained / gainMax)) : 0)
  const tags = $derived(repo.tags.slice(0, MAX_TAGS))
  const moreTags = $derived(Math.max(0, repo.tags.length - MAX_TAGS))
  const created = $derived.by(() => {
    const date = new Date(repo.created_at)
    return Number.isNaN(date.getTime()) ? '' : CREATED.format(date)
  })

  // Swipe state is plain variables: the pointer path writes styles straight to the DOM once per
  // frame, so a drag never goes through Svelte's reactivity.
  interface Gesture {
    id: number
    x0: number
    y0: number
    x: number
    base: number
    active: boolean
    ready: boolean
    samples: [number, number][]
  }

  let g: Gesture | null = null
  let raf = 0
  let lastGesture = 0
  let timers: ReturnType<typeof setTimeout>[] = []
  let item: HTMLElement | undefined
  let track: HTMLElement | undefined
  let card: HTMLElement | undefined

  $effect(() => () => {
    cancelAnimationFrame(raf)
    for (const timer of timers) clearTimeout(timer)
  })

  const threshold = () => Math.min(MAX_COMMIT_PX, Math.max(MIN_COMMIT_PX, (card?.offsetWidth ?? 0) * 0.2))

  function resist(distance: number, limit: number): number {
    const abs = Math.abs(distance)
    return Math.sign(distance) * (abs <= limit ? abs : limit + (abs - limit) * RUBBER)
  }

  function paint() {
    raf = 0
    if (!g?.active || !card || !track) return
    const limit = threshold()
    const distance = g.base + g.x - g.x0
    const shown = resist(distance, limit)
    card.style.transform = `translate3d(${shown}px,0,0)`
    track.style.setProperty('--p', String(Math.min(1, Math.abs(shown) / limit)))
    const dir = shown > 0 ? 'save' : shown < 0 ? 'dismiss' : ''
    if (track.dataset.dir !== dir) track.dataset.dir = dir
    const ready = Math.abs(distance) >= limit
    if (ready !== g.ready) {
      g.ready = ready
      track.toggleAttribute('data-ready', ready)
      if (ready) navigator.vibrate?.(8)
    }
  }

  function resetVisuals() {
    if (!card || !track) return
    card.style.transform = ''
    card.style.willChange = ''
    track.removeAttribute('data-ready')
    delete track.dataset.dir
    track.style.setProperty('--p', '0')
  }

  function pointerDown(e: PointerEvent) {
    if (!swipeOn || !card || !e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Links and buttons keep their own press behaviour.
    if ((e.target as Element | null)?.closest('a, button')) return
    // Pick up a snap-back that is still running instead of jumping to its end.
    const base = new DOMMatrix(getComputedStyle(card).transform).m41
    card.style.transition = 'none'
    card.style.transform = base ? `translate3d(${base}px,0,0)` : ''
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, base, active: false, ready: false, samples: [] }
    if (e.pointerType === 'mouse') card.setPointerCapture(e.pointerId)
  }

  function pointerMove(e: PointerEvent) {
    if (!g || g.id !== e.pointerId || !card) return
    if (!g.active) {
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (Math.hypot(dx, dy) < SLOP_PX) return
      // A mostly vertical gesture belongs to the page scroll.
      if (Math.abs(dy) > Math.abs(dx) && !g.base) {
        g = null
        return
      }
      g.active = true
      card.setPointerCapture(e.pointerId)
      card.style.willChange = 'transform'
    }
    g.x = e.clientX
    g.samples.push([e.timeStamp, e.clientX])
    if (g.samples.length > 6) g.samples.shift()
    raf ||= requestAnimationFrame(paint)
  }

  function release(e: PointerEvent, allowed: boolean) {
    if (!g || g.id !== e.pointerId || !card || !track) return
    const end = g
    g = null
    cancelAnimationFrame(raf)
    raf = 0
    if (!end.active) {
      card.style.transition = ''
      return
    }
    lastGesture = performance.now()

    const limit = threshold()
    const distance = end.base + end.x - end.x0
    const recent = end.samples.filter(([time]) => e.timeStamp - time < 100)
    const first = recent[0]
    const last = recent.at(-1)
    const velocity = first && last && last[0] > first[0] ? (last[1] - first[1]) / (last[0] - first[0]) : 0
    const flick =
      Math.abs(velocity) >= FLICK_PX_PER_MS && Math.abs(distance) >= FLICK_MIN_PX && Math.sign(velocity) === Math.sign(distance)
    const commit = allowed && (Math.abs(distance) >= limit || flick)
    const action = !commit ? undefined : distance > 0 ? (mode === 'saved' ? onunsave : onsave) : mode === 'seen' ? onrestore : ondismiss

    if (!action) {
      card.style.transition = reduced() ? 'none' : 'transform 260ms cubic-bezier(0.3, 1.35, 0.5, 1)'
      resetVisuals()
      return
    }

    const width = card.offsetWidth + 24
    const remaining = width - Math.abs(resist(distance, limit))
    const ms = reduced() ? 0 : Math.round(Math.min(200, Math.max(110, remaining / Math.max(Math.abs(velocity), 1.5))))
    card.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.7, 0.3, 1)`
    card.style.transform = `translate3d(${Math.sign(distance) * width}px,0,0)`
    // The row closes its own gap, then the action removes it, so the list never jumps.
    timers.push(setTimeout(() => collapse(action), ms))
  }

  function collapse(action: () => void) {
    const el = item
    const height = el?.offsetHeight ?? 0
    if (!el || reduced() || height === 0) {
      action()
      return
    }
    el.style.overflow = 'hidden'
    const closing = el.animate(
      [
        { height: `${height}px`, opacity: 1 },
        { height: '0px', opacity: 0 },
      ],
      { duration: 150, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    )
    const done = () => {
      action()
      // If the action left this row in place, bring it back.
      timers.push(
        setTimeout(() => {
          if (!el.isConnected) return
          closing.cancel()
          el.style.overflow = ''
          if (card) card.style.transition = 'none'
          resetVisuals()
        }, 250),
      )
    }
    closing.onfinish = done
    closing.oncancel = () => {}
  }

  function select() {
    if (performance.now() - lastGesture < GESTURE_GRACE_MS) return
    onselect?.()
  }
</script>

<li class="item" id={`repo-${repo.full_name}`} data-repo-key={repo.full_name} bind:this={item}>
  <div class="track" bind:this={track} style:--p="0">
    <div class="reveal" aria-hidden="true">
      <div class="tag-reveal left">
        <Icon name="save" size={16} />
        <span>{mode === 'saved' ? 'Unsave' : 'Save'}</span>
      </div>
      <div class="tag-reveal right">
        <Icon name={mode === 'seen' ? 'undo' : 'dismiss'} size={16} />
        <span>{mode === 'seen' ? 'Restore' : 'Dismiss'}</span>
      </div>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
    <article
      bind:this={card}
      class="card"
      class:is-sel={selected}
      tabindex="0"
      role="button"
      onclick={select}
      onkeydown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          select()
        }
      }}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={(e) => release(e, true)}
      onpointercancel={(e) => release(e, false)}
      onlostpointercapture={(e) => release(e, false)}
    >
      <header class="card-head">
        <div class="head-title">
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
        <span
          class="gain"
          style:--heat={heat}
          title={`${repo.stars_gained.toLocaleString('en-US')} stars gained`}
        >
          <Icon name="trend" size={12} />
          {formatGain(repo.stars_gained)}
        </span>
      </header>

      <p class="desc" class:none={!repo.description}>
        {repo.description || 'No description'}
      </p>

      {#if tags.length}
        <ul class="tags">
          {#each tags as tag (tag)}
            <li class="tag">{tag}</li>
          {/each}
          {#if moreTags}<li class="tag more">+{moreTags}</li>{/if}
        </ul>
      {/if}

      <footer class="stats">
        {#if repo.language}
          <span class="stat lang">
            <span class="dot" style:background={languageColor(repo.language)}></span>
            <span class="lang-name">{repo.language}</span>
          </span>
        {/if}
        <span class="stat" title="Total stars">
          <Icon name="star" size={13} />
          <span>{formatCount(repo.stars_total)}</span>
        </span>
        <span class="stat" title="Total forks">
          <Icon name="fork" size={13} />
          <span>{formatCount(repo.forks_total)}</span>
        </span>
        {#if formatAge(repo.created_at)}
          <span class="stat" title={created ? `Created ${created}` : undefined}>
            <Icon name="clock" size={13} />
            <span>{formatAge(repo.created_at)}</span>
          </span>
        {/if}
      </footer>
    </article>
  </div>
</li>

<style>
  .item {
    border-bottom: 1px solid var(--hair);
    scroll-margin-top: calc(var(--top-h) + 8px);
    content-visibility: auto;
    contain-intrinsic-size: auto 120px;
  }

  .track {
    position: relative;
    overflow: hidden;
  }

  /* The coloured lane behind the card. Its opacity follows the finger through --p, so it has no transitions. */
  .reveal {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    opacity: var(--p, 0);
    pointer-events: none;
  }

  .tag-reveal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font: 600 13px/1 var(--font-ui);
    letter-spacing: 0.02em;
    white-space: nowrap;
    opacity: 0.7;
  }

  .tag-reveal.left {
    color: var(--accent-text);
  }

  .tag-reveal.right {
    color: var(--ink-2);
  }

  .track:global([data-ready]) .tag-reveal {
    opacity: 1;
    font-weight: 700;
  }

  .track:global([data-dir="save"]) .reveal {
    background: var(--accent-tint);
  }

  .track:global([data-dir="dismiss"]) .reveal {
    background: var(--dismiss-tint);
  }

  .track:global([data-dir="save"]) .right,
  .track:global([data-dir="dismiss"]) .left {
    visibility: hidden;
  }

  .card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px 10px;
    background: var(--bg);
    color: inherit;
    text-align: left;
    touch-action: pan-y;
    border-left: 3px solid transparent;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .card:hover {
      background: var(--hover);
    }
  }

  .card.is-sel {
    background: var(--sel);
    border-left-color: var(--accent);
  }

  .card:focus-visible {
    outline-offset: -2px;
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .head-title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px 8px;
    min-width: 0;
  }

  .repo-link {
    font-size: 15px;
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
    color: var(--accent-text);
    border-color: var(--accent);
  }

  /* Star gain: one pill. The tint deepens with how hot the repo is relative to its period. */
  .gain {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--accent-tint);
    background: color-mix(in oklab, var(--accent) calc(6% + var(--heat, 0) * 14%), transparent);
    color: var(--accent-text);
    font: 600 12px/1 var(--font-mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    cursor: default;
  }

  .desc {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    margin: 0;
    overflow: hidden;
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--ink-2);
    word-break: break-word;
  }

  .is-sel .desc {
    -webkit-line-clamp: unset;
    line-clamp: unset;
  }

  .desc.none {
    font-style: italic;
    color: var(--ink-3);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tag {
    padding: 3px 7px;
    border: 1px solid var(--hair-2);
    border-radius: 999px;
    font: 500 10.5px/1 var(--font-mono);
    color: var(--ink-2);
    background: var(--panel);
  }

  .tag.more {
    color: var(--ink-3);
    border-style: dashed;
  }

  .stats {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 14px;
    font: 400 12px/1 var(--font-mono);
    color: var(--ink-2);
  }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }

  .stat.lang {
    font-family: inherit;
    font-size: 12.5px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  @media (max-width: 719px) {
    .card {
      padding: 10px 14px 9px;
      gap: 7px;
    }

    .repo-link {
      font-size: 14.5px;
    }

    .stats {
      gap: 6px 12px;
    }
  }
</style>
