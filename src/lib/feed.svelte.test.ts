import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearArchiveCache } from './client'
import { Feed } from './feed.svelte'
import { createMemoryAdapter, Triage } from './triage.svelte'
import type { Repo } from './types'

const BASE = 'https://quantavil.github.io/trendshift/data/'

function repo(
  fullName: string,
  periodKey: string,
  rank: number,
  overrides: Partial<Repo> = {},
): Repo {
  return {
    period_key: periodKey,
    rank,
    score: 1,
    full_name: fullName,
    github_url: `https://github.com/${fullName}`,
    description: '',
    language: 'TypeScript',
    stars_total: 1,
    stars_gained: 1,
    forks_total: 0,
    forks_gained: 0,
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    social_mention_platforms: [],
    ...overrides,
  }
}

// Newest-first archive: "A/One" is an older appearance of a/one and must be dropped.
const DAILY: Repo[] = [
  repo('a/one', '2026-10-18', 1, { stars_gained: 10, created_at: '2026-10-10T00:00:00Z' }),
  repo('b/two', '2026-10-18', 2, { stars_gained: 500 }),
  repo('c/three', '2026-10-18', 3, { stars_gained: 50, created_at: '2026-10-15T00:00:00Z' }),
  repo('A/One', '2026-10-17', 1),
  repo('d/four', '2026-10-17', 2),
  repo('e/five', '2026-10-16', 1),
]

const WEEKLY: Repo[] = [repo('x/y', '2026-W42', 1), repo('z/w', '2026-W41', 1)]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function fakeLocalStorage(): Storage {
  const values = new Map<string, string>()
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

const summary = (feed: Feed) =>
  feed.periods.map((period) => [period.label, period.current, period.repos.map((item) => item.full_name)])

describe('Feed', () => {
  let triage: Triage
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    clearArchiveCache()
    vi.stubGlobal('localStorage', fakeLocalStorage())
    triage = new Triage(createMemoryAdapter(), null)
    await until(() => triage.ready)

    const archives: Record<string, Repo[]> = {
      'daily/daily-all.json': DAILY,
      'weekly/weekly-all.json': WEEKLY,
    }
    fetchMock = vi.fn(async (url: string) => {
      const body = archives[url.slice(BASE.length)]
      return body ? json(body) : json({ error: 'missing' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is empty until a load completes', () => {
    const feed = new Feed(triage)
    expect(feed.status).toBe('idle')
    expect(feed.periods).toEqual([])
    expect(feed.currentTotal).toBe(0)
  })

  it('groups the archive into dated periods and keeps the newest appearance of each repo', async () => {
    const feed = new Feed(triage)
    await feed.load()

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}daily/daily-all.json`, expect.any(Object))
    expect(feed.status).toBe('ready')
    expect(summary(feed)).toEqual([
      ['Today', true, ['a/one', 'b/two', 'c/three']],
      ['Oct 17', false, ['d/four']],
      ['Oct 16', false, ['e/five']],
    ])
    expect(feed.currentTotal).toBe(3)
    expect(feed.currentRemaining).toBe(3)
    expect(feed.currentTriaged).toBe(0)
  })

  it('excludes triaged repos and keeps the current period even when fully triaged', async () => {
    const feed = new Feed(triage)
    await feed.load()

    triage.save(DAILY[0])
    triage.dismiss(DAILY[4])
    expect(summary(feed)).toEqual([
      ['Today', true, ['b/two', 'c/three']],
      ['Oct 16', false, ['e/five']],
    ])
    expect(feed.currentTotal).toBe(3)
    expect(feed.currentTriaged).toBe(1)
    expect(feed.currentRemaining).toBe(2)

    triage.dismiss(DAILY[1])
    triage.dismiss(DAILY[2])
    expect(summary(feed)).toEqual([
      ['Today', true, []],
      ['Oct 16', false, ['e/five']],
    ])
    expect(feed.currentRemaining).toBe(0)
  })

  it('sorts within each period without refetching', async () => {
    const feed = new Feed(triage)
    await feed.load()
    const currentNames = () => feed.periods[0].repos.map((item) => item.full_name)

    feed.setSort('gained')
    expect(currentNames()).toEqual(['b/two', 'c/three', 'a/one'])

    feed.setSort('newest')
    expect(currentNames()).toEqual(['c/three', 'a/one', 'b/two'])

    feed.setSort('trending')
    expect(currentNames()).toEqual(['a/one', 'b/two', 'c/three'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reloads on timeframe change and labels periods with the loaded timeframe', async () => {
    const feed = new Feed(triage)
    await feed.load()

    feed.setTimeframe('weekly')
    await until(() => feed.status === 'ready')

    expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}weekly/weekly-all.json`, expect.any(Object))
    expect(summary(feed)).toEqual([
      ['This week', true, ['x/y']],
      ['Week 41 · 2026', false, ['z/w']],
    ])
  })

  it('aborts a superseded load without letting it overwrite the newer one', async () => {
    const feed = new Feed(triage)
    fetchMock.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    )

    const superseded = feed.load()
    feed.setTimeframe('weekly')
    await superseded

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    await until(() => feed.status === 'ready')
    expect(feed.error).toBeNull()
    expect(feed.periods[0].label).toBe('This week')
  })

  it('keeps the last good archive on screen when a load fails and recovers on retry', async () => {
    const feed = new Feed(triage)
    await feed.load()

    feed.setLanguage('python')
    await until(() => feed.status === 'error')
    expect(feed.error).toBe('HTTP 404')
    expect(summary(feed)[0]).toEqual(['Today', true, ['a/one', 'b/two', 'c/three']])

    feed.setLanguage('all')
    await until(() => feed.status === 'ready')
    expect(feed.error).toBeNull()
  })

  it('persists timeframe, language and sort and restores them for a new feed', () => {
    const feed = new Feed(triage)
    feed.setTimeframe('monthly')
    feed.setLanguage('rust')
    feed.setSort('newest')

    const restored = new Feed(triage)
    expect([restored.timeframe, restored.language, restored.sort]).toEqual([
      'monthly',
      'rust',
      'newest',
    ])
  })
})
