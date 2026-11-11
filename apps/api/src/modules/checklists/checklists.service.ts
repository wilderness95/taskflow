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
) {
  const requireChecklist = (id: string) => orNotFound(repo.findById(id), 'Checklist')
  const requireItem = (id: string) => orNotFound(repo.findItem(id), 'Checklist item')

  return {
    create(actor: Actor, cardId: string, input: CreateChecklistInput): ChecklistDto {
      access.requireCard(actor, cardId, 'board:write')
      if (!cards.findById(cardId)) throw notFound('Card')
      const row = repo.insert({
        id: newId(),
        cardId,
        title: input.title,
        position: generateKeyBetween(repo.lastChecklistPosition(cardId), null),
      })
      return toChecklistDto({ ...row, items: [] })
    },
    update(actor: Actor, id: string, input: UpdateChecklistInput): ChecklistDto {
      access.requireChecklist(actor, id, 'board:write')
      requireChecklist(id)
      repo.update(id, { title: input.title })
      return toChecklistDto(
        repo.listByCardIds([requireChecklist(id).cardId]).find((c) => c.id === id)!,
      )
    },
    remove(actor: Actor, id: string): void {
      access.requireChecklist(actor, id, 'board:write')
      requireChecklist(id)
      repo.delete(id)
    },
    createItem(
      actor: Actor,
      checklistId: string,
      input: CreateChecklistItemInput,
    ): ChecklistItemDto {
      access.requireChecklist(actor, checklistId, 'board:write')
      requireChecklist(checklistId)
      return toItemDto(
        repo.insertItem({
          id: newId(),
          checklistId,
          text: input.text,
          position: generateKeyBetween(repo.lastItemPosition(checklistId), null),
        }),
      )
    },
    updateItem(actor: Actor, id: string, input: UpdateChecklistItemInput): ChecklistItemDto {
      access.requireChecklistItem(actor, id, 'board:write')
      requireItem(id)
      return toItemDto(repo.updateItem(id, input)!)
    },
    removeItem(actor: Actor, id: string): void {
      access.requireChecklistItem(actor, id, 'board:write')
      requireItem(id)
      repo.deleteItem(id)
    },
  }
}
export type ChecklistsService = ReturnType<typeof createChecklistsService>
