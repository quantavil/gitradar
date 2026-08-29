import { normalizeRepo } from '../repo-schema'
import type { SavedEntry, SeenEntry, TrendshiftRepo } from '../types'

const DB_NAME = 'repo-radar-db'
const DB_VERSION = 1
const STORE_SEEN = 'seen'
const STORE_SAVED = 'saved'
const MIGRATED_KEY = 'repo_radar_storage_migrated'

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

export class RepoDatabase {
  private db: IDBDatabase

  private constructor(db: IDBDatabase) {
    this.db = db
  }

  static open(name: string = DB_NAME): Promise<RepoDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB is not available'))
      }

      const request = indexedDB.open(name, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_SEEN)) {
          db.createObjectStore(STORE_SEEN, { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains(STORE_SAVED)) {
          db.createObjectStore(STORE_SAVED, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => {
        resolve(new RepoDatabase(request.result))
      }

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open IndexedDB'))
      }
    })
  }

  private runTransaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    operation: (tx: IDBTransaction) => Promise<T> | void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeNames, mode)
        let result: T

        tx.oncomplete = () => {
          resolve(result)
        }

        tx.onerror = () => {
          reject(tx.error ?? new Error('Transaction error'))
        }

        tx.onabort = () => {
          reject(tx.error ?? new Error('Transaction aborted'))
        }

        const opResult = operation(tx)
        if (opResult instanceof Promise) {
          opResult
            .then((val) => {
              result = val
            })
            .catch((err) => {
              try {
                tx.abort()
              } catch {}
              reject(err)
            })
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  getAllSeen(): Promise<SeenEntry[]> {
    return this.runTransaction([STORE_SEEN], 'readonly', (tx) => {
      return new Promise<SeenEntry[]>((resolve, reject) => {
        const store = tx.objectStore(STORE_SEEN)
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result as SeenEntry[])
        req.onerror = () => reject(req.error)
      })
    })
  }

  getAllSaved(): Promise<SavedEntry[]> {
    return this.runTransaction([STORE_SAVED], 'readonly', (tx) => {
      return new Promise<SavedEntry[]>((resolve, reject) => {
        const store = tx.objectStore(STORE_SAVED)
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result as SavedEntry[])
        req.onerror = () => reject(req.error)
      })
    })
  }

  putSeen(entry: SeenEntry): Promise<void> {
    return this.runTransaction([STORE_SEEN], 'readwrite', (tx) => {
      tx.objectStore(STORE_SEEN).put(entry)
    })
  }

  deleteSeen(key: string): Promise<void> {
    return this.runTransaction([STORE_SEEN], 'readwrite', (tx) => {
      tx.objectStore(STORE_SEEN).delete(key)
    })
  }

  replaceSeen(entries: SeenEntry[]): Promise<void> {
    return this.runTransaction([STORE_SEEN], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_SEEN)
      store.clear()
      for (const entry of entries) {
        store.put(entry)
      }
    })
  }

  putSaved(entry: SavedEntry): Promise<void> {
    return this.runTransaction([STORE_SAVED], 'readwrite', (tx) => {
      tx.objectStore(STORE_SAVED).put(entry)
    })
  }

  deleteSaved(key: string): Promise<void> {
    return this.runTransaction([STORE_SAVED], 'readwrite', (tx) => {
      tx.objectStore(STORE_SAVED).delete(key)
    })
  }

  replaceSaved(entries: SavedEntry[]): Promise<void> {
    return this.runTransaction([STORE_SAVED], 'readwrite', (tx) => {
      const store = tx.objectStore(STORE_SAVED)
      store.clear()
      for (const entry of entries) {
        store.put(entry)
      }
    })
  }

  clearSeen(): Promise<void> {
    return this.runTransaction([STORE_SEEN], 'readwrite', (tx) => {
      tx.objectStore(STORE_SEEN).clear()
    })
  }

  clearSaved(): Promise<void> {
    return this.runTransaction([STORE_SAVED], 'readwrite', (tx) => {
      tx.objectStore(STORE_SAVED).clear()
    })
  }

  close(): void {
    this.db.close()
  }
}

export async function migrateLegacyStorage(
  db: RepoDatabase,
  storage: Storage | null,
): Promise<{ seen: number; saved: number }> {
  if (!storage) return { seen: 0, saved: 0 }

  try {
    if (storage.getItem(MIGRATED_KEY) === '1') {
      return { seen: 0, saved: 0 }
    }
  } catch {
    return { seen: 0, saved: 0 }
  }

  const seenMap = new Map<string, TrendshiftRepo>()
  const savedMap = new Map<string, TrendshiftRepo>()

  // 1. Parse seen_details
  try {
    const rawSeenDetails = storage.getItem('seen_details')
    if (rawSeenDetails) {
      const parsed = JSON.parse(rawSeenDetails)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string') {
            const normalized = normalizeRepo(item[1])
            if (normalized) {
              const key = item[0].trim().toLowerCase()
              seenMap.set(key, normalized)
            }
          }
        }
      }
    }
  } catch {}

  // 2. Parse seen_repos fallback
  try {
    const rawSeenRepos = storage.getItem('seen_repos')
    if (rawSeenRepos) {
      const parsed = JSON.parse(rawSeenRepos)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === 'string' && item.trim()) {
            const key = item.trim().toLowerCase()
            if (!seenMap.has(key)) {
              const stub = normalizeRepo(createStubRepo(item.trim()))
              if (stub) {
                seenMap.set(key, stub)
              }
            }
          }
        }
      }
    }
  } catch {}

  // 3. Parse saved_repos
  try {
    const rawSavedRepos = storage.getItem('saved_repos')
    if (rawSavedRepos) {
      const parsed = JSON.parse(rawSavedRepos)
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'string') {
            const normalized = normalizeRepo(item[1])
            if (normalized) {
              const key = item[0].trim().toLowerCase()
              savedMap.set(key, normalized)
            }
          } else if (item && typeof item === 'object') {
            const normalized = normalizeRepo(item)
            if (normalized) {
              savedMap.set(normalized.full_name.toLowerCase(), normalized)
            }
          }
        }
      }
    }
  } catch {}

  const baseTimestamp = Date.now()
  const seenEntries: SeenEntry[] = Array.from(seenMap.entries()).map(
    ([key, repo], index) => ({
      key,
      repo,
      seenAt: baseTimestamp + index,
    }),
  )

  const savedEntries: SavedEntry[] = Array.from(savedMap.entries()).map(
    ([key, repo], index) => ({
      key,
      repo,
      savedAt: baseTimestamp + index,
    }),
  )

  if (seenEntries.length > 0) {
    await db.replaceSeen(seenEntries)
  }
  if (savedEntries.length > 0) {
    await db.replaceSaved(savedEntries)
  }

  try {
    storage.removeItem('seen_details')
    storage.removeItem('seen_repos')
    storage.removeItem('saved_repos')
    storage.setItem(MIGRATED_KEY, '1')
  } catch {}

  return {
    seen: seenEntries.length,
    saved: savedEntries.length,
  }
}
