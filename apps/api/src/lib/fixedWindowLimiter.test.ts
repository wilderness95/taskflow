import { describe, expect, it } from 'vitest'
import { createFixedWindowLimiter } from './fixedWindowLimiter.js'

describe('fixed window limiter', () => {
  it('blocks above the limit, per key, and resets after the window', () => {
    let t = 0
    const limiter = createFixedWindowLimiter(2, 60_000, () => t)
    expect(limiter.hit('a').allowed).toBe(true)
    expect(limiter.hit('a').allowed).toBe(true)
    const blocked = limiter.hit('a')
    expect(blocked).toMatchObject({ allowed: false, retryAfterSeconds: 60 })
    expect(limiter.hit('b').allowed).toBe(true)
    t = 60_000
    expect(limiter.hit('a').allowed).toBe(true)
  })
})
