import { describe, expect, it } from 'vitest'
import { boardReducer } from './boardReducer'
import { makeColumn, makeTask, taskIdsOf } from './testUtils'
import type { Columns } from './types'

const baseState = (): Columns => ({
  todo: makeColumn(['a', 'b', 'c']),
  doing: makeColumn(['d']),
  done: makeColumn(['e'], { done: true }),
})

describe('boardReducer: oszlopok', () => {
  it('hozzáad egy üres oszlopot a végére', () => {
    const next = boardReducer(baseState(), {
      type: 'column/added',
      columnId: 'new',
      title: 'Új',
      accent: 'rose',
    })
    expect(Object.keys(next)).toEqual(['todo', 'doing', 'done', 'new'])
    expect(next.new).toEqual({ title: 'Új', accent: 'rose', done: false, tasks: [] })
  })

  it('átnevezi az oszlopot és színt vált', () => {
    const next = boardReducer(baseState(), {
      type: 'column/updated',
      columnId: 'todo',
      title: 'Más',
      accent: 'green',
    })
    expect(next.todo).toMatchObject({ title: 'Más', accent: 'green' })
    expect(taskIdsOf(next, 'todo')).toEqual(['a', 'b', 'c'])
  })

  it('nem létező oszlop módosítása nem változtat az állapoton', () => {
    const state = baseState()
    expect(
      boardReducer(state, { type: 'column/updated', columnId: 'x', title: 't', accent: 'blue' }),
    ).toBe(state)
  })

  it('törlésnél a kártyák az előző oszlop végére kerülnek', () => {
    const next = boardReducer(baseState(), { type: 'column/deleted', columnId: 'doing' })
    expect(Object.keys(next)).toEqual(['todo', 'done'])
    expect(taskIdsOf(next, 'todo')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('az első oszlop törlésekor a következő oszlopba kerülnek a kártyák', () => {
    const next = boardReducer(baseState(), { type: 'column/deleted', columnId: 'todo' })
    expect(Object.keys(next)).toEqual(['doing', 'done'])
    expect(taskIdsOf(next, 'doing')).toEqual(['d', 'a', 'b', 'c'])
  })

  it('az utolsó oszlopot nem lehet törölni', () => {
    const state: Columns = { only: makeColumn(['a']) }
    expect(boardReducer(state, { type: 'column/deleted', columnId: 'only' })).toBe(state)
  })

  it('átrendezi az oszlopokat', () => {
    const next = boardReducer(baseState(), {
      type: 'column/reordered',
      sourceColumnId: 'done',
      targetColumnId: 'todo',
    })
    expect(Object.keys(next)).toEqual(['done', 'todo', 'doing'])
  })

  it('önmagára húzott oszlop nem változtat az állapoton', () => {
    const state = baseState()
    expect(
      boardReducer(state, {
        type: 'column/reordered',
        sourceColumnId: 'todo',
        targetColumnId: 'todo',
      }),
    ).toBe(state)
  })
})

describe('boardReducer: kártyák mozgatása', () => {
  it('oszlopon belül a célkártya elé szúrja be', () => {
    const next = boardReducer(baseState(), {
      type: 'task/moved',
      taskId: 'c',
      fromColumnId: 'todo',
      toColumnId: 'todo',
      targetTaskId: 'a',
    })
    expect(taskIdsOf(next, 'todo')).toEqual(['c', 'a', 'b'])
  })

  it('oszlopon belül célkártya nélkül a végére teszi', () => {
    const next = boardReducer(baseState(), {
      type: 'task/moved',
      taskId: 'a',
      fromColumnId: 'todo',
      toColumnId: 'todo',
    })
    expect(taskIdsOf(next, 'todo')).toEqual(['b', 'c', 'a'])
  })

  it('oszlopok között a célkártya elé kerül', () => {
    const next = boardReducer(baseState(), {
      type: 'task/moved',
      taskId: 'a',
      fromColumnId: 'todo',
      toColumnId: 'doing',
      targetTaskId: 'd',
    })
    expect(taskIdsOf(next, 'todo')).toEqual(['b', 'c'])
    expect(taskIdsOf(next, 'doing')).toEqual(['a', 'd'])
  })

  it('oszlopok között célkártya nélkül az oszlop végére kerül', () => {
    const next = boardReducer(baseState(), {
      type: 'task/moved',
      taskId: 'a',
      fromColumnId: 'todo',
      toColumnId: 'doing',
    })
    expect(taskIdsOf(next, 'doing')).toEqual(['d', 'a'])
  })

  it('a "kész" oszlopba húzott kártya késznek számít, onnan kivéve nem', () => {
    const intoDone = boardReducer(baseState(), {
      type: 'task/moved',
      taskId: 'a',
      fromColumnId: 'todo',
      toColumnId: 'done',
    })
    expect(intoDone.done?.tasks.find((task) => task.id === 'a')?.done).toBe(true)

    const outOfDone = boardReducer(intoDone, {
      type: 'task/moved',
      taskId: 'a',
      fromColumnId: 'done',
      toColumnId: 'todo',
    })
    expect(outOfDone.todo?.tasks.find((task) => task.id === 'a')?.done).toBe(false)
  })

  it('nem létező kártya mozgatása nem változtat az állapoton', () => {
    const state = baseState()
    expect(
      boardReducer(state, {
        type: 'task/moved',
        taskId: 'zzz',
        fromColumnId: 'todo',
        toColumnId: 'doing',
      }),
    ).toBe(state)
  })

  it('nem módosítja az eredeti állapotot', () => {
    const state = baseState()
    boardReducer(state, {
      type: 'task/moved',
      taskId: 'a',
      fromColumnId: 'todo',
      toColumnId: 'doing',
    })
    expect(taskIdsOf(state, 'todo')).toEqual(['a', 'b', 'c'])
    expect(taskIdsOf(state, 'doing')).toEqual(['d'])
  })
})

describe('boardReducer: kártyák mentése és törlése', () => {
  it('új kártyát az oszlop elejére szúr', () => {
    const next = boardReducer(baseState(), {
      type: 'task/saved',
      task: makeTask('n'),
      columnId: 'todo',
    })
    expect(taskIdsOf(next, 'todo')).toEqual(['n', 'a', 'b', 'c'])
  })

  it('szerkesztésnél helyben frissíti a kártyát, és megtartja a nem módosított mezőket', () => {
    const state = baseState()
    state.todo = {
      ...makeColumn([]),
      tasks: [makeTask('a', { coverImage: 'cover.png' }), makeTask('b')],
    }
    const next = boardReducer(state, {
      type: 'task/saved',
      task: makeTask('a', { title: 'Új cím' }),
      columnId: 'todo',
      originalColumnId: 'todo',
    })
    expect(taskIdsOf(next, 'todo')).toEqual(['a', 'b'])
    expect(next.todo?.tasks[0]).toMatchObject({ title: 'Új cím', coverImage: 'cover.png' })
  })

  it('szerkesztésnél másik oszlopba váltva az új oszlop elejére kerül', () => {
    const next = boardReducer(baseState(), {
      type: 'task/saved',
      task: makeTask('b', { title: 'Átrakva' }),
      columnId: 'doing',
      originalColumnId: 'todo',
    })
    expect(taskIdsOf(next, 'todo')).toEqual(['a', 'c'])
    expect(taskIdsOf(next, 'doing')).toEqual(['b', 'd'])
  })

  it('törli a kártyát', () => {
    const next = boardReducer(baseState(), { type: 'task/deleted', columnId: 'todo', taskId: 'b' })
    expect(taskIdsOf(next, 'todo')).toEqual(['a', 'c'])
  })
})
