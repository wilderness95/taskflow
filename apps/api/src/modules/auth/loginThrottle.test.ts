import { describe, expect, it } from 'vitest'
import { LoginThrottle } from './loginThrottle.js'

describe('LoginThrottle', () => {
  it('locks after max failures and unlocks after the lock time', () => {
    let now = 0
    const throttle = new LoginThrottle(3, 1000, 5000, () => now)
    for (let i = 0; i < 3; i++) {
      throttle.check('a')
      throttle.fail('a')
    }
    expect(() => throttle.check('a')).toThrow(/Too many/)
    expect(() => throttle.check('b')).not.toThrow()
    now = 5001
    expect(() => throttle.check('a')).not.toThrow()
  })

  it('forgets failures outside the window and on reset', () => {
    let now = 0
    const throttle = new LoginThrottle(3, 1000, 5000, () => now)
    throttle.fail('a')
    throttle.fail('a')
    now = 1500
    throttle.fail('a')
    throttle.fail('a')
    expect(() => throttle.check('a')).not.toThrow()
    throttle.fail('a')
    expect(() => throttle.check('a')).toThrow()
    throttle.reset('a')
    expect(() => throttle.check('a')).not.toThrow()
  })
})
