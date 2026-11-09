<script lang="ts">
  import { fly } from 'svelte/transition'
  import { reduced } from './motion'

  interface Props {
    message: string
    actionLabel?: string
    onaction?: () => void
    ondismiss: () => void
  }

  let { message, actionLabel, onaction, ondismiss }: Props = $props()

  // A new message mounts a new Toast (the parent keys it), which restarts this timer.
  // Hovering or focusing the toast pauses the countdown so Undo is never snatched away mid-reach.
  let paused = $state(false)

  $effect(() => {
    if (paused) return
    const timer = setTimeout(ondismiss, 5000)
    return () => clearTimeout(timer)
  })
</script>

<div class="toast-wrap">
  <div
    class="toast"
    role="status"
    transition:fly={{ y: 14, duration: reduced() ? 0 : 180 }}
    onpointerenter={() => (paused = true)}
    onpointerleave={() => (paused = false)}
    onfocusin={() => (paused = true)}
    onfocusout={() => (paused = false)}
  >
    <span class="msg">{message}</span>
    {#if actionLabel}
      <button type="button" class="btn-action" onclick={onaction}>{actionLabel}</button>
    {/if}
  </div>
</div>

<style>
  .toast-wrap {
    position: fixed;
    inset: auto 0 24px;
    z-index: var(--z-toast);
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }

  .toast {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    max-width: min(100%, 460px);
    padding: 6px 6px 6px 14px;
    border-radius: 9999px;
    background: var(--panel);
    border: 1px solid var(--hair-2);
    box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.32), 0 2px 6px -1px rgba(0, 0, 0, 0.16);
    color: var(--ink);
    font: 500 13px/1.3 var(--font-ui);
    pointer-events: auto;
  }

  .msg {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-2);
  }

  .btn-action {
    flex: none;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--hair-2);
    border-radius: 9999px;
    background: var(--hover);
    color: var(--accent);
    font: 600 12px/1 var(--font-ui);
    cursor: pointer;
    transition: background-color 0.12s, border-color 0.12s, color 0.12s;
    white-space: nowrap;
  }

  .btn-action:hover {
    background: var(--sel);
    border-color: var(--accent);
    color: var(--accent);
  }

  @media (pointer: coarse) {
    .btn-action {
      height: 40px;
      padding: 0 16px;
    }
  }

  @media (max-width: 719px) {
    .toast-wrap {
      bottom: calc(76px + env(safe-area-inset-bottom));
    }
  }
</style>
