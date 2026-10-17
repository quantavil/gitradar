import { describe, expect, it } from 'vitest'
import { normalizeRepo, normalizeRepoArray, safeGithubUrl } from './repo-schema'
import { makeRepo } from '../test/fixtures'

describe('repository schema', () => {
  it('normalizes identity and forces the canonical GitHub URL', () => {
    const result = normalizeRepo({
      ...makeRepo(1),
      full_name: ' OpenAI/Codex ',
      github_url: 'javascript:alert(1)',
    })
    expect(result?.full_name).toBe('OpenAI/Codex')
    expect(result?.github_url).toBe('https://github.com/OpenAI/Codex')
  })

  it('rejects records without owner/name identity', () => {
    expect(normalizeRepo({ ...makeRepo(1), full_name: 'invalid' })).toBeNull()
  })

  it('rejects a non-array response', () => {
    expect(normalizeRepoArray({ repos: [] })).toEqual({
      ok: false,
      repos: [],
      reason: 'Expected an array',
    })
  })

  it('drops malformed records without poisoning valid records', () => {
    const result = normalizeRepoArray([makeRepo(1), null, { full_name: '' }])
    expect(result.ok).toBe(true)
    expect(result.repos).toHaveLength(1)
  })

  it('rejects owner or repo segments that are exactly "." or ".."', () => {
    for (const fullName of ['../x', 'x/..', './x', '../..']) {
      expect(normalizeRepo({ ...makeRepo(1), full_name: fullName })).toBeNull()
    }
  })

  it('still accepts names that merely start with a dot', () => {
    expect(normalizeRepo({ ...makeRepo(1), full_name: 'owner/.github' })?.full_name).toBe(
      'owner/.github',
    )
    expect(normalizeRepo({ ...makeRepo(1), full_name: 'owner/..hidden' })?.full_name).toBe(
      'owner/..hidden',
    )
  })
})
