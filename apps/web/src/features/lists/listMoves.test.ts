import { groupListItems, type ListItemDto, type ListSectionDto } from '@taskflow/shared'
import { describe, expect, it } from 'vitest'
import { computeItemMove } from './listMoves'

const item = (id: string, sectionId: string | null, position: string): ListItemDto => ({
  id,
  listId: 'l',
  sectionId,
  text: id,
  done: false,
  recurring: false,
  position,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
})
const section = (id: string, position: string): ListSectionDto => ({
  id,
  listId: 'l',
  title: id,
  position,
})

const groups = groupListItems(
  [section('s1', 'a'), section('s2', 'b')],
  [
    item('x', null, 'a'),
    item('a', 's1', 'a'),
    item('b', 's1', 'b'),
    item('c', 's1', 'c'),
    item('d', 's2', 'a'),
  ],
)

describe('computeItemMove', () => {
  it('moves within a group', () => {
    expect(computeItemMove(groups, 'b', 'up')).toEqual({ sectionId: 's1', beforeItemId: 'a' })
    expect(computeItemMove(groups, 'a', 'down')).toEqual({ sectionId: 's1', beforeItemId: 'c' })
    expect(computeItemMove(groups, 'b', 'down')).toEqual({ sectionId: 's1', beforeItemId: null })
  })

  it('crosses into the neighbouring group at the edges', () => {
    // fel: a szomszéd csoport végére; le: a következő csoport elejére
    expect(computeItemMove(groups, 'a', 'up')).toEqual({ sectionId: null, beforeItemId: null })
    expect(computeItemMove(groups, 'c', 'down')).toEqual({ sectionId: 's2', beforeItemId: 'd' })
    expect(computeItemMove(groups, 'd', 'up')).toEqual({ sectionId: 's1', beforeItemId: null })
  })

  it('returns null at the ends of the list and for unknown items', () => {
    expect(computeItemMove(groups, 'x', 'up')).toBeNull()
    expect(computeItemMove(groups, 'd', 'down')).toBeNull()
    expect(computeItemMove(groups, 'nope', 'up')).toBeNull()
  })
})
