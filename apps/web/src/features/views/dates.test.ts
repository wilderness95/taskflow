import { describe, expect, it } from 'vitest'
import { addDays, buildMonthGrid, diffDays, parseIsoDate, shiftMonth, toIsoDate } from './dates'

describe('dates', () => {
  it('oda-vissza alakít és napot léptet hónaphatáron át', () => {
    expect(toIsoDate(parseIsoDate('2026-03-09'))).toBe('2026-03-09')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('a napok különbségét a nyári időszámítás átállásán át is pontosan adja', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2)
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2)
    expect(diffDays('2026-05-02', '2026-05-01')).toBe(-1)
  })

  it('shiftMonth átfordul az évhatáron', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 })
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 })
  })
})

describe('buildMonthGrid', () => {
  it('hétfővel kezd és vasárnappal zár, teljes hetekkel', () => {
    // 2026. november 1. vasárnap: az első hét október 26-án (hétfő) indul
    const grid = buildMonthGrid(2026, 10)
    expect(grid[0]?.[0]).toBe('2026-10-26')
    expect(grid[0]?.[6]).toBe('2026-11-01')
    expect(grid.at(-1)?.[6]).toBe('2026-12-06')
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid.flat()).toContain('2026-11-30')
  })

  it('a hétfőn induló hónap nem kap felesleges előtag-hetet', () => {
    // 2026. június 1. hétfő; 30 nap -> 5 hét
    const grid = buildMonthGrid(2026, 5)
    expect(grid[0]?.[0]).toBe('2026-06-01')
    expect(grid).toHaveLength(5)
  })
})
