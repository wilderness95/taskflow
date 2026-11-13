import { describe, expect, it } from 'vitest'
import { createRecentGate } from './recentGate.js'

describe('createRecentGate', () => {
  it('lets a key through once per window, independently per key', () => {
    let time = 0
    const gate = createRecentGate(60_000, 100, () => time)
    expect(gate.allow('a')).toBe(true)
    expect(gate.allow('a')).toBe(false)
    expect(gate.allow('b')).toBe(true)
    time = 59_999
    expect(gate.allow('a')).toBe(false)
    time = 60_000
    expect(gate.allow('a')).toBe(true)
  })

  it('stays bounded when many keys arrive', () => {
    let time = 0
    const gate = createRecentGate(60_000, 3, () => time)
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      expect(gate.allow(key)).toBe(true)
    }
    // Túlcsordulás után a kapu újra átenged (nem blokkol tévesen, és nem nő végtelenül).
    expect(gate.allow('a')).toBe(true)
  })
})
