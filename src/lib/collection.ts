import type { Entry, Timeframe } from './types'
import { TIMEFRAMES } from './types'

export interface FilterOption {
  id: string
  label: string
  short?: string
}

export type CollectionSort = 'recent' | 'stars' | 'gained' | 'name'

export const COLLECTION_SORTS: { id: CollectionSort; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'stars', label: 'Total stars' },
  { id: 'gained', label: 'Stars gained' },
  { id: 'name', label: 'Name' },
]

/** Rows rendered before the next page is added by the scroll sentinel. */
export const ROWS_PER_PAGE = 60

/** Returns a sorted copy; ties fall back to the most recent decision. */
export function sortEntries(entries: Entry[], sort: CollectionSort): Entry[] {
  const byRecent = (a: Entry, b: Entry) => b.at - a.at
  const compare: Record<CollectionSort, (a: Entry, b: Entry) => number> = {
    recent: byRecent,
    stars: (a, b) => b.repo.stars_total - a.repo.stars_total || byRecent(a, b),
    gained: (a, b) => b.repo.stars_gained - a.repo.stars_gained || byRecent(a, b),
    name: (a, b) =>
      a.repo.full_name.localeCompare(b.repo.full_name, 'en', { sensitivity: 'base' }) || byRecent(a, b),
  }
  return [...entries].sort(compare[sort])
}

/** Every whitespace-separated term must appear in the name, description, language or a tag. */
export function filterEntries(entries: Entry[], query: string): Entry[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return entries
  return entries.filter(({ repo }) => {
    const haystack = [repo.full_name, repo.description, repo.language, ...repo.tags].join('\n').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

/** Index one step from `current` (-1 means nothing selected), clamped to the list; -1 when empty. */
export function stepIndex(length: number, current: number, delta: number): number {
  if (length === 0) return -1
  if (current < 0) return 0
  return Math.min(length - 1, Math.max(0, current + delta))
}

/** The archive a stored repo came from, read from the shape of its period key. */
export function timeframeOf(periodKey: string): Timeframe | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) return 'daily'
  if (/^\d{4}-W\d{2}$/.test(periodKey)) return 'weekly'
  if (/^\d{4}-M\d{2}$/.test(periodKey)) return 'monthly'
  if (/^\d{4}$/.test(periodKey)) return 'yearly'
  return null
}

export const languageKey = (language: string): string => language.trim().toLowerCase() || 'none'

/** "All" plus every language present, most common first, with counts in the label. */
export function languageOptions(entries: Entry[]): FilterOption[] {
  const counts = new Map<string, { label: string; count: number }>()
  for (const { repo } of entries) {
    const key = languageKey(repo.language)
    const found = counts.get(key)
    if (found) found.count += 1
    else counts.set(key, { label: repo.language.trim() || 'Other', count: 1 })
  }
  const options = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label, 'en'))
    .map(([id, { label, count }]) => ({ id, label: `${label} · ${count}`, short: label }))
  return [{ id: 'all', label: 'All languages', short: 'All' }, ...options]
}

/** "All" plus the timeframes the stored repos came from; just "All" when there is no choice to make. */
export function sourceOptions(entries: Entry[]): FilterOption[] {
  const present = new Set(entries.map(({ repo }) => timeframeOf(repo.period_key)))
  const options = TIMEFRAMES.filter((t) => present.has(t.id)).map((t) => ({ id: t.id, label: t.label }))
  return options.length < 2 ? [{ id: 'all', label: 'All periods', short: 'All' }] : [{ id: 'all', label: 'All periods', short: 'All' }, ...options]
}

export interface CollectionFilter {
  query: string
  language: string
  source: string
  sort: CollectionSort
}

export const isFiltered = (f: CollectionFilter): boolean =>
  f.query.trim() !== '' || f.language !== 'all' || f.source !== 'all'

/** Sorts, then narrows by language, source and search text. */
export function applyFilters(entries: Entry[], f: CollectionFilter): Entry[] {
  let list = sortEntries(entries, f.sort)
  if (f.language !== 'all') list = list.filter(({ repo }) => languageKey(repo.language) === f.language)
  if (f.source !== 'all') list = list.filter(({ repo }) => timeframeOf(repo.period_key) === f.source)
  return filterEntries(list, f.query)
}
