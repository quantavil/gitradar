import { describe, expect, it } from 'vite-plus/test'
import {
  applyFilters,
  filterEntries,
  isFiltered,
  languageKey,
  languageOptions,
  sortEntries,
  sourceOptions,
  stepIndex,
  timeframeOf,
} from './collection'
import type { Entry, Repo } from './types'

function entry(overrides: Partial<Repo> & Pick<Repo, 'full_name'>, at: number): Entry {
  const repo: Repo = {
    period_key: '2026-10-18',
    rank: 1,
    score: 1,
    github_url: `https://github.com/${overrides.full_name}`,
    description: '',
    language: 'Rust',
    stars_total: 0,
    stars_gained: 0,
    forks_total: 0,
    forks_gained: 0,
    created_at: '2025-01-01T00:00:00Z',
    tags: [],
    social_mention_platforms: [],
    ...overrides,
  }
  return { repo, at }
}

const names = (entries: Entry[]) => entries.map((e) => e.repo.full_name)

describe('sortEntries', () => {
  const entries = [
    entry({ full_name: 'acme/beta', stars_total: 500, stars_gained: 10 }, 1000),
    entry({ full_name: 'Acme/alpha', stars_total: 900, stars_gained: 40 }, 3000),
    entry({ full_name: 'zed/gamma', stars_total: 500, stars_gained: 70 }, 2000),
  ]

  it('orders by the most recent decision first', () => {
    expect(names(sortEntries(entries, 'recent'))).toEqual(['Acme/alpha', 'zed/gamma', 'acme/beta'])
  })

  it('orders by total stars, breaking ties by recency', () => {
    expect(names(sortEntries(entries, 'stars'))).toEqual(['Acme/alpha', 'zed/gamma', 'acme/beta'])
  })

  it('orders by stars gained', () => {
    expect(names(sortEntries(entries, 'gained'))).toEqual(['zed/gamma', 'Acme/alpha', 'acme/beta'])
  })

  it('orders by name case-insensitively', () => {
    expect(names(sortEntries(entries, 'name'))).toEqual(['Acme/alpha', 'acme/beta', 'zed/gamma'])
  })

  it('returns a copy and leaves the input untouched', () => {
    const before = names(entries)
    const sorted = sortEntries(entries, 'name')
    expect(sorted).not.toBe(entries)
    expect(names(entries)).toEqual(before)
  })
})

describe('filterEntries', () => {
  const entries = [
    entry(
      {
        full_name: 'anthropics/claude-code',
        language: 'TypeScript',
        description: 'Terminal agent',
      },
      1,
    ),
    entry({ full_name: 'acme/parser', language: 'Rust', tags: ['ai-agent', 'json'] }, 2),
    entry({ full_name: 'acme/notes', language: 'Go', description: 'Rust-style notes app' }, 3),
  ]

  it('returns every entry for a blank query', () => {
    expect(filterEntries(entries, '')).toEqual(entries)
    expect(filterEntries(entries, '   ')).toEqual(entries)
  })

  it('matches the full name, language, description and tags case-insensitively', () => {
    expect(names(filterEntries(entries, 'CLAUDE'))).toEqual(['anthropics/claude-code'])
    expect(names(filterEntries(entries, 'typescript'))).toEqual(['anthropics/claude-code'])
    expect(names(filterEntries(entries, 'terminal'))).toEqual(['anthropics/claude-code'])
    expect(names(filterEntries(entries, 'ai-agent'))).toEqual(['acme/parser'])
  })

  it('requires every term to match, possibly in different fields', () => {
    expect(names(filterEntries(entries, 'parser rust'))).toEqual(['acme/parser'])
    expect(names(filterEntries(entries, 'rust notes'))).toEqual(['acme/notes'])
    expect(filterEntries(entries, 'rust missing')).toEqual([])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterEntries(entries, 'nonexistent')).toEqual([])
  })
})

describe('stepIndex', () => {
  it('moves within the list and clamps at both ends', () => {
    expect(stepIndex(3, 0, 1)).toBe(1)
    expect(stepIndex(3, 2, 1)).toBe(2)
    expect(stepIndex(3, 0, -1)).toBe(0)
    expect(stepIndex(3, 2, -1)).toBe(1)
  })

  it('selects the first row when nothing is selected', () => {
    expect(stepIndex(3, -1, 1)).toBe(0)
    expect(stepIndex(3, -1, -1)).toBe(0)
  })

  it('returns -1 for an empty list', () => {
    expect(stepIndex(0, -1, 1)).toBe(-1)
  })
})

describe('timeframeOf', () => {
  it('reads the archive from the period key', () => {
    expect(timeframeOf('2026-10-18')).toBe('daily')
    expect(timeframeOf('2026-W42')).toBe('weekly')
    expect(timeframeOf('2026-M10')).toBe('monthly')
    expect(timeframeOf('2026')).toBe('yearly')
    expect(timeframeOf('nope')).toBeNull()
  })
})

describe('language and source filters', () => {
  const entries = [
    entry({ full_name: 'a/one', language: 'Rust', period_key: '2026-10-18' }, 3),
    entry({ full_name: 'a/two', language: 'rust', period_key: '2026-W42' }, 2),
    entry({ full_name: 'a/three', language: 'Go', period_key: '2026-10-17' }, 1),
    entry({ full_name: 'a/four', language: '', period_key: '' }, 0),
  ]

  it('builds language options by count and maps empty to none', () => {
    expect(languageKey('  ')).toBe('none')
    const options = languageOptions(entries)
    expect(options.map((o) => o.id)).toEqual(['all', 'rust', 'go', 'none'])
    expect(options[1].label).toBe('Rust · 2')
    expect(options[3].short).toBe('Other')
  })

  it('offers sources only when there is a choice', () => {
    expect(sourceOptions(entries).map((o) => o.id)).toEqual(['all', 'daily', 'weekly'])
    expect(sourceOptions(entries.slice(0, 1)).map((o) => o.id)).toEqual(['all'])
  })

  it('applies sort, language, source and query together', () => {
    const base = { query: '', language: 'all', source: 'all', sort: 'recent' as const }
    expect(isFiltered(base)).toBe(false)
    expect(names(applyFilters(entries, base))).toEqual(['a/one', 'a/two', 'a/three', 'a/four'])
    expect(names(applyFilters(entries, { ...base, language: 'rust' }))).toEqual(['a/one', 'a/two'])
    expect(names(applyFilters(entries, { ...base, language: 'rust', source: 'weekly' }))).toEqual(['a/two'])
    expect(names(applyFilters(entries, { ...base, query: 'three' }))).toEqual(['a/three'])
    expect(isFiltered({ ...base, source: 'daily' })).toBe(true)
  })
})
