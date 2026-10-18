import { createStore, get, set } from 'idb-keyval'
import { isRecord, normalizeRepo } from './repo-schema'
import {
  LANGUAGES,
  SORTS,
  TIMEFRAMES,
  type Entry,
  type Repo,
  type SortKey,
  type Theme,
  type Timeframe,
} from './types'

export interface Prefs {
  timeframe: Timeframe
  language: string
  sort: SortKey
  theme: Theme
}

type Collection = 'saved' | 'seen'
type Action = 'save' | 'dismiss'
type Index = ReadonlyMap<string, Entry>

export interface KeyValueAdapter {
  get(key: Collection): Promise<unknown>
  set(key: Collection, entries: Entry[]): Promise<void>
}

interface UndoRecord {
  kind: Action
  repo: Repo
  at: number
  previous: { collection: Collection; entry: Entry } | null
}

export type ImportResult = { ok: true; saved: number; seen: number } | { ok: false; error: string }

// Storage identifiers keep their original RepoRadar-era names on purpose: renaming them
// would drop every saved and seen repo already in a browser. Only visible text says GitRadar.
const PREFS_KEY = 'rr:prefs'
const THEMES: readonly Theme[] = ['system', 'light', 'dark']
const CHANNEL_NAME = 'repo-radar'
const CHANGED = 'changed'
const BACKUP_VERSION = 1
const MAX_IMPORT_BYTES = 2 * 1024 * 1024
const UNDO_LIMIT = 20

// Save moves a repo out of Seen and vice versa, so a repo lives in at most one collection.
const TARGET: Record<Action, Collection> = { save: 'saved', dismiss: 'seen' }
const OTHER: Record<Collection, Collection> = { saved: 'seen', seen: 'saved' }

const keyOf = (name: string): string => name.toLowerCase()

// Shared by the feed and triage: both persist to the single 'rr:prefs' key.
function prefsStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readRawPrefs(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(prefsStorage()?.getItem(PREFS_KEY) ?? 'null')
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.find((option) => option === value) ?? fallback
}

export function readPrefs(): Prefs {
  const raw = readRawPrefs()
  return {
    timeframe: oneOf(
      raw.timeframe,
      TIMEFRAMES.map((item) => item.id),
      'daily',
    ),
    language: oneOf(
      raw.language,
      LANGUAGES.map((item) => item.id),
      'all',
    ),
    sort: oneOf(
      raw.sort,
      SORTS.map((item) => item.id),
      'trending',
    ),
    theme: oneOf(raw.theme, THEMES, 'system'),
  }
}

export function patchPrefs(patch: Partial<Prefs>): void {
  try {
    prefsStorage()?.setItem(PREFS_KEY, JSON.stringify({ ...readRawPrefs(), ...patch }))
  } catch {
    // Blocked or full storage: the preference then lasts for this session only.
  }
}

function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

function normalizeEntries(value: unknown): Entry[] | null {
  if (!Array.isArray(value)) return null
  const entries: Entry[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.at !== 'number' || !Number.isFinite(item.at)) continue
    const repo = normalizeRepo(item.repo)
    if (repo) entries.push({ repo, at: item.at })
  }
  return entries
}

// First occurrence wins; `taken` lists keys that another collection already owns.
function indexEntries(entries: Entry[], taken: ReadonlySet<string> = new Set()): Index {
  const index = new Map<string, Entry>()
  for (const entry of entries) {
    const key = keyOf(entry.repo.full_name)
    if (!index.has(key) && !taken.has(key)) index.set(key, entry)
  }
  return index
}

// Maps are replaced rather than mutated: Svelte 5 does not track in-place Map changes.
const withEntry = (index: Index, key: string, entry: Entry): Index =>
  new Map(index).set(key, entry)

const withoutEntry = (index: Index, key: string): Index => {
  const next = new Map(index)
  next.delete(key)
  return next
}

