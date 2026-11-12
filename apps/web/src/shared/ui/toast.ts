import { useSyncExternalStore } from 'react'

export type ToastKind = 'info' | 'success' | 'error'

export type Toast = {
  id: number
  message: string
  kind: ToastKind
  /** Egy gombos művelet (pl. visszavonás); a toast a művelet után bezárul. */
  action?: { label: string; run: () => void }
}

export type ToastInput = Omit<Toast, 'id' | 'kind'> & { kind?: ToastKind }

/** A toast alapértelmezett látszási ideje; hibánál és művelet mellett hosszabb. */
const DEFAULT_MS = 4000
const LONG_MS = 8000

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const emit = () => listeners.forEach((listener) => listener())

export function dismissToast(id: number): void {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

/** Üzenet a képernyő alján (nem blokkoló, az `alert()` helyett). Visszaadja a toast azonosítóját. */
export function showToast(input: ToastInput, durationMs?: number): number {
  const kind = input.kind ?? 'info'
  const id = nextId++
  // Egyszerre legfeljebb három látszik; a legrégebbi esik ki.
  toasts = [...toasts, { ...input, kind, id }].slice(-3)
  const ms = durationMs ?? (input.action || kind === 'error' ? LONG_MS : DEFAULT_MS)
  timers.set(
    id,
    setTimeout(() => dismissToast(id), ms),
  )
  emit()
  return id
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export const getToasts = (): Toast[] => toasts

export const useToasts = (): Toast[] => useSyncExternalStore(subscribe, getToasts)

/** Csak teszthez: minden toast eltávolítása. */
export function resetToasts(): void {
  for (const id of timers.keys()) clearTimeout(timers.get(id))
  timers.clear()
  toasts = []
  emit()
}
