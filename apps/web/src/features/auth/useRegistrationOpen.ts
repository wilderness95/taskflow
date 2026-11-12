import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../../api/health'

/**
 * Regisztrálhat-e valaki meghívó nélkül. Amíg az adat nem érkezik meg: `undefined`; ha az állapot
 * nem kérdezhető le, az űrlap marad (a szerver úgyis kényszeríti a szabályt).
 */
export function useRegistrationOpen(): boolean | undefined {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
    meta: { handlesErrors: true },
  })
  return isError ? true : data?.registrationOpen
}
