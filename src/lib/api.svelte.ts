import { fetchTrendshiftCatalog } from './trendshift-client'
import { seenStore, SeenStore } from './seen.svelte'
import { readLanguagePreference, writeLanguagePreference } from './storage/preferences'
import type { CatalogResult, LanguageOption, Timeframe, TrendshiftRepo } from './types'

export type CatalogFetcher = (
  language: LanguageOption,
  options?: { signal?: AbortSignal; timeoutMs?: number },
) => Promise<CatalogResult>

export class RepoFeed {
  catalog = $state<TrendshiftRepo[]>([])
  successfulTimeframes = $state<Timeframe[]>([])
  loading = $state<boolean>(false)
  error = $state<string | null>(null)
  selectedLanguage = $state<LanguageOption>('all')

  private client: CatalogFetcher
  private seenStore: SeenStore
  private activeController: AbortController | null = null
  private _fetchId = 0

  constructor(
    client: CatalogFetcher = fetchTrendshiftCatalog,
    seen: SeenStore = seenStore,
  ) {
    this.client = client
    this.seenStore = seen
    this.selectedLanguage = readLanguagePreference()
  }

  get repos(): TrendshiftRepo[] {
    return this.catalog.filter((repo) => !this.seenStore.isSeen(repo.full_name))
  }

  get totalCount(): number {
    return this.catalog.length
  }

  get remainingCount(): number {
    return this.repos.length
  }

  async setLanguage(lang: LanguageOption) {
    this.selectedLanguage = lang
    writeLanguagePreference(lang)
    await this.fetchFeed()
  }

  cancel() {
    if (this.activeController) {
      this.activeController.abort()
      this.activeController = null
    }
  }

  async fetchFeed() {
    this.cancel()

    const controller = new AbortController()
    this.activeController = controller
    const fetchId = ++this._fetchId

    this.loading = true
    this.error = null

    try {
      const result = await this.client(this.selectedLanguage, {
        signal: controller.signal,
      })

      if (fetchId !== this._fetchId) return

      if (result.successfulTimeframes.length === 0) {
        // Total outage: keep the last good feed and surface the first real cause.
        this.error =
          result.failures[0]?.message ||
          'Failed to load repository feed. Please check your network connection and try again.'
        return
      }

      this.catalog = result.catalog
      this.successfulTimeframes = result.successfulTimeframes

      this.error = null
      const seenInCatalog = result.catalog.filter((repo: TrendshiftRepo) =>
        this.seenStore.isSeen(repo.full_name),
      )
      if (seenInCatalog.length > 0) {
        void this.seenStore.enrichSeenDetails(seenInCatalog)
      }
    } catch (err: unknown) {
      if (fetchId !== this._fetchId) return
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      this.error =
        err instanceof Error
          ? err.message
          : 'Failed to load repository feed. Please check your network connection and try again.'
    } finally {
      if (fetchId === this._fetchId) {
        this.loading = false
        this.activeController = null
      }
    }
  }
}

export const repoFeed = new RepoFeed()
