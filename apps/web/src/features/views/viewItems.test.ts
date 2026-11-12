import { describe, expect, it } from 'vitest'
import { makeColumn, makeTask } from '../boards/testUtils'
import type { Columns } from '../boards/types'
import { buildTimeline, flattenColumns, groupByDueDate, MAX_TIMELINE_DAYS } from './viewItems'

const columns = (): Columns => ({
  todo: {
    ...makeColumn([]),
    title: 'Teendő',
    tasks: [
      makeTask('a', { dueDate: '2026-11-10', createdAt: '2026-11-05T10:00:00' }),
      makeTask('b'),
    ],
  },
  done: {
    ...makeColumn([]),
    title: 'Kész',
    done: true,
    tasks: [makeTask('c', { dueDate: '2026-11-10', createdAt: '2026-11-12T10:00:00' })],
  },
})

const TODAY = new Date(2026, 10, 8)

describe('flattenColumns', () => {
  it('az oszlopok és kártyák sorrendjében adja vissza az oszlop adataival', () => {
    expect(flattenColumns(columns()).map((i) => [i.task.id, i.columnTitle, i.done])).toEqual([
      ['a', 'Teendő', false],
      ['b', 'Teendő', false],
      ['c', 'Kész', true],
    ])
  })
})

describe('groupByDueDate', () => {
  it('csak a határidős kártyákat csoportosítja napok szerint', () => {
    const groups = groupByDueDate(flattenColumns(columns()))
    expect([...groups.keys()]).toEqual(['2026-11-10'])
    expect(groups.get('2026-11-10')?.map((i) => i.task.id)).toEqual(['a', 'c'])
  })
})

describe('buildTimeline', () => {
  it('határidő nélkül üres tengely, a kártyák a nem ütemezettek között', () => {
    const timeline = buildTimeline(flattenColumns({ x: makeColumn(['a']) }), TODAY)
    expect(timeline.days).toEqual([])
    expect(timeline.unscheduled).toHaveLength(1)
  })

  it('a sáv a létrehozástól a határidőig tart; a határidőnél későbbi létrehozás egynapos', () => {
    const timeline = buildTimeline(flattenColumns(columns()), TODAY)
    expect(timeline.unscheduled.map((i) => i.task.id)).toEqual(['b'])
    const [a, c] = timeline.rows
    // a tengely a legkorábbi kezdettől (nov. 5.) indul
    expect(timeline.days[0]).toBe('2026-11-05')
    expect(a).toMatchObject({ offset: 0, span: 6 })
    expect(c).toMatchObject({ offset: 5, span: 1 })
  })

  it('legalább két hetes, és a mai napot is tartalmazza', () => {
    const timeline = buildTimeline(flattenColumns(columns()), TODAY)
    expect(timeline.days.length).toBeGreaterThanOrEqual(14)
    expect(timeline.days).toContain('2026-11-08')
  })

  it('a hosszú tengelyt a legkésőbbi határidőtől visszafelé vágja, a sávot levágja', () => {
    const items = flattenColumns({
      x: {
        ...makeColumn([]),
        tasks: [
          makeTask('old', { dueDate: '2026-06-10', createdAt: '2025-01-01T10:00:00' }),
          makeTask('late', { dueDate: '2027-01-30', createdAt: '2027-01-20T10:00:00' }),
        ],
      },
    })
    const timeline = buildTimeline(items, TODAY)
    expect(timeline.days).toHaveLength(MAX_TIMELINE_DAYS)
    expect(timeline.days.at(-1)).toBe('2027-01-30')
    // a tengely előtt véget érő kártya nem rajzolható
    expect(timeline.rows.map((r) => r.item.task.id)).toEqual(['late'])
  })
})
