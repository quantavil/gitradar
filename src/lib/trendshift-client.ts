import { normalizeRepoArray } from './repo-schema'
import type { LanguageOption, Timeframe, TrendshiftRepo } from './types'

const BASE_CDN = 'https://quantavil.github.io/trendshift/data'
const TIMEFRAMES: Timeframe[] = ['daily', 'weekly', 'monthly']
const DEFAULT_TIMEOUT_MS = 10000

export interface CatalogFailure {
  timeframe: Timeframe
  message: string
}

export interface CatalogResult {
  catalog: TrendshiftRepo[]
  successfulTimeframes: Timeframe[]
  failures: CatalogFailure[]
}

export async function fetchTrendshiftCatalog(
  language: LanguageOption,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<CatalogResult> {
  const { signal: callerSignal, timeoutMs = DEFAULT_TIMEOUT_MS } = options

  if (callerSignal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  const childControllers: AbortController[] = []
  const onCallerAbort = () => {
    for (const controller of childControllers) {
      controller.abort()
    }
  }

  if (callerSignal) {
    callerSignal.addEventListener('abort', onCallerAbort, { once: true })
  }

  try {
    const fetchPromises = TIMEFRAMES.map(async (timeframe) => {
      const controller = new AbortController()
      childControllers.push(controller)

      let timer: ReturnType<typeof setTimeout> | undefined

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error(`Request timed out after ${timeoutMs}ms`))
          }, timeoutMs)
        })

        const endpoint = `${BASE_CDN}/${timeframe}/${timeframe}-${language}.json`
        const fetchPromise = fetch(endpoint, {
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          const raw = await response.json()
          const normalized = normalizeRepoArray(raw)
          if (!normalized.ok) {
            throw new Error(normalized.reason)
          }
          return normalized.repos
        })

        return await Promise.race([fetchPromise, timeoutPromise])
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer)
        }
      }
    })

    const settled = await Promise.allSettled(fetchPromises)

    if (callerSignal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    const successful = new Map<Timeframe, TrendshiftRepo[]>()
    const successfulTimeframes: Timeframe[] = []
    const failures: CatalogFailure[] = []

    settled.forEach((result, index) => {
      const timeframe = TIMEFRAMES[index]
      if (result.status === 'fulfilled') {
        successful.set(timeframe, result.value)
        successfulTimeframes.push(timeframe)
      } else {
        const error = result.reason
        failures.push({
          timeframe,
          message:
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : 'Unknown network error',
        })
      }
    })

    const byName = new Map<string, TrendshiftRepo>()
    for (const timeframe of TIMEFRAMES) {
      const source = successful.get(timeframe) ?? []
      for (const repo of source) {
        const key = repo.full_name.toLowerCase()
        if (!byName.has(key)) {
          byName.set(key, { ...repo, timeframe })
        }
      }
    }

    return {
      catalog: Array.from(byName.values()),
      successfulTimeframes,
      failures,
    }
  } finally {
    if (callerSignal) {
      callerSignal.removeEventListener('abort', onCallerAbort)
    }
  }
}
