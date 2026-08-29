<script lang="ts">
  import type { IconProps } from './types'

  let { size = 16, class: className = '', ...restProps }: IconProps = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  {...restProps}
>
  <polyline points="6 9 12 15 18 9" />
</svg>
