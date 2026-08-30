import { describe, expect, it } from 'vitest'
import { ScrollPastTracker } from './scroll-past'

describe('ScrollPastTracker', () => {
  it('reports a previously visible row crossed by a downward scroll once', () => {
    const tracker = new ScrollPastTracker(56, 2)
    tracker.update(0, 800, [{ key: 'owner/a', top: 100, bottom: 200 }])

    expect(
      tracker.update(160, 800, [{ key: 'owner/a', top: -60, bottom: 40 }]),
    ).toEqual(['owner/a'])
    expect(
      tracker.update(160, 800, [{ key: 'owner/a', top: -160, bottom: -60 }]),
    ).toEqual([])
  })

  it('ignores movement caused by layout removal at the same scroll position', () => {
    const tracker = new ScrollPastTracker(56, 2)
    tracker.update(100, 800, [{ key: 'owner/a', top: 60, bottom: 160 }])

    expect(
      tracker.update(100, 800, [{ key: 'owner/a', top: -80, bottom: 20 }]),
    ).toEqual([])
  })
})
