import type { ApiKeyScope } from '@taskflow/shared'

/** A hatókör fordítási kulcsa (`apikeys:scopes.<kulcs>`); a kettőspont nem használható i18n kulcsban. */
export const SCOPE_KEYS = {
  'workspaces:read': 'workspacesRead',
  'boards:read': 'boardsRead',
  'boards:write': 'boardsWrite',
} as const satisfies Record<ApiKeyScope, string>
