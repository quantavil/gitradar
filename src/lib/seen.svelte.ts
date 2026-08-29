import { normalizeRepo } from './repo-schema'
import { parseHistoryImport } from './history-import'
import {
  getBrowserStorage,
  readBooleanPreference,
  writeBooleanPreference,
} from './storage/preferences'
import { migrateLegacyStorage, RepoDatabase } from './storage/repo-db'
import type { SavedEntry, SeenEntry, TrendshiftRepo } from './types'

export interface RepoPersistence {
  getAllSeen(): Promise<SeenEntry[]>
  getAllSaved(): Promise<SavedEntry[]>
  putSeen(entry: SeenEntry): Promise<void>
  deleteSeen(key: string): Promise<void>
  replaceSeen(entries: SeenEntry[]): Promise<void>
  clearSeen(): Promise<void>
  putSaved(entry: SavedEntry): Promise<void>
  deleteSaved(key: string): Promise<void>
  replaceSaved(entries: SavedEntry[]): Promise<void>
  clearSaved(): Promise<void>
}

type RepoStateMessage =
  | { type: 'seen-put'; entry: SeenEntry }
  | { type: 'seen-delete'; key: string }
  | { type: 'seen-replace'; entries: SeenEntry[] }
  | { type: 'saved-put'; entry: SavedEntry }
  | { type: 'saved-delete'; key: string }
  | { type: 'saved-clear' }

const CHANNEL_NAME = 'repo-radar-sync'

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

export class SeenStore {
  seenEntries = $state<Map<string, SeenEntry>>(new Map())
  savedEntries = $state<Map<string, SavedEntry>>(new Map())
  ready = $state(false)
  persistenceError = $state<string | null>(null)

  private _autoSeenOnScroll = $state(
    readBooleanPreference(getBrowserStorage(), 'auto_seen_on_scroll', true),
  )
  private _swipeGesturesEnabled = $state(
    readBooleanPreference(getBrowserStorage(), 'swipe_gestures_enabled', true),
  )

  private persistence: RepoPersistence | null = null
  private now: () => number
  private channel: BroadcastChannel | null = null

