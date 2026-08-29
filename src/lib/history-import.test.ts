import { describe, expect, it } from 'vitest'
import { makeRepo } from '../test/fixtures'
import {
  parseHistoryImport,
  validateImportFile,
} from './history-import'
import type { SeenEntry } from './types'

describe('history import', () => {
  it('rejects files larger than 2 MiB before FileReader parsing', () => {
    expect(validateImportFile({ size: 2 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      error: 'History file must be 2 MiB or smaller.',
    })
    expect(validateImportFile({ size: 1024 })).toEqual({ ok: true })
  })

  it('rejects a non-array JSON', () => {
    expect(parseHistoryImport('{"repos": []}')).toEqual({
      ok: false,
      error: 'Invalid JSON format. Expected an array of history entries.',
    })
    expect(parseHistoryImport('not valid json')).toEqual({
      ok: false,
      error: 'Invalid JSON file: syntax error.',
    })
  })

  it('rejects an array containing zero valid records', () => {
    const res = parseHistoryImport(JSON.stringify(['invalid-owner', null, {}]))
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('No valid repository entries found in history file.')
    }
  })

  it('allows an empty array import', () => {
    const res = parseHistoryImport('[]')
    expect(res).toEqual({ ok: true, entries: [], count: 0 })
  })

  it('normalizes tuple, string, and object legacy entries atomically', () => {
    const data = [
      ['owner/repo-1', makeRepo(1)],
      'owner/repo-2',
      makeRepo(3, { full_name: 'owner/repo-3' }),
      'owner/repo-1', // duplicate, should dedupe
    ]

    const res = parseHistoryImport(JSON.stringify(data), () => 1000)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.count).toBe(3)
      expect(res.entries).toHaveLength(3)
      expect(res.entries.map((e: SeenEntry) => e.key)).toEqual([
        'owner/repo-1',
        'owner/repo-2',
        'owner/repo-3',
      ])
      expect(res.entries[0].repo.github_url).toBe('https://github.com/owner/repo-1')
      expect(res.entries[1].repo.full_name).toBe('owner/repo-2')
      expect(res.entries[2].repo.full_name).toBe('owner/repo-3')
    }
  })
})
