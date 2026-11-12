import {
  listBulkResultSchema,
  listDetailSchema,
  listItemSchema,
  listSectionSchema,
  listSummaryListSchema,
  listSummarySchema,
  type CreateListItemRequest,
  type ListDetailDto,
  type ListItemDto,
  type ListSectionDto,
  type ListSummaryDto,
  type MoveListItemInput,
  type UpdateListItemInput,
} from '@taskflow/shared'
import { apiFetch } from './client'

export const listLists = async (workspaceId: string, archived = false): Promise<ListSummaryDto[]> =>
  listSummaryListSchema.parse(
    await apiFetch('GET', `/workspaces/${workspaceId}/lists${archived ? '?archived=true' : ''}`),
  ).data

export const createList = async (workspaceId: string, title: string): Promise<ListSummaryDto> =>
  listSummarySchema.parse(await apiFetch('POST', `/workspaces/${workspaceId}/lists`, { title }))

export const getList = async (listId: string): Promise<ListDetailDto> =>
  listDetailSchema.parse(await apiFetch('GET', `/lists/${listId}`))

export const renameList = async (listId: string, title: string) =>
  listSummarySchema.parse(await apiFetch('PATCH', `/lists/${listId}`, { title }))

export const archiveList = async (listId: string) =>
  listSummarySchema.parse(await apiFetch('POST', `/lists/${listId}/archive`))

export const restoreList = async (listId: string) =>
  listSummarySchema.parse(await apiFetch('POST', `/lists/${listId}/restore`))

export const clearDone = async (listId: string) =>
  listBulkResultSchema.parse(await apiFetch('POST', `/lists/${listId}/clear-done`))

export const resetRecurring = async (listId: string) =>
  listBulkResultSchema.parse(await apiFetch('POST', `/lists/${listId}/reset-recurring`))

export const createSection = async (listId: string, title: string): Promise<ListSectionDto> =>
  listSectionSchema.parse(await apiFetch('POST', `/lists/${listId}/sections`, { title }))

export const renameSection = async (sectionId: string, title: string): Promise<ListSectionDto> =>
  listSectionSchema.parse(await apiFetch('PATCH', `/list-sections/${sectionId}`, { title }))

export const deleteSection = (sectionId: string) =>
  apiFetch('DELETE', `/list-sections/${sectionId}`)

export const createItem = async (
  listId: string,
  input: CreateListItemRequest,
): Promise<ListItemDto> =>
  listItemSchema.parse(await apiFetch('POST', `/lists/${listId}/items`, input))

export const updateItem = async (
  itemId: string,
  input: UpdateListItemInput,
): Promise<ListItemDto> =>
  listItemSchema.parse(await apiFetch('PATCH', `/list-items/${itemId}`, input))

export const moveItem = async (itemId: string, input: MoveListItemInput): Promise<ListItemDto> =>
  listItemSchema.parse(await apiFetch('POST', `/list-items/${itemId}/move`, input))

export const deleteItem = (itemId: string) => apiFetch('DELETE', `/list-items/${itemId}`)
