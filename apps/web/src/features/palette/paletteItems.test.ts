import { describe, expect, it } from 'vitest'
import { filterPaletteItems, normalize, type PaletteItem } from './paletteItems'

const item = (id: string, label: string, hint?: string): PaletteItem => ({
  id,
  group: 'board',
  label,
  hint,
  run: () => {},
})

describe('normalize', () => {
  it('drops accents and case', () => {
    expect(normalize('  Kenyér ŐŰ ')).toBe('kenyer ou')
  })
})

describe('filterPaletteItems', () => {
  const items = [
    item('a', 'Heti bevásárlás'),
    item('b', 'Bevásárlólista'),
    item('c', 'Termékfejlesztés', 'Demo munkaterület'),
    item('d', 'Nagybevásárlás'),
  ]

  it('returns everything for an empty query', () => {
    expect(filterPaletteItems(items, '  ')).toEqual(items)
  })

  it('matches without accents and ranks prefix, word start, contains, hint', () => {
    expect(filterPaletteItems(items, 'bevasar').map((i) => i.id)).toEqual(['b', 'a', 'd'])
    expect(filterPaletteItems(items, 'demo').map((i) => i.id)).toEqual(['c'])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterPaletteItems(items, 'xyz')).toEqual([])
  })
})
