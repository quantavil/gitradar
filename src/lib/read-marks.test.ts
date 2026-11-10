import { describe, expect, it } from 'vitest'
import { readNamesByPeriod, sameRead } from './read-marks'

// Bottom edges by repo name; a name missing from the map is treated as not rendered.
const bottoms = (map: Record<string, number>) => (name: string) => map[name]

describe('readNamesByPeriod', () => {
  it('counts a later period by its own rows, not by the first period header', () => {
    const result = readNamesByPeriod(
      [
        { key: 'p1', names: ['a', 'b', 'c'] },
        { key: 'p2', names: ['x', 'y', 'z'] },
      ],
      bottoms({ a: 10, b: 20, c: 30, x: 40, y: 60, z: 300 }),
      100,
    )
    // Each period gives up its row nearest the line, so the last read row of each is held back.
    expect(result).toEqual({ p1: ['a', 'b'], p2: ['x'] })
  })

  it('holds back only one row per period', () => {
    const result = readNamesByPeriod([{ key: 'p1', names: ['a', 'b', 'c', 'd'] }], bottoms({ a: 10, b: 20, c: 30, d: 300 }), 100)
    expect(result).toEqual({ p1: ['a', 'b'] })
  })

  it('stops measuring at the first row below the line', () => {
    const measured: string[] = []
    const lookup = bottoms({ a: 10, b: 500, c: 20 })
    readNamesByPeriod(
      [{ key: 'p1', names: ['a', 'b', 'c'] }],
      (name) => {
        measured.push(name)
        return lookup(name)
      },
      100,
    )
    expect(measured).toEqual(['a', 'b'])
  })

  it('does not stop at a row that is not rendered', () => {
    const result = readNamesByPeriod([{ key: 'p1', names: ['a', 'missing', 'b', 'c'] }], bottoms({ a: 10, b: 20, c: 30 }), 100)
    expect(result).toEqual({ p1: ['a', 'b'] })
  })

  it('leaves out periods with no read row, and reports nothing when no row has passed the line', () => {
    expect(readNamesByPeriod([{ key: 'p1', names: ['a'] }], bottoms({ a: 10 }), 100)).toEqual({})
    expect(readNamesByPeriod([{ key: 'p1', names: ['a', 'b'] }], bottoms({ a: 200, b: 300 }), 100)).toEqual({})
  })

  it('counts a row whose bottom is within one pixel of the line, which covers sub-pixel rounding', () => {
    const result = readNamesByPeriod(
      [{ key: 'p1', names: ['a', 'b', 'c'] }],
      bottoms({ a: 10, b: 100.5, c: 300 }),
      100,
    )
    // Both a and b are read; b is then the row nearest the line, so it is the one held back.
    expect(result).toEqual({ p1: ['a'] })
  })
})

describe('sameRead', () => {
  it('is true for the same names in the same order under the same keys', () => {
    expect(sameRead({ p: ['a', 'b'] }, { p: ['a', 'b'] })).toBe(true)
    expect(sameRead({}, {})).toBe(true)
  })

  it('is false for a different set of the same size', () => {
    expect(sameRead({ p: ['a'] }, { p: ['b'] })).toBe(false)
  })

  it('is false for the same names in another order', () => {
    expect(sameRead({ p: ['a', 'b'] }, { p: ['b', 'a'] })).toBe(false)
  })

  it('is false when the period keys or the number of periods differ', () => {
    expect(sameRead({ p: ['a'] }, { q: ['a'] })).toBe(false)
    expect(sameRead({ p: ['a'] }, { p: ['a'], q: ['b'] })).toBe(false)
  })
})
