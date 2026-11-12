import type { BoardDto, CardDto } from '@taskflow/shared'
import { describe, expect, it } from 'vitest'
import { moveCardInBoard, moveColumnInBoard } from './boardCache'

const card = (id: string, columnId: string): CardDto => ({
  id,
  columnId,
  title: id,
  description: '',
  priority: 'medium',
  dueDate: null,
  coverImage: null,
  position: 'a0',
  labelIds: [],
  checklists: [],
  createdAt: '',
  updatedAt: '',
  version: 1,
})

const column = (id: string, cardIds: string[]) => ({
  id,
  boardId: 'b',
  title: id,
  accent: 'blue' as const,
  isDone: false,
  position: 'a0',
  cards: cardIds.map((cardId) => card(cardId, id)),
})

const board = (): BoardDto => ({
  id: 'b',
  title: 'T',
  visibility: 'private',
  workspaceId: 'w',
  myRole: 'admin',
  starred: false,
  createdAt: '',
  labels: [],
  columns: [column('todo', ['a', 'b', 'c']), column('doing', ['d']), column('done', [])],
})

const ids = (b: BoardDto, columnId: string) =>
  b.columns.find((c) => c.id === columnId)?.cards.map((c) => c.id)

describe('moveCardInBoard', () => {
  it('reorders inside a column, before the target', () => {
    expect(ids(moveCardInBoard(board(), 'c', 'todo', 'a'), 'todo')).toEqual(['c', 'a', 'b'])
    expect(ids(moveCardInBoard(board(), 'a', 'todo', 'c'), 'todo')).toEqual(['b', 'a', 'c'])
  })

  it('moves to another column at a given place, at the end, or into an empty column', () => {
    const toPlace = moveCardInBoard(board(), 'b', 'doing', 'd')
    expect(ids(toPlace, 'todo')).toEqual(['a', 'c'])
    expect(ids(toPlace, 'doing')).toEqual(['b', 'd'])
    expect(ids(moveCardInBoard(board(), 'b', 'doing'), 'doing')).toEqual(['d', 'b'])
    const toEmpty = moveCardInBoard(board(), 'a', 'done')
    expect(ids(toEmpty, 'done')).toEqual(['a'])
    expect(toEmpty.columns[2]?.cards[0]?.columnId).toBe('done')
  })

  it('falls back to the end when the target is unknown and does not mutate the input', () => {
    const original = board()
    const next = moveCardInBoard(original, 'a', 'doing', 'zzz')
    expect(ids(next, 'doing')).toEqual(['d', 'a'])
    expect(ids(original, 'todo')).toEqual(['a', 'b', 'c'])
  })

  it('ignores unknown cards, unknown columns and self targets', () => {
    const original = board()
    expect(moveCardInBoard(original, 'nope', 'todo')).toBe(original)
    expect(moveCardInBoard(original, 'a', 'nope')).toBe(original)
    expect(moveCardInBoard(original, 'a', 'todo', 'a')).toBe(original)
  })
})

describe('moveColumnInBoard', () => {
  const order = (b: BoardDto) => b.columns.map((c) => c.id)

  it('moves a column before another or to the end', () => {
    expect(order(moveColumnInBoard(board(), 'done', 'todo'))).toEqual(['done', 'todo', 'doing'])
    expect(order(moveColumnInBoard(board(), 'todo'))).toEqual(['doing', 'done', 'todo'])
    expect(order(moveColumnInBoard(board(), 'todo', 'done'))).toEqual(['doing', 'todo', 'done'])
  })

  it('ignores unknown columns', () => {
    const original = board()
    expect(moveColumnInBoard(original, 'nope')).toBe(original)
  })
})
