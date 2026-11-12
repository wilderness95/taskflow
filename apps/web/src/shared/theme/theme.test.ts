import { describe, expect, it } from 'vitest'
import { parsePreference, resolveTheme } from './theme'

describe('theme', () => {
  it('resolves explicit preferences regardless of the system', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows the system for the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('treats unknown stored values as the system preference', () => {
    expect(parsePreference('light')).toBe('light')
    expect(parsePreference('dark')).toBe('dark')
    expect(parsePreference('blue')).toBe('system')
    expect(parsePreference(null)).toBe('system')
  })
})
