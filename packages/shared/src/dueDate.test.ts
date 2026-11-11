import { describe, expect, it } from 'vitest'
import { getDueDateState } from './dueDate'

const now = new Date(2026, 10, 11, 15, 30) // 2026-11-11 délután

describe('getDueDateState', () => {
  it('határidő nélkül "none"', () => {
    expect(getDueDateState('', now)).toBe('none')
    expect(getDueDateState(undefined, now)).toBe('none')
    expect(getDueDateState(null, now)).toBe('none')
  })

  it('tegnapi határidő lejárt', () => {
    expect(getDueDateState('2026-11-10', now)).toBe('overdue')
  })

  it('a mai nap még nem lejárt, hanem "soon"', () => {
    expect(getDueDateState('2026-11-11', now)).toBe('soon')
  })

  it('3 napon belül "soon", utána "normal"', () => {
    expect(getDueDateState('2026-11-14', now)).toBe('soon')
    expect(getDueDateState('2026-11-15', now)).toBe('normal')
  })
})
