import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../../api/health'

/** Be van-e állítva a szerveren a hangasszisztens (Gemini API kulcs); addig a gomb rejtve marad. */
export function useVoiceAvailable(): boolean {
  return (
    useQuery({
      queryKey: ['health'],
      queryFn: fetchHealth,
      staleTime: 5 * 60_000,
      meta: { handlesErrors: true },
    }).data?.voice === true
  )
}
