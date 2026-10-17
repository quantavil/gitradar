import type { SavedEntry, SeenEntry } from '../types'

const DB_NAME = 'repo-radar-db'
const DB_VERSION = 1
const STORE_SEEN = 'seen'
const STORE_SAVED = 'saved'

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
        db.createObjectStore(STORE_SEEN, { keyPath: 'key' })
        db.createObjectStore(STORE_SAVED, { keyPath: 'key' })
      }

      request.onsuccess = () => {
        const db = request.result
        // Let a newer app version or another tab upgrade the database instead of being blocked.
        db.onversionchange = () => db.close()
        resolve(new RepoDatabase(db))
      }

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to open IndexedDB'))
      }
    })
  }

  getAllSeen(): Promise<SeenEntry[]> {
    return this.readAll<SeenEntry>(STORE_SEEN)
  }

  getAllSaved(): Promise<SavedEntry[]> {
    return this.readAll<SavedEntry>(STORE_SAVED)
  }

  putSeen(entry: SeenEntry): Promise<void> {
    return this.write(STORE_SEEN, (store) => store.put(entry))
  }

  deleteSeen(key: string): Promise<void> {
    return this.write(STORE_SEEN, (store) => store.delete(key))
  }

  replaceSeen(entries: SeenEntry[]): Promise<void> {
    return this.write(STORE_SEEN, (store) => {
      store.clear()
      for (const entry of entries) store.put(entry)
    })
  }

  clearSeen(): Promise<void> {
    return this.write(STORE_SEEN, (store) => store.clear())
  }

  putSaved(entry: SavedEntry): Promise<void> {
    return this.write(STORE_SAVED, (store) => store.put(entry))
  }

  deleteSaved(key: string): Promise<void> {
    return this.write(STORE_SAVED, (store) => store.delete(key))
  }

  clearSaved(): Promise<void> {
    return this.write(STORE_SAVED, (store) => store.clear())
  }

  close(): void {
    this.db.close()
  }

  private readAll<T>(storeName: string): Promise<T[]> {
    return this.runTransaction([storeName], 'readonly', (tx) => {
      return new Promise<T[]>((resolve, reject) => {
        const req = tx.objectStore(storeName).getAll()
        req.onsuccess = () => resolve(req.result as T[])
        req.onerror = () => reject(req.error)
      })
    })
  }

  private write(
    storeName: string,
    operation: (store: IDBObjectStore) => unknown,
  ): Promise<void> {
    return this.runTransaction([storeName], 'readwrite', (tx) => {
      operation(tx.objectStore(storeName))
    })
  }

  private runTransaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    operation: (tx: IDBTransaction) => Promise<T> | void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let started: IDBTransaction | null = null
      try {
        const tx = this.db.transaction(storeNames, mode)
        started = tx
        let result: T

        tx.oncomplete = () => {
          resolve(result)
        }

        tx.onerror = (event) => {
          // The failing request carries the real cause; tx.error is not set yet at this point.
          const failed = (event.target as IDBRequest | null)?.error ?? tx.error
          reject(failed instanceof Error ? failed : new Error('Transaction error'))
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
        // Abort so requests already queued before the throw cannot commit.
        try {
          started?.abort()
        } catch {}
        reject(err)
      }
    })
  }
}
