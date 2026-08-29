export interface TrendshiftRepo {
  period_key?: string;
  rank: number;
  score: number;
  full_name: string;
  github_url: string;
  description: string;
  language: string;
  stars_total: number;
  stars_gained: number;
  forks_total: number;
  forks_gained: number;
  created_at: string;
  tags: string[];
  social_mention_platforms: string[];
  timeframe?: 'daily' | 'weekly' | 'monthly';
  language_filter?: string;
}

export type Timeframe = 'daily' | 'weekly' | 'monthly';

export interface SeenEntry {
  key: string;
  repo: TrendshiftRepo;
  seenAt: number;
}

export interface SavedEntry {
  key: string;
  repo: TrendshiftRepo;
  savedAt: number;
}

export type { CatalogResult, CatalogFailure } from './trendshift-client';

export type ViewMode = 'feed' | 'saved' | 'history' | 'settings';


export type LanguageOption =
  | 'all'
  | 'python'
  | 'rust'
  | 'typescript'
  | 'go'
  | 'javascript'
  | 'cpp'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'dart'
  | 'zig';

export interface LanguageMeta {
  id: LanguageOption;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageMeta[] = [
  { id: 'all', label: 'All Languages' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'go', label: 'Go' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'dart', label: 'Dart' },
  { id: 'zig', label: 'Zig' },
];
