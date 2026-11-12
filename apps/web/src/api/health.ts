import { apiFetch } from './client'

export type HealthDto = {
  status: string
  voice: boolean
  registrationOpen: boolean
  emailVerificationRequired: boolean
}

export const fetchHealth = () => apiFetch<HealthDto>('GET', '/health')
