import {
  apiKeyListSchema,
  createdApiKeySchema,
  type ApiKeyDto,
  type CreateApiKeyInput,
  type CreatedApiKeyDto,
} from '@taskflow/shared'
import { apiFetch } from './client'

export const listApiKeys = async (): Promise<ApiKeyDto[]> =>
  apiKeyListSchema.parse(await apiFetch('GET', '/api-keys')).data

export const createApiKey = async (input: CreateApiKeyInput): Promise<CreatedApiKeyDto> =>
  createdApiKeySchema.parse(await apiFetch('POST', '/api-keys', input))

export const revokeApiKey = (id: string) => apiFetch('DELETE', `/api-keys/${id}`)
