import { describe, expect, it } from 'vitest'
import { makeRepo } from '../../test/fixtures'
import { RepoDatabase } from './repo-db'
import type { SavedEntry, SeenEntry } from '../types'

function testDbName() {
  return 'repo-radar-test-' + Math.random().toString(36).slice(2)
}

describe('repo-db indexeddb persistence', () => {
  it('stores and retrieves seen and saved records with timestamps', async () => {
    const db = await RepoDatabase.open(testDbName())
    try {
      const seenEntry: SeenEntry = { key: 'owner/repo-1', repo: makeRepo(1), seenAt: 1000 }
      const savedEntry: SavedEntry = { key: 'owner/saved-2', repo: makeRepo(2), savedAt: 2000 }

      await db.replaceSeen([seenEntry])
      await db.clearSaved()
      await db.putSaved(savedEntry)

      const seen = await db.getAllSeen()
      const saved = await db.getAllSaved()
      expect(seen).toEqual([seenEntry])
      expect(saved).toEqual([savedEntry])

      await db.deleteSeen('owner/repo-1')
      await db.deleteSaved('owner/saved-2')
      expect(await db.getAllSeen()).toHaveLength(0)
      expect(await db.getAllSaved()).toHaveLength(0)
    } finally {
      db.close()
    }
  })

  it('supports putSeen, putSaved, clearSeen, and clearSaved', async () => {
    const db = await RepoDatabase.open(testDbName())
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
})
