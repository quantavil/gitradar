import { describe, expect, it } from 'vitest'
import { makeRepo } from '../test/fixtures'
import { dailyEquivalent, sortSaved } from './saved-sort'
import type { SavedEntry } from './types'

function saved(repo = makeRepo(1), savedAt = 1000): SavedEntry {
  return {
    key: repo.full_name.toLowerCase(),
    repo,
    savedAt,
  }
}

describe('saved sorting', () => {
  it('calculates daily equivalent star growth across timeframes', () => {
    expect(dailyEquivalent(makeRepo(1, { stars_gained: 14, timeframe: 'weekly' }))).toBe(2)
    expect(dailyEquivalent(makeRepo(1, { stars_gained: 60, timeframe: 'monthly' }))).toBe(2)
    expect(dailyEquivalent(makeRepo(1, { stars_gained: 5, timeframe: 'daily' }))).toBe(5)
  })

  it('sorts newest by savedAt, not repository created_at', () => {
    const older = saved(makeRepo(1, { created_at: '2026-08-01' }), 10)
    const newer = saved(makeRepo(2, { created_at: '2020-01-01' }), 20)
    const result = sortSaved([older, newer], 'newest')
    expect(result[0].key).toBe(newer.key)
    expect(result[1].key).toBe(older.key)
  })

  it('sorts growth by daily-equivalent gains', () => {
    const daily = saved(makeRepo(1, { stars_gained: 20, timeframe: 'daily' }), 1)
    const weekly = saved(makeRepo(2, { stars_gained: 70, timeframe: 'weekly' }), 2)
    const result = sortSaved([weekly, daily], 'growth')
    expect(result[0].key).toBe(daily.key) // 20 vs 10
  })

  it('sorts stars by total stars descending', () => {
    const less = saved(makeRepo(1, { stars_total: 100 }))
    const more = saved(makeRepo(2, { stars_total: 500 }))
    expect(sortSaved([less, more], 'stars')[0].key).toBe(more.key)
  })

  it('sorts name alphabetically case-insensitively', () => {
    const b = saved(makeRepo(1, { full_name: 'Beta/Repo' }))
    const a = saved(makeRepo(2, { full_name: 'alpha/repo' }))
    expect(sortSaved([b, a], 'name')[0].key).toBe(a.key)
  })

  it('does not mutate the source array', () => {
    const items = [saved(makeRepo(1), 10), saved(makeRepo(2), 20)]
    const copy = [...items]
    sortSaved(items, 'newest')
    expect(items).toEqual(copy)
  })
})
