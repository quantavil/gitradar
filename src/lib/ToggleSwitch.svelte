<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    checked = false,
    onChange,
    label,
    description,
    iconInactive,
    iconActive,
    ariaLabel
  } = $props<{
    checked: boolean;
    onChange: (val: boolean) => void;
    label: string;
    description: string;
    iconInactive?: Snippet;
    iconActive?: Snippet;
    ariaLabel?: string;
  }>();
</script>

<div class="flex items-center justify-between text-xs py-2">
  <div class="space-y-0.5 pr-4">
    <div class="font-semibold text-[var(--text-main)] text-sm font-display">{label}</div>
    <div class="text-xs text-[var(--text-muted)] font-mono">{description}</div>
  </div>

  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onclick={() => onChange(!checked)}
    aria-label={ariaLabel || label}
    class="relative flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full p-1 border shadow-inner transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] {
      checked
        ? 'bg-[var(--accent-signal)] border-[var(--accent-signal)]'
        : 'bg-[var(--bg-canvas)] border-[var(--border-strong)]'
    }"
  >
    {#if iconInactive || iconActive}
      <div class="absolute inset-0 flex items-center justify-between px-2.5 pointer-events-none transition-colors {
        checked ? 'text-black/40' : 'text-[var(--text-muted)]/40'
      }">
        {#if iconInactive}
          <div class="w-3.5 h-3.5 flex items-center justify-center">
            {@render iconInactive()}
          </div>
        {/if}
        {#if iconActive}
          <div class="w-3.5 h-3.5 flex items-center justify-center">
            {@render iconActive()}
          </div>
        {/if}
      </div>
    {/if}

    <span
      class="pointer-events-none relative z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] {
        checked
          ? 'bg-[var(--bg-surface)] text-[var(--accent-signal)] border-[var(--border-subtle)] translate-x-6'
          : 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-subtle)] translate-x-0'
      }"
    >
      {#if checked && iconActive}
        {@render iconActive()}
      {:else if !checked && iconInactive}
        {@render iconInactive()}
      {/if}
    </span>
  </button>
</div>
