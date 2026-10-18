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

  function onclosed() {
    opener?.focus()
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
      <button type="button" class="btn" onclick={() => oncancel()}>Cancel</button>
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
    box-shadow: 0 24px 60px rgb(0 0 0 / 0.28);
  }
  .dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
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
  .btn {
    height: 36px;
    padding: 0 14px;
    border: 1px solid var(--hair-2);
    border-radius: 8px;
    background: var(--panel);
    color: var(--ink);
    font: 500 14px/1 var(--font-ui);
    white-space: nowrap;
    cursor: pointer;
  }
  .btn:hover {
    background: var(--hover);
  }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
  @media (pointer: coarse) {
    .btn {
      min-height: 44px;
      height: auto;
    }
  }
</style>
