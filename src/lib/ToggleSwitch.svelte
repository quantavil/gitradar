<script module lang="ts">
  // Unique id source for each instance's label and description.
  let instanceCount = 0;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    checked = false,
    onChange,
    label,
    description,
    iconInactive,
    iconActive,
  } = $props<{
    checked: boolean;
    onChange: (val: boolean) => void;
    label: string;
    description: string;
    iconInactive?: Snippet;
    iconActive?: Snippet;
    /** Kept for API compatibility. The switch is named by its visible label. */
  }>();

  instanceCount += 1;
  const labelId = `toggle-label-${instanceCount}`;
  const descriptionId = `toggle-desc-${instanceCount}`;
</script>

<div class="flex min-h-11 items-center justify-between gap-4">
  <div class="min-w-0 space-y-0.5">
    <div id={labelId} class="text-sm font-medium text-[var(--text-main)]">{label}</div>
    {#if description}
      <div id={descriptionId} class="text-xs leading-relaxed text-[var(--text-muted)]">{description}</div>
    {/if}
  </div>

  <!-- 44px hit area around a fixed 44x28 track, so the thumb never changes the row height -->
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelId}
    aria-describedby={description ? descriptionId : undefined}
    onclick={() => onChange(!checked)}
    class="relative flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
  >
    <span
      aria-hidden="true"
      class="pointer-events-none relative flex h-7 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors duration-200 {checked
        ? 'border-[var(--accent-signal)] bg-[var(--accent-signal)]'
        : 'border-[var(--control-border)] bg-[var(--bg-canvas)]'}"
    >
      {#if iconInactive || iconActive}
        <span
          class="pointer-events-none absolute inset-0 flex items-center justify-between px-2 transition-colors {checked
            ? 'text-[var(--on-accent)]/70'
            : 'text-[var(--text-muted)]'}"
        >
          {#if iconInactive}
            <span class="flex h-3.5 w-3.5 items-center justify-center">
              {@render iconInactive()}
            </span>
          {/if}
          {#if iconActive}
            <span class="flex h-3.5 w-3.5 items-center justify-center">
              {@render iconActive()}
            </span>
          {/if}
        </span>
      {/if}

      <span
        class="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] {checked
          ? 'translate-x-4.5 text-[var(--accent-signal)]'
          : 'translate-x-0 text-[var(--text-main)]'}"
      >
        {#if checked && iconActive}
          {@render iconActive()}
        {:else if !checked && iconInactive}
          {@render iconInactive()}
        {/if}
      </span>
    </span>
  </button>
</div>
