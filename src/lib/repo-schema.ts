import type { TrendshiftRepo } from './types'

const FULL_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

// "." and ".." would resolve to parent or current GitHub paths; names like ".github" are valid.
function isDotSegment(segment: string): boolean {
  return segment === '.' || segment === '..'
}

export type RepoArrayResult =
  | { ok: true; repos: TrendshiftRepo[] }
  | { ok: false; repos: []; reason: string }

export function safeGithubUrl(fullName: string): string {
  return 'https://github.com/' + fullName
}

export function normalizeRepo(value: unknown): TrendshiftRepo | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const fullName = typeof raw.full_name === 'string' ? raw.full_name.trim() : ''
  if (!FULL_NAME.test(fullName) || fullName.split('/').some(isDotSegment)) return null

  const stringValue = (key: string) =>
    typeof raw[key] === 'string' ? (raw[key] as string) : ''
  const numberValue = (key: string) =>
    typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? (raw[key] as number) : 0
  const stringArray = (key: string) =>
    Array.isArray(raw[key])
      ? (raw[key] as unknown[]).filter((item): item is string => typeof item === 'string')
      : []

  return {
    rank: numberValue('rank'),
    score: numberValue('score'),
    full_name: fullName,
    github_url: safeGithubUrl(fullName),
    description: stringValue('description'),
    language: stringValue('language'),
    stars_total: numberValue('stars_total'),
    stars_gained: numberValue('stars_gained'),
    forks_total: numberValue('forks_total'),
    forks_gained: numberValue('forks_gained'),
    created_at: stringValue('created_at'),
    tags: stringArray('tags'),
    social_mention_platforms: stringArray('social_mention_platforms'),
  }
}

export function normalizeRepoArray(value: unknown): RepoArrayResult {
  if (!Array.isArray(value)) {
    return { ok: false, repos: [], reason: 'Expected an array' }
  }
  return {
    ok: true,
    repos: value.map(normalizeRepo).filter((repo): repo is TrendshiftRepo => repo !== null),
  }
}
