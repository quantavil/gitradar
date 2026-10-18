<script module lang="ts">
  // One path per shape. Circles are drawn as two arcs so every icon is plain path data.
  type Shape = { d: string; fill?: boolean }

  function circle(cx: number, cy: number, r: number): string {
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
  }

  const ICONS: Record<string, Shape[]> = {
    radar: [{ d: circle(12, 12, 9) }, { d: circle(12, 12, 4.5) }, { d: 'M12 12l6-6' }, { d: circle(12, 12, 1), fill: true }],
    list: [{ d: 'M4 6h16M4 12h16M4 18h10' }],
    save: [{ d: 'M6 3.5h12v17l-6-4.5-6 4.5z' }],
    dismiss: [{ d: 'M5 5l14 14M19 5L5 19' }],
    'external-link': [{ d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }],
    sun: [
      { d: circle(12, 12, 4) },
      { d: 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4' },
    ],
    moon: [{ d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' }],
    undo: [{ d: 'M9 14L4 9l5-5' }, { d: 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }],
    settings: [{ d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }, { d: circle(15, 7, 2) }, { d: circle(9, 17, 2) }],
    seen: [{ d: circle(12, 12, 8.5) }, { d: 'M12 7.5V12l3 2' }],
  }
</script>

<script lang="ts">
  let { name, size = 16 }: { name: string; size?: number } = $props()

  const shapes = $derived(ICONS[name] ?? [])
</script>

<svg class="i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="1.6">
  {#each shapes as shape, n (n)}
    <path d={shape.d} fill={shape.fill ? 'currentColor' : 'none'} />
  {/each}
</svg>

<style>
  .i {
    flex: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
