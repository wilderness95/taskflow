import type { BoardDto, CardDto } from '@taskflow/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../api/boards'
import { makeTask } from '../boards/testUtils'
import { saveCard } from './saveCard'

vi.mock('../../api/boards')

const card = (over: Partial<CardDto> = {}): CardDto => ({
  id: 'k1',
  columnId: 'c1',
  title: 'K',
  description: '',
  priority: 'medium',
  dueDate: null,
  coverImage: null,
  position: 'a0',
  labelIds: [],
  assigneeIds: [],
  checklists: [],
  createdAt: '',
  updatedAt: '',
  version: 1,
  ...over,
})

const board = (cards: CardDto[] = []): BoardDto => ({
  id: 'b',
  title: 'T',
  visibility: 'private',
  workspaceId: 'w',
  myRole: 'admin',
  starred: false,
  createdAt: '',
  labels: [{ id: 'l1', boardId: 'b', name: 'UI', color: 'blue' }],
  columns: [
    { id: 'c1', boardId: 'b', title: 'A', accent: 'blue', isDone: false, position: 'a0', cards },
    {
      id: 'c2',
      boardId: 'b',
      title: 'B',
      accent: 'green',
      isDone: false,
      position: 'a1',
      cards: [card({ id: 'first', columnId: 'c2' })],
    },
  ],
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.createCard).mockResolvedValue(card({ id: 'new' }))
  vi.mocked(api.updateCard).mockImplementation(async (id) => card({ id }))
  vi.mocked(api.moveCard).mockImplementation(async (id) => card({ id }))
  vi.mocked(api.createLabel).mockResolvedValue({
    id: 'l2',
    boardId: 'b',
    name: 'UX',
    color: 'green',
  })
  vi.mocked(api.createChecklist).mockResolvedValue({
    id: 'cl',
    cardId: 'new',
    title: 'L',
    position: 'a0',
    items: [],
  })
  vi.mocked(api.createChecklistItem).mockResolvedValue({
    id: 'i',
    checklistId: 'cl',
    text: '',
    done: false,
    position: 'a0',
  })
})

describe('saveCard', () => {
  it('creates a card, reusing known labels and creating missing ones', async () => {
    const task = makeTask('x', {
      tags: [
        { label: 'ui', color: 'purple' },
        { label: 'UX', color: 'green' },
      ],
    })
    await saveCard(board(), { task, columnId: 'c1' })
    expect(api.createLabel).toHaveBeenCalledTimes(1)
    expect(api.createCard).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ labelIds: ['l1', 'l2'], dueDate: null }),
    )
    expect(api.moveCard).not.toHaveBeenCalled()
    expect(api.createChecklist).not.toHaveBeenCalled()
  })

  it('puts a new card before the first one of a non-empty column', async () => {
    await saveCard(board(), { task: makeTask('x'), columnId: 'c2' })
    expect(api.moveCard).toHaveBeenCalledWith('new', {
      columnId: 'c2',
      beforeCardId: 'first',
    })
  })

  it('creates a checklist with items, marking done ones', async () => {
    vi.mocked(api.createChecklistItem)
      .mockResolvedValueOnce({
        id: 'i1',
        checklistId: 'cl',
        text: 'a',
        done: false,
        position: 'a0',
      })
      .mockResolvedValueOnce({
        id: 'i2',
        checklistId: 'cl',
        text: 'b',
        done: false,
        position: 'a1',
      })
    const task = makeTask('x', {
      checklist: {
        title: 'L',
        items: [
          { id: 'tmp1', text: 'a', done: false },
          { id: 'tmp2', text: 'b', done: true },
        ],
      },
    })
    await saveCard(board(), { task, columnId: 'c1' })
    expect(api.createChecklist).toHaveBeenCalledWith('new', { title: 'L' })
    expect(api.createChecklistItem).toHaveBeenCalledTimes(2)
    expect(api.updateChecklistItem).toHaveBeenCalledWith('i2', { done: true })
  })

  it('updates an existing card, moves it between columns and diffs checklist items', async () => {
    const existing = card({
      checklists: [
        {
          id: 'cl',
          cardId: 'k1',
          title: 'Old',
          position: 'a0',
          items: [
            { id: 'keep', checklistId: 'cl', text: 'same', done: false, position: 'a0' },
            { id: 'change', checklistId: 'cl', text: 'old', done: false, position: 'a1' },
            { id: 'gone', checklistId: 'cl', text: 'x', done: false, position: 'a2' },
          ],
        },
      ],
    })
    const task = makeTask('k1', {
      checklist: {
        title: 'New',
        items: [
          { id: 'keep', text: 'same', done: false },
          { id: 'change', text: 'old', done: true },
        ],
      },
    })
    await saveCard(board([existing]), { task, columnId: 'c2', originalColumnId: 'c1' })
    expect(api.updateCard).toHaveBeenCalledWith(
      'k1',
      expect.objectContaining({ title: task.title, version: existing.version }),
    )
    expect(api.moveCard).toHaveBeenCalledWith('k1', {
      columnId: 'c2',
      beforeCardId: 'first',
      version: expect.any(Number),
    })
    expect(api.updateChecklist).toHaveBeenCalledWith('cl', 'New')
    expect(api.deleteChecklistItem).toHaveBeenCalledWith('gone')
    expect(api.updateChecklistItem).toHaveBeenCalledTimes(1)
    expect(api.updateChecklistItem).toHaveBeenCalledWith('change', { text: 'old', done: true })
    expect(api.createChecklistItem).not.toHaveBeenCalled()
  })
})
