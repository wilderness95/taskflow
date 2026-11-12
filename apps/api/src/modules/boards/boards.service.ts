import { generateKeyBetween } from 'fractional-indexing'
import {
  effectiveBoardRole,
  type BoardDto,
  type BoardMemberDto,
  type BoardRole,
  type BoardSummaryDto,
  type ColumnDto,
  type CreateBoardInput,
  type CreateColumnInput,
  type CreateLabelInput,
  type LabelDto,
  type PolicyActor,
  type SetBoardMemberInput,
  type UpdateBoardInput,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { AppError, notFound } from '../../errors.js'
import type { AccessService } from '../access/access.service.js'
import type { CardsService } from '../cards/cards.service.js'
import { toColumnDto } from '../columns/columns.service.js'
import type { BoardRow, BoardsRepository } from './boards.repository.js'

const toSummary = (r: BoardRow, myRole: BoardRole, starred: boolean): BoardSummaryDto => ({
  id: r.id,
  workspaceId: r.workspaceId!,
  title: r.title,
  visibility: r.visibility,
  createdAt: r.createdAt.toISOString(),
  myRole,
  starred,
})

export function createBoardsService(
  repo: BoardsRepository,
  cards: CardsService,
  access: AccessService,
) {
  return {
    /** A felhasználó összes olvasható táblája (opcionálisan egy munkaterületre szűrve). */
    list(actor: Actor, workspaceId?: string): BoardSummaryDto[] {
      if (workspaceId) access.requireWorkspace(actor, workspaceId, 'workspace:read')
      return repo.listForUser(actor.id, workspaceId).flatMap((row) => {
        const role = effectiveBoardRole(actor, {
          visibility: row.board.visibility,
          workspaceRole: row.workspaceRole,
          boardRole: row.boardRole,
        })
        return role ? [toSummary(row.board, role, row.starred)] : []
      })
    },

    /** `actor = null`: névtelen olvasás, csak `public` táblára. */
    get(actor: PolicyActor, id: string): BoardDto {
      const { board, role } = access.requireBoard(actor, id, 'board:read')
      const columns = repo.listColumns(id)
      const allCards = cards.listForColumns(columns.map((c) => c.id))
      return {
        ...toSummary(board, role, actor ? repo.isStarred(id, actor.id) : false),
        labels: repo.listLabels(id).map((l) => ({ ...l })),
        columns: columns.map((c) => ({
          ...toColumnDto(c),
          cards: allCards.filter((card) => card.columnId === c.id),
        })),
      }
    },

    create(actor: Actor, workspaceId: string, input: CreateBoardInput): BoardSummaryDto {
      access.requireWorkspace(actor, workspaceId, 'board:create')
      const board = repo.transaction(() => {
        const row = repo.insert({
          id: newId(),
          workspaceId,
          title: input.title,
          visibility: input.visibility,
          createdBy: actor.id,
        })
        // A létrehozó a táblán admin, így a privát táblája akkor is az övé marad, ha a munkaterületen "member".
        repo.setBoardMember(row.id, actor.id, 'admin')
        return row
      })
      return toSummary(board, 'admin', false)
    },

    update(actor: Actor, id: string, input: UpdateBoardInput): BoardSummaryDto {
      const { role } = access.requireBoard(actor, id, 'board:update')
      return toSummary(repo.update(id, input)!, role, repo.isStarred(id, actor.id))
    },

    /** Archiválás: a tábla eltűnik a listából, az adat megmarad. */
    remove(actor: Actor, id: string): void {
      access.requireBoard(actor, id, 'board:delete')
      repo.update(id, { archivedAt: new Date() })
    },

    star(actor: Actor, id: string): void {
      access.requireBoard(actor, id, 'board:read')
      repo.star(id, actor.id)
    },

    unstar(actor: Actor, id: string): void {
      access.requireBoard(actor, id, 'board:read')
      repo.unstar(id, actor.id)
    },

    createColumn(actor: Actor, boardId: string, input: CreateColumnInput): ColumnDto {
      access.requireBoard(actor, boardId, 'board:write')
      return toColumnDto(
        repo.insertColumn({
          id: newId(),
          boardId,
          title: input.title,
          accent: input.accent,
          isDone: input.isDone,
          position: generateKeyBetween(repo.lastColumnPosition(boardId), null),
        }),
      )
    },

    createLabel(actor: Actor, boardId: string, input: CreateLabelInput): LabelDto {
      access.requireBoard(actor, boardId, 'board:write')
      return { ...repo.insertLabel({ id: newId(), boardId, ...input }) }
    },

    listMembers(actor: Actor, boardId: string): BoardMemberDto[] {
      access.requireBoard(actor, boardId, 'board:read')
      return repo.listBoardMembers(boardId)
    },

    /** Explicit tábla-szerepkör (hozzáférés privát táblához); csak munkaterület-tagnak adható. */
    setMember(
      actor: Actor,
      boardId: string,
      userId: string,
      input: SetBoardMemberInput,
    ): BoardMemberDto {
      const { board } = access.requireBoard(actor, boardId, 'board:manage_members')
      if (!repo.workspaceRole(board.workspaceId!, userId)) {
        throw new AppError(
          422,
          'not_workspace_member',
          'Only workspace members can be added to a board',
        )
      }
      repo.setBoardMember(boardId, userId, input.role)
      return repo.listBoardMembers(boardId).find((m) => m.userId === userId)!
    },

    removeMember(actor: Actor, boardId: string, userId: string): void {
      access.requireBoard(actor, boardId, 'board:manage_members')
      if (!repo.getBoardRole(boardId, userId)) throw notFound('Board member')
      repo.removeBoardMember(boardId, userId)
    },
  }
}
export type BoardsService = ReturnType<typeof createBoardsService>
