import { useQueryClient } from '@tanstack/react-query'
import { BOARD_EVENT_NAME, boardEventSchema } from '@taskflow/shared'
import { useEffect } from 'react'

/** Az események összevonása: egy gyors sorozat (pl. több API-hívásos mentés) egyetlen újratöltés. */
const DEBOUNCE_MS = 150

/**
 * Valós idejű frissítés: a tábla SSE csatornájára feliratkozik, és minden változáskor
 * újratölti a tábla (kártyák, hozzászólások, napló) és a táblalista gyorsítótárát.
 * A böngésző az `EventSource`-szal magától újracsatlakozik; újracsatlakozáskor az
 * esetleg elmulasztott változások miatt is frissítünk.
 */
export function useBoardEvents(boardId: string, enabled = true): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !boardId || typeof EventSource === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | undefined
    let opened = false
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['board', boardId] })
        void queryClient.invalidateQueries({ queryKey: ['boards'] })
      }, DEBOUNCE_MS)
    }

    const source = new EventSource(`/api/v1/boards/${boardId}/events`)
    source.addEventListener('open', () => {
      if (opened) refresh()
      opened = true
    })
    source.addEventListener(BOARD_EVENT_NAME, (message) => {
      const parsed = boardEventSchema.safeParse(JSON.parse((message as MessageEvent<string>).data))
      if (parsed.success) refresh()
    })

    return () => {
      clearTimeout(timer)
      source.close()
    }
  }, [boardId, enabled, queryClient])
}
