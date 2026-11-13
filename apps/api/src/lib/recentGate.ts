/**
 * Ugyanarra a kulcsra egy időablakon belül csak egyszer enged át (`true`), utána az ablak végéig
 * `false`. Memóriában él, a kulcsok száma korlátos (túlcsordulásnál a lejártakat söpri, végső
 * esetben mindent elfelejt). Pl. az ismételt sikertelen belépések auditnaplózásának sűrítésére.
 */
export function createRecentGate(windowMs: number, maxKeys = 10_000, now: () => number = Date.now) {
  const seen = new Map<string, number>()

  return {
    allow(key: string): boolean {
      const time = now()
      const last = seen.get(key)
      if (last !== undefined && time - last < windowMs) return false
      if (seen.size >= maxKeys) {
        for (const [k, at] of seen) if (time - at >= windowMs) seen.delete(k)
        if (seen.size >= maxKeys) seen.clear()
      }
      seen.set(key, time)
      return true
    },
  }
}
