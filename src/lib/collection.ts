import type { Entry } from './types'

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
