import { AppError } from '../../errors.js'

type Entry = { failures: number; windowStart: number; lockedUntil: number }

/**
 * Brute-force védelem fiókonként (a normalizált e-mail-címre kulcsolva, létező és nem létező
 * fiókra egyformán): `maxFailures` sikertelen próbálkozás után `lockMs` ideig tilt minden belépést.
 * Memóriában él: újraindításkor nullázódik, az IP-alapú rate limit ettől függetlenül véd.
 */
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>()

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 15 * 60_000,
    private readonly lockMs = 15 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Zárolt fiókra 429-et dob. */
  check(key: string): void {
    const entry = this.entries.get(key)
    if (entry && entry.lockedUntil > this.now()) {
      throw new AppError(429, 'too_many_attempts', 'Too many failed login attempts', {
        retryAfterSeconds: Math.ceil((entry.lockedUntil - this.now()) / 1000),
      })
    }
  }

  fail(key: string): void {
    const now = this.now()
    this.prune(now)
    const current = this.entries.get(key)
    const entry =
      current && now - current.windowStart < this.windowMs
        ? current
        : { failures: 0, windowStart: now, lockedUntil: 0 }
    entry.failures += 1
    if (entry.failures >= this.maxFailures) {
      entry.lockedUntil = now + this.lockMs
      entry.failures = 0
      entry.windowStart = now
    }
    this.entries.set(key, entry)
  }

  reset(key: string): void {
    this.entries.delete(key)
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.lockedUntil <= now && now - entry.windowStart >= this.windowMs) {
        this.entries.delete(key)
      }
    }
  }
}
