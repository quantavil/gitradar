import { describe, expect, it } from 'vitest'
import {
  formatAge,
  formatCount,
  formatGain,
  isNewRepo,
  languageColor,
  periodLabel,
} from './format'

const NOW = Date.parse('2026-10-18T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [634, '634'],
    [1000, '1k'],
    [1234, '1.2k'],
    [9999, '10k'],
    [307919, '308k'],
    [999_499, '999k'],
    [999_500, '1M'],
    [1_500_000, '1.5M'],
    [12_000_000, '12M'],
    [-1234, '-1.2k'],
    [Number.NaN, '0'],
  ])('formats %d as %s', (input, expected) => {
    expect(formatCount(input)).toBe(expected)
  })
})

describe('formatGain', () => {
  it('prefixes the sign', () => {
    expect(formatGain(634)).toBe('+634')
    expect(formatGain(1234)).toBe('+1.2k')
    expect(formatGain(0)).toBe('+0')
    expect(formatGain(-5)).toBe('-5')
  })
})

describe('formatAge', () => {
  const HOUR = 60 * 60 * 1000
  const DAY = 24 * HOUR

  it.each([
    [30 * 60 * 1000, 'now'],
    [5 * HOUR, '5h'],
    [3 * DAY, '3d'],
    [35 * DAY, '5w'],
    [240 * DAY, '8mo'],
    [800 * DAY, '2y'],
  ])('renders an age of %d ms', (ageMs, expected) => {
    expect(formatAge(new Date(NOW - ageMs).toISOString(), NOW)).toBe(expected)
  })

  it('treats future timestamps as now and invalid timestamps as empty', () => {
    expect(formatAge(new Date(NOW + 60_000).toISOString(), NOW)).toBe('now')
    expect(formatAge('not a date', NOW)).toBe('')
  })
})

describe('isNewRepo', () => {
  it('is true for repos younger than 30 days', () => {
    expect(isNewRepo(daysAgo(29), NOW)).toBe(true)
    expect(isNewRepo(daysAgo(30), NOW)).toBe(false)
    expect(isNewRepo(daysAgo(400), NOW)).toBe(false)
  })

  it('is false for invalid timestamps', () => {
    expect(isNewRepo('', NOW)).toBe(false)
  })
})

describe('periodLabel', () => {
  it('labels the current period by timeframe', () => {
    expect(periodLabel('2026-10-18', 'daily', true)).toBe('Today')
    expect(periodLabel('2026-W42', 'weekly', true)).toBe('This week')
    expect(periodLabel('2026-M10', 'monthly', true)).toBe('This month')
    expect(periodLabel('2026', 'yearly', true)).toBe('This year')
  })

  it('labels archive periods from their keys', () => {
    expect(periodLabel('2026-10-17', 'daily', false)).toBe('Oct 17')
    expect(periodLabel('2026-W41', 'weekly', false)).toBe('Week 41 · 2026')
    expect(periodLabel('2026-M09', 'monthly', false)).toBe('Sep 2026')
    expect(periodLabel('2025', 'yearly', false)).toBe('2025')
  })

  it('falls back to the raw key when it does not match the timeframe', () => {
    expect(periodLabel('2026-M13', 'monthly', false)).toBe('2026-M13')
    expect(periodLabel('2026-W41', 'daily', false)).toBe('2026-W41')
  })
})

describe('languageColor', () => {
  it('uses fixed colours for the main languages regardless of case', () => {
    expect(languageColor('TypeScript')).toBe('#3178c6')
    expect(languageColor('python')).toBe('#3572A5')
    expect(languageColor('C++')).toBe('#f34b7d')
  })

  it('gives a stable hsl colour for unknown languages', () => {
    const first = languageColor('Haskell')
    expect(first).toMatch(/^hsl\(\d{1,3} 65% 60%\)$/)
    expect(languageColor('Haskell')).toBe(first)
  })

  it('uses a neutral colour when there is no language', () => {
    expect(languageColor('')).toBe('#8b949e')
  })
})
