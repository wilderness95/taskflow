import { useSyncExternalStore } from 'react'
import { applyTheme, readPreference, savePreference, type ThemePreference } from './theme'

let current: ThemePreference = readPreference()
const listeners = new Set<() => void>()

/** Egyszer, indításkor: érvényesíti a témát, és követi a rendszer-téma változását. */
export function initTheme(): void {
  applyTheme(current)
  if (typeof window.matchMedia !== 'function') return
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyTheme(current))
}

export function setThemePreference(next: ThemePreference): void {
  current = next
  savePreference(next)
  applyTheme(next)
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, () => current)
  return { preference, setPreference: setThemePreference }
}
