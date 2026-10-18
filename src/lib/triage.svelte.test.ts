import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryAdapter, patchPrefs, readPrefs, Triage, type KeyValueAdapter } from './triage.svelte'
import type { Repo } from './types'

const T0 = Date.parse('2026-10-18T12:00:00Z')
const PREFS_KEY = 'rr:prefs'

function repo(fullName: string): Repo {
  return {
    period_key: '2026-10-18',
    rank: 1,
    score: 1,
    full_name: fullName,
    github_url: `https://github.com/${fullName}`,
    description: '',
    language: 'Rust',
    stars_total: 1,
    stars_gained: 1,
    forks_total: 0,
    forks_gained: 0,
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    social_mention_platforms: [],
  }
}

// Storage blocking and quota errors surface through Storage's own methods, so a plain object is enough here.
function fakeLocalStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as Storage
}

// Polls on real timers: vi.waitFor would advance faked Date time on every check.
async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  expect(condition()).toBe(true)
}

async function readyTriage(storage: KeyValueAdapter = createMemoryAdapter()): Promise<Triage> {
  const triage = new Triage(storage, null)
  await until(() => triage.ready)
  return triage
}

describe('Triage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    vi.stubGlobal('localStorage', fakeLocalStorage())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('applies mutations made before storage has loaded', async () => {
    const storage = createMemoryAdapter()
    const triage = new Triage(storage, null)
    triage.save(repo('Org/Alpha'))
    expect(triage.ready).toBe(false)

    await until(() => triage.ready)
    expect(triage.isSaved('org/alpha')).toBe(true)
  })

  it('moves a repo between saved and seen and never keeps it in both', async () => {
    const triage = await readyTriage()
    const alpha = repo('org/alpha')

    triage.dismiss(alpha)
    expect(triage.isSeen('ORG/alpha')).toBe(true)
    expect(triage.isSaved('org/alpha')).toBe(false)

    triage.save(alpha)
    expect(triage.isSaved('org/alpha')).toBe(true)
    expect(triage.isSeen('org/alpha')).toBe(false)
    expect(triage.saved.map((entry) => entry.repo.full_name)).toEqual(['org/alpha'])
  })

  it('ignores a repeated save or dismiss so the timestamp and undo history stay put', async () => {
    const triage = await readyTriage()
    triage.save(repo('org/alpha'))
    vi.setSystemTime(T0 + 1000)
    triage.save(repo('org/alpha'))

    expect(triage.saved[0].at).toBe(T0)
    triage.undo()
    expect(triage.isSaved('org/alpha')).toBe(false)
    expect(triage.canUndo).toBe(false)
  })

  it('unsave and restore remove repos from their collection', async () => {
    const triage = await readyTriage()
    triage.save(repo('org/alpha'))
    triage.dismiss(repo('org/beta'))

    triage.unsave('ORG/alpha')
    triage.restore('org/BETA')
    expect(triage.saved).toEqual([])
    expect(triage.seen).toEqual([])
  })

  it('orders collections newest first by action time', async () => {
    const triage = await readyTriage()
    triage.dismiss(repo('org/old'))
    vi.setSystemTime(T0 + 60_000)
    triage.dismiss(repo('org/new'))

    expect(triage.seen.map((entry) => entry.repo.full_name)).toEqual(['org/new', 'org/old'])
    expect(triage.seen.map((entry) => entry.at)).toEqual([T0 + 60_000, T0])
  })

  it('undo reverts a save and restores the seen entry it replaced with its original time', async () => {
    const triage = await readyTriage()
    triage.dismiss(repo('org/alpha'))
    vi.setSystemTime(T0 + 5000)
    triage.save(repo('org/alpha'))

    expect(triage.lastAction).toEqual({ kind: 'save', repo: repo('org/alpha') })
    triage.undo()

    expect(triage.isSaved('org/alpha')).toBe(false)
    expect(triage.seen).toEqual([{ repo: repo('org/alpha'), at: T0 }])
    expect(triage.lastAction).toEqual({ kind: 'dismiss', repo: repo('org/alpha') })

    triage.undo()
    expect(triage.isSeen('org/alpha')).toBe(false)
    expect(triage.lastAction).toBeNull()
  })

  it('undoes actions newest first and keeps at most 20', async () => {
    const triage = await readyTriage()
    for (let index = 0; index < 25; index += 1) {
      vi.setSystemTime(T0 + index)
      triage.dismiss(repo(`org/repo-${index}`))
    }
    expect(triage.seen).toHaveLength(25)

    for (let index = 0; index < 20; index += 1) triage.undo()

    expect(triage.seen.map((entry) => entry.repo.full_name)).toEqual([
      'org/repo-4',
      'org/repo-3',
      'org/repo-2',
      'org/repo-1',
      'org/repo-0',
    ])
    expect(triage.canUndo).toBe(false)
  })

  it('skips undo records whose effect was already reversed by another action', async () => {
    const triage = await readyTriage()
    triage.dismiss(repo('org/alpha'))
    triage.dismiss(repo('org/beta'))
    triage.restore('org/beta')

    triage.undo()
    expect(triage.isSeen('org/alpha')).toBe(false)
    expect(triage.isSeen('org/beta')).toBe(false)
    expect(triage.canUndo).toBe(false)
  })

  it('clears saved and seen collections', async () => {
    const triage = await readyTriage()
    triage.save(repo('org/alpha'))
    triage.dismiss(repo('org/beta'))

    triage.clearSaved()
    expect(triage.saved).toEqual([])
    expect(triage.seen).toHaveLength(1)

    triage.clearSeen()
    expect(triage.seen).toEqual([])
  })

  it('persists to storage and restores it for a new instance', async () => {
    const storage = createMemoryAdapter()
    const first = await readyTriage(storage)
    first.save(repo('org/alpha'))
    first.dismiss(repo('org/beta'))

    const second = await readyTriage(storage)
    expect(second.isSaved('org/alpha')).toBe(true)
    expect(second.isSeen('org/beta')).toBe(true)
  })

  it('keeps the in-memory state when storage cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken: KeyValueAdapter = {
      get: () => Promise.reject(new Error('blocked')),
      set: () => Promise.resolve(),
    }
    const triage = await readyTriage(broken)

    triage.save(repo('org/alpha'))
    expect(triage.isSaved('org/alpha')).toBe(true)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('could not read'), expect.any(Error))
  })

  it('synchronises changes made by another tab sharing the same storage', async () => {
    const storage = createMemoryAdapter()
    const tabA = new Triage(storage)
    const tabB = new Triage(storage)
    await until(() => tabA.ready && tabB.ready)

    tabA.save(repo('org/alpha'))
    await until(() => tabB.isSaved('org/alpha'))

    tabB.dismiss(repo('org/beta'))
    await until(() => tabA.isSeen('org/beta'))
    expect(tabA.isSaved('org/alpha')).toBe(true)
  })

  it('works without BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const triage = new Triage(createMemoryAdapter())
    await until(() => triage.ready)

    triage.save(repo('org/alpha'))
    expect(triage.isSaved('org/alpha')).toBe(true)
  })

  it('exports saved and seen entries as versioned JSON', async () => {
    const triage = await readyTriage()
    triage.save(repo('org/alpha'))
    triage.dismiss(repo('org/beta'))

    expect(JSON.parse(triage.exportJson())).toEqual({
      version: 1,
      saved: [{ repo: repo('org/alpha'), at: T0 }],
      seen: [{ repo: repo('org/beta'), at: T0 }],
    })
  })

  it('imports a backup and replaces the current data', async () => {
    const source = await readyTriage()
    source.save(repo('org/alpha'))
    source.dismiss(repo('org/beta'))
    const backup = source.exportJson()

    const target = await readyTriage()
    target.save(repo('org/previous'))
    expect(target.importJson(backup)).toEqual({ ok: true, saved: 1, seen: 1 })

    expect(target.isSaved('org/previous')).toBe(false)
    expect(target.isSaved('org/alpha')).toBe(true)
    expect(target.isSeen('org/beta')).toBe(true)
    expect(target.canUndo).toBe(false)
  })

  it('drops invalid entries and keeps a repo in saved when the backup lists it twice', async () => {
    const triage = await readyTriage()
    const backup = JSON.stringify({
      version: 1,
      saved: [
        { repo: repo('org/alpha'), at: T0 },
        { repo: { full_name: 'no-slash' }, at: T0 },
        { repo: repo('org/gamma'), at: 'yesterday' },
      ],
      seen: [{ repo: repo('ORG/alpha'), at: T0 }],
    })

    expect(triage.importJson(backup)).toEqual({ ok: true, saved: 1, seen: 0 })
    expect(triage.saved.map((entry) => entry.repo.full_name)).toEqual(['org/alpha'])
  })

  it.each([
    ['invalid JSON', '{not json', 'Backup file is not valid JSON'],
    ['another version', JSON.stringify({ version: 2, saved: [], seen: [] }), 'Unsupported backup format'],
    ['missing lists', JSON.stringify({ version: 1, saved: [] }), 'Backup must contain saved and seen lists'],
  ])('rejects %s without touching current data', async (_label, text, error) => {
    const triage = await readyTriage()
    triage.save(repo('org/alpha'))

    expect(triage.importJson(text)).toEqual({ ok: false, error })
    expect(triage.isSaved('org/alpha')).toBe(true)
  })

  it('rejects backups larger than 2 MiB', async () => {
    const triage = await readyTriage()
    const oversized = 'x'.repeat(2 * 1024 * 1024 + 1)
    expect(triage.importJson(oversized)).toEqual({
      ok: false,
      error: 'Backup file is larger than 2 MiB',
    })
  })

  it('reads the theme from preferences and applies it to the document root', () => {
    const root = { dataset: {} as Record<string, string> }
    vi.stubGlobal('document', { documentElement: root })
    vi.stubGlobal('localStorage', fakeLocalStorage({ [PREFS_KEY]: JSON.stringify({ theme: 'dark' }) }))

    const triage = new Triage(createMemoryAdapter(), null)
    expect(triage.theme).toBe('dark')
    expect(root.dataset.theme).toBe('dark')

    triage.theme = 'light'
    expect(root.dataset.theme).toBe('light')
    expect(readPrefs().theme).toBe('light')
  })
})

describe('preferences', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to defaults for missing or invalid values', () => {
    vi.stubGlobal(
      'localStorage',
      fakeLocalStorage({ [PREFS_KEY]: JSON.stringify({ timeframe: 'hourly', sort: 'random', theme: 3 }) }),
    )
    expect(readPrefs()).toEqual({
      timeframe: 'daily',
      language: 'all',
      sort: 'trending',
      theme: 'system',
    })
  })

  it('merges patches with the stored preferences', () => {
    patchPrefs({ timeframe: 'weekly' })
    patchPrefs({ language: 'rust' })
    expect(readPrefs()).toMatchObject({ timeframe: 'weekly', language: 'rust' })
  })

  it('treats unreadable JSON as no preferences', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage({ [PREFS_KEY]: '{broken' }))
    expect(readPrefs().timeframe).toBe('daily')
  })
})
