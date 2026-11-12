import { describe, expect, it } from 'vitest'
import { clearableItems, groupListItems, listProgress, resettableItems } from './listItems'
import type { ListItemDto, ListSectionDto } from './schemas/list'

const item = (id: string, over: Partial<ListItemDto> = {}): ListItemDto => ({
  id,
  listId: 'l',
  sectionId: null,
  text: id,
  done: false,
  recurring: false,
  position: id,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})
const section = (id: string, position: string): ListSectionDto => ({
  id,
  listId: 'l',
  title: id,
  position,
})

describe('groupListItems', () => {
  it('puts loose items first, then sections in order (also the empty ones)', () => {
    const groups = groupListItems(
      [section('s2', 'b'), section('s1', 'a')],
      [item('c', { sectionId: 's2' }), item('b'), item('a', { sectionId: 's1' })],
    )
    expect(groups.map((g) => g.section?.id ?? null)).toEqual([null, 's1', 's2'])
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['b'])
  })

  it('omits the loose group when empty and orders items by position', () => {
    const groups = groupListItems(
      [section('s', 'a')],
      [item('y', { sectionId: 's', position: 'b' }), item('x', { sectionId: 's', position: 'a' })],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]!.items.map((i) => i.id)).toEqual(['x', 'y'])
  })

  it('treats items of an unknown section as loose', () => {
    expect(groupListItems([], [item('a', { sectionId: 'gone' })])[0]!.section).toBeNull()
  })
})

describe('recurring helpers', () => {
  const items = [
    item('a', { done: true }),
    item('b', { done: true, recurring: true }),
    item('c', { recurring: true }),
    item('d'),
  ]
  it('splits done items into clearable and resettable', () => {
    expect(clearableItems(items).map((i) => i.id)).toEqual(['a'])
    expect(resettableItems(items).map((i) => i.id)).toEqual(['b'])
  })
  it('counts progress', () => {
    expect(listProgress(items)).toEqual({ done: 2, total: 4 })
  })
})
