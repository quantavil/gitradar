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

  it('rejects an empty array so an accidental empty file cannot clear history', () => {
    expect(parseHistoryImport('[]')).toEqual({
      ok: false,
      error: 'History file has no entries.',
    })
  })

  it('keys entries by repository name, case-insensitively, keeping the first occurrence', () => {
    const res = parseHistoryImport(
      JSON.stringify([makeRepo(1, { full_name: 'Owner/Repo-1' }), makeRepo(1)]),
      () => 1000,
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.count).toBe(1)
      expect(res.entries[0].key).toBe('owner/repo-1')
      expect(res.entries[0].repo.full_name).toBe('Owner/Repo-1')
    }
  })

  it('uses an exported seenAt and falls back to import order when it is missing or invalid', () => {
    const res = parseHistoryImport(
      JSON.stringify([
        { ...makeRepo(1), seenAt: 42 },
        makeRepo(2),
        { ...makeRepo(3), seenAt: 'soon' },
      ]),
      () => 1000,
    )
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.entries.map((e: SeenEntry) => e.seenAt)).toEqual([42, 1001, 1002])
    }
  })
})
