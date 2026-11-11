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

export function createChecklistsService(repo: ChecklistsRepository, cards: CardsRepository) {
  const requireChecklist = (id: string) => orNotFound(repo.findById(id), 'Checklist')
  const requireItem = (id: string) => orNotFound(repo.findItem(id), 'Checklist item')

  return {
    create(cardId: string, input: CreateChecklistInput): ChecklistDto {
      if (!cards.findById(cardId)) throw notFound('Card')
      const row = repo.insert({
        id: newId(),
        cardId,
        title: input.title,
        position: generateKeyBetween(repo.lastChecklistPosition(cardId), null),
      })
      return toChecklistDto({ ...row, items: [] })
    },
    update(id: string, input: UpdateChecklistInput): ChecklistDto {
      requireChecklist(id)
      repo.update(id, { title: input.title })
      return toChecklistDto(
        repo.listByCardIds([requireChecklist(id).cardId]).find((c) => c.id === id)!,
      )
    },
    remove(id: string): void {
      requireChecklist(id)
      repo.delete(id)
    },
    createItem(checklistId: string, input: CreateChecklistItemInput): ChecklistItemDto {
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
    updateItem(id: string, input: UpdateChecklistItemInput): ChecklistItemDto {
      requireItem(id)
      return toItemDto(repo.updateItem(id, input)!)
    },
    removeItem(id: string): void {
      requireItem(id)
      repo.deleteItem(id)
    },
  }
}
export type ChecklistsService = ReturnType<typeof createChecklistsService>