  constructor(
    persistence?: RepoPersistence,
    now: () => number = () => Date.now(),
    channelFactory?: (name: string) => BroadcastChannel | null,
  ) {
    this.persistence = persistence ?? null
    this.now = now

    if (channelFactory) {
      this.channel = channelFactory(CHANNEL_NAME)
    } else if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME)
      } catch {
        this.channel = null
      }
    }

    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<RepoStateMessage>) => {
        this.handleBroadcastMessage(event.data)
      }
    }
  }

  get autoSeenOnScroll(): boolean {
    return this._autoSeenOnScroll
  }

  set autoSeenOnScroll(value: boolean) {
    this._autoSeenOnScroll = value
    writeBooleanPreference(getBrowserStorage(), 'auto_seen_on_scroll', value)
  }

  get swipeGesturesEnabled(): boolean {
    return this._swipeGesturesEnabled
  }

  set swipeGesturesEnabled(value: boolean) {
    this._swipeGesturesEnabled = value
    writeBooleanPreference(getBrowserStorage(), 'swipe_gestures_enabled', value)
  }

  get seenDetails(): Map<string, TrendshiftRepo> {
    const map = new Map<string, TrendshiftRepo>()
    for (const [k, v] of this.seenEntries) {
      map.set(k, v.repo)
    }
    return map
  }

  get saved(): Map<string, TrendshiftRepo> {
    const map = new Map<string, TrendshiftRepo>()
    for (const [k, v] of this.savedEntries) {
      map.set(k, v.repo)
    }
    return map
  }

  get seenKeys(): string[] {
    return Array.from(this.seenEntries.keys())
  }

  get seenSize(): number {
    return this.seenEntries.size
  }

  private normalizeKey(key: string): string {
    return (key || '').trim().toLowerCase()
  }

  private broadcast(message: RepoStateMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(message)
      } catch {}
    }
  }

  private handleBroadcastMessage(data: RepoStateMessage) {
    if (!data || typeof data !== 'object') return

    switch (data.type) {
      case 'seen-put': {
        const next = new Map(this.seenEntries)
        next.set(data.entry.key, data.entry)
        this.seenEntries = next
        break
      }
      case 'seen-delete': {
        if (this.seenEntries.has(data.key)) {
          const next = new Map(this.seenEntries)
          next.delete(data.key)
          this.seenEntries = next
        }
        break
      }
      case 'seen-replace': {
        const next = new Map<string, SeenEntry>()
        for (const e of data.entries) next.set(e.key, e)
        this.seenEntries = next
        break
      }
      case 'saved-put': {
        const next = new Map(this.savedEntries)
        next.set(data.entry.key, data.entry)
        this.savedEntries = next
        break
      }
      case 'saved-delete': {
        if (this.savedEntries.has(data.key)) {
          const next = new Map(this.savedEntries)
          next.delete(data.key)
          this.savedEntries = next
        }
        break
      }
      case 'saved-clear': {
        this.savedEntries = new Map()
        break
      }
    }
  }

  async init(): Promise<void> {
    try {
      if (!this.persistence && typeof indexedDB !== 'undefined') {
        const db = await RepoDatabase.open()
        await migrateLegacyStorage(db, getBrowserStorage())
        this.persistence = db
      }

      if (this.persistence) {
        const [seenList, savedList] = await Promise.all([
          this.persistence.getAllSeen(),
          this.persistence.getAllSaved(),
        ])

        const seenMap = new Map<string, SeenEntry>()
        for (const entry of seenList) {
          seenMap.set(entry.key, entry)
        }
        this.seenEntries = seenMap

        const savedMap = new Map<string, SavedEntry>()
        for (const entry of savedList) {
          savedMap.set(entry.key, entry)
        }
        this.savedEntries = savedMap
      }
    } catch (err: unknown) {
      this.persistenceError =
        err instanceof Error ? err.message : 'Storage initialization failed'
    } finally {
      this.ready = true
    }
  }

  isSeen(fullName: string): boolean {
    return this.seenEntries.has(this.normalizeKey(fullName))
  }

  isSaved(fullName: string): boolean {
    return this.savedEntries.has(this.normalizeKey(fullName))
  }

  async markSeen(repoOrName: string | TrendshiftRepo): Promise<void> {
    const isObj = typeof repoOrName !== 'string'
    const fullName = isObj ? repoOrName.full_name : repoOrName
    const key = this.normalizeKey(fullName)
    if (!key) return

    const normalizedRepo = isObj
      ? (normalizeRepo(repoOrName) ?? createStubRepo(fullName))
      : (this.seenEntries.get(key)?.repo ?? createStubRepo(fullName))

    const existing = this.seenEntries.get(key)
    const entry: SeenEntry = {
      key,
      repo: normalizedRepo,
      seenAt: existing ? existing.seenAt : this.now(),
    }

    const nextSeen = new Map(this.seenEntries)
    nextSeen.set(key, entry)
    this.seenEntries = nextSeen

    this.broadcast({ type: 'seen-put', entry })

    if (this.persistence) {
      try {
        await this.persistence.putSeen(entry)
        this.persistenceError = null
      } catch (err: unknown) {
        this.persistenceError =
          err instanceof Error ? err.message : 'Failed to persist seen repository'
      }
    }
  }

  async unsee(fullName: string): Promise<void> {
    const key = this.normalizeKey(fullName)
    if (!this.seenEntries.has(key)) return

    const nextSeen = new Map(this.seenEntries)
    nextSeen.delete(key)
    this.seenEntries = nextSeen

    this.broadcast({ type: 'seen-delete', key })

    if (this.persistence) {
      try {
        await this.persistence.deleteSeen(key)
        this.persistenceError = null
      } catch (err: unknown) {
        this.persistenceError =
          err instanceof Error ? err.message : 'Failed to delete seen repository'
      }
    }
  }

  async resetSeen(): Promise<void> {
    this.seenEntries = new Map()
    this.broadcast({ type: 'seen-replace', entries: [] })

    if (this.persistence) {
      try {
        await this.persistence.clearSeen()
        this.persistenceError = null
      } catch (err: unknown) {
        this.persistenceError =
          err instanceof Error ? err.message : 'Failed to clear seen repositories'
      }
    }
  }

  async enrichSeenDetails(repos: TrendshiftRepo[]): Promise<void> {
    let changed = false
    const nextSeen = new Map(this.seenEntries)
    const updates: SeenEntry[] = []

    for (const repo of repos) {
      const key = this.normalizeKey(repo.full_name)
      const existing = nextSeen.get(key)
      if (existing) {
        const needsEnrichment =
          !existing.repo.description &&
          (repo.description || repo.stars_total > 0 || repo.tags.length > 0)
        if (needsEnrichment) {
          const updatedEntry: SeenEntry = {
            ...existing,
            repo: { ...repo },
          }
          nextSeen.set(key, updatedEntry)
          updates.push(updatedEntry)
          changed = true
        }
      }
    }

    if (changed) {
      this.seenEntries = nextSeen
      if (this.persistence) {
        try {
          for (const entry of updates) {
            await this.persistence.putSeen(entry)
          }
          this.persistenceError = null
        } catch (err: unknown) {
          this.persistenceError =
            err instanceof Error ? err.message : 'Failed to persist enriched seen repos'
        }
      }
    }
  }

  async toggleSave(repo: TrendshiftRepo): Promise<void> {
    const key = this.normalizeKey(repo.full_name)
    if (this.savedEntries.has(key)) {
      await this.removeSaved(repo.full_name)
    } else {
      const normalized = normalizeRepo(repo) ?? createStubRepo(repo.full_name)
      const entry: SavedEntry = {
        key,
        repo: normalized,
        savedAt: this.now(),
      }
      const nextSaved = new Map(this.savedEntries)
      nextSaved.set(key, entry)
      this.savedEntries = nextSaved

      this.broadcast({ type: 'saved-put', entry })

      if (this.persistence) {
        try {
          await this.persistence.putSaved(entry)
          this.persistenceError = null
        } catch (err: unknown) {
          this.persistenceError =
            err instanceof Error ? err.message : 'Failed to persist saved repository'
        }
      }
    }
  }

  async removeSaved(fullName: string): Promise<void> {
    const key = this.normalizeKey(fullName)
    if (!this.savedEntries.has(key)) return

    const nextSaved = new Map(this.savedEntries)
    nextSaved.delete(key)
    this.savedEntries = nextSaved

    this.broadcast({ type: 'saved-delete', key })

    if (this.persistence) {
      try {
        await this.persistence.deleteSaved(key)
        this.persistenceError = null
      } catch (err: unknown) {
        this.persistenceError =
          err instanceof Error ? err.message : 'Failed to delete saved repository'
      }
    }
  }

  async clearSaved(): Promise<void> {
    this.savedEntries = new Map()
    this.broadcast({ type: 'saved-clear' })

    if (this.persistence) {
      try {
        await this.persistence.clearSaved()
        this.persistenceError = null
      } catch (err: unknown) {
        this.persistenceError =
          err instanceof Error ? err.message : 'Failed to clear saved repositories'
      }
    }
  }

  createStubRepo(fullName: string): TrendshiftRepo {
    return createStubRepo(fullName)
  }

  async importHistoryJSON(jsonStr: string): Promise<{
    success: boolean
    count: number
    error?: string
  }> {
    const parseResult = parseHistoryImport(jsonStr, this.now)
    if (!parseResult.ok) {
      return { success: false, count: 0, error: parseResult.error }
    }

    if (this.persistence) {
      try {
        await this.persistence.replaceSeen(parseResult.entries)
        this.persistenceError = null
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to persist imported history'
        this.persistenceError = msg
        return { success: false, count: 0, error: msg }
      }
    }

    const next = new Map<string, SeenEntry>()
    for (const e of parseResult.entries) next.set(e.key, e)
    this.seenEntries = next
    this.broadcast({ type: 'seen-replace', entries: parseResult.entries })

    return { success: true, count: parseResult.count }
  }

  exportHistoryJSON(): string {
    const entries = Array.from(this.seenEntries.values()).map((e) => [
      e.key,
      e.repo,
    ])
    return JSON.stringify(entries, null, 2)
  }

  destroy(): void {
    if (this.channel) {
      try {
        this.channel.close()
      } catch {}
      this.channel = null
    }
  }
}

export const seenStore = new SeenStore()
