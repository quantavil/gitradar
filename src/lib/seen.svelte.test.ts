import { describe, expect, it } from 'vitest'
import { makeRepo } from '../test/fixtures'
import { SeenStore, type RepoPersistence } from './seen.svelte'
import type { SavedEntry, SeenEntry, TrendshiftRepo } from './types'

function stubRepo(fullName: string): TrendshiftRepo {
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

class FakePersistence implements RepoPersistence {
  seen: Map<string, SeenEntry> = new Map()
  saved: Map<string, SavedEntry> = new Map()
  shouldFail = false

  async getAllSeen(): Promise<SeenEntry[]> {
    if (this.shouldFail) throw new Error('Persistence error')
    return Array.from(this.seen.values())
  }
  async getAllSaved(): Promise<SavedEntry[]> {
    if (this.shouldFail) throw new Error('Persistence error')
    return Array.from(this.saved.values())
  }
  async putSeen(entry: SeenEntry): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.seen.set(entry.key, entry)
  }
  async deleteSeen(key: string): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.seen.delete(key)
  }
  async replaceSeen(entries: SeenEntry[]): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.seen.clear()
    for (const e of entries) this.seen.set(e.key, e)
  }
  async clearSeen(): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.seen.clear()
  }
  async putSaved(entry: SavedEntry): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.saved.set(entry.key, entry)
  }
  async deleteSaved(key: string): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.saved.delete(key)
  }
  async clearSaved(): Promise<void> {
    if (this.shouldFail) throw new Error('Persistence error')
    this.saved.clear()
  }
}

async function makeStore(initial: { seen?: SeenEntry[]; saved?: SavedEntry[] } = {}) {
  const persistence = new FakePersistence()
  if (initial.seen) {
    for (const s of initial.seen) persistence.seen.set(s.key, s)
  }
  if (initial.saved) {
    for (const s of initial.saved) persistence.saved.set(s.key, s)
  }

  let currentTime = 1000
  const clock = () => currentTime++
  const store = new SeenStore(persistence, clock, () => null)
  await store.init()
  return { store, persistence, setTime: (t: number) => (currentTime = t) }
}

describe('SeenStore', () => {
  it('enriches an existing stub without changing seenAt', async () => {
    const { store } = await makeStore({
      seen: [{ key: 'owner/repo', repo: stubRepo('owner/repo'), seenAt: 10 }],
    })
    expect(store.seenDetails.get('owner/repo')?.description).toBe('')
    expect(store.seenEntries.get('owner/repo')?.seenAt).toBe(10)

    await store.enrichSeenDetails([makeRepo(1, { full_name: 'owner/repo' })])
    expect(store.seenDetails.get('owner/repo')?.description).toBe('Repository 1')
    expect(store.seenEntries.get('owner/repo')?.seenAt).toBe(10)
  })

  it('markSeen is idempotent and unsee removes from seen', async () => {
    const { store } = await makeStore()
    await store.markSeen(makeRepo(1))
    await store.markSeen(makeRepo(1))
    expect(store.seenSize).toBe(1)
    expect(store.isSeen('owner/repo-1')).toBe(true)

    await store.unsee('owner/repo-1')
    expect(store.seenSize).toBe(0)
    expect(store.isSeen('owner/repo-1')).toBe(false)
  })

  it('stores savedAt and toggles saved entries', async () => {
    const { store, setTime } = await makeStore()
    setTime(5000)
    await store.toggleSave(makeRepo(1))
    expect(store.isSaved('owner/repo-1')).toBe(true)
    expect(store.savedEntries.get('owner/repo-1')?.savedAt).toBe(5000)

    setTime(6000)
    await store.toggleSave(makeRepo(1))
    expect(store.isSaved('owner/repo-1')).toBe(false)
  })

  it('surfaces persistence errors without discarding in-memory state', async () => {
    const { store, persistence } = await makeStore()
    persistence.shouldFail = true

    await store.markSeen(makeRepo(1))
    expect(store.isSeen('owner/repo-1')).toBe(true)
    expect(store.persistenceError).not.toBeNull()
  })
})
