import { describe, expect, it } from 'vitest'
import { DEFAULT_PRIORITY, isPriority } from './priority'

describe('isPriority', () => {
  it('elfogadja az érvényes értékeket', () => {
    expect(isPriority('high')).toBe(true)
    expect(isPriority('medium')).toBe(true)
    expect(isPriority('low')).toBe(true)
  })

  it('elutasít minden mást, a régi magyar értékeket is', () => {
    expect(isPriority('Magas')).toBe(false)
    expect(isPriority('')).toBe(false)
    expect(isPriority(undefined)).toBe(false)
  })

  it('az alapértelmezett érték érvényes', () => {
    expect(isPriority(DEFAULT_PRIORITY)).toBe(true)
  })
})
