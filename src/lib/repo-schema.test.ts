import { describe, expect, it } from 'vitest'
import { normalizeRepo, normalizeRepos } from './repo-schema'

describe('normalizeRepo', () => {
  it('keeps period_key and derives github_url from the trimmed full_name', () => {
    expect(
      normalizeRepo({
        period_key: '2026-10-18',
        full_name: '  morluto/rea ',
        github_url: 'https://evil.example/x',
        rank: 1,
      }),
    ).toMatchObject({
      period_key: '2026-10-18',
      full_name: 'morluto/rea',
      github_url: 'https://github.com/morluto/rea',
      rank: 1,
    })
  })

  it('fills defaults for missing or wrongly typed fields and drops unknown keys', () => {
    expect(
      normalizeRepo({
        full_name: 'a/b',
        stars_total: Number.NaN,
        stars_gained: '634',
        tags: ['ai', 7, 'llm'],
        social_mention_platforms: 'x',
        unknown: true,
      }),
    ).toEqual({
      period_key: '',
      rank: 0,
      score: 0,
      full_name: 'a/b',
      github_url: 'https://github.com/a/b',
      description: '',
      language: '',
      stars_total: 0,
      stars_gained: 0,
      forks_total: 0,
      forks_gained: 0,
      created_at: '',
      tags: ['ai', 'llm'],
      social_mention_platforms: [],
    })
  })

  it.each([
    ['empty string', ''],
    ['missing owner', 'rea'],
    ['three segments', 'a/b/c'],
    ['parent segment', 'a/..'],
    ['current segment', './b'],
    ['space in name', 'a b/c'],
    ['number', 42],
  ])('rejects a full_name that is %s', (_label, fullName) => {
    expect(normalizeRepo({ full_name: fullName })).toBeNull()
  })

  it('accepts dot-prefixed owners such as .github', () => {
    expect(normalizeRepo({ full_name: '.github/profile' })?.full_name).toBe('.github/profile')
  })

  it('rejects non-object values', () => {
    expect(normalizeRepo(null)).toBeNull()
    expect(normalizeRepo(['a/b'])).toBeNull()
    expect(normalizeRepo('a/b')).toBeNull()
  })
})

describe('normalizeRepos', () => {
  it('returns null when the payload is not an array', () => {
    expect(normalizeRepos({ full_name: 'a/b' })).toBeNull()
    expect(normalizeRepos(null)).toBeNull()
  })

  it('drops malformed items and keeps the file order', () => {
    const repos = normalizeRepos([
      { full_name: 'first/one', rank: 1 },
      { full_name: 'no-slash' },
      { full_name: 'second/two', rank: 2 },
    ])
    expect(repos?.map((repo) => repo.full_name)).toEqual(['first/one', 'second/two'])
  })
})
