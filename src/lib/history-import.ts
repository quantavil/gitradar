import { normalizeRepo } from './repo-schema'
import type { SeenEntry } from './types'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export type ImportValidation =
  | { ok: true }
  | { ok: false; error: string }

export type ImportResult =
  | { ok: true; entries: SeenEntry[]; count: number }
  | { ok: false; error: string }

export function validateImportFile(file: Pick<File, 'size'>): ImportValidation {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'History file must be 2 MiB or smaller.' }
  }
  return { ok: true }
}

/** Parses an export: an array of repository objects, each optionally carrying `seenAt`. */
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
    return { ok: false, error: 'History file has no entries.' }
  }

  const map = new Map<string, SeenEntry>()
  const baseTime = now()

  parsed.forEach((item, index) => {
    const repo = normalizeRepo(item)
    if (!repo) return
    const key = repo.full_name.toLowerCase()
    if (map.has(key)) return
    // Entries without a valid timestamp keep their import order.
    const exportedSeenAt = (item as { seenAt?: unknown }).seenAt
    const seenAt =
      typeof exportedSeenAt === 'number' && Number.isFinite(exportedSeenAt)
        ? exportedSeenAt
        : baseTime + index
    map.set(key, { key, repo, seenAt })
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
