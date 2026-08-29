import { describe, expect, it } from 'vitest'
import {
  readBooleanPreference,
  readLanguagePreference,
  readThemePreference,
  writeBooleanPreference,
  writeLanguagePreference,
  writeThemePreference,
} from './preferences'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial))
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe('storage preferences', () => {
  it('returns the default when localStorage throws', () => {
    const storage = {
      getItem() {
        throw new DOMException('denied')
      },
      setItem() {
        throw new DOMException('denied')
      },
      clear() {},
      key() {
        return null
      },
      length: 0,
      removeItem() {},
    } as Storage

    expect(readBooleanPreference(storage, 'auto_seen_on_scroll', true)).toBe(true)
    expect(readBooleanPreference(storage, 'auto_seen_on_scroll', false)).toBe(false)
    expect(writeBooleanPreference(storage, 'auto_seen_on_scroll', true)).toBe(false)
  })

  it('rejects a non-boolean JSON preference', () => {
    const storage = memoryStorage({ auto_seen_on_scroll: '"yes"' })
    expect(readBooleanPreference(storage, 'auto_seen_on_scroll', true)).toBe(true)

    const storageNumber = memoryStorage({ auto_seen_on_scroll: '123' })
    expect(readBooleanPreference(storageNumber, 'auto_seen_on_scroll', false)).toBe(false)
  })

  it('reads and writes boolean preferences correctly', () => {
    const storage = memoryStorage()
    expect(readBooleanPreference(storage, 'swipe_gestures_enabled', true)).toBe(true)
    expect(writeBooleanPreference(storage, 'swipe_gestures_enabled', false)).toBe(true)
    expect(readBooleanPreference(storage, 'swipe_gestures_enabled', true)).toBe(false)
  })

  it('accepts only known language values', () => {
    const storage = memoryStorage({ repo_radar_lang: 'not-a-language' })
    expect(readLanguagePreference(storage)).toBe('all')

    const validStorage = memoryStorage({ repo_radar_lang: 'typescript' })
    expect(readLanguagePreference(validStorage)).toBe('typescript')

    expect(writeLanguagePreference('rust', validStorage)).toBe(true)
    expect(readLanguagePreference(validStorage)).toBe('rust')
  })

  it('reads and writes theme preferences with fallback to dark', () => {
    const storage = memoryStorage()
    expect(readThemePreference(storage)).toBe('dark')

    const lightStorage = memoryStorage({ repo_radar_theme: 'light' })
    expect(readThemePreference(lightStorage)).toBe('light')

    const invalidStorage = memoryStorage({ repo_radar_theme: 'sepia' })
    expect(readThemePreference(invalidStorage)).toBe('dark')

    expect(writeThemePreference('light', storage)).toBe(true)
    expect(readThemePreference(storage)).toBe('light')
  })
})
