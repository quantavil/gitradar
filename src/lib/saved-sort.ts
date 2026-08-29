import type { SavedEntry, TrendshiftRepo } from './types'

export type SavedSortOption = 'newest' | 'stars' | 'growth' | 'name'

export function dailyEquivalent(repo: TrendshiftRepo): number {
  if (repo.timeframe === 'weekly') return (repo.stars_gained ?? 0) / 7
  if (repo.timeframe === 'monthly') return (repo.stars_gained ?? 0) / 30
  return repo.stars_gained ?? 0
}

export function sortSaved(
  entries: SavedEntry[],
  sort: SavedSortOption,
): SavedEntry[] {
  const list = [...entries]
  switch (sort) {
    case 'newest':
      return list.sort((a, b) => b.savedAt - a.savedAt)
    case 'stars':
      return list.sort((a, b) => (b.repo.stars_total ?? 0) - (a.repo.stars_total ?? 0))
    case 'growth':
      return list.sort((a, b) => dailyEquivalent(b.repo) - dailyEquivalent(a.repo))
    case 'name':
      return list.sort((a, b) =>
        a.repo.full_name.localeCompare(b.repo.full_name, undefined, {
          sensitivity: 'base',
        }),
      )
    default:
      return list
  }
}
