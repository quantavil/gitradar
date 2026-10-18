<script lang="ts">
  import { triage } from './triage.svelte'
  import type { View } from './types'
  import Icon from './Icon.svelte'

  const TABS: { id: View; label: string; icon: string }[] = [
    { id: 'discover', label: 'Discover', icon: 'list' },
    { id: 'saved', label: 'Saved', icon: 'save' },
    { id: 'seen', label: 'Seen', icon: 'seen' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ]

  interface Props {
    view: View
    onview: (view: View) => void
  }

  let { view, onview }: Props = $props()

  function count(id: View): number | null {
    if (id === 'saved') return triage.saved.length
    if (id === 'seen') return triage.seen.length
    return null
  }
</script>

<nav class="dock" aria-label="Views">
  {#each TABS as tab (tab.id)}
    {@const n = count(tab.id)}
    <button type="button" aria-current={view === tab.id ? 'page' : undefined} onclick={() => onview(tab.id)}>
      <Icon name={tab.icon} size={20} />
      <span>{tab.label}</span>
      {#if n !== null}<span class="cnt">{n}</span>{/if}
    </button>
  {/each}
</nav>

<style>
  .dock {
    display: none;
  }

  @media (max-width: 719px) {
    .dock {
      position: fixed;
      inset: auto 0 0;
      z-index: 30;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--bg);
      border-top: 1px solid var(--hair);
    }

    .dock button {
      position: relative;
      min-height: 58px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 500;
      color: var(--ink-3);
    }

    .dock button[aria-current="page"] {
      color: var(--ink);
    }

    .dock button[aria-current="page"]::before {
      content: "";
      position: absolute;
      top: 0;
      left: 28%;
      right: 28%;
      height: 2px;
      background: var(--accent);
    }

    .cnt {
      position: absolute;
      top: 6px;
      left: calc(50% + 6px);
      min-width: 17px;
      padding: 0 3px;
      background: var(--bg);
      font: 500 10px/15px var(--font-mono);
      text-align: center;
      color: var(--ink-3);
    }
  }
</style>
