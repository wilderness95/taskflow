import { describe, expect, it } from 'vitest'

// A forrásfájlok nyers szövege (tesztek és a központi format helper kivételével).
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!./format.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('i18n szabályok', () => {
  it('találunk forrásfájlokat', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
  })

  it('nincs beégetett locale vagy toLocale* hívás a format helperen kívül', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /['"]hu-HU['"]|\.toLocale\w*\(/u.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
