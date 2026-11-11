import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LoginRequest, RegisterRequest, UpdateProfileInput, UserDto } from '@taskflow/shared'
import * as api from '../../api/auth'

export const ME_KEY = ['me'] as const

/** Az auth-mutációk a hibát helyben, az űrlapon kezelik; a globális hibaüzenet ne jelenjen meg. */
const LOCAL_ERRORS = { meta: { handlesErrors: true } } as const

/** `undefined` = még töltődik, `null` = nincs bejelentkezve. */
export function useCurrentUser(): UserDto | null | undefined {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: api.fetchMe,
    retry: false,
    staleTime: Infinity,
  }).data
}

export function useAuthActions() {
  const queryClient = useQueryClient()
  const setUser = (user: UserDto | null) => queryClient.setQueryData(ME_KEY, user)

  const login = useMutation({
    ...LOCAL_ERRORS,
    mutationFn: (input: LoginRequest) => api.login(input),
    onSuccess: setUser,
  })
  const register = useMutation({
    ...LOCAL_ERRORS,
    mutationFn: (input: RegisterRequest) => api.register(input),
    onSuccess: setUser,
  })
  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      // A másik felhasználó ne lásson maradék adatot a gyorsítótárból.
      queryClient.clear()
      setUser(null)
    },
  })
  const updateProfile = useMutation({
    ...LOCAL_ERRORS,
    mutationFn: (input: UpdateProfileInput) => api.updateProfile(input),
    onSuccess: setUser,
  })

  return { login, register, logout, updateProfile }
}
