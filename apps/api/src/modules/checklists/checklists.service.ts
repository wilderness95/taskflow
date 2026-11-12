import { generateKeyBetween } from 'fractional-indexing'
import type {
  ChecklistDto,
  ChecklistItemDto,
  CreateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput,
} from '@taskflow/shared'
import { newId } from '../../db/ids.js'
import { notFound, orNotFound } from '../../errors.js'
import type { Actor } from '../../auth/actor.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { AccessService } from '../access/access.service.js'
import type { CardsRepository } from '../cards/cards.repository.js'
import type {
  ChecklistItemRow,
  ChecklistRow,
  ChecklistsRepository,
} from './checklists.repository.js'

export const toItemDto = (r: ChecklistItemRow): ChecklistItemDto => ({ ...r })
export const toChecklistDto = (r: ChecklistRow & { items: ChecklistItemRow[] }): ChecklistDto => ({
  id: r.id,
  cardId: r.cardId,
  title: r.title,
  position: r.position,
  items: r.items.map(toItemDto),
})

export function createChecklistsService(
  repo: ChecklistsRepository,
  cards: CardsRepository,
  access: AccessService,
  activity: ActivityService,
) {
  const requireChecklist = (id: string) => orNotFound(repo.findById(id), 'Checklist')
  const requireItem = (id: string) => orNotFound(repo.findItem(id), 'Checklist item')
  const log = (
    actor: Actor,
    boardId: string,
    action: string,
    entityType: string,
    entityId: string,
    meta: Record<string, unknown>,
  ) => activity.record(actor, { boardId, action, entityType, entityId, meta })

  return {
    create(actor: Actor, cardId: string, input: CreateChecklistInput): ChecklistDto {
      const { board } = access.requireCard(actor, cardId, 'board:write')
      if (!cards.findById(cardId)) throw notFound('Card')
      const row = repo.insert({
        id: newId(),
        cardId,
        title: input.title,
        position: generateKeyBetween(repo.lastChecklistPosition(cardId), null),
      })
      log(actor, board.id, 'checklist.created', 'checklist', row.id, { cardId, title: row.title })
      return toChecklistDto({ ...row, items: [] })
    },
    update(actor: Actor, id: string, input: UpdateChecklistInput): ChecklistDto {
      const { board } = access.requireChecklist(actor, id, 'board:write')
      requireChecklist(id)
      repo.update(id, { title: input.title })
      log(actor, board.id, 'checklist.updated', 'checklist', id, { title: input.title })
      return toChecklistDto(
        repo.listByCardIds([requireChecklist(id).cardId]).find((c) => c.id === id)!,
      )
    },
    remove(actor: Actor, id: string): void {
      const { board } = access.requireChecklist(actor, id, 'board:write')
      const checklist = requireChecklist(id)
      repo.delete(id)
      log(actor, board.id, 'checklist.deleted', 'checklist', id, {
        cardId: checklist.cardId,
        title: checklist.title,
      })
    },
    createItem(
      actor: Actor,
      checklistId: string,
      input: CreateChecklistItemInput,
    ): ChecklistItemDto {
      const { board } = access.requireChecklist(actor, checklistId, 'board:write')
      requireChecklist(checklistId)
      const item = repo.insertItem({
        id: newId(),
        checklistId,
        text: input.text,
        position: generateKeyBetween(repo.lastItemPosition(checklistId), null),
      })
      log(actor, board.id, 'checklist_item.created', 'checklist_item', item.id, { checklistId })
      return toItemDto(item)
    },
    updateItem(actor: Actor, id: string, input: UpdateChecklistItemInput): ChecklistItemDto {
      const { board } = access.requireChecklistItem(actor, id, 'board:write')
      requireItem(id)
      const item = toItemDto(repo.updateItem(id, input)!)
      log(actor, board.id, 'checklist_item.updated', 'checklist_item', id, {
        fields: Object.keys(input),
        done: item.done,
      })
      return item
    },
    removeItem(actor: Actor, id: string): void {
      const { board } = access.requireChecklistItem(actor, id, 'board:write')
      const item = requireItem(id)
      repo.deleteItem(id)
      log(actor, board.id, 'checklist_item.deleted', 'checklist_item', id, {
        checklistId: item.checklistId,
      })
    },
  }
}
export type ChecklistsService = ReturnType<typeof createChecklistsService>
