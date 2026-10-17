<script module lang="ts">
  import Icon from './Icon.svelte'
  // Unique id source for each instance's title and description.
  let instanceCount = 0
  // Number of open confirm dialogs holding the app shell inert. The shell is
  // released only when the last holder lets go.
  let inertHolders = 0
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  let {
    isOpen = false,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    onConfirm,
    onClose,
  } = $props<{
    isOpen: boolean
    title?: string
    message?: string
    confirmText?: string
    onConfirm: () => void
    onClose: () => void
  }>()

  instanceCount += 1
  const titleId = `confirm-title-${instanceCount}`
  const descriptionId = `confirm-desc-${instanceCount}`

  let dialogRef = $state<HTMLDialogElement | null>(null)
  let cancelBtnRef = $state<HTMLButtonElement | null>(null)
  let returnFocusTo: HTMLElement | null = null
  let holdsInert = false

  function lockAppShell() {
    if (holdsInert || typeof document === 'undefined') return
    holdsInert = true
    inertHolders += 1
    document.querySelector<HTMLElement>('[data-app-shell]')?.setAttribute('inert', '')
  }

  function releaseAppShell() {
    if (!holdsInert) return
    holdsInert = false
    inertHolders = Math.max(0, inertHolders - 1)
    if (inertHolders === 0 && typeof document !== 'undefined') {
      document.querySelector<HTMLElement>('[data-app-shell]')?.removeAttribute('inert')
    }
  }

  // Move the dialog under <body>. The app shell is inert while the dialog is
  // open, and a dialog inside an inert ancestor is unreliable across browsers.
  $effect(() => {
    const dialog = dialogRef
    if (!dialog || typeof document === 'undefined') return
    document.body.appendChild(dialog)
    return () => {
      if (dialog.open) dialog.close()
      dialog.remove()
    }
  })

  // Open while isOpen is true. The cleanup runs when isOpen turns false and on
  // destroy, so the shell is always released and focus is returned.
  $effect(() => {
    const dialog = dialogRef
    if (!isOpen || !dialog) return

    untrack(() => {
      returnFocusTo = document.activeElement as HTMLElement | null
      lockAppShell()
      if (!dialog.open) dialog.showModal()
      cancelBtnRef?.focus()
    })

    return () => {
      if (dialog.open) dialog.close()
      releaseAppShell()
      const target = returnFocusTo
      returnFocusTo = null
      // Restore focus only if the element still exists in the document.
      if (target?.isConnected) target.focus()
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

  function handleConfirm() {
    onConfirm()
    onClose()
  }
</script>

<dialog
  bind:this={dialogRef}
  oncancel={handleCancelEvent}
  onclick={handleBackdropClick}
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
  class="m-auto w-full max-w-sm border-none bg-transparent p-4 text-left backdrop:bg-black/60 backdrop:backdrop-blur-xl"
>
  <div class="popover-animate w-full space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 font-sans shadow-[var(--card-shadow-lift)]">
    <!-- Header -->
    <div class="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
      <h3 id={titleId} class="font-display text-lg font-semibold leading-tight tracking-tight text-[var(--text-main)]">
        {title}
      </h3>
      <button
        type="button"
        onclick={onClose}
        class="-my-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] sm:h-8 sm:w-8"
        aria-label="Close modal"
      >
        <Icon name="close" size={16} aria-hidden="true" />
      </button>
    </div>

    <!-- Content -->
    <p id={descriptionId} class="text-sm leading-relaxed text-[var(--text-muted)]">
      {message}
    </p>

    <!-- Actions -->
    <div class="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
      <button
        type="button"
        bind:this={cancelBtnRef}
        onclick={onClose}
        class="btn-press inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--control-border)] bg-transparent px-4 text-sm font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)]"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        class="btn-press inline-flex min-h-10 items-center justify-center rounded-md px-4 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] bg-[var(--badge-red-text)] text-[var(--bg-surface)]"
      >
        {confirmText}
      </button>
    </div>
  </div>
</dialog>
