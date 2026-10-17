<script lang="ts">
  import type { SVGAttributes } from 'svelte/elements'
  import { ICONS, type IconName } from './icons'

  interface Props extends Omit<SVGAttributes<SVGSVGElement>, 'name'> {
    name: IconName
    size?: number
    filled?: boolean
    class?: string
  }

  let {
    name,
    size = 16,
    filled = false,
    class: className = '',
    ...restProps
  }: Props = $props()

  const icon = $derived(ICONS[name])
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={icon.solid || filled ? 'currentColor' : 'none'}
  stroke={icon.solid ? 'none' : 'currentColor'}
  stroke-width={icon.strokeWidth}
  stroke-linecap={icon.solid ? undefined : 'round'}
  stroke-linejoin={icon.solid ? undefined : 'round'}
  class={className}
  {...restProps}
>
  {@html icon.body}
</svg>
