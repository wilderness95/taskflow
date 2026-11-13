import { describe, expect, it } from 'vitest'
import { buildSystemInstruction } from './systemInstruction.js'

describe('buildSystemInstruction', () => {
  it('contains the current date with weekday and the viewed board', () => {
    const text = buildSystemInstruction({
      now: new Date(2026, 10, 12, 9, 0),
      boardId: 'b-1',
      boardTitle: 'Sprint',
    })
    expect(text).toContain('Thursday, 2026-11-12')
    expect(text).toContain('"Sprint" (boardId: b-1)')
  })

  it('tells the model to use the list tools for lists instead of creating boards', () => {
    const text = buildSystemInstruction({ now: new Date(2026, 10, 12, 9, 0) })
    expect(text).toContain('create_list')
    expect(text).toMatch(/never create a board or cards for it/)
    expect(text).toContain('bevásárlólista')
  })
})
