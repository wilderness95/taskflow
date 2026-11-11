import { describe, expect, it } from 'vitest'
import { getChecklistProgress } from './checklist'

describe('getChecklistProgress', () => {
  it('hiányzó checklistre nullát ad', () => {
    expect(getChecklistProgress(undefined)).toEqual({ percent: 0, done: 0, total: 0 })
    expect(getChecklistProgress(null)).toEqual({ percent: 0, done: 0, total: 0 })
  })

  it('a tételekből számol, és kerekít', () => {
    const progress = getChecklistProgress({
      items: [
        { text: 'a', done: true },
        { text: 'b', done: false },
        { text: 'c', done: false },
      ],
    })
    expect(progress).toEqual({ percent: 33, done: 1, total: 3 })
  })

  it('tételek hiányában az összesítő számokat használja', () => {
    expect(getChecklistProgress({ done: 2, total: 4 })).toEqual({ percent: 50, done: 2, total: 4 })
  })

  it('az összesítőnél a done nem lépheti túl a totalt, és nem lehet negatív', () => {
    expect(getChecklistProgress({ done: 9, total: 4 }).done).toBe(4)
    expect(getChecklistProgress({ done: -1, total: 4 }).done).toBe(0)
  })

  it('érvénytelen összesítőre nullát ad', () => {
    expect(getChecklistProgress({ done: 1, total: 0 })).toEqual({ percent: 0, done: 0, total: 0 })
    expect(getChecklistProgress({ done: 1, total: Number.NaN })).toEqual({
      percent: 0,
      done: 0,
      total: 0,
    })
  })
})
