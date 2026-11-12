import {
  savedFilterListSchema,
  savedFilterSchema,
  type CreateSavedFilterRequest,
  type SavedFilterDto,
} from '@taskflow/shared'
import { apiFetch } from './client'

export const listSavedFilters = async (boardId: string): Promise<SavedFilterDto[]> =>
  savedFilterListSchema.parse(await apiFetch('GET', `/boards/${boardId}/filters`)).data

export const createSavedFilter = async (
  boardId: string,
  input: CreateSavedFilterRequest,
): Promise<SavedFilterDto> =>
  savedFilterSchema.parse(await apiFetch('POST', `/boards/${boardId}/filters`, input))

export const deleteSavedFilter = (filterId: string) => apiFetch('DELETE', `/filters/${filterId}`)