const newestFirst = (index: Index): Entry[] => [...index.values()].sort((a, b) => b.at - a.at)

export function createMemoryAdapter(): KeyValueAdapter {
  const values = new Map<Collection, Entry[]>()
  return {
    async get(key) {
      return values.get(key)
    },
    async set(key, entries) {
      values.set(key, entries)
    },
  }
}

function createIndexedDbAdapter(): KeyValueAdapter {
  const store = createStore('repo-radar', 'entries')
  return {
    get: (key) => get<unknown>(key, store),
    set: (key, entries) => set(key, entries, store),
  }
}

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)
}

export class Triage {
  #storage: KeyValueAdapter
  #channel: BroadcastChannel | null
  #ready = $state(false)
  #saved = $state.raw<Index>(new Map())
  #seen = $state.raw<Index>(new Map())
  #undo = $state.raw<UndoRecord[]>([])
  #theme = $state<Theme>('system')
  #version = 0
  // Mutations that arrive before IndexedDB has loaded are replayed once it has.
  #queue: (() => void)[] = []
  #savedList = $derived(newestFirst(this.#saved))
  #seenList = $derived(newestFirst(this.#seen))
  #canUndo = $derived(this.#undo.length > 0)
  #lastAction = $derived.by(() => {
    const top = this.#undo.at(-1)
    return top ? { kind: top.kind, repo: top.repo } : null
  })

  #onMessage = (event: MessageEvent<unknown>): void => {
    if (event.data === CHANGED) this.#run(() => void this.#refresh())
  }

  constructor(
    storage: KeyValueAdapter = typeof indexedDB === 'undefined'
      ? createMemoryAdapter()
      : createIndexedDbAdapter(),
    channel: BroadcastChannel | null = openChannel(),
  ) {
    this.#storage = storage
    this.#channel = channel
    this.#channel?.addEventListener('message', this.#onMessage)
    this.#theme = readPrefs().theme
    applyTheme(this.#theme)
    void this.#init()
  }

  get ready(): boolean {
    return this.#ready
  }

  get saved(): Entry[] {
    return this.#savedList
  }

  get seen(): Entry[] {
    return this.#seenList
  }

  get canUndo(): boolean {
    return this.#canUndo
  }

  get lastAction(): { kind: Action; repo: Repo } | null {
    return this.#lastAction
  }

  get theme(): Theme {
    return this.#theme
  }

  set theme(theme: Theme) {
    this.#theme = theme
    applyTheme(theme)
    patchPrefs({ theme })
  }

  isSaved(name: string): boolean {
    return this.#saved.has(keyOf(name))
  }

  isSeen(name: string): boolean {
    return this.#seen.has(keyOf(name))
  }

  save(repo: Repo): void {
    this.#run(() => this.#move(repo, 'save'))
  }

  dismiss(repo: Repo): void {
    this.#run(() => this.#move(repo, 'dismiss'))
  }

  unsave(name: string): void {
    this.#run(() => this.#remove('saved', name))
  }

  restore(name: string): void {
    this.#run(() => this.#remove('seen', name))
  }

  undo(): void {
    this.#run(() => this.#undoLast())
  }

  clearSaved(): void {
    this.#run(() => this.#clear('saved'))
  }

  clearSeen(): void {
    this.#run(() => this.#clear('seen'))
  }

  exportJson(): string {
    return JSON.stringify({ version: BACKUP_VERSION, saved: this.saved, seen: this.seen }, null, 2)
  }

  importJson(text: string): ImportResult {
    if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
      return { ok: false, error: 'Backup file is larger than 2 MiB' }
    }
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, error: 'Backup file is not valid JSON' }
    }
    if (!isRecord(data) || data.version !== BACKUP_VERSION) {
      return { ok: false, error: 'Unsupported backup format' }
    }
    const savedEntries = normalizeEntries(data.saved)
    const seenEntries = normalizeEntries(data.seen)
    if (!savedEntries || !seenEntries) {
      return { ok: false, error: 'Backup must contain saved and seen lists' }
    }

    const saved = indexEntries(savedEntries)
    const seen = indexEntries(seenEntries, new Set(saved.keys()))
    this.#run(() => {
      this.#saved = saved
      this.#seen = seen
      this.#undo = []
      this.#commit()
    })
    return { ok: true, saved: saved.size, seen: seen.size }
  }

  async #init(): Promise<void> {
    await this.#refresh()
    this.#ready = true
    for (const op of this.#queue.splice(0)) op()
  }

  #run(op: () => void): void {
    if (this.#ready) op()
    else this.#queue.push(op)
  }

  // Re-reads storage until no local write landed during the read, so a stale read never overwrites it.
  async #refresh(): Promise<void> {
    try {
      for (;;) {
        const version = this.#version
        const [savedValue, seenValue] = await Promise.all([
          this.#storage.get('saved'),
          this.#storage.get('seen'),
        ])
        if (version !== this.#version) continue
        const saved = indexEntries(normalizeEntries(savedValue) ?? [])
        this.#saved = saved
        this.#seen = indexEntries(normalizeEntries(seenValue) ?? [], new Set(saved.keys()))
        return
      }
    } catch (error) {
      console.error('GitRadar: could not read saved repos', error)
    }
  }

  #commit(): void {
    this.#version += 1
    void Promise.all([
      this.#storage.set('saved', [...this.#saved.values()]),
      this.#storage.set('seen', [...this.#seen.values()]),
    ]).then(
      () => this.#channel?.postMessage(CHANGED),
      (error: unknown) => console.error('GitRadar: could not save triage data', error),
    )
  }

  #index(collection: Collection): Index {
    return collection === 'saved' ? this.#saved : this.#seen
  }

  #assign(collection: Collection, index: Index): void {
    if (collection === 'saved') this.#saved = index
    else this.#seen = index
  }

  #move(repo: Repo, action: Action): void {
    const target = TARGET[action]
    const source = OTHER[target]
    const key = keyOf(repo.full_name)
    if (this.#index(target).has(key)) return

    // A repo read from component $state is a proxy, which IndexedDB cannot clone.
    const stored = $state.snapshot(repo)
    const at = Date.now()
    const previous = this.#index(source).get(key)
    this.#assign(target, withEntry(this.#index(target), key, { repo: stored, at }))
    if (previous) this.#assign(source, withoutEntry(this.#index(source), key))
    this.#undo = [
      ...this.#undo,
      {
        kind: action,
        repo: stored,
        at,
        previous: previous ? { collection: source, entry: previous } : null,
      },
    ].slice(-UNDO_LIMIT)
    this.#commit()
  }

  #remove(collection: Collection, name: string): void {
    const key = keyOf(name)
    if (!this.#index(collection).has(key)) return
    this.#assign(collection, withoutEntry(this.#index(collection), key))
    this.#commit()
  }

  #clear(collection: Collection): void {
    if (this.#index(collection).size === 0) return
    this.#assign(collection, new Map())
    this.#commit()
  }

  // Records whose effect was undone by other means (unsave, another tab) are skipped.
  #isCurrent(record: UndoRecord): boolean {
    return this.#index(TARGET[record.kind]).get(keyOf(record.repo.full_name))?.at === record.at
  }

  #undoLast(): void {
    const stack = [...this.#undo]
    let record = stack.pop()
    while (record && !this.#isCurrent(record)) record = stack.pop()
    this.#undo = stack
    if (!record) return

    const key = keyOf(record.repo.full_name)
    const target = TARGET[record.kind]
    this.#assign(target, withoutEntry(this.#index(target), key))
    if (record.previous) {
      const { collection, entry } = record.previous
      this.#assign(collection, withEntry(this.#index(collection), key, entry))
    }
    this.#commit()
  }
}

export const triage = new Triage()
