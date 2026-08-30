export interface ScrollRowSnapshot {
  key: string
  top: number
  bottom: number
}

export class ScrollPastTracker {
  private previousScrollY: number | null = null
  private previousRows = new Map<string, ScrollRowSnapshot>()
  private handled = new Set<string>()

  constructor(
    private headerOffset = 56,
    private movementTolerance = 2,
  ) {}

  update(
    scrollY: number,
    viewportHeight: number,
    rows: ScrollRowSnapshot[],
  ): string[] {
    const scrollDelta =
      this.previousScrollY === null ? 0 : scrollY - this.previousScrollY
    const crossed: string[] = []

    if (scrollDelta > 0) {
      for (const row of rows) {
        const previous = this.previousRows.get(row.key)
        if (!previous || this.handled.has(row.key)) continue
        const upwardMovement = previous.bottom - row.bottom
        if (
          previous.bottom >= this.headerOffset &&
          row.bottom < this.headerOffset &&
          upwardMovement > 0 &&
          upwardMovement <= scrollDelta + this.movementTolerance
        ) {
          crossed.push(row.key)
          this.handled.add(row.key)
        }
      }
    }

    this.previousScrollY = scrollY
    this.previousRows = new Map(
      rows
        .filter(
          (row) =>
            row.bottom >= this.headerOffset && row.top < viewportHeight,
        )
        .map((row) => [row.key, row]),
    )
    return crossed
  }
}
