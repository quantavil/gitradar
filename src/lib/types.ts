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
}

export const LANGUAGES: LanguageMeta[] = [
  { id: 'all', label: 'All languages' },
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

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'gained', label: 'Most stars gained' },
  { id: 'newest', label: 'Newest repos' },
]

export type View = 'discover' | 'saved' | 'seen' | 'settings'
export type Social = 'hackernews' | 'reddit' | 'x'
export type Theme = 'system' | 'light' | 'dark'

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
