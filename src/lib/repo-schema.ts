import type { Repo } from './types'

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

// "." and ".." would resolve to parent or current GitHub paths; names like ".github" are valid.
function isDotSegment(segment: string): boolean {
  return segment === '.' || segment === '..'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const text = (raw: unknown): string => (typeof raw === 'string' ? raw : '')
const count = (raw: unknown): number => (typeof raw === 'number' && Number.isFinite(raw) ? raw : 0)
const texts = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []

export function normalizeRepo(value: unknown): Repo | null {
  if (!isRecord(value)) return null
  const fullName = text(value.full_name).trim()
  if (!FULL_NAME.test(fullName) || fullName.split('/').some(isDotSegment)) return null

  return {
    period_key: text(value.period_key),
    rank: count(value.rank),
    score: count(value.score),
    full_name: fullName,
    github_url: `https://github.com/${fullName}`,
    description: text(value.description),
    language: text(value.language),
    stars_total: count(value.stars_total),
    stars_gained: count(value.stars_gained),
    forks_total: count(value.forks_total),
    forks_gained: count(value.forks_gained),
    created_at: text(value.created_at),
    tags: texts(value.tags),
    social_mention_platforms: texts(value.social_mention_platforms),
  }
}

/** Returns null when the payload is not an array; malformed items are dropped. */
export function normalizeRepos(value: unknown): Repo[] | null {
  if (!Array.isArray(value)) return null
  return value.map(normalizeRepo).filter((repo): repo is Repo => repo !== null)
}
