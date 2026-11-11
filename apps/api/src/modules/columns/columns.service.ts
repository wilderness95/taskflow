import { generateKeyBetween } from 'fractional-indexing'
import type { ColumnDto, MoveColumnInput, UpdateColumnInput } from '@taskflow/shared'
import { positionBefore } from '../../lib/position.js'
import { AppError, orNotFound } from '../../errors.js'
import type { ColumnRow, ColumnsRepository } from './columns.repository.js'

export const toColumnDto = (r: ColumnRow): ColumnDto => ({
  id: r.id,
  boardId: r.boardId,
  title: r.title,
  accent: r.accent,
  isDone: r.isDone,
  position: r.position,
})

export function createColumnsService(repo: ColumnsRepository) {
  const require = (id: string): ColumnRow => orNotFound(repo.findById(id), 'Column')

  return {
    update(id: string, input: UpdateColumnInput): ColumnDto {
      require(id)
      return toColumnDto(repo.update(id, input)!)
    },

    move(id: string, input: MoveColumnInput): ColumnDto {
      const column = require(id)
      const position = positionBefore(repo.listPositions(column.boardId), id, input.beforeColumnId)
      return toColumnDto(repo.update(id, { position })!)
    },

    /** Ha az oszlopban vannak kártyák, `moveCardsTo` kötelező: a kártyák a cél oszlop végére kerülnek. */
    remove(id: string, moveCardsTo?: string): void {
      const column = require(id)
      repo.transaction(() => {
        if (repo.countCards(id) > 0) {
          if (!moveCardsTo) {
            throw new AppError(409, 'column_not_empty', 'Column still has cards', {
              cardCount: repo.countCards(id),
            })
          }
          const target = repo.findById(moveCardsTo)
          if (!target || target.boardId !== column.boardId || target.id === id) {
            throw new AppError(422, 'invalid_target_column', 'Invalid target column', {
              moveCardsTo,
            })
          }
          let last = repo.lastCardPosition(target.id)
          for (const cardId of repo.cardIdsInOrder(id)) {
            last = generateKeyBetween(last, null)
            repo.moveCard(cardId, target.id, last)
          }
        }
        repo.delete(id)
      })
    },
  }
}
export type ColumnsService = ReturnType<typeof createColumnsService>
