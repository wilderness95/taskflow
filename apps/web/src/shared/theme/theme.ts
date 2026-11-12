export const THEME_KEY = 'taskflow.theme'
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type Theme = 'light' | 'dark'

/** A `<meta name="theme-color">` értéke (az Android / böngésző felső sávjának színe). */
export const THEME_COLORS: Record<Theme, string> = { dark: '#0f172a', light: '#eef2f7' }

/** A tárolt érték érvényes beállítássá alakítása (ismeretlen: rendszer). */
export const parsePreference = (value: string | null): ThemePreference =>
  value === 'light' || value === 'dark' ? value : 'system'

/** A tényleges téma: a rendszer-beállítás a böngésző színsémáját követi. */
export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): Theme =>
  preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference

export const readPreference = (): ThemePreference => {
  try {
    return parsePreference(window.localStorage.getItem(THEME_KEY))
  } catch {
    return 'system'
  }
}

export const systemPrefersDark = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

/** Érvényesíti a témát a dokumentumon (`data-theme`, `theme-color`); visszaadja a tényleges témát. */
export function applyTheme(preference: ThemePreference): Theme {
  const theme = resolveTheme(preference, systemPrefersDark())
  document.documentElement.setAttribute('data-theme', theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  return theme
}

export function savePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Privát módban a tárolás tiltott lehet; a beállítás ekkor csak az oldal életére érvényes.
  }
}
