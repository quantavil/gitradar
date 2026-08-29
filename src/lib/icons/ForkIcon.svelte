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
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
  {...restProps}
>
  <circle cx="12" cy="18" r="3" />
  <circle cx="6" cy="6" r="3" />
  <circle cx="18" cy="6" r="3" />
  <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
  <path d="M12 12v3" />
</svg>
