import { describe, expect, it } from 'vitest'
import {
  can,
  boardRoleCan,
  canManageMember,
  workspaceRoleCan,
  effectiveBoardRole,
  type BoardAction,
  type BoardResource,
  type WorkspaceAction,
} from './authz'
import {
  BOARD_ROLES,
  BOARD_VISIBILITIES,
  WORKSPACE_ROLES,
  type BoardRole,
  type BoardVisibility,
  type WorkspaceRole,
} from './roles'

const user = { id: 'u1' }

describe('workspace policy matrix', () => {
  const expected: Record<WorkspaceRole, WorkspaceAction[]> = {
    owner: [
      'workspace:read',
      'workspace:update',
      'workspace:delete',
      'workspace:manage_members',
      'board:create',
      'list:read',
      'list:write',
    ],
    admin: [
      'workspace:read',
      'workspace:update',
      'workspace:manage_members',
      'board:create',
      'list:read',
      'list:write',
    ],
    member: ['workspace:read', 'board:create', 'list:read', 'list:write'],
    viewer: ['workspace:read', 'list:read'],
  }
  const actions: WorkspaceAction[] = [
    'workspace:read',
    'workspace:update',
    'workspace:delete',
    'workspace:manage_members',
    'board:create',
    'list:read',
    'list:write',
  ]

  for (const role of WORKSPACE_ROLES) {
    for (const action of actions) {
      it(`${role} ${expected[role].includes(action) ? 'may' : 'may not'} ${action}`, () => {
        expect(can(user, action, { type: 'workspace', role })).toBe(expected[role].includes(action))
      })
    }
  }

  it('denies non-members and anonymous actors everything', () => {
    for (const action of actions) {
      expect(can(user, action, { type: 'workspace', role: null })).toBe(false)
      expect(can(null, action, { type: 'workspace', role: 'owner' })).toBe(false)
    }
  })
})

describe('effective board role', () => {
  type Case = { visibility: BoardVisibility; ws: WorkspaceRole | null; board: BoardRole | null }
  const role = ({ visibility, ws, board }: Case) =>
    effectiveBoardRole(user, { visibility, workspaceRole: ws, boardRole: board })

  // Teljes mátrix: láthatóság × munkaterületi szerepkör × explicit tábla-szerepkör.
  const table: Record<BoardVisibility, Record<string, BoardRole | null>> = {
    private: { owner: 'admin', admin: 'admin', member: null, viewer: null, none: null },
    workspace: { owner: 'admin', admin: 'admin', member: 'editor', viewer: 'viewer', none: null },
    public: { owner: 'admin', admin: 'admin', member: 'editor', viewer: 'viewer', none: 'viewer' },
  }

  for (const visibility of BOARD_VISIBILITIES) {
    for (const [wsKey, expectedRole] of Object.entries(table[visibility])) {
      it(`${visibility} board, workspace role ${wsKey} -> ${expectedRole}`, () => {
        const ws = wsKey === 'none' ? null : (wsKey as WorkspaceRole)
        expect(role({ visibility, ws, board: null })).toBe(expectedRole)
      })
    }
  }

  it('an explicit board role grants access on private boards and never lowers access', () => {
    for (const board of BOARD_ROLES) {
      expect(role({ visibility: 'private', ws: 'member', board })).toBe(board)
      expect(role({ visibility: 'private', ws: null, board })).toBe(board)
    }
    expect(role({ visibility: 'workspace', ws: 'member', board: 'viewer' })).toBe('editor')
    expect(role({ visibility: 'workspace', ws: 'viewer', board: 'editor' })).toBe('editor')
  })

  it('anonymous actors only read public boards', () => {
    const anon = (visibility: BoardVisibility) =>
      effectiveBoardRole(null, { visibility, workspaceRole: null, boardRole: null })
    expect(anon('public')).toBe('viewer')
    expect(anon('workspace')).toBeNull()
    expect(anon('private')).toBeNull()
  })
})

describe('board policy matrix', () => {
  const expected: Record<BoardRole, BoardAction[]> = {
    admin: ['board:read', 'board:write', 'board:update', 'board:delete', 'board:manage_members'],
    editor: ['board:read', 'board:write'],
    viewer: ['board:read'],
  }
  const actions: BoardAction[] = [
    'board:read',
    'board:write',
    'board:update',
    'board:delete',
    'board:manage_members',
  ]

  for (const boardRole of BOARD_ROLES) {
    for (const action of actions) {
      it(`board ${boardRole} ${expected[boardRole].includes(action) ? 'may' : 'may not'} ${action}`, () => {
        const resource: BoardResource = {
          type: 'board',
          visibility: 'private',
          workspaceRole: null,
          boardRole,
        }
        expect(can(user, action, resource)).toBe(expected[boardRole].includes(action))
      })
    }
  }

  it('a viewer can never write, on any visibility', () => {
    for (const visibility of BOARD_VISIBILITIES) {
      for (const action of [
        'board:write',
        'board:update',
        'board:delete',
        'board:manage_members',
      ] as const) {
        expect(
          can(user, action, {
            type: 'board',
            visibility,
            workspaceRole: 'viewer',
            boardRole: 'viewer',
          }),
        ).toBe(false)
        expect(
          can(null, action, { type: 'board', visibility, workspaceRole: null, boardRole: null }),
        ).toBe(false)
      }
    }
  })

  it('workspace actions never apply to boards and vice versa', () => {
    expect(
      can(user, 'workspace:update', {
        type: 'board',
        visibility: 'public',
        workspaceRole: 'owner',
        boardRole: 'admin',
      }),
    ).toBe(false)
    expect(can(user, 'board:read', { type: 'workspace', role: 'owner' })).toBe(false)
  })
})

describe('canManageMember', () => {
  it('owners manage everyone, admins only non-owners and cannot grant ownership, others nobody', () => {
    for (const target of WORKSPACE_ROLES) {
      expect(canManageMember('owner', target, 'viewer')).toBe(true)
      expect(canManageMember('owner', target, null)).toBe(true)
      expect(canManageMember('member', target, null)).toBe(false)
      expect(canManageMember('viewer', target, 'viewer')).toBe(false)
      expect(canManageMember(null, target, null)).toBe(false)
    }
    expect(canManageMember('admin', 'member', 'admin')).toBe(true)
    expect(canManageMember('admin', 'member', null)).toBe(true)
    expect(canManageMember('admin', 'owner', 'member')).toBe(false)
    expect(canManageMember('admin', 'owner', null)).toBe(false)
    expect(canManageMember('admin', 'member', 'owner')).toBe(false)
  })
})

describe('role helpers used by the UI', () => {
  it('agree with can() for known roles', () => {
    expect(boardRoleCan('viewer', 'board:write')).toBe(false)
    expect(boardRoleCan('editor', 'board:write')).toBe(true)
    expect(boardRoleCan('admin', 'board:update')).toBe(true)
    expect(boardRoleCan(null, 'board:read')).toBe(false)
    expect(workspaceRoleCan('member', 'board:create')).toBe(true)
    expect(workspaceRoleCan('viewer', 'board:create')).toBe(false)
    expect(workspaceRoleCan(null, 'workspace:read')).toBe(false)
  })
})
