export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly'

export const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: 'daily', label: 'Today' },
  { id: 'weekly', label: 'Week' },
  { id: 'monthly', label: 'Month' },
  { id: 'yearly', label: 'Year' },
]

export interface LanguageMeta {
  id: string
  label: string
  /** Trigger text under 720px; the popup keeps the full label. */
  short?: string
}

export const LANGUAGES: LanguageMeta[] = [
  { id: 'all', label: 'All languages', short: 'All' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'go', label: 'Go' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'dart', label: 'Dart' },
  { id: 'zig', label: 'Zig' },
]

export type SortKey = 'trending' | 'gained' | 'newest'

export const SORTS: { id: SortKey; label: string; short?: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'gained', label: 'Most stars gained', short: 'Stars gained' },
  { id: 'newest', label: 'Newest repos', short: 'Newest' },
]

export type View = 'discover' | 'saved' | 'seen' | 'settings'
export type Theme = 'system' | 'light' | 'dark' | 'nord' | 'dracula' | 'solarized' | 'rosepine'

export interface ThemeMeta {
  id: Theme
  label: string
  /** Page background, text and accent colours for the Settings swatch and the browser chrome. */
  swatch: [bg: string, ink: string, accent: string]
}

export const THEMES: ThemeMeta[] = [
  { id: 'system', label: 'System', swatch: ['#f6f5f1', '#161614', '#c2410c'] },
  { id: 'light', label: 'Light', swatch: ['#f6f5f1', '#161614', '#c2410c'] },
  { id: 'dark', label: 'Dark', swatch: ['#0e0e0d', '#ecebe6', '#ff7a3d'] },
  { id: 'nord', label: 'Nord', swatch: ['#2e3440', '#eceff4', '#88c0d0'] },
  { id: 'dracula', label: 'Dracula', swatch: ['#282a36', '#f8f8f2', '#bd93f9'] },
  { id: 'solarized', label: 'Solarized', swatch: ['#fdf6e3', '#073642', '#cb4b16'] },
  { id: 'rosepine', label: 'Rosé Pine', swatch: ['#191724', '#e0def4', '#ebbcba'] },
]

export interface Repo {
  period_key: string
  rank: number
  score: number
  full_name: string
  github_url: string
  description: string
  language: string
  stars_total: number
  stars_gained: number
  forks_total: number
  forks_gained: number
  created_at: string
  tags: string[]
  social_mention_platforms: string[]
}

export interface Period {
  key: string
  label: string
  current: boolean
  repos: Repo[]
}

export interface Entry {
  repo: Repo
  at: number
}
