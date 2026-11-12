/** Memóriában tartott, fix ablakos számláló (kulcsonkénti rate limithez). */
export function createFixedWindowLimiter(max: number, windowMs: number, now = () => Date.now()) {
  const windows = new Map<string, { start: number; count: number }>()
  return {
    /** Egy kérés beszámítása; ha a limit elfogyott, `allowed: false` és a várakozási idő. */
    hit(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
      const t = now()
      let w = windows.get(key)
      if (!w || t - w.start >= windowMs) {
        w = { start: t, count: 0 }
        windows.set(key, w)
        // Ritkán takarítunk, hogy a térkép ne nőjön a végtelenségig.
        if (windows.size > 10_000) {
          for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k)
        }
      }
      w.count += 1
      return {
        allowed: w.count <= max,
        remaining: Math.max(0, max - w.count),
        retryAfterSeconds: Math.ceil((w.start + windowMs - t) / 1000),
      }
    },
  }
}
