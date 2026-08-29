import { describe, expect, it } from 'vitest'
import { makeRepo, makeRepos } from '../test/fixtures'
import { RepoFeed, type CatalogFetcher } from './api.svelte'
import { SeenStore, type RepoPersistence } from './seen.svelte'
import type { CatalogResult, LanguageOption, Timeframe, TrendshiftRepo } from './types'

class MemoryPersistence implements RepoPersistence {
  async getAllSeen() {
    return []
  }
  async getAllSaved() {
    return []
  }
  async putSeen() {}
  async deleteSeen() {}
  async replaceSeen() {}
  async clearSeen() {}
  async putSaved() {}
  async deleteSaved() {}
  async replaceSaved() {}
  async clearSaved() {}
}

function fakeClient(
  catalog: TrendshiftRepo[],
  successfulTimeframes: Timeframe[] = ['daily', 'weekly', 'monthly'],
  failures: { timeframe: Timeframe; message: string }[] = [],
): CatalogFetcher {
  return async () => ({
    catalog,
    successfulTimeframes,
    failures,
  })
}

async function createStoreWithSeen(seenKeys: string[] = []): Promise<SeenStore> {
  const store = new SeenStore(new MemoryPersistence(), () => 1000, () => null)
  await store.init()
  for (const key of seenKeys) {
    await store.markSeen(makeRepo(1, { full_name: key }))
  }
  return store
}

describe('RepoFeed catalog-derived state', () => {
  it('counts total catalog and remaining unseen repositories', async () => {
    const seen = await createStoreWithSeen(['owner/repo-1'])
    const repos = makeRepos(3)
    const feed = new RepoFeed(fakeClient(repos), seen)

    await feed.fetchFeed()

    expect(feed.totalCount).toBe(3)
    expect(feed.remainingCount).toBe(2)
    expect(feed.repos.map((repo) => repo.full_name)).toEqual([
      'owner/repo-0',
      'owner/repo-2',
    ])
  })

  it('reacts immediately when history is reset or restored without refetching', async () => {
    const seen = await createStoreWithSeen(['owner/repo-0'])
    let fetchCount = 0
    const client: CatalogFetcher = async () => {
      fetchCount++
      return {
        catalog: makeRepos(3),
        successfulTimeframes: ['daily'],
        failures: [],
      }
    }

    const feed = new RepoFeed(client, seen)
    await feed.fetchFeed()

    expect(feed.remainingCount).toBe(2)
    expect(fetchCount).toBe(1)

    // Unsee owner/repo-0
    await seen.unsee('owner/repo-0')
    expect(feed.remainingCount).toBe(3)
    expect(fetchCount).toBe(1)

    // Mark seen owner/repo-1
    await seen.markSeen(makeRepo(1, { full_name: 'owner/repo-1' }))
    expect(feed.remainingCount).toBe(2)
    expect(fetchCount).toBe(1)
  })

  it('does not publish an obsolete language response', async () => {
    const seen = await createStoreWithSeen()
    let resolveFirst: (res: CatalogResult) => void
    const firstPromise = new Promise<CatalogResult>((resolve) => {
      resolveFirst = resolve
    })

    const client: CatalogFetcher = async (lang: LanguageOption) => {
      if (lang === 'python') {
        return firstPromise
      }
      return {
        catalog: [makeRepo(1, { full_name: 'rust/repo' })],
        successfulTimeframes: ['daily'],
        failures: [],
      }
    }

    const feed = new RepoFeed(client, seen)
    const pythonFetch = feed.setLanguage('python')
    const rustFetch = feed.setLanguage('rust')

    await rustFetch
    resolveFirst!({
      catalog: [makeRepo(2, { full_name: 'python/repo' })],
      successfulTimeframes: ['daily'],
      failures: [],
    })
    await pythonFetch

    expect(feed.catalog.map((r) => r.full_name)).toEqual(['rust/repo'])
  })

  it('shows partial source state without discarding successful data', async () => {
    const seen = await createStoreWithSeen()
    const client: CatalogFetcher = async () => ({
      catalog: [makeRepo(1)],
      successfulTimeframes: ['daily', 'weekly'],
      failures: [{ timeframe: 'monthly', message: 'Timeout' }],
    })

    const feed = new RepoFeed(client, seen)
    await feed.fetchFeed()

    expect(feed.catalog).toHaveLength(1)
    expect(feed.successfulTimeframes).toEqual(['daily', 'weekly'])
    expect(feed.partialWarning).toContain('monthly')
  })
})
