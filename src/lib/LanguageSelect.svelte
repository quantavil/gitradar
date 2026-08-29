<script lang="ts">
  import { LANGUAGE_OPTIONS, type LanguageOption } from './types'
  import { ChevronDownIcon, CheckIcon } from './icons'

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

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(e.key)) {
        e.preventDefault()
        toggleOpen()
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
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (LANGUAGE_OPTIONS[highlightedIndex]) {
          selectOption(LANGUAGE_OPTIONS[highlightedIndex].id)
        }
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
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    aria-controls="lang-listbox"
    aria-activedescendant={isOpen && LANGUAGE_OPTIONS[highlightedIndex]
      ? `lang-opt-${LANGUAGE_OPTIONS[highlightedIndex].id}`
      : undefined}
    aria-label="Filter repositories by language: {selectedOption.label}"
    class="inline-flex items-center gap-1 font-mono text-[11px] sm:text-xs font-bold text-[var(--text-main)] uppercase cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] rounded px-1 -mx-1"
  >
    <span>{selectedOption.label}</span>
    <span
      class="text-[var(--text-muted)] flex items-center justify-center shrink-0 transition-transform duration-150 {isOpen ? 'rotate-180' : ''}"
      aria-hidden="true"
    >
      <ChevronDownIcon size={12} />
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
      class="popover-animate absolute left-0 mt-2 z-50 min-w-[170px] max-h-64 overflow-y-auto p-1.5 bg-[var(--bg-surface)]/90 backdrop-blur-xl border border-black/10 dark:border-white/15 rounded-xl shadow-2xl focus:outline-none"
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
          class="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors font-mono {isHighlighted ? 'bg-[var(--bg-surface-hover)] text-[var(--text-main)]' : 'text-[var(--text-main)]'} {isSelected ? 'font-semibold bg-[var(--bg-surface-hover)]/60' : 'font-normal'}"
        >
          <span>{opt.label}</span>
          {#if isSelected}
            <span class="text-[var(--text-main)] ml-2 shrink-0" aria-hidden="true">
              <CheckIcon size={13} />
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
