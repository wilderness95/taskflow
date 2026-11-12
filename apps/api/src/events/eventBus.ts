import type { BoardEvent, ListEvent } from '@taskflow/shared'

export type BoardEventListener = (event: BoardEvent) => void
export type ListEventListener = (event: ListEvent) => void

/**
 * Folyamaton belüli publish/subscribe a táblánkénti valós idejű csatornához. Egy példányos
 * telepítéshez elég (a házi szerveren egyetlen api konténer fut); több példánynál ide kell
 * külső bróker (pl. Redis), a felület ugyanez maradhat.
 */
export function createEventBus() {
  const listeners = new Map<string, Set<BoardEventListener>>()
  /** Minden tábla eseményét kapó előfizetők (pl. a webhook-kézbesítő). */
  const global = new Set<BoardEventListener>()
  /** Listánkénti csatorna (a listák nem táblák, ezért külön, a webhookoktól független). */
  const listListeners = new Map<string, Set<ListEventListener>>()

  return {
    publish(event: BoardEvent): void {
      for (const listener of global) {
        try {
          listener(event)
        } catch {
          // lásd lent
        }
      }
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
    /** Feliratkozás az összes tábla eseményeire; a visszaadott függvény leiratkozik. */
    subscribeAll(listener: BoardEventListener): () => void {
      global.add(listener)
      return () => void global.delete(listener)
    },
    publishList(event: ListEvent): void {
      for (const listener of listListeners.get(event.listId) ?? []) {
        try {
          listener(event)
        } catch {
          // Egy hibás előfizető ne akassza meg a többit és a kérést sem.
        }
      }
    },
    subscribeList(listId: string, listener: ListEventListener): () => void {
      const set = listListeners.get(listId) ?? new Set()
      set.add(listener)
      listListeners.set(listId, set)
      return () => {
        set.delete(listener)
        if (set.size === 0) listListeners.delete(listId)
      }
    },
    listSubscriberCount: (listId: string): number => listListeners.get(listId)?.size ?? 0,
    subscriberCount: (boardId: string): number => listeners.get(boardId)?.size ?? 0,
  }
}
export type EventBus = ReturnType<typeof createEventBus>
