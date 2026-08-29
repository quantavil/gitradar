<script lang="ts">
  import { CloseIcon } from './icons'

  let {
    isOpen = false,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    confirmVariant = 'danger',
    onConfirm,
    onClose,
  } = $props<{
    isOpen: boolean
    title?: string
    message?: string
    confirmText?: string
    confirmVariant?: 'danger' | 'primary'
    onConfirm: () => void
    onClose: () => void
  }>()

  let dialogRef = $state<HTMLDialogElement | null>(null)
  let cancelBtnRef = $state<HTMLButtonElement | null>(null)
  let previousActiveElement: HTMLElement | null = null

  $effect(() => {
    if (typeof document === 'undefined' || !dialogRef) return
    const appShell = document.querySelector('[data-app-shell]') as HTMLElement | null

    if (isOpen) {
      previousActiveElement = document.activeElement as HTMLElement | null
      if (appShell) appShell.setAttribute('inert', '')
      if (!dialogRef.open) {
        dialogRef.showModal()
      }
      cancelBtnRef?.focus()
    } else {
      if (dialogRef.open) {
        dialogRef.close()
      }
      if (appShell) appShell.removeAttribute('inert')
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus()
      }
    }
  })

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialogRef) {
      onClose()
    }
  }

  function handleCancelEvent(e: Event) {
    e.preventDefault()
    onClose()
  }
</script>

<dialog
  bind:this={dialogRef}
  oncancel={handleCancelEvent}
  onclick={handleBackdropClick}
  aria-labelledby="confirm-modal-title"
  aria-describedby="confirm-modal-description"
  class="backdrop:bg-black/60 backdrop:backdrop-blur-xl bg-transparent p-4 max-w-sm w-full m-auto border-none focus:outline-none"
>
  <div class="popover-animate w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-5 space-y-4 font-sans text-left">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
      <h3 id="confirm-modal-title" class="font-semibold text-sm text-[var(--text-main)] font-display tracking-tight">
        {title}
      </h3>
      <button
        onclick={onClose}
        class="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-canvas)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
        aria-label="Close modal"
      >
        <CloseIcon size={15} aria-hidden="true" />
      </button>
    </div>

    <!-- Content -->
    <p id="confirm-modal-description" class="text-xs text-[var(--text-muted)] leading-relaxed">
      {message}
    </p>

    <!-- Actions -->
    <div class="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] font-mono text-xs">
      <button
        bind:this={cancelBtnRef}
        onclick={onClose}
        class="px-3.5 py-1.5 bg-[var(--bg-canvas)] text-[var(--text-main)] border border-[var(--border-subtle)] rounded-md font-medium hover:border-[var(--border-strong)] transition-colors btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Cancel
      </button>
      <button
        onclick={() => {
          onConfirm()
          onClose()
        }}
        class="px-3.5 py-1.5 rounded-md font-semibold transition-all btn-press active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
          confirmVariant === 'danger'
            ? 'bg-[var(--badge-red-bg)] text-[var(--badge-red-text)] border border-[var(--badge-red-text)]/30 hover:opacity-90'
            : 'bg-[var(--accent-signal)] text-white dark:text-zinc-950 hover:opacity-90'
        }"
      >
        {confirmText}
      </button>
    </div>
  </div>
</dialog>
