import type { ApiKeyScope } from '@taskflow/shared'

/**
 * Egy útvonalhoz szükséges hatókör API kulccsal; `'session'`: csak böngészős bejelentkezéssel
 * érhető el (fiók-, tagság-, meghívó- és kulcskezelés), `null`: nincs külön hatókör (pl. `auth/me`).
 */
export type RequiredScope = ApiKeyScope | 'session' | null

const WORKSPACE_PATH = /^\/api\/v1\/workspaces(\/[^/]+)?$/
const WORKSPACE_MEMBERS = /^\/api\/v1\/workspaces\/[^/]+\/members$/
const BOARD_MEMBERS = /^\/api\/v1\/boards\/[^/]+\/members$/

const SESSION_ONLY = [
  /^\/api\/v1\/auth\//,
  /^\/api\/v1\/api-keys(\/|$)/,
  /^\/api\/v1\/notifications(\/|$)/,
  /^\/api\/v1\/voice(\/|$)/,
  /^\/api\/v1\/invitations(\/|$)/,
  /^\/api\/v1\/workspaces\/[^/]+\/(members|invitations)\/.+/,
  /^\/api\/v1\/workspaces\/[^/]+\/invitations$/,
  /^\/api\/v1\/boards\/[^/]+\/members\/.+/,
  /^\/api\/v1\/boards\/[^/]+\/star$/,
  // A mentett szűrők személyes nézet-beállítások (csak böngészős bejelentkezéssel).
  /^\/api\/v1\/boards\/[^/]+\/filters$/,
  /^\/api\/v1\/filters\//,
]

export function requiredScope(method: string, path: string): RequiredScope {
  const read = method === 'GET' || method === 'HEAD'
  if (path === '/api/v1/auth/me' && method === 'GET') return null
  // A tagok listája olvasás; a tagság módosítása csak session-nel megy.
  if (read && WORKSPACE_MEMBERS.test(path)) return 'workspaces:read'
  if (read && BOARD_MEMBERS.test(path)) return 'boards:read'
  if (SESSION_ONLY.some((re) => re.test(path))) return 'session'
  if (WORKSPACE_PATH.test(path)) return read ? 'workspaces:read' : 'session'
  return read ? 'boards:read' : 'boards:write'
}
