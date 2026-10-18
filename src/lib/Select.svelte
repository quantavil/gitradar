<script lang="ts">
  // One custom select for every filter in the app: a combobox trigger plus a listbox popup.
  // Focus stays on the trigger and the option is announced through aria-activedescendant,
  // which is the select-only combobox pattern and needs no focus juggling in the popup.
  import { tick } from 'svelte'
  import Icon from './Icon.svelte'

  export interface SelectOption {
    id: string
    label: string
    /** Shortened trigger text on narrow screens; the popup always shows the full label. */
    short?: string
  }

  interface Props {
    value: string
    options: readonly SelectOption[]
    onchange: (id: string) => void
    ariaLabel: string
    /** Which edge the popup is pinned to; end keeps a right-most control inside the viewport. */
    align?: 'start' | 'end'
  }

  let { value, options, onchange, ariaLabel, align = 'start' }: Props = $props()

  const uid = $props.id()
  const listId = `${uid}-list`
  const TYPEAHEAD_MS = 600

  let root = $state<HTMLElement | null>(null)
  let list = $state<HTMLUListElement | null>(null)
  let open = $state(false)
  let active = $state(0)
  let buffer = ''
  let bufferTimer: ReturnType<typeof setTimeout> | undefined

  const current = $derived(options.find((option) => option.id === value) ?? options[0])

  $effect(() => () => clearTimeout(bufferTimer))

  // A click anywhere outside the control closes the popup. Clicks inside it, including on
  // the trigger, are ignored here because the trigger already toggles on its own click.
  $effect(() => {
    if (!open) return
    const onoutside = (event: MouseEvent) => {
      if (root && !root.contains(event.target as Node)) open = false
    }
    window.addEventListener('click', onoutside)
    return () => window.removeEventListener('click', onoutside)
  })

  function reveal(index: number) {
    active = index
    void tick().then(() => list?.querySelectorAll('[role="option"]')[index]?.scrollIntoView({ block: 'nearest' }))
  }

  function expand(edge: 'first' | 'last' | 'current' = 'current') {
    if (open) return
    const at = options.findIndex((option) => option.id === value)
    open = true
    reveal(edge === 'first' ? 0 : edge === 'last' ? options.length - 1 : at >= 0 ? at : 0)
  }

  function collapse() {
    open = false
    buffer = ''
  }

  function choose(index: number) {
    const option = options[index]
    if (option) onchange(option.id)
    collapse()
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.ctrlKey || event.altKey || event.metaKey) return

    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        expand(event.key === 'ArrowUp' ? 'last' : 'current')
      }
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      choose(active)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      collapse()
      return
    }
    if (event.key === 'Tab') {
      collapse()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      const step = event.key === 'ArrowDown' ? 1 : -1
      reveal((active + step + options.length) % options.length)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      reveal(event.key === 'Home' ? 0 : options.length - 1)
      return
    }
    // Printable characters jump to the first matching label, like a native select.
    if (event.key.length === 1) {
      event.stopPropagation()
      buffer += event.key.toLowerCase()
      clearTimeout(bufferTimer)
      bufferTimer = setTimeout(() => (buffer = ''), TYPEAHEAD_MS)
      const at = options.findIndex((option) => option.label.toLowerCase().startsWith(buffer))
      if (at >= 0) reveal(at)
    }
  }
</script>

<div class="sel" bind:this={root} data-align={align}>
  <button
    type="button"
    class="trigger"
    class:compact={current?.short !== undefined}
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={open ? listId : undefined}
    aria-activedescendant={open ? `${uid}-opt-${options[active]?.id}` : undefined}
    aria-label={`${ariaLabel}: ${current?.label ?? ''}`}
    onclick={() => (open ? collapse() : expand())}
    onkeydown={onkeydown}
  >
    <span class="txt full">{current?.label}</span>
    {#if current?.short}
      <span class="txt short">{current.short}</span>
    {/if}
    <span class="chev"><Icon name="chevron" size={13} /></span>
  </button>

  {#if open}
    <ul class="pop" bind:this={list} id={listId} role="listbox" aria-label={`${ariaLabel} options`}>
      {#each options as option, index (option.id)}
        <li
          id={`${uid}-opt-${option.id}`}
          class="opt"
          class:active={index === active}
          role="option"
          aria-selected={option.id === value}
          onclick={() => choose(index)}
          onkeydown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            event.stopPropagation()
            choose(index)
          }}
          onmouseenter={() => (active = index)}
        >
          <span>{option.label}</span>
          {#if option.id === value}
            <Icon name="check" size={14} />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .sel {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
    height: 30px;
    padding: 0 9px 0 10px;
    border: 1px solid var(--hair-2);
    border-radius: 8px;
    background: var(--panel);
    color: var(--ink);
    font: 500 13px/1 var(--font-ui);
    cursor: pointer;
  }

  .trigger:hover {
    background: var(--hover);
  }

  .txt {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .short {
    display: none;
  }

  .chev {
    display: flex;
    margin-left: auto;
    color: var(--ink-3);
    transition: transform 0.15s ease;
  }

  .trigger[aria-expanded="true"] .chev {
    transform: rotate(180deg);
  }

  .pop {
    position: absolute;
    top: calc(100% + 4px);
    z-index: 30;
    min-width: 100%;
    max-width: min(280px, calc(100vw - 24px));
    max-height: 264px;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    border: 1px solid var(--hair-2);
    border-radius: 9px;
    background: var(--panel);
    box-shadow: 0 10px 24px rgb(0 0 0 / 0.14);
    list-style: none;
  }

  .sel[data-align="start"] .pop {
    left: 0;
  }

  .sel[data-align="end"] .pop {
    right: 0;
  }

  .opt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 30px;
    padding: 0 8px;
    border-radius: 6px;
    color: var(--ink-2);
    font: 400 13px/1.2 var(--font-ui);
    white-space: nowrap;
    cursor: pointer;
  }

  .opt.active {
    background: var(--hover);
    color: var(--ink);
  }

  .opt[aria-selected="true"] {
    color: var(--ink);
    font-weight: 600;
  }

  .opt :global(.i) {
    color: var(--accent);
  }

  /* Compact phone row: shorter triggers, and short labels where an option defines one. */
  @media (max-width: 719px) {
    .trigger {
      gap: 6px;
      height: 36px;
      padding: 0 8px 0 9px;
      font-size: 12.5px;
    }

    .trigger.compact .full {
      display: none;
    }

    .trigger.compact .short {
      display: inline;
    }
  }

  @media (pointer: coarse) {
    .opt {
      min-height: 44px;
    }
  }
</style>
