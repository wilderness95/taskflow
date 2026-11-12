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
})
