export interface ScrollRowSnapshot {
  key: string
  top: number
  bottom: number
}

/**
 * Keys whose bottom edge moved from at or below the header line to above it during a downward scroll.
 * Movement larger than the scroll delta (plus tolerance) is layout change and is ignored.
 * Known limit: a scroll event that moves more than about six rows can skip rows that were never in the previous snapshot, so those are not reported.
 */
export function findScrollPastCrossings(
  previousRows: ReadonlyMap<string, ScrollRowSnapshot>,
  rows: ScrollRowSnapshot[],
  scrollDelta: number,
  headerOffset: number,
  movementTolerance: number,
): string[] {
  if (scrollDelta <= 0) return []

  const crossed: string[] = []
  for (const row of rows) {
    const previous = previousRows.get(row.key)
    if (!previous) continue
    const upwardMovement = previous.bottom - row.bottom
    if (
      previous.bottom >= headerOffset &&
      row.bottom < headerOffset &&
      upwardMovement > 0 &&
      upwardMovement <= scrollDelta + movementTolerance
    ) {
      crossed.push(row.key)
    }
  }
  return crossed
}

export class ScrollPastTracker {
  private previousScrollY: number | null = null
  private previousRows = new Map<string, ScrollRowSnapshot>()
  private handled = new Set<string>()

  constructor(private movementTolerance = 2) {}

  /** Drops the row baseline, so the next update starts fresh (use when the list is replaced). */
  reset(): void {
    this.previousScrollY = null
    this.previousRows = new Map()
  }

  /**
   * Call on every scroll and after every layout change. A call at an unchanged scroll position
   * reports nothing but refreshes the row baseline, so later scrolls compare against current positions.
   */
  update(
    scrollY: number,
    viewportHeight: number,
    rows: ScrollRowSnapshot[],
    headerOffset: number,
  ): string[] {
    const scrollDelta =
      this.previousScrollY === null ? 0 : scrollY - this.previousScrollY
    const crossed = findScrollPastCrossings(
      this.previousRows,
      rows,
      scrollDelta,
      headerOffset,
      this.movementTolerance,
    ).filter((key) => !this.handled.has(key))

    for (const key of crossed) this.handled.add(key)

    this.previousScrollY = scrollY
    this.previousRows = new Map(
      rows
        .filter(
          (row) => row.bottom >= headerOffset && row.top < viewportHeight,
        )
        .map((row) => [row.key, row]),
    )
    return crossed
  }
}
