<script lang="ts">
  interface Props {
    open: boolean
    title: string
    body: string
    confirmLabel: string
    danger?: boolean
    onconfirm: () => void
    oncancel: () => void
  }

  let { open, title, body, confirmLabel, danger = false, onconfirm, oncancel }: Props = $props()

  const uid = $props.id()
  const titleId = `${uid}-title`
  const bodyId = `${uid}-body`

  let dialog: HTMLDialogElement | undefined = $state()
  let opener: HTMLElement | null = null
  let pressedOnBackdrop = false

  // The `open` prop is the source of truth: Escape and backdrop clicks only request a cancel.
  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  })

  function onnativecancel(event: Event) {
    event.preventDefault()
    oncancel()
  }

  // A press that starts inside the panel and ends on the backdrop (e.g. a text selection) must not cancel.
  function onpointerdown(event: PointerEvent) {
    pressedOnBackdrop = event.target === dialog
  }

  function onbackdrop(event: MouseEvent) {
    if (pressedOnBackdrop && event.target === dialog) oncancel()
  }

  // Chrome's close watcher can close the dialog despite the cancelled Esc (second press, Android
  // back). The parent must hear about it, or `open` stays true and the dialog can never reopen.
  function onclosed() {
    if (open) oncancel()
    // The opener may be gone (e.g. "Clear all" disappears once the list is empty).
    if (opener?.isConnected) opener.focus()
    else document.querySelector<HTMLElement>('main h1')?.focus()
    opener = null
  }
</script>

<dialog
  bind:this={dialog}
  class="dialog"
  aria-labelledby={titleId}
  aria-describedby={bodyId}
  oncancel={onnativecancel}
  onpointerdown={onpointerdown}
  onclick={onbackdrop}
  onclose={onclosed}
>
  <div class="panel">
    <h2 id={titleId}>{title}</h2>
    <p id={bodyId}>{body}</p>
    <div class="actions">
      <!-- svelte-ignore a11y_autofocus -->
      <button type="button" class="btn" autofocus onclick={() => oncancel()}>Cancel</button>
      <button type="button" class="btn confirm" class:danger onclick={() => onconfirm()}>{confirmLabel}</button>
    </div>
  </div>
</dialog>

<style>
  .dialog {
    width: min(420px, calc(100vw - 32px));
    max-width: none;
    padding: 0;
    border: 1px solid var(--hair-2);
    border-radius: 12px;
    background: var(--panel);
    color: var(--ink);
    box-shadow: 0 24px 60px rgb(0 0 0 / 0.32);
    overscroll-behavior: contain;
  }
  .dialog[open] {
    animation: dialog-in 0.16s ease-out;
  }
  .dialog[open]::backdrop {
    animation: fade-in 0.16s ease-out;
  }
  .dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
  }
  @keyframes dialog-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }
  .panel {
    padding: 20px 20px 16px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  p {
    margin: 0 0 20px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
  .confirm {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--bg);
  }
  .confirm:hover {
    background: var(--ink-2);
    border-color: var(--ink-2);
  }
  .confirm.danger {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .confirm.danger:hover {
    filter: brightness(1.06);
  }
  /* Phones get a bottom sheet with full-width, thumb-sized buttons. */
  @media (max-width: 719px) {
    .dialog,
    .dialog[open] {
      width: 100%;
      margin: auto 0 0;
      border-width: 1px 0 0;
      border-radius: 16px 16px 0 0;
      animation-name: sheet-in;
    }
    .panel {
      padding-bottom: calc(16px + env(safe-area-inset-bottom));
    }
    .actions {
      flex-direction: column-reverse;
    }
    .actions :global(.btn) {
      width: 100%;
      min-height: 44px;
    }
  }
  @keyframes sheet-in {
    from {
      transform: translateY(100%);
    }
  }
</style>
