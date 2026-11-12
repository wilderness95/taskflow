import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateApiKeyInput } from '@taskflow/shared'
import * as api from '../../api/apiKeys'

const apiKeysKey = ['api-keys'] as const

/** Az API kulcsok listája, létrehozás és visszavonás; a hibát az oldal jeleníti meg. */
export function useApiKeys() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: apiKeysKey })
  const local = { meta: { handlesErrors: true } } as const

  const keys = useQuery({ queryKey: apiKeysKey, queryFn: api.listApiKeys })
  const create = useMutation({
    ...local,
    mutationFn: (input: CreateApiKeyInput) => api.createApiKey(input),
    onSuccess: invalidate,
  })
  const revoke = useMutation({
    ...local,
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: invalidate,
  })

  return { keys, create, revoke }
}
