export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

/** Munkaterületre meghívható szerepkörök (tulajdonost nem lehet meghívni). */
export const INVITABLE_ROLES = ['admin', 'member', 'viewer'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

export const BOARD_ROLES = ['admin', 'editor', 'viewer'] as const
export type BoardRole = (typeof BOARD_ROLES)[number]

export const BOARD_VISIBILITIES = ['private', 'workspace', 'public'] as const
export type BoardVisibility = (typeof BOARD_VISIBILITIES)[number]
