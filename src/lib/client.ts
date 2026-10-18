import { normalizeRepos } from './repo-schema'
import type { Repo, Timeframe } from './types'

const BASE_URL = 'https://quantavil.github.io/trendshift/data'
const DEFAULT_TIMEOUT_MS = 10_000

const archives = new Map<string, Repo[]>()

export function archiveUrl(timeframe: Timeframe, language: string): string {
  return `${BASE_URL}/${timeframe}/${timeframe}-${language}.json`
}

export function clearArchiveCache(): void {
  archives.clear()
}

/** Resolves the validated repositories of one archive file, in file (newest-first) order. */
export async function fetchArchive(
  timeframe: Timeframe,
  language: string,
  { signal, timeoutMs = DEFAULT_TIMEOUT_MS }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Repo[]> {
  const key = `${timeframe}:${language}`
  const cached = archives.get(key)
  if (cached) return cached

  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', forwardAbort, { once: true })
  if (signal?.aborted) forwardAbort()

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(archiveUrl(timeframe, language), { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const repos = normalizeRepos(await response.json())
    if (!repos) throw new Error('Archive is not a list of repositories')
    archives.set(key, repos)
    return repos
  } catch (error) {
    if (timedOut) throw new Error(`Request timed out after ${timeoutMs}ms`)
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
