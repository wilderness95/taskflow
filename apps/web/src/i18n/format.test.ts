import { describe, expect, it } from 'vitest'
import { formatDateTime, formatNumber, formatShortDate } from './format'

describe('formatShortDate', () => {
  it('magyar rövid dátumot ad', () => {
    expect(formatShortDate('2026-11-14')).toBe('nov. 14.')
  })
})

describe('formatDateTime', () => {
  it('magyar dátumot és időt ad', () => {
    const text = formatDateTime(new Date(2026, 10, 14, 10, 30).toISOString())
    expect(text).toMatch(/2026\. nov\. 14\./u)
    expect(text).toMatch(/10:30/u)
  })
})

describe('formatNumber', () => {
  it('magyar ezres elválasztót és tizedesvesszőt használ', () => {
    expect(formatNumber(12345.5)).toMatch(/^12\s345,5$/u)
  })
})
