import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveUrl, clearArchiveCache, fetchArchive } from './client'

const BASE = 'https://quantavil.github.io/trendshift/data'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function repo(fullName: string, periodKey = '2026-10-18') {
  return { full_name: fullName, period_key: periodKey, rank: 1 }
}

// Behaves like fetch: rejects with the signal's reason when aborted, and never resolves otherwise.
function hangingFetch(_url: string, init?: RequestInit): Promise<Response> {
  const signal = init?.signal
  return new Promise<Response>((_resolve, reject) => {
    if (signal?.aborted) reject(signal.reason)
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

describe('fetchArchive', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    clearArchiveCache()
    fetchMock = vi.fn(async () => json([repo('a/one'), { full_name: 'no-slash' }, repo('b/two')]))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds the archive URL from timeframe and language', () => {
    expect(archiveUrl('weekly', 'rust')).toBe(`${BASE}/weekly/weekly-rust.json`)
  })

  it('returns validated repositories in file order', async () => {
    const repos = await fetchArchive('daily', 'all')
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/daily/daily-all.json`, expect.any(Object))
    expect(repos.map((item) => item.full_name)).toEqual(['a/one', 'b/two'])
    expect(repos[0].github_url).toBe('https://github.com/a/one')
  })

  it('caches successful archives per timeframe and language', async () => {
    await fetchArchive('daily', 'all')
    await fetchArchive('daily', 'all')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await fetchArchive('daily', 'python')
    await fetchArchive('weekly', 'all')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not cache failed responses', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'nope' }, 500))
    await expect(fetchArchive('daily', 'all')).rejects.toThrow('HTTP 500')

    await expect(fetchArchive('daily', 'all')).resolves.toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects payloads that are not a list', async () => {
    fetchMock.mockResolvedValueOnce(json({ repos: [] }))
    await expect(fetchArchive('daily', 'all')).rejects.toThrow('not a list of repositories')
  })

  it('times out with a readable message', async () => {
    fetchMock.mockImplementation(hangingFetch)
    await expect(fetchArchive('daily', 'all', { timeoutMs: 5 })).rejects.toThrow(
      'Request timed out after 5ms',
    )
  })

  it('rejects with AbortError when the caller aborts', async () => {
    fetchMock.mockImplementation(hangingFetch)
    const controller = new AbortController()
    const pending = fetchArchive('daily', 'all', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects immediately when the caller signal is already aborted', async () => {
    fetchMock.mockImplementation(hangingFetch)
    await expect(fetchArchive('daily', 'all', { signal: AbortSignal.abort() })).rejects.toMatchObject(
      { name: 'AbortError' },
    )
  })
})
