import { activityListSchema, type ActivityDto } from '@taskflow/shared'
import { apiFetch } from './client'

export type ActivityPage = { data: ActivityDto[]; nextCursor: string | null }

const query = (cursor?: string) => `?limit=30${cursor ? `&cursor=${cursor}` : ''}`

export const listBoardActivity = async (boardId: string, cursor?: string): Promise<ActivityPage> =>
  activityListSchema.parse(await apiFetch('GET', `/boards/${boardId}/activity${query(cursor)}`))

export const listCardActivity = async (cardId: string, cursor?: string): Promise<ActivityPage> =>
  activityListSchema.parse(await apiFetch('GET', `/cards/${cardId}/activity${query(cursor)}`))
