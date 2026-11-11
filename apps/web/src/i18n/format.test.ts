import { describe, expect, it } from 'vitest'
import { formatNumber, formatShortDate } from './format'

describe('formatShortDate', () => {
  it('magyar rövid dátumot ad', () => {
    expect(formatShortDate('2026-11-14')).toBe('nov. 14.')
  })
})

describe('formatNumber', () => {
  it('magyar ezres elválasztót és tizedesvesszőt használ', () => {
    expect(formatNumber(12345.5)).toMatch(/^12\s345,5$/u)
  })
})
