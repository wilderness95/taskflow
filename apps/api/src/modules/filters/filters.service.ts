import {
  boardFilterSchema,
  type CreateSavedFilterInput,
  type SavedFilterDto,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { AppError, notFound } from '../../errors.js'
import type { AccessService } from '../access/access.service.js'
import type { FiltersRepository, SavedFilterRow } from './filters.repository.js'

/** Egy felhasználó ennyi mentett szűrőt tarthat egy táblán. */
export const MAX_SAVED_FILTERS = 50

const toDto = (r: SavedFilterRow): SavedFilterDto => ({
  id: r.id,
  boardId: r.boardId,
  name: r.name,
  filter: boardFilterSchema.parse(JSON.parse(r.filter)),
  createdAt: r.createdAt.toISOString(),
})

/**
 * Mentett szűrők: személyes nézet-beállítások (nem a tábla tartalma), ezért nem kerülnek a
 * tevékenységnaplóba és az SSE-csatornára (a csillagozáshoz hasonlóan); olvasási jog elég hozzá.
 */
export function createFiltersService(repo: FiltersRepository, access: AccessService) {
  return {
    list(actor: Actor, boardId: string): SavedFilterDto[] {
      access.requireBoard(actor, boardId, 'board:read')
      return repo.list(boardId, actor.id).map(toDto)
    },

    create(actor: Actor, boardId: string, input: CreateSavedFilterInput): SavedFilterDto {
      access.requireBoard(actor, boardId, 'board:read')
      if (repo.findByName(boardId, actor.id, input.name)) {
        throw new AppError(409, 'filter_name_taken', 'You already have a filter with this name')
      }
      if (repo.list(boardId, actor.id).length >= MAX_SAVED_FILTERS) {
        throw new AppError(422, 'too_many_filters', 'Too many saved filters on this board', {
          limit: MAX_SAVED_FILTERS,
        })
      }
      return toDto(
        repo.insert({
          id: newId(),
          boardId,
          userId: actor.id,
          name: input.name,
          filter: JSON.stringify(input.filter),
        }),
      )
    },

    /** Csak a saját szűrő törölhető; más szűrője nem létezik a szereplő számára (404). */
    remove(actor: Actor, id: string): void {
      const row = repo.findById(id)
      if (!row || row.userId !== actor.id) throw notFound('Filter')
      access.requireBoard(actor, row.boardId, 'board:read')
      repo.delete(id)
    },
  }
}
export type FiltersService = ReturnType<typeof createFiltersService>
