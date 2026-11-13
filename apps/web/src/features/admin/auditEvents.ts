import { AUDIT_ACTIONS, type AuditAction, type AuditEventDto } from '@taskflow/shared'

/** Az esemény fordítási kulcsa (`admin:audit.actions.<kulcs>`); ismeretlen műveletre `unknown`. */
export const auditActionKey = (action: string): AuditAction | 'unknown' =>
  (AUDIT_ACTIONS as readonly string[]).includes(action) ? (action as AuditAction) : 'unknown'

const metaString = (event: AuditEventDto, key: string): string | null => {
  const value = event.meta[key]
  return typeof value === 'string' && value ? value : null
}

/**
 * Az érintett személy a megjelenítéshez: az érintett felhasználó neve, ennek híján a naplózott
 * e-mail-cím (pl. ismeretlen címmel próbált belépés vagy meghívó).
 */
export const auditTarget = (event: AuditEventDto): string | null =>
  event.targetUserName ?? metaString(event, 'email')
