import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { ME_KEY } from '../features/auth/useSession'
import i18n from '../i18n'

const isUnauthenticated = (error: unknown) => error instanceof ApiError && error.status === 401

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
  queryCache: new QueryCache({
    // Lejárt vagy érvénytelen munkamenet: a védett route a login oldalra irányít.
    onError: (error, query) => {
      if (isUnauthenticated(error) && query.queryKey[0] !== ME_KEY[0]) {
        queryClient.setQueryData(ME_KEY, null)
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (isUnauthenticated(error) && !mutation.meta?.handlesErrors) {
        queryClient.setQueryData(ME_KEY, null)
        return
      }
      // Az űrlapos (auth) mutációk a hibát helyben jelenítik meg.
      if (mutation.meta?.handlesErrors) {
        return
      }
      // A hibaüzenet fordítása a frontend dolga; a szerver csak hibakódot küld.
      const conflict = error instanceof ApiError && error.code === 'version_conflict'
      window.alert(i18n.t(conflict ? 'board:conflictError' : 'board:saveError'))
    },
  }),
})
