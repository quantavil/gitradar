/** True when the reader asked for less motion; JS-driven animation must check this itself. */
export function reduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
