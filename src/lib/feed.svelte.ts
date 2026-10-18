import { fetchArchive } from './client'
import { periodLabel } from './format'
import { patchPrefs, readPrefs, triage as sharedTriage, type Triage } from './triage.svelte'
import type { Period, Repo, SortKey, Timeframe } from './types'

type FeedStatus = 'idle' | 'loading' | 'ready' | 'error'

interface Archive {
  timeframe: Timeframe
  repos: Repo[]
}

interface Group {
  key: string
  repos: Repo[]
}

// The archive is newest-first, so the first appearance of a repo is its newest one.
function groupByPeriod(repos: Repo[]): Group[] {
  const seen = new Set<string>()
  const groups: Group[] = []
  for (const repo of repos) {
    const name = repo.full_name.toLowerCase()
    if (seen.has(name)) continue
    seen.add(name)
    const last = groups.at(-1)
    if (last?.key === repo.period_key) last.repos.push(repo)
    else groups.push({ key: repo.period_key, repos: [repo] })
  }
  return groups
}

const createdTime = (repo: Repo): number => {
  const time = Date.parse(repo.created_at)
  return Number.isNaN(time) ? 0 : time
}

const SORT_COMPARERS: Record<SortKey, (a: Repo, b: Repo) => number> = {
  trending: (a, b) => a.rank - b.rank,
  gained: (a, b) => b.stars_gained - a.stars_gained || a.rank - b.rank,
  newest: (a, b) => createdTime(b) - createdTime(a) || a.rank - b.rank,
}

export class Feed {
  readonly #triage: Triage
  #timeframe = $state<Timeframe>('daily')
  #language = $state('all')
  #sort = $state<SortKey>('trending')
  #status = $state<FeedStatus>('idle')
  #error = $state<string | null>(null)
  // Kept on failure so the last good archive stays on screen.
  #archive = $state.raw<Archive | null>(null)
  #controller: AbortController | null = null

  readonly #groups = $derived.by(() => (this.#archive ? groupByPeriod(this.#archive.repos) : []))
  readonly #pending = $derived.by(() =>
    this.#groups.map((group) => ({
      key: group.key,
      repos: group.repos.filter(
        (repo) => !this.#triage.isSaved(repo.full_name) && !this.#triage.isSeen(repo.full_name),
      ),
    })),
  )
  readonly #periods = $derived.by((): Period[] => {
    if (!this.#archive) return []
    const timeframe = this.#archive.timeframe
    const compare = SORT_COMPARERS[this.#sort]
    return this.#pending.flatMap((group, index) => {
      const current = index === 0
      // The current period stays even when fully triaged so its progress strip remains visible.
      if (group.repos.length === 0 && !current) return []
      return [
        {
          key: group.key,
          label: periodLabel(group.key, timeframe, current),
          current,
          repos: [...group.repos].sort(compare),
        },
      ]
    })
  })
  readonly #currentTotal = $derived(this.#groups[0]?.repos.length ?? 0)
  readonly #currentRemaining = $derived(this.#pending[0]?.repos.length ?? 0)

  constructor(triage: Triage = sharedTriage) {
    this.#triage = triage
    const prefs = readPrefs()
    this.#timeframe = prefs.timeframe
    this.#language = prefs.language
    this.#sort = prefs.sort
  }

  get timeframe(): Timeframe {
    return this.#timeframe
  }

  get language(): string {
    return this.#language
  }

  get sort(): SortKey {
    return this.#sort
  }

  get status(): FeedStatus {
    return this.#status
  }

  get error(): string | null {
    return this.#error
  }

  get periods(): Period[] {
    return this.#periods
  }

  get currentTotal(): number {
    return this.#currentTotal
  }

  get currentRemaining(): number {
    return this.#currentRemaining
  }

  get currentTriaged(): number {
    return this.#currentTotal - this.#currentRemaining
  }

  async load(): Promise<void> {
    const timeframe = this.#timeframe
    const language = this.#language
    this.#controller?.abort()
    const controller = new AbortController()
    this.#controller = controller
    this.#status = 'loading'
    this.#error = null

    try {
      const repos = await fetchArchive(timeframe, language, { signal: controller.signal })
      if (controller.signal.aborted) return
      this.#archive = { timeframe, repos }
      this.#status = 'ready'
    } catch (error) {
      // A superseded load must not overwrite the status of the load that replaced it.
      if (controller.signal.aborted) return
      this.#status = 'error'
      this.#error = error instanceof Error ? error.message : 'Could not load repositories'
    } finally {
      if (this.#controller === controller) this.#controller = null
    }
  }

  setTimeframe(timeframe: Timeframe): void {
    if (timeframe === this.#timeframe) return
    this.#timeframe = timeframe
    patchPrefs({ timeframe })
    void this.load()
  }

  setLanguage(language: string): void {
    if (language === this.#language) return
    this.#language = language
    patchPrefs({ language })
    void this.load()
  }

  setSort(sort: SortKey): void {
    if (sort === this.#sort) return
    this.#sort = sort
    patchPrefs({ sort })
  }
}

export const feed = new Feed()
