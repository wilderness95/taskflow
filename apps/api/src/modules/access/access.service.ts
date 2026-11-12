import {
  can,
  effectiveBoardRole,
  type BoardAction,
  type BoardResource,
  type BoardRole,
  type PolicyActor,
  type WorkspaceAction,
  type WorkspaceRole,
} from '@taskflow/shared'
import { AppError, notFound } from '../../errors.js'
import type { AccessRepository, BoardRow } from './access.repository.js'

export type BoardAccess = { board: BoardRow; role: BoardRole; resource: BoardResource }

const forbidden = () => new AppError(403, 'forbidden', 'You are not allowed to do this')

/**
 * Az egyetlen hely, ahol a service-ek a központi `can()` policy-t hívják: feloldja az erőforrás
 * munkaterületét és a szereplő szerepköreit, és a policy-val dönt. Ha a szereplő nem is olvashatja
 * az erőforrást, az nem létezik számára (404); ha olvashatja, de a művelet tiltott: 403.
 */
export function createAccessService(repo: AccessRepository) {
  const resolveBoard = (
    actor: PolicyActor,
    boardId: string,
    action: BoardAction,
    archived: boolean,
  ): BoardAccess => {
    const board = archived ? repo.findArchivedBoard(boardId) : repo.findActiveBoard(boardId)
    if (!board?.workspaceId) throw notFound('Board')
    const resource: BoardResource = {
      type: 'board',
      visibility: board.visibility,
      workspaceRole: actor ? repo.workspaceRole(board.workspaceId, actor.id) : null,
      boardRole: actor ? repo.boardRole(board.id, actor.id) : null,
    }
    const role = effectiveBoardRole(actor, resource)
    if (!role) throw notFound('Board')
    if (!can(actor, action, resource)) throw forbidden()
    return { board, role, resource }
  }

  const requireBoard = (actor: PolicyActor, boardId: string, action: BoardAction): BoardAccess =>
    resolveBoard(actor, boardId, action, false)

  const viaBoardId = (
    actor: PolicyActor,
    boardId: string | undefined,
    action: BoardAction,
    what: string,
  ) => {
    if (!boardId) throw notFound(what)
    return requireBoard(actor, boardId, action)
  }

  /** A tábla résztvevői: akik a policy szerint legalább olvashatják (tagság alapján, névtelen nélkül). */
  const participants = (board: BoardRow): { userId: string; role: BoardRole }[] => {
    const boardRoles = new Map(repo.boardMemberRoles(board.id).map((m) => [m.userId, m.role]))
    const workspaceRoles = new Map(
      board.workspaceId
        ? repo.workspaceMemberRoles(board.workspaceId).map((m) => [m.userId, m.role])
        : [],
    )
    const result: { userId: string; role: BoardRole }[] = []
    for (const userId of new Set([...boardRoles.keys(), ...workspaceRoles.keys()])) {
      const role = effectiveBoardRole(
        { id: userId },
        {
          visibility: board.visibility,
          workspaceRole: workspaceRoles.get(userId) ?? null,
          boardRole: boardRoles.get(userId) ?? null,
        },
      )
      if (role) result.push({ userId, role })
    }
    return result
  }

  return {
    requireBoard,
    /** Az archivált táblára (visszaállítás); az aktívra 404. */
    requireArchivedBoard: (actor: PolicyActor, boardId: string, action: BoardAction) =>
      resolveBoard(actor, boardId, action, true),
    /** Az archivált kártyára (visszaállítás); az aktívra 404. */
    requireArchivedCard: (actor: PolicyActor, cardId: string, action: BoardAction) =>
      viaBoardId(actor, repo.boardIdOfArchivedCard(cardId), action, 'Card'),
    participants,
    /** Pusztán lekérdezés (nem dob hibát): engedi-e a policy a műveletet az adott erőforráson. */
    can: (actor: PolicyActor, action: BoardAction, resource: BoardResource): boolean =>
      can(actor, action, resource),
    /** A résztvevők megjeleníthető adatokkal, név szerint rendezve. */
    participantProfiles(board: BoardRow) {
      const roles = new Map(participants(board).map((p) => [p.userId, p.role]))
      return repo
        .usersByIds([...roles.keys()])
        .map((u) => ({
          userId: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          role: roles.get(u.id)!,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    requireColumn: (actor: PolicyActor, columnId: string, action: BoardAction) =>
      viaBoardId(actor, repo.boardIdOfColumn(columnId), action, 'Column'),
    requireCard: (actor: PolicyActor, cardId: string, action: BoardAction) =>
      viaBoardId(actor, repo.boardIdOfCard(cardId), action, 'Card'),
    requireChecklist: (actor: PolicyActor, checklistId: string, action: BoardAction) =>
      viaBoardId(actor, repo.boardIdOfChecklist(checklistId), action, 'Checklist'),
    requireChecklistItem: (actor: PolicyActor, itemId: string, action: BoardAction) =>
      viaBoardId(actor, repo.boardIdOfChecklistItem(itemId), action, 'Checklist item'),

    /** Munkaterületi művelet (pl. tábla létrehozása): nem tagnak 404, tiltott műveletre 403. */
    requireWorkspace(
      actor: { id: string },
      workspaceId: string,
      action: WorkspaceAction,
    ): WorkspaceRole {
      const role = repo.workspaceRole(workspaceId, actor.id)
      if (!role) throw notFound('Workspace')
      if (!can(actor, action, { type: 'workspace', role })) throw forbidden()
      return role
    },
  }
}
export type AccessService = ReturnType<typeof createAccessService>
