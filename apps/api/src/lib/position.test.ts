import { describe, expect, it } from 'vitest'
import { AppError } from '../errors.js'
import { positionBefore } from './position.js'

const list = [
  { id: 'a', position: 'a0' },
  { id: 'b', position: 'a1' },
  { id: 'c', position: 'a2' },
]

describe('positionBefore', () => {
  it('appends when no target is given', () => {
    expect(positionBefore(list, 'x') > 'a2').toBe(true)
  })
  it('inserts at the start', () => {
    expect(positionBefore(list, 'x', 'a') < 'a0').toBe(true)
  })
  it('inserts between neighbours', () => {
    const p = positionBefore(list, 'x', 'c')
    expect(p > 'a1' && p < 'a2').toBe(true)
  })
  it('ignores the moving item itself', () => {
    const p = positionBefore(list, 'b', 'c')
    expect(p > 'a0' && p < 'a2').toBe(true)
    expect(positionBefore(list, 'c') > 'a1').toBe(true)
  })
  it('works for an empty list', () => {
    expect(typeof positionBefore([], 'x')).toBe('string')
  })
  it('rejects unknown or self targets', () => {
    expect(() => positionBefore(list, 'x', 'zzz')).toThrow(AppError)
    expect(() => positionBefore(list, 'a', 'a')).toThrow(AppError)
  })
})
