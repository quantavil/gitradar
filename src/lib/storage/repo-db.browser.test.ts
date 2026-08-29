import { describe, expect, it } from 'vitest'
import { makeRepo } from '../../test/fixtures'
import { migrateLegacyStorage, RepoDatabase } from './repo-db'
import type { SavedEntry, SeenEntry } from '../types'

function testDbName() {
  return 'repo-radar-test-' + Math.random().toString(36).slice(2)
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial))
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe('repo-db indexeddb persistence', () => {
  it('stores and retrieves seen and saved records with timestamps', async () => {
    const dbName = testDbName()
    const db = await RepoDatabase.open(dbName)
    try {
      const seenEntry: SeenEntry = {
        key: 'owner/repo-1',
        repo: makeRepo(1),
        seenAt: 1000,
      }
      const savedEntry: SavedEntry = {
        key: 'owner/saved-2',
        repo: makeRepo(2),
        savedAt: 2000,
      }

      await db.replaceSeen([seenEntry])
      await db.replaceSaved([savedEntry])

      const seen = await db.getAllSeen()
      const saved = await db.getAllSaved()

      expect(seen).toHaveLength(1)
      expect(seen[0]).toEqual(seenEntry)
      expect(saved).toHaveLength(1)
      expect(saved[0]).toEqual(savedEntry)

      await db.deleteSeen('owner/repo-1')
      expect(await db.getAllSeen()).toHaveLength(0)

      await db.deleteSaved('owner/saved-2')
      expect(await db.getAllSaved()).toHaveLength(0)
    } finally {
      db.close()
    }
  })

  it('supports putSeen, putSaved, clearSeen, and clearSaved', async () => {
    const dbName = testDbName()
    const db = await RepoDatabase.open(dbName)
    try {
      await db.putSeen({ key: 'owner/repo-1', repo: makeRepo(1), seenAt: 10 })
      await db.putSeen({ key: 'owner/repo-2', repo: makeRepo(2), seenAt: 20 })
      expect(await db.getAllSeen()).toHaveLength(2)

      await db.clearSeen()
      expect(await db.getAllSeen()).toHaveLength(0)

      await db.putSaved({ key: 'owner/saved-1', repo: makeRepo(1), savedAt: 10 })
      await db.putSaved({ key: 'owner/saved-2', repo: makeRepo(2), savedAt: 20 })
      expect(await db.getAllSaved()).toHaveLength(2)

      await db.clearSaved()
      expect(await db.getAllSaved()).toHaveLength(0)
    } finally {
      db.close()
    }
  })

  it('migrates valid legacy records and ignores corrupt keys independently', async () => {
    const dbName = testDbName()
    const db = await RepoDatabase.open(dbName)
    try {
      const storage = memoryStorage({
        seen_details: JSON.stringify([
          ['owner/repo-1', makeRepo(1)],
          ['invalid-entry', null],
        ]),
        seen_repos: JSON.stringify(['owner/repo-1', 'owner/repo-2', 'not-valid']),
        saved_repos: JSON.stringify([
          ['owner/repo-3', makeRepo(3)],
        ]),
        repo_radar_theme: 'light',
        auto_seen_on_scroll: 'false',
      })

      const counts = await migrateLegacyStorage(db, storage)
      expect(counts.seen).toBe(2) // repo-1 and repo-2 (as stub)
      expect(counts.saved).toBe(1) // repo-3

      const seen = await db.getAllSeen()
      expect(seen).toHaveLength(2)
      expect(seen[0].key).toBe('owner/repo-1')
      expect(seen[1].key).toBe('owner/repo-2')

      const saved = await db.getAllSaved()
      expect(saved).toHaveLength(1)
      expect(saved[0].key).toBe('owner/repo-3')

      // Legacy repository keys removed
      expect(storage.getItem('seen_details')).toBeNull()
      expect(storage.getItem('seen_repos')).toBeNull()
      expect(storage.getItem('saved_repos')).toBeNull()

      // Preference keys retained
      expect(storage.getItem('repo_radar_theme')).toBe('light')
      expect(storage.getItem('auto_seen_on_scroll')).toBe('false')
      expect(storage.getItem('repo_radar_storage_migrated')).toBe('1')
    } finally {
      db.close()
    }
  })

  it('does not re-migrate if already migrated flag is set', async () => {
    const dbName = testDbName()
    const db = await RepoDatabase.open(dbName)
    try {
      const storage = memoryStorage({
        repo_radar_storage_migrated: '1',
        seen_repos: JSON.stringify(['owner/repo-1']),
      })

      const counts = await migrateLegacyStorage(db, storage)
      expect(counts.seen).toBe(0)
      expect(counts.saved).toBe(0)
      expect(await db.getAllSeen()).toHaveLength(0)
    } finally {
      db.close()
    }
  })
})
