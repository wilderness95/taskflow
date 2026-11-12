import { useEffect, useRef } from 'react'

type EventTargetLike = { tagName?: string; isContentEditable?: boolean } | null

/** Beviteli elemben gépelés közben a gyorsbillentyűk nem aktívak. */
export const isEditableTarget = (target: EventTargetLike): boolean =>
  Boolean(target) &&
  (target?.isContentEditable === true ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes((target?.tagName ?? '').toUpperCase()))

/**
 * Egybillentyűs gyorsbillentyűk (pl. `n`, `/`, `?`): a kulcs az `event.key`. Módosítóval
 * (Ctrl, Alt, Meta) és beviteli mezőben nem lépnek működésbe; a kezelő futása után az esemény
 * alapértelmezett működése (pl. a `/` beírása) kimarad.
 */
export function useHotkeys(bindings: Record<string, () => void>, enabled = true) {
  const latest = useRef(bindings)
  useEffect(() => {
    latest.current = bindings
  })

  useEffect(() => {
    if (!enabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableTarget(event.target as EventTargetLike)) return
      const handler = latest.current[event.key]
      if (!handler) return
      event.preventDefault()
      handler()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
