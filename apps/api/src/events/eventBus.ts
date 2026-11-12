import type { BoardEvent } from '@taskflow/shared'

export type BoardEventListener = (event: BoardEvent) => void

/**
 * Folyamaton belüli publish/subscribe a táblánkénti valós idejű csatornához. Egy példányos
 * telepítéshez elég (a házi szerveren egyetlen api konténer fut); több példánynál ide kell
 * külső bróker (pl. Redis), a felület ugyanez maradhat.
 */
export function createEventBus() {
  const listeners = new Map<string, Set<BoardEventListener>>()

  return {
    publish(event: BoardEvent): void {
      for (const listener of listeners.get(event.boardId) ?? []) {
        try {
          listener(event)
        } catch {
          // Egy hibás előfizető ne akassza meg a többit és a kérést sem.
        }
      }
    },
    /** Feliratkozás egy tábla eseményeire; a visszaadott függvény leiratkozik. */
    subscribe(boardId: string, listener: BoardEventListener): () => void {
      const set = listeners.get(boardId) ?? new Set()
      set.add(listener)
      listeners.set(boardId, set)
      return () => {
        set.delete(listener)
        if (set.size === 0) listeners.delete(boardId)
      }
    },
    subscriberCount: (boardId: string): number => listeners.get(boardId)?.size ?? 0,
  }
}
export type EventBus = ReturnType<typeof createEventBus>
