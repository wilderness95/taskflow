import { describe, expect, it } from 'vitest'
import { EMPTY_BOARD_FILTER } from '@taskflow/shared'
import { applyBoardFilter, countTasks, filterColumns } from './filterColumns'
import { makeColumn, makeTask, taskIdsOf } from './testUtils'
import type { Columns } from './types'

const priorityLabel = (priority: string) =>
  ({ high: 'Magas', medium: 'Közepes', low: 'Alacsony' })[priority] ?? priority

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
    expect(filterColumns(columns, '   ', priorityLabel)).toBe(columns)
  })

  it('címre, kis- és nagybetű függetlenül szűr', () => {
    expect(taskIdsOf(filterColumns(state(), 'LANDING', priorityLabel), 'todo')).toEqual(['a'])
  })

  it('címkére szűr', () => {
    expect(taskIdsOf(filterColumns(state(), 'ui', priorityLabel), 'todo')).toEqual(['a'])
  })

  it('a prioritás megjelenített szövegére szűr', () => {
    expect(taskIdsOf(filterColumns(state(), 'magas', priorityLabel), 'todo')).toEqual(['b'])
  })

  it('az üres oszlopok megmaradnak', () => {
    const result = filterColumns(state(), 'landing', priorityLabel)
    expect(Object.keys(result)).toEqual(['todo', 'done'])
    expect(taskIdsOf(result, 'done')).toEqual([])
  })
})

describe('countTasks', () => {
  it('összeszámolja a kártyákat az összes oszlopban', () => {
    expect(countTasks(state())).toBe(3)
  })
})

describe('applyBoardFilter', () => {
  const columns = (): Columns => ({
    todo: {
      ...makeColumn([]),
      tasks: [
        makeTask('a', { priority: 'high', labelIds: ['l1'] }),
        makeTask('b', { priority: 'low', labelIds: ['l1', 'l2'] }),
        makeTask('c', {
          priority: 'high',
          assignees: [{ id: 'u1', name: 'Olga', avatarUrl: null }],
        }),
      ],
    },
    done: makeColumn([]),
  })

  it('üres szűrőnél ugyanazt az objektumot adja vissza', () => {
    const state = columns()
    expect(applyBoardFilter(state, EMPTY_BOARD_FILTER)).toBe(state)
  })

  it('prioritásra és címkére ÉS kapcsolattal szűr, az oszlopok megmaradnak', () => {
    const result = applyBoardFilter(columns(), {
      ...EMPTY_BOARD_FILTER,
      priorities: ['high'],
      labelIds: ['l1'],
    })
    expect(taskIdsOf(result, 'todo')).toEqual(['a'])
    expect(Object.keys(result)).toEqual(['todo', 'done'])
  })

  it('felelősre szűr', () => {
    const result = applyBoardFilter(columns(), { ...EMPTY_BOARD_FILTER, assigneeIds: ['u1'] })
    expect(taskIdsOf(result, 'todo')).toEqual(['c'])
  })
})
