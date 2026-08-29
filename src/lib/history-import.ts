import { normalizeRepo } from './repo-schema'
import type { SeenEntry, TrendshiftRepo } from './types'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export type ImportValidation =
  | { ok: true }
  | { ok: false; error: string }

export type ImportResult =
  | { ok: true; entries: SeenEntry[]; count: number }
  | { ok: false; error: string }

function createStubRepo(fullName: string): TrendshiftRepo {
  return {
    rank: 0,
    score: 0,
    full_name: fullName,
    github_url: 'https://github.com/' + fullName,
    description: '',
    language: '',
    stars_total: 0,
    stars_gained: 0,
    forks_total: 0,
    forks_gained: 0,
    created_at: '',
    tags: [],
    social_mention_platforms: [],
  }
}

export function validateImportFile(file: Pick<File, 'size'>): ImportValidation {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'History file must be 2 MiB or smaller.' }
  }
  return { ok: true }
}

export function parseHistoryImport(
  json: string,
  now: () => number = () => Date.now(),
): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Invalid JSON file: syntax error.' }
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'Invalid JSON format. Expected an array of history entries.',
    }
  }

  if (parsed.length === 0) {
    return { ok: true, entries: [], count: 0 }
  }

  const map = new Map<string, SeenEntry>()
  const baseTime = now()

  parsed.forEach((item, index) => {
    if (!item) return

    // 1. Tuple [string, TrendshiftRepo]
    if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string') {
      const key = item[0].trim().toLowerCase()
      const normalized =
        normalizeRepo(item[1]) ?? normalizeRepo(createStubRepo(item[0].trim()))
      if (normalized) {
        if (!map.has(key)) {
          map.set(key, { key, repo: normalized, seenAt: baseTime + index })
        }
      }
      return
    }

    // 2. String 'owner/repo'
    if (typeof item === 'string' && item.trim()) {
      const trimmed = item.trim()
      const normalized = normalizeRepo(createStubRepo(trimmed))
      if (normalized) {
        const key = normalized.full_name.toLowerCase()
        if (!map.has(key)) {
          map.set(key, { key, repo: normalized, seenAt: baseTime + index })
        }
      }
      return
    }

    // 3. Object TrendshiftRepo
    if (typeof item === 'object') {
      const normalized = normalizeRepo(item)
      if (normalized) {
        const key = normalized.full_name.toLowerCase()
        if (!map.has(key)) {
          map.set(key, { key, repo: normalized, seenAt: baseTime + index })
        }
      }
    }
  })

  if (map.size === 0) {
    return {
      ok: false,
      error: 'No valid repository entries found in history file.',
    }
  }

  const entries = Array.from(map.values())
  return {
    ok: true,
    entries,
    count: entries.length,
  }
}
