import { describe, expect, it } from 'vitest'
import { parseTags } from './tags'

describe('parseTags', () => {
  it('üres vagy hiányzó bemenetre üres listát ad', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags(undefined)).toEqual([])
    expect(parseTags(null)).toEqual([])
  })

  it('felbontja, trimmeli és kiszűri az üres elemeket', () => {
    expect(parseTags(' UI ,, UX , ').map((tag) => tag.label)).toEqual(['UI', 'UX'])
  })

  it('a színeket sorban osztja ki', () => {
    expect(parseTags('a, b').map((tag) => tag.color)).toEqual(['blue', 'amber'])
  })

  it('a színek körbeforognak', () => {
    const tags = parseTags('a, b, c, d, e, f')
    expect(tags).toHaveLength(6)
    expect(tags[5]?.color).toBe('blue')
  })
})
