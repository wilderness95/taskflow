import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatFileSize,
  formatMinutes,
  formatNumber,
  formatShortDate,
} from './format'

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

describe('formatFileSize', () => {
  it('bájtot, KB-ot és MB-ot ad', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1536)).toBe('1,5 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
  })
})

describe('formatMinutes', () => {
  it('ezredmásodpercet percre alakít egy tizedessel', () => {
    expect(formatMinutes(90_000)).toMatch(/^1,5\s?p/u)
    expect(formatMinutes(0)).toMatch(/^0\s?p/u)
  })
})
