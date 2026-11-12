import type { BoardEvent, ListEvent } from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { AppError } from '../../errors.js'
import type { EventBus } from '../../events/eventBus.js'
import type { AccessService } from '../access/access.service.js'

/** Egy felhasználó (a böngészőfülekkel és kulcsokkal együtt) ennyi nyitott csatornát tarthat. */
export const MAX_STREAMS_PER_USER = 20

export function createEventsService(bus: EventBus, access: AccessService) {
  const open = new Map<string, number>()

  const track = (actor: Actor, off: () => void) => {
    open.set(actor.id, (open.get(actor.id) ?? 0) + 1)
    let closed = false
    return () => {
      if (closed) return
      closed = true
      off()
      const left = (open.get(actor.id) ?? 1) - 1
      if (left <= 0) open.delete(actor.id)
      else open.set(actor.id, left)
    }
  }
  const checkLimit = (actor: Actor) => {
    if ((open.get(actor.id) ?? 0) >= MAX_STREAMS_PER_USER) {
      throw new AppError(429, 'too_many_streams', 'Too many open event streams')
    }
  }

  return {
    /**
     * Feliratkozás egy tábla eseményeire: olvasási jog kell (nem olvasható tábla: 404). A jogot
     * csak a csatlakozáskor ellenőrizzük; az esemény vékony (nem hordoz kártyatartalmat), az
     * adatot a kliens a jogosultságot ellenőrző végpontokról olvassa újra.
     */
    subscribe(actor: Actor, boardId: string, listener: (event: BoardEvent) => void): () => void {
      access.requireBoard(actor, boardId, 'board:read')
      checkLimit(actor)
      return track(actor, bus.subscribe(boardId, listener))
    },

    /** Feliratkozás egy lista eseményeire (olvasási jog kell; nem olvasható lista: 404). */
    subscribeList(actor: Actor, listId: string, listener: (event: ListEvent) => void): () => void {
      access.requireList(actor, listId, 'list:read')
      checkLimit(actor)
      return track(actor, bus.subscribeList(listId, listener))
    },
  }
}
export type EventsService = ReturnType<typeof createEventsService>
