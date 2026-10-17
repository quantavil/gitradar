<script lang="ts">
  import Icon from './Icon.svelte'
  import { LANGUAGE_OPTIONS, type LanguageOption } from './types'
  let {
    value = 'all',
    onChange,
  }: {
    value?: LanguageOption
    onChange?: (selected: LanguageOption) => void
  } = $props()

  let isOpen = $state(false)
  let highlightedIndex = $state(0)
  let triggerRef = $state<HTMLButtonElement | null>(null)
  let containerRef = $state<HTMLDivElement | null>(null)
  let listboxRef = $state<HTMLUListElement | null>(null)

  let typeaheadBuffer = ''
  let typeaheadTimer: ReturnType<typeof setTimeout> | null = null

  const selectedOption = $derived(
    LANGUAGE_OPTIONS.find((opt) => opt.id === value) || LANGUAGE_OPTIONS[0],
  )

  function toggleOpen() {
    isOpen = !isOpen
    if (isOpen) {
      const idx = LANGUAGE_OPTIONS.findIndex((opt) => opt.id === value)
      highlightedIndex = idx >= 0 ? idx : 0
      setTimeout(() => scrollToHighlighted(), 10)
    }
  }

  function close() {
    isOpen = false
    typeaheadBuffer = ''
  }

  function selectOption(optionId: LanguageOption) {
    if (onChange) {
      onChange(optionId)
    }
    close()
    triggerRef?.focus()
  }

  // Space would otherwise fire a native button click on keyup and reopen the list.
  function preventSpaceKeyup(e: KeyboardEvent) {
    if (e.key === ' ') e.preventDefault()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(e.key)) {
        e.preventDefault()
        toggleOpen()
      }
      return
    }

    // Enter and Space select the active option. This runs before the printable
    // character branch below, which would otherwise take Space as typeahead.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (LANGUAGE_OPTIONS[highlightedIndex]) {
        selectOption(LANGUAGE_OPTIONS[highlightedIndex].id)
      }
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      typeaheadBuffer += e.key.toLowerCase()
      if (typeaheadTimer) clearTimeout(typeaheadTimer)
      typeaheadTimer = setTimeout(() => {
        typeaheadBuffer = ''
      }, 500)

      const matchIdx = LANGUAGE_OPTIONS.findIndex((opt) =>
        opt.label.toLowerCase().startsWith(typeaheadBuffer),
      )
      if (matchIdx >= 0) {
        highlightedIndex = matchIdx
        scrollToHighlighted()
      }
      return
    }

    switch (e.key) {
      case 'Home':
        e.preventDefault()
        highlightedIndex = 0
        scrollToHighlighted()
        break
      case 'End':
        e.preventDefault()
        highlightedIndex = LANGUAGE_OPTIONS.length - 1
        scrollToHighlighted()
        break
      case 'ArrowDown':
        e.preventDefault()
        highlightedIndex = (highlightedIndex + 1) % LANGUAGE_OPTIONS.length
        scrollToHighlighted()
        break
      case 'ArrowUp':
        e.preventDefault()
        highlightedIndex =
          (highlightedIndex - 1 + LANGUAGE_OPTIONS.length) %
          LANGUAGE_OPTIONS.length
        scrollToHighlighted()
        break
      case 'Escape':
        e.preventDefault()
        close()
        triggerRef?.focus()
        break
      case 'Tab':
        close()
        break
    }
  }

  function scrollToHighlighted() {
    if (!listboxRef) return
    const items = listboxRef.querySelectorAll('[role="option"]')
    const target = items[highlightedIndex] as HTMLElement | undefined
    if (target) {
      target.scrollIntoView({ block: 'nearest' })
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (isOpen && containerRef && !containerRef.contains(e.target as Node)) {
      close()
    }
  }

  $effect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      window.addEventListener('click', handleClickOutside)
      return () => window.removeEventListener('click', handleClickOutside)
    }
  })
</script>

<div class="relative inline-block text-left" bind:this={containerRef}>
  <button
    bind:this={triggerRef}
    type="button"
    role="combobox"
    onclick={toggleOpen}
    onkeydown={handleKeydown}
    onkeyup={preventSpaceKeyup}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-controls="lang-listbox"
    aria-activedescendant={isOpen && LANGUAGE_OPTIONS[highlightedIndex]
      ? `lang-opt-${LANGUAGE_OPTIONS[highlightedIndex].id}`
      : undefined}
    aria-label="Filter repositories by language: {selectedOption.label}"
    class="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--control-border)] bg-[var(--bg-surface)] px-3 font-mono text-sm font-semibold uppercase text-[var(--text-main)] cursor-pointer transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] sm:min-h-9"
  >
    <span>{selectedOption.label}</span>
    <span
      class="flex items-center justify-center shrink-0 text-[var(--text-muted)] transition-transform duration-150 {isOpen ? 'rotate-180' : ''}"
      aria-hidden="true"
    >
      <Icon name="chevron-down" size={12} />
    </span>
  </button>

  {#if isOpen}
    <ul
      id="lang-listbox"
      bind:this={listboxRef}
      role="listbox"
      tabindex="-1"
      onkeydown={handleKeydown}
      aria-label="Language options"
      class="popover-animate absolute left-0 mt-1.5 z-50 min-w-[11rem] max-h-64 overflow-y-auto p-1 bg-[var(--bg-surface)] border border-[var(--control-border)] rounded-lg shadow-[var(--card-shadow-lift)]"
    >
      {#each LANGUAGE_OPTIONS as opt, idx (opt.id)}
        {@const isSelected = opt.id === value}
        {@const isHighlighted = idx === highlightedIndex}
        <li
          id={`lang-opt-${opt.id}`}
          role="option"
          aria-selected={isSelected}
          tabindex="-1"
          onclick={() => selectOption(opt.id)}
          onkeydown={(e) =>
            (e.key === 'Enter' || e.key === ' ') && selectOption(opt.id)}
          onmouseenter={() => (highlightedIndex = idx)}
          class="flex min-h-11 sm:min-h-8 items-center justify-between gap-3 px-3 rounded-md font-mono text-sm cursor-pointer select-none transition-colors {isSelected
            ? 'bg-[var(--accent-signal-soft-bg)] font-semibold text-[var(--accent-signal-soft-text)]'
            : isHighlighted
              ? 'bg-[var(--bg-surface-hover)] font-normal text-[var(--text-main)]'
              : 'font-normal text-[var(--text-main)]'} {isHighlighted
            ? 'ring-2 ring-inset ring-[var(--accent-signal)]'
            : ''}"
        >
          <span>{opt.label}</span>
          {#if isSelected}
            <span class="flex shrink-0 text-[var(--accent-signal-soft-text)]" aria-hidden="true">
              <Icon name="check" size={13} />
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
