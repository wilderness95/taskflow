/**
 * API kulcs hatókörök. A kulcs tényleges joga a hatókör és a tulajdonos jogainak metszete:
 * a hatókör csak szűkíthet, a tulajdonos jogain túl nem ad semmit.
 */
export const API_KEY_SCOPES = ['workspaces:read', 'boards:read', 'boards:write'] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

/** Az `boards:write` az olvasást is magában foglalja. */
export function scopeAllows(scopes: readonly ApiKeyScope[], required: ApiKeyScope): boolean {
  if (scopes.includes(required)) return true
  return required === 'boards:read' && scopes.includes('boards:write')
}

/** A kulcs nyers értékének előtagja; a titkos rész utána jön. */
export const API_KEY_PREFIX = 'tfk_'
