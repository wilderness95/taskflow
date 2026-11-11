import { describe, expect, it } from 'vitest'
import { countTasks, filterColumns } from './filterColumns'
import { makeColumn, makeTask, taskIdsOf } from './testUtils'
import type { Columns } from './types'

const state = (): Columns => ({
  todo: {
    ...makeColumn([]),
    tasks: [
      makeTask('a', { title: 'Landing page', tags: [{ label: 'UI', color: 'blue' }] }),
      makeTask('b', { title: 'Backend', priority: 'high' }),
    ],
  },
  done: makeColumn(['c']),
})

describe('filterColumns', () => {
  it('üres keresésnél ugyanazt az objektumot adja vissza', () => {
    const columns = state()
    expect(filterColumns(columns, '   ')).toBe(columns)
  })

  it('címre, kis- és nagybetű függetlenül szűr', () => {
    expect(taskIdsOf(filterColumns(state(), 'LANDING'), 'todo')).toEqual(['a'])
  })

  it('címkére szűr', () => {
    expect(taskIdsOf(filterColumns(state(), 'ui'), 'todo')).toEqual(['a'])
  })

  it('a prioritás megjelenített szövegére szűr', () => {
    expect(taskIdsOf(filterColumns(state(), 'magas'), 'todo')).toEqual(['b'])
  })

  it('az üres oszlopok megmaradnak', () => {
    const result = filterColumns(state(), 'landing')
    expect(Object.keys(result)).toEqual(['todo', 'done'])
    expect(taskIdsOf(result, 'done')).toEqual([])
  })
})

describe('countTasks', () => {
  it('összeszámolja a kártyákat az összes oszlopban', () => {
    expect(countTasks(state())).toBe(3)
  })
})
