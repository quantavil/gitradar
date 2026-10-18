import type { Timeframe } from './types'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NEW_REPO_DAYS = 30

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CURRENT_LABELS: Record<Timeframe, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  yearly: 'This year',
}

// GitHub linguist colours for the languages offered in the filter.
const LANGUAGE_COLORS = new Map<string, string>([
  ['python', '#3572A5'],
  ['typescript', '#3178c6'],
  ['javascript', '#f1e05a'],
  ['rust', '#dea584'],
  ['go', '#00ADD8'],
  ['c++', '#f34b7d'],
  ['c', '#555555'],
  ['java', '#b07219'],
  ['c#', '#178600'],
  ['ruby', '#701516'],
  ['php', '#4F5D95'],
  ['swift', '#F05138'],
  ['kotlin', '#A97BFF'],
  ['dart', '#00B4AB'],
  ['zig', '#ec915c'],
])
const NEUTRAL_COLOR = '#8b949e'

function compact(value: number, suffix: string): string {
  const digits = value < 10 ? 1 : 0
  return `${value.toFixed(digits).replace(/\.0$/, '')}${suffix}`
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n < 0) return `-${formatCount(-n)}`
  if (n < 1000) return String(Math.round(n))
  // Values from 999 500 round up to "1000k", so they are promoted to millions.
  if (n < 999_500) return compact(n / 1000, 'k')
  return compact(n / 1_000_000, 'M')
}

export function formatGain(n: number): string {
  return `${n < 0 ? '-' : '+'}${formatCount(Math.abs(n))}`
}

function ageMs(iso: string, now: number): number | null {
  const created = Date.parse(iso)
  return Number.isNaN(created) ? null : Math.max(0, now - created)
}

export function formatAge(iso: string, now: number = Date.now()): string {
  const age = ageMs(iso, now)
  if (age === null) return ''
  if (age < HOUR) return 'now'
  if (age < DAY) return `${Math.floor(age / HOUR)}h`
  const days = Math.floor(age / DAY)
  if (days < 7) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}

export function isNewRepo(iso: string, now: number = Date.now()): boolean {
  const age = ageMs(iso, now)
  return age !== null && age < NEW_REPO_DAYS * DAY
}

function monthName(value: string): string | undefined {
  const index = Number(value) - 1
  return index >= 0 && index < MONTHS.length ? MONTHS[index] : undefined
}

function archiveLabel(key: string, timeframe: Timeframe): string | undefined {
  switch (timeframe) {
    case 'daily': {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
      const month = match ? monthName(match[2]) : undefined
      return match && month ? `${month} ${Number(match[3])}` : undefined
    }
    case 'weekly': {
      const match = /^(\d{4})-W(\d{2})$/.exec(key)
      return match ? `Week ${Number(match[2])} · ${match[1]}` : undefined
    }
    case 'monthly': {
      const match = /^(\d{4})-M(\d{2})$/.exec(key)
      const month = match ? monthName(match[2]) : undefined
      return match && month ? `${month} ${match[1]}` : undefined
    }
    case 'yearly':
      return /^\d{4}$/.test(key) ? key : undefined
  }
}

/** Unrecognised keys fall back to the raw key so a schema change stays visible. */
export function periodLabel(key: string, timeframe: Timeframe, current: boolean): string {
  if (current) return CURRENT_LABELS[timeframe]
  return archiveLabel(key, timeframe) ?? key
}

export function languageColor(language: string): string {
  const name = language.trim().toLowerCase()
  if (name === '') return NEUTRAL_COLOR
  const known = LANGUAGE_COLORS.get(name)
  if (known !== undefined) return known

  let hash = 0
  for (const char of name) {
    hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) | 0
  }
  return `hsl(${(hash >>> 0) % 360} 65% 60%)`
}
