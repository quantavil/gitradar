// Read tracking for the Discover feed. Kept free of DOM access so the rules can be unit tested:
// DiscoverView measures the rows and passes their bottom edges in.

/** One period's repo names, in on-screen order. */
export interface PeriodRows {
  key: string
  names: readonly string[]
}

/**
 * Names of the rows scrolled above the read line, per period.
 *
 * Rows are in on-screen order, so the scan of a period stops at its first row below the line, and
 * the periods after it are skipped too. One row per period is held back, the one nearest the line,
 * so a quick scroll back never loses its place. Periods with no read rows are left out.
 */
export function readNamesByPeriod(
  periods: readonly PeriodRows[],
  bottomOf: (name: string) => number | undefined,
  line: number,
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const { key, names } of periods) {
    const read: string[] = []
    let reachedLine = false
    for (const name of names) {
      const bottom = bottomOf(name)
      // A row that is not rendered has no position to judge, so it is skipped rather than ending the scan.
      if (bottom === undefined) continue
      if (bottom > line + 1) {
        reachedLine = true
        break
      }
      read.push(name)
    }
    read.pop()
    if (read.length > 0) result[key] = read
    if (reachedLine) break
  }
  return result
}

/** True when both maps list the same names, in the same order, under the same period keys. */
export function sameRead(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => {
    const left = a[key]
    const right = b[key]
    return right !== undefined && left.length === right.length && left.every((name, i) => name === right[i])
  })
}
