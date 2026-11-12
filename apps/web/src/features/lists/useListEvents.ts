import { useQueryClient } from '@tanstack/react-query'
import { LIST_EVENT_NAME, listEventSchema } from '@taskflow/shared'
import { useEffect } from 'react'
import { LISTS_KEY } from './useLists'

/** Az események összevonása: egy gyors sorozat egyetlen újratöltés. */
const DEBOUNCE_MS = 150

/**
 * Valós idejű frissítés: a lista SSE csatornájára feliratkozik, és minden változáskor újratölti
 * a listák gyorsítótárát. Újracsatlakozáskor az elmulasztott változások miatt is frissít.
 */
export function useListEvents(listId: string, enabled = true): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !listId || typeof EventSource === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | undefined
    let opened = false
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: LISTS_KEY })
      }, DEBOUNCE_MS)
    }

    const source = new EventSource(`/api/v1/lists/${listId}/events`)
    source.addEventListener('open', () => {
      if (opened) refresh()
      opened = true
    })
    source.addEventListener(LIST_EVENT_NAME, (message) => {
      const parsed = listEventSchema.safeParse(JSON.parse((message as MessageEvent<string>).data))
      if (parsed.success) refresh()
    })

    return () => {
      clearTimeout(timer)
      source.close()
    }
  }, [listId, enabled, queryClient])
}
