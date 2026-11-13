import { describe, expect, it } from 'vitest'
import { endOfDayIso, startOfDayIso } from './dayRange'

describe('day range', () => {
  it('covers the whole local day', () => {
    const start = new Date(startOfDayIso('2026-03-10')!)
    const end = new Date(endOfDayIso('2026-03-10')!)
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })

  it('returns undefined for invalid input', () => {
    expect(startOfDayIso('')).toBeUndefined()
    expect(endOfDayIso('not-a-date')).toBeUndefined()
  })
})
