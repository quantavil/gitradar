import type { SVGAttributes } from 'svelte/elements'

export type IconProps = SVGAttributes<SVGSVGElement> & {
  size?: number
  class?: string
}

export type BookmarkIconProps = IconProps & {
  filled?: boolean
}
