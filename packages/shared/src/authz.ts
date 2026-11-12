import type { BoardRole, BoardVisibility, WorkspaceRole } from './roles'

/**
 * A központi jogosultsági policy: tiszta függvények, a backend service-ei és a UI is ezt használják
 * (a backend a forrása az igazságnak, a UI csak elrejti/letiltja a nem engedélyezett műveleteket).
 */

export type WorkspaceAction =
  | 'workspace:read'
  | 'workspace:update'
  | 'workspace:delete'
  | 'workspace:manage_members'
  | 'board:create'

export type BoardAction =
  'board:read' | 'board:write' | 'board:update' | 'board:delete' | 'board:manage_members'

export type Action = WorkspaceAction | BoardAction

export type WorkspaceResource = { type: 'workspace'; role: WorkspaceRole | null }

export type BoardResource = {
  type: 'board'
  visibility: BoardVisibility
  /** A szereplő szerepköre a tábla munkaterületén (`null`: nem tag). */
  workspaceRole: WorkspaceRole | null
  /** A szereplő explicit tábla-szerepköre (`board_members`). */
  boardRole: BoardRole | null
}

export type Resource = WorkspaceResource | BoardResource

/** `null` = névtelen (nem bejelentkezett) szereplő. */
export type PolicyActor = { id: string } | null

export const WORKSPACE_PERMISSIONS: Record<WorkspaceRole, readonly WorkspaceAction[]> = {
  owner: [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:manage_members',
    'board:create',
  ],
  admin: ['workspace:read', 'workspace:update', 'workspace:manage_members', 'board:create'],
  member: ['workspace:read', 'board:create'],
  viewer: ['workspace:read'],
}

export const BOARD_PERMISSIONS: Record<BoardRole, readonly BoardAction[]> = {
  admin: ['board:read', 'board:write', 'board:update', 'board:delete', 'board:manage_members'],
  editor: ['board:read', 'board:write'],
  viewer: ['board:read'],
}

const BOARD_ROLE_RANK: Record<BoardRole, number> = { viewer: 1, editor: 2, admin: 3 }

const strongest = (roles: (BoardRole | null)[]): BoardRole | null =>
  roles.reduce<BoardRole | null>(
    (best, role) =>
      role && (!best || BOARD_ROLE_RANK[role] > BOARD_ROLE_RANK[best]) ? role : best,
    null,
  )

/**
 * A szereplő tényleges szerepköre egy táblán:
 * - a munkaterület tulajdonosa és adminja minden táblán admin (privát táblán is);
 * - az explicit tábla-szerepkör mindig érvényes;
 * - `workspace` / `public` láthatóságnál a munkaterület tagja szerkeszthet (`member`) vagy olvashat (`viewer`);
 * - `public` táblát bárki olvashat, névtelenül is.
 */
export function effectiveBoardRole(
  actor: PolicyActor,
  board: Pick<BoardResource, 'visibility' | 'workspaceRole' | 'boardRole'>,
): BoardRole | null {
  const { visibility, workspaceRole, boardRole } = board
  if (!actor) {
    return visibility === 'public' ? 'viewer' : null
  }

  const fromWorkspace: BoardRole | null =
    workspaceRole === 'owner' || workspaceRole === 'admin'
      ? 'admin'
      : visibility === 'private'
        ? null
        : workspaceRole === 'member'
          ? 'editor'
          : workspaceRole === 'viewer'
            ? 'viewer'
            : null

  return strongest([fromWorkspace, boardRole, visibility === 'public' ? 'viewer' : null])
}

/** Egy már ismert tábla-szerepkör (pl. a `myRole` az API válaszából) engedélyezi-e a műveletet. */
export const boardRoleCan = (role: BoardRole | null, action: BoardAction): boolean =>
  role !== null && BOARD_PERMISSIONS[role].includes(action)

/** Egy már ismert munkaterületi szerepkör engedélyezi-e a műveletet. */
export const workspaceRoleCan = (role: WorkspaceRole | null, action: WorkspaceAction): boolean =>
  role !== null && WORKSPACE_PERMISSIONS[role].includes(action)

export function can(actor: PolicyActor, action: Action, resource: Resource): boolean {
  if (resource.type === 'workspace') {
    if (!actor || !resource.role) return false
    return (WORKSPACE_PERMISSIONS[resource.role] as readonly Action[]).includes(action)
  }

  const role = effectiveBoardRole(actor, resource)
  if (!role) return false
  return (BOARD_PERMISSIONS[role] as readonly Action[]).includes(action)
}

/**
 * Tagkezelés szabálya: a tulajdonos bárkit kezelhet; az admin csak nem-tulajdonost, és tulajdonosi
 * szerepkört nem adhat. (`newRole = null`: eltávolítás.) A „legutolsó tulajdonos” védelme a service-ben van.
 */
export function canManageMember(
  actorRole: WorkspaceRole | null,
  targetRole: WorkspaceRole,
  newRole: WorkspaceRole | null,
): boolean {
  if (actorRole === 'owner') return true
  if (actorRole === 'admin') return targetRole !== 'owner' && newRole !== 'owner'
  return false
}
