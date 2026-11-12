import { describe, expect, it } from 'vitest'
import {
  countActiveFilters,
  EMPTY_BOARD_FILTER,
  isBoardFilterEmpty,
  matchesBoardFilter,
  type FilterableCard,
} from './boardFilter'

const NOW = new Date(2026, 10, 14)
const card = (over: Partial<FilterableCard> = {}): FilterableCard => ({
  priority: 'medium',
  labelIds: [],
  assigneeIds: [],
  dueDate: null,
  ...over,
})

describe('matchesBoardFilter', () => {
  it('az üres szűrő mindent átenged', () => {
    expect(isBoardFilterEmpty(EMPTY_BOARD_FILTER)).toBe(true)
    expect(matchesBoardFilter(card(), EMPTY_BOARD_FILTER, NOW)).toBe(true)
  })

  it('a csoporton belül VAGY, a csoportok között ÉS', () => {
    const filter = { ...EMPTY_BOARD_FILTER, priorities: ['high', 'low'] as const, labelIds: ['l1'] }
    const f = { ...filter, priorities: [...filter.priorities] }
    expect(matchesBoardFilter(card({ priority: 'high', labelIds: ['l1', 'l2'] }), f, NOW)).toBe(
      true,
    )
    expect(matchesBoardFilter(card({ priority: 'low', labelIds: ['l1'] }), f, NOW)).toBe(true)
    expect(matchesBoardFilter(card({ priority: 'medium', labelIds: ['l1'] }), f, NOW)).toBe(false)
    expect(matchesBoardFilter(card({ priority: 'high', labelIds: ['l2'] }), f, NOW)).toBe(false)
  })

  it('felelősre szűr', () => {
    const f = { ...EMPTY_BOARD_FILTER, assigneeIds: ['u1'] }
    expect(matchesBoardFilter(card({ assigneeIds: ['u1', 'u2'] }), f, NOW)).toBe(true)
    expect(matchesBoardFilter(card({ assigneeIds: ['u2'] }), f, NOW)).toBe(false)
    expect(matchesBoardFilter(card(), f, NOW)).toBe(false)
  })

  it('a határidő állapotára szűr', () => {
    const f = { ...EMPTY_BOARD_FILTER, due: ['overdue' as const, 'none' as const] }
    expect(matchesBoardFilter(card({ dueDate: '2026-11-01' }), f, NOW)).toBe(true)
    expect(matchesBoardFilter(card({ dueDate: null }), f, NOW)).toBe(true)
    expect(matchesBoardFilter(card({ dueDate: '2026-11-15' }), f, NOW)).toBe(false)
    expect(matchesBoardFilter(card({ dueDate: '2027-01-01' }), f, NOW)).toBe(false)
  })
})

describe('countActiveFilters', () => {
  it('összeadja a kiválasztott értékeket', () => {
    expect(countActiveFilters(EMPTY_BOARD_FILTER)).toBe(0)
    expect(
      countActiveFilters({
        priorities: ['high'],
        labelIds: ['a', 'b'],
        assigneeIds: [],
        due: ['soon'],
      }),
    ).toBe(4)
  })
})
