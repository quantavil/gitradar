import type { TrendshiftRepo } from '../lib/types'

export function makeRepo(
  index: number,
  overrides: Partial<TrendshiftRepo> = {},
): TrendshiftRepo {
  return {
    rank: index + 1,
    score: 1000 - index,
    full_name: 'owner/repo-' + index,
    github_url: 'https://github.com/owner/repo-' + index,
    description: 'Repository ' + index,
    language: 'TypeScript',
    stars_total: 100 + index,
    stars_gained: 10,
    forks_total: index,
    forks_gained: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    tags: ['test'],
    social_mention_platforms: [],
    timeframe: 'daily',
    ...overrides,
  }
}

export function makeRepos(count: number): TrendshiftRepo[] {
  return Array.from({ length: count }, (_, index) => makeRepo(index))
}
