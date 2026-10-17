import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTrendshiftCatalog } from './trendshift-client'
import { makeRepo } from '../test/fixtures'

describe('trendshift client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches all timeframes and preserves source priority', async () => {
    const started: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        started.push(url)
        return new Response(JSON.stringify([makeRepo(started.length)]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const result = await fetchTrendshiftCatalog('all', { timeoutMs: 1000 })

    expect(started).toHaveLength(3)
    expect(result.successfulTimeframes).toEqual(['daily', 'weekly', 'monthly'])
    expect(result.catalog).toHaveLength(3)
    expect(result.failures).toEqual([])
  })

  it('deduplicates by normalized full_name and keeps daily before weekly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/daily/')) {
          return new Response(
            JSON.stringify([
              makeRepo(1, { full_name: 'OpenAI/Codex', description: 'Daily version' }),
            ]),
            { status: 200 },
          )
        }
        if (url.includes('/weekly/')) {
          return new Response(
            JSON.stringify([
              makeRepo(1, { full_name: 'openai/codex', description: 'Weekly version' }),
              makeRepo(2, { full_name: 'owner/repo-2' }),
            ]),
            { status: 200 },
          )
        }
        return new Response(JSON.stringify([]), { status: 200 })
      }),
    )

    const result = await fetchTrendshiftCatalog('typescript')
    expect(result.catalog).toHaveLength(2)
    expect(result.catalog[0].full_name).toBe('OpenAI/Codex')
    expect(result.catalog[0].timeframe).toBe('daily')
    expect(result.catalog[0].description).toBe('Daily version')
    expect(result.catalog[1].full_name).toBe('owner/repo-2')
    expect(result.catalog[1].timeframe).toBe('weekly')
  })

  it('reports malformed HTTP 200 as a source failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/daily/')) {
          return new Response(JSON.stringify({ notAnArray: true }), { status: 200 })
        }
        return new Response(JSON.stringify([makeRepo(1)]), { status: 200 })
      }),
    )

    const result = await fetchTrendshiftCatalog('all')
    expect(result.successfulTimeframes).toEqual(['weekly', 'monthly'])
    expect(result.failures).toEqual([
      { timeframe: 'daily', message: 'Expected an array' },
    ])
  })

  it('returns partial data when one source times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/monthly/')) {
          return new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          })
        }
        return new Response(JSON.stringify([makeRepo(1)]), { status: 200 })
      }),
    )

    const result = await fetchTrendshiftCatalog('all', { timeoutMs: 50 })
    expect(result.successfulTimeframes).toEqual(['daily', 'weekly'])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].timeframe).toBe('monthly')
    expect(result.catalog).toHaveLength(1)
  })

  it('propagates caller cancellation without publishing stale data', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        })
      }),
    )

    const promise = fetchTrendshiftCatalog('all', { signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toThrow()
  })
})
