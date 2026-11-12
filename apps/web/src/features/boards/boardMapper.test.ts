import type { BoardDto } from '@taskflow/shared'
import { describe, expect, it } from 'vitest'
import { toColumns } from './boardMapper'

const board: BoardDto = {
  id: 'b',
  title: 'T',
  visibility: 'private',
  workspaceId: 'w',
  myRole: 'admin',
  starred: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  labels: [{ id: 'l1', boardId: 'b', name: 'UI', color: 'blue' }],
  columns: [
    {
      id: 'c1',
      boardId: 'b',
      title: 'Teendők',
      accent: 'blue',
      isDone: false,
      position: 'a0',
      cards: [],
    },
    {
      id: 'c2',
      boardId: 'b',
      title: 'Kész',
      accent: 'green',
      isDone: true,
      position: 'a1',
      cards: [
        {
          id: 'k1',
          columnId: 'c2',
          title: 'Kártya',
          description: 'Leírás',
          priority: 'high',
          dueDate: null,
          coverImage: null,
          coverAttachmentId: null,
          attachmentCount: 0,
          position: 'a0',
          labelIds: ['l1', 'missing'],
          assigneeIds: ['u1'],
          checklists: [
            {
              id: 'cl',
              cardId: 'k1',
              title: 'Lista',
              position: 'a0',
              items: [{ id: 'i1', checklistId: 'cl', text: 'Egy', done: true, position: 'a0' }],
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          version: 1,
        },
      ],
    },
  ],
}

describe('toColumns', () => {
  it('keeps column order and maps column fields', () => {
    const columns = toColumns(board)
    expect(Object.keys(columns)).toEqual(['c1', 'c2'])
    expect(columns.c2).toMatchObject({ title: 'Kész', accent: 'green', done: true })
  })

  it('falls back to a placeholder for assignees missing from the participants', () => {
    const [task] = toColumns(board).c2!.tasks
    expect(task!.assignees).toEqual([{ id: 'u1', name: '?', avatarUrl: null }])
  })

  it('maps cards with labels, checklist and the done flag of the column', () => {
    const [task] = toColumns(board, [{ id: 'u1', name: 'Olga', avatarUrl: null }]).c2!.tasks
    expect(task).toEqual({
      id: 'k1',
      title: 'Kártya',
      description: 'Leírás',
      priority: 'high',
      tags: [{ label: 'UI', color: 'blue' }],
      assignees: [{ id: 'u1', name: 'Olga', avatarUrl: null }],
      dueDate: undefined,
      coverImage: undefined,
      attachmentCount: 0,
      done: true,
      version: 1,
      checklists: [{ id: 'cl', title: 'Lista', items: [{ id: 'i1', text: 'Egy', done: true }] }],
    })
  })
})
