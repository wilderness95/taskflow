import { describe, expect, it } from 'vitest'
import { computeColumnMove, computeTaskMove, directionFromKey } from './keyboardMove'
import { makeColumn } from './testUtils'
import type { Columns } from './types'

const columns = (): Columns => ({
  todo: makeColumn(['a', 'b', 'c']),
  doing: makeColumn(['d']),
  done: makeColumn([]),
})

describe('computeTaskMove', () => {
  it('felfelé a megelőző kártya elé kerül', () => {
    expect(computeTaskMove(columns(), 'todo', 'b', 'up')).toEqual({
      toColumnId: 'todo',
      targetTaskId: 'a',
      position: 1,
      total: 3,
    })
  })

  it('lefelé a következő kártya utánra, azaz a azt követő elé kerül', () => {
    expect(computeTaskMove(columns(), 'todo', 'a', 'down')).toMatchObject({
      targetTaskId: 'c',
      position: 2,
    })
    // az utolsó előttiből az oszlop végére
    expect(computeTaskMove(columns(), 'todo', 'b', 'down')).toMatchObject({
      targetTaskId: null,
      position: 3,
    })
  })

  it('az oszlop szélén nincs mozgás', () => {
    expect(computeTaskMove(columns(), 'todo', 'a', 'up')).toBeNull()
    expect(computeTaskMove(columns(), 'todo', 'c', 'down')).toBeNull()
    expect(computeTaskMove(columns(), 'todo', 'a', 'left')).toBeNull()
    expect(computeTaskMove(columns(), 'done', 'x', 'right')).toBeNull()
  })

  it('oldalra ugyanarra a sorszámra kerül, rövidebb oszlopban a végére', () => {
    expect(computeTaskMove(columns(), 'todo', 'a', 'right')).toEqual({
      toColumnId: 'doing',
      targetTaskId: 'd',
      position: 1,
      total: 2,
    })
    expect(computeTaskMove(columns(), 'todo', 'c', 'right')).toEqual({
      toColumnId: 'doing',
      targetTaskId: null,
      position: 2,
      total: 2,
    })
    expect(computeTaskMove(columns(), 'doing', 'd', 'right')).toMatchObject({
      toColumnId: 'done',
      targetTaskId: null,
      position: 1,
    })
  })

  it('ismeretlen kártyára null', () => {
    expect(computeTaskMove(columns(), 'todo', 'nincs', 'up')).toBeNull()
  })
})

describe('computeColumnMove', () => {
  it('a szomszéd oszlopot adja célnak', () => {
    expect(computeColumnMove(columns(), 'doing', 'right')).toEqual({
      targetColumnId: 'done',
      position: 3,
      total: 3,
    })
    expect(computeColumnMove(columns(), 'doing', 'left')?.targetColumnId).toBe('todo')
  })

  it('a szélén nincs mozgás', () => {
    expect(computeColumnMove(columns(), 'todo', 'left')).toBeNull()
    expect(computeColumnMove(columns(), 'done', 'right')).toBeNull()
  })
})

describe('directionFromKey', () => {
  it('a nyilakat irányra képezi', () => {
    expect(directionFromKey('ArrowUp')).toBe('up')
    expect(directionFromKey('ArrowRight')).toBe('right')
    expect(directionFromKey('Enter')).toBeNull()
  })
})
