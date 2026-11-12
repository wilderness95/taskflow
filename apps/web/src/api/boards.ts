import {
  boardArchiveSchema,
  boardListSchema,
  boardMemberListSchema,
  boardParticipantListSchema,
  type BoardMemberDto,
  type SetBoardMemberInput,
  boardSummarySchema,
  type CreateBoardRequest,
  boardSchema,
  type BoardArchiveDto,
  type BoardDto,
  type BoardSummaryDto,
  type CardDto,
  type ChecklistDto,
  type ChecklistItemDto,
  type ColumnDto,
  type CreateCardRequest,
  type CreateChecklistRequest,
  type CreateChecklistItemInput,
  type CreateColumnRequest,
  type CreateLabelInput,
  type LabelDto,
  type MoveCardInput,
  type MoveColumnInput,
  type UpdateBoardInput,
  type UpdateCardInput,
  type UpdateChecklistItemInput,
  type UpdateColumnInput,
} from '@taskflow/shared'
import { apiFetch } from './client'

export const listBoards = async (workspaceId?: string): Promise<BoardSummaryDto[]> =>
  boardListSchema.parse(
    await apiFetch('GET', workspaceId ? `/workspaces/${workspaceId}/boards` : '/boards'),
  ).data

/** A munkaterület archivált táblái (csak azok, amelyeket a felhasználó vissza is állíthat). */
export const listArchivedBoards = async (workspaceId: string): Promise<BoardSummaryDto[]> =>
  boardListSchema.parse(await apiFetch('GET', `/workspaces/${workspaceId}/boards?archived=true`))
    .data

export const archiveBoard = (boardId: string) => apiFetch('DELETE', `/boards/${boardId}`)
export const restoreBoard = (boardId: string) =>
  apiFetch<BoardSummaryDto>('POST', `/boards/${boardId}/restore`)

export const getBoardArchive = async (boardId: string): Promise<BoardArchiveDto> =>
  boardArchiveSchema.parse(await apiFetch('GET', `/boards/${boardId}/archive`))

export const archiveColumn = (columnId: string) =>
  apiFetch<ColumnDto>('POST', `/columns/${columnId}/archive`)
export const restoreColumn = (columnId: string) =>
  apiFetch<ColumnDto>('POST', `/columns/${columnId}/restore`)
export const archiveCard = (cardId: string) => apiFetch<CardDto>('POST', `/cards/${cardId}/archive`)
export const restoreCard = (cardId: string) => apiFetch<CardDto>('POST', `/cards/${cardId}/restore`)

export const createBoard = async (
  workspaceId: string,
  input: CreateBoardRequest,
): Promise<BoardSummaryDto> =>
  boardSummarySchema.parse(await apiFetch('POST', `/workspaces/${workspaceId}/boards`, input))

export const starBoard = (boardId: string) => apiFetch('PUT', `/boards/${boardId}/star`)
export const unstarBoard = (boardId: string) => apiFetch('DELETE', `/boards/${boardId}/star`)

export const getBoard = async (boardId: string): Promise<BoardDto> =>
  boardSchema.parse(await apiFetch('GET', `/boards/${boardId}`))

export const updateBoard = (boardId: string, input: UpdateBoardInput) =>
  apiFetch<BoardSummaryDto>('PATCH', `/boards/${boardId}`, input)

export const createLabel = (boardId: string, input: CreateLabelInput) =>
  apiFetch<LabelDto>('POST', `/boards/${boardId}/labels`, input)

export const createColumn = (boardId: string, input: CreateColumnRequest) =>
  apiFetch<ColumnDto>('POST', `/boards/${boardId}/columns`, input)

export const updateColumn = (columnId: string, input: UpdateColumnInput) =>
  apiFetch<ColumnDto>('PATCH', `/columns/${columnId}`, input)

export const moveColumn = (columnId: string, input: MoveColumnInput) =>
  apiFetch<ColumnDto>('POST', `/columns/${columnId}/move`, input)

export const deleteColumn = (columnId: string, moveCardsTo?: string) =>
  apiFetch('DELETE', `/columns/${columnId}${moveCardsTo ? `?moveCardsTo=${moveCardsTo}` : ''}`)

export const createCard = (columnId: string, input: CreateCardRequest) =>
  apiFetch<CardDto>('POST', `/columns/${columnId}/cards`, input)

export const updateCard = (cardId: string, input: UpdateCardInput) =>
  apiFetch<CardDto>('PATCH', `/cards/${cardId}`, input)

export const moveCard = (cardId: string, input: MoveCardInput) =>
  apiFetch<CardDto>('POST', `/cards/${cardId}/move`, input)

export const deleteCard = (cardId: string) => apiFetch('DELETE', `/cards/${cardId}`)

export const createChecklist = (cardId: string, input: CreateChecklistRequest) =>
  apiFetch<ChecklistDto>('POST', `/cards/${cardId}/checklists`, input)

export const updateChecklist = (checklistId: string, title: string) =>
  apiFetch<ChecklistDto>('PATCH', `/checklists/${checklistId}`, { title })

export const createChecklistItem = (checklistId: string, input: CreateChecklistItemInput) =>
  apiFetch<ChecklistItemDto>('POST', `/checklists/${checklistId}/items`, input)

export const updateChecklistItem = (itemId: string, input: UpdateChecklistItemInput) =>
  apiFetch<ChecklistItemDto>('PATCH', `/checklist-items/${itemId}`, input)

export const deleteChecklistItem = (itemId: string) =>
  apiFetch('DELETE', `/checklist-items/${itemId}`)

export const listBoardParticipants = async (boardId: string): Promise<BoardMemberDto[]> =>
  boardParticipantListSchema.parse(await apiFetch('GET', `/boards/${boardId}/participants`)).data

export const listBoardMembers = async (boardId: string): Promise<BoardMemberDto[]> =>
  boardMemberListSchema.parse(await apiFetch('GET', `/boards/${boardId}/members`)).data

export const setBoardMember = (boardId: string, userId: string, input: SetBoardMemberInput) =>
  apiFetch<BoardMemberDto>('PUT', `/boards/${boardId}/members/${userId}`, input)

export const removeBoardMember = (boardId: string, userId: string) =>
  apiFetch('DELETE', `/boards/${boardId}/members/${userId}`)
