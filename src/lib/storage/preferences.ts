import type { LanguageOption } from '../types'

const LANGUAGE_IDS = new Set<LanguageOption>([
  'all',
  'python',
  'rust',
  'typescript',
  'go',
  'javascript',
  'cpp',
  'java',
  'csharp',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'dart',
  'zig',
])

export function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readBooleanPreference(
  storage: Storage | null,
  key: string,
  fallback: boolean,
): boolean {
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    return typeof parsed === 'boolean' ? parsed : fallback
  } catch {
    return fallback
  }
}

export function writeBooleanPreference(
  storage: Storage | null,
  key: string,
  value: boolean,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function readLanguagePreference(storage?: Storage | null): LanguageOption {
  const targetStorage = storage !== undefined ? storage : getBrowserStorage()
  if (!targetStorage) return 'all'
  try {
    const raw = targetStorage.getItem('repo_radar_lang')
    if (raw && LANGUAGE_IDS.has(raw as LanguageOption)) {
      return raw as LanguageOption
    }
    return 'all'
  } catch {
    return 'all'
  }
}

export function writeLanguagePreference(
  value: LanguageOption,
  storage?: Storage | null,
): boolean {
  const targetStorage = storage !== undefined ? storage : getBrowserStorage()
  if (!targetStorage) return false
  try {
    targetStorage.setItem('repo_radar_lang', value)
    return true
  } catch {
    return false
  }
}

export function readThemePreference(storage?: Storage | null): 'dark' | 'light' {
  const targetStorage = storage !== undefined ? storage : getBrowserStorage()
  if (!targetStorage) return 'dark'
  try {
    const raw = targetStorage.getItem('repo_radar_theme')
    return raw === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function writeThemePreference(
  value: 'dark' | 'light',
  storage?: Storage | null,
): boolean {
  const targetStorage = storage !== undefined ? storage : getBrowserStorage()
  if (!targetStorage) return false
  try {
    targetStorage.setItem('repo_radar_theme', value)
    return true
  } catch {
    return false
  }
}
