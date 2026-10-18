<script lang="ts">
  import { fly } from 'svelte/transition'

  interface Props {
    message: string
    actionLabel?: string
    onaction?: () => void
    ondismiss: () => void
  }

  let { message, actionLabel, onaction, ondismiss }: Props = $props()

  // A new message mounts a new Toast (the parent keys it), which restarts this timer.
  $effect(() => {
    const timer = setTimeout(ondismiss, 6000)
    return () => clearTimeout(timer)
  })
</script>

<div class="toast-wrap">
  <div class="toast" role="status" transition:fly={{ y: 12, duration: 180 }}>
    <span>{message}</span>
    {#if actionLabel}
      <button type="button" onclick={onaction}>{actionLabel}</button>
    {/if}
  </div>
</div>

<style>
  .toast-wrap {
    position: fixed;
    inset: auto 0 20px;
    z-index: 40;
    display: flex;
    justify-content: center;
    padding: 0 16px;
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 100%;
    padding: 8px 8px 8px 14px;
    border-radius: 10px;
    background: var(--ink);
    color: var(--bg);
    font-size: 13px;
    pointer-events: auto;
  }

  .toast > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toast button {
    flex: none;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    background: var(--bg);
    color: var(--ink);
    font-weight: 600;
    white-space: nowrap;
  }

  @media (max-width: 719px) {
    .toast-wrap {
      bottom: calc(80px + env(safe-area-inset-bottom));
    }
  }
</style>
