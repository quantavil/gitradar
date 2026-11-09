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
    inset: auto 0 12px;
    z-index: var(--z-toast);
    display: flex;
    justify-content: center;
    padding: 0 12px;
    pointer-events: none;
  }

  .toast {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: min(100%, 320px);
    padding: 0 4px 0 12px;
    min-height: 30px;
    border-radius: 8px;
    background: var(--ink);
    color: var(--bg);
    box-shadow: 0 4px 14px -4px rgba(0, 0, 0, 0.35);
    font: 500 12.5px/1 var(--font-ui);
    pointer-events: auto;
  }

  .msg {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-action {
    flex: none;
    padding: 8px 8px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: inherit;
    font: 700 12px/1 var(--font-ui);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-action:hover {
    background: color-mix(in oklab, var(--bg) 18%, transparent);
  }

  .btn-action:focus-visible {
    outline: 2px solid var(--bg);
  }

  @media (pointer: coarse) {
    .toast {
      min-height: 36px;
    }

    .btn-action {
      padding: 13px 10px;
    }
  }

  @media (max-width: 719px) {
    .toast-wrap {
      bottom: calc(60px + env(safe-area-inset-bottom));
    }
  }
</style>
