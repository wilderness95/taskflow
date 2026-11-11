import { MutationCache, QueryClient } from '@tanstack/react-query'
import i18n from '../i18n'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({
    // A hibaüzenet fordítása a frontend dolga; a szerver csak hibakódot küld.
    onError: () => window.alert(i18n.t('board:saveError')),
  }),
})
