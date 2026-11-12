import type { ListDetailDto } from '@taskflow/shared'
import { describe, expect, it } from 'vitest'
import { patchListItem } from './listCache'

const list: ListDetailDto = {
  id: 'l',
  workspaceId: 'w',
  title: 'T',
  itemCount: 2,
  doneCount: 0,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  myRole: 'owner',
  sections: [],
  items: ['a', 'b'].map((id) => ({
    id,
    listId: 'l',
    sectionId: null,
    text: id,
    done: false,
    recurring: false,
    position: id,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  })),
}

describe('patchListItem', () => {
  it('updates one item and the done counter without touching the input', () => {
    const next = patchListItem(list, 'a', { done: true })
    expect(next.items.find((i) => i.id === 'a')!.done).toBe(true)
    expect(next.items.find((i) => i.id === 'b')!.done).toBe(false)
    expect(next.doneCount).toBe(1)
    expect(list.doneCount).toBe(0)
    expect(list.items[0]!.done).toBe(false)
  })
})
