import { describe, expect, it } from 'vitest'
import { scopeAllows } from './apiKeys'

describe('scopeAllows', () => {
  it('requires the exact scope', () => {
    expect(scopeAllows(['boards:read'], 'boards:read')).toBe(true)
    expect(scopeAllows(['boards:read'], 'boards:write')).toBe(false)
    expect(scopeAllows(['workspaces:read'], 'boards:read')).toBe(false)
  })
  it('write implies board read', () => {
    expect(scopeAllows(['boards:write'], 'boards:read')).toBe(true)
    expect(scopeAllows(['boards:write'], 'workspaces:read')).toBe(false)
  })
})
