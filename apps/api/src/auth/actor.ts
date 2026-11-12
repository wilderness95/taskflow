import type { ApiKeyScope } from '@taskflow/shared'
import { AppError } from '../errors.js'

/**
 * Session és API kulcs egyaránt Actor-rá képződik le; a service nem tudja, honnan jön a kérés.
 * Az `id` mindkét esetben a (tulajdonos) felhasználó azonosítója, így a policy ugyanúgy működik;
 * a kulcs hatókörét az auth plugin kényszeríti az útvonalakon (a `scopes` itt csak információ).
 */
/**
 * `emailCleared`: a felhasználó e-mail-címe megerősített, vagy platform-admin (ő mentesül a
 * `REQUIRE_EMAIL_VERIFICATION` kötelezés alól). Kulcsos kérésnél a kulcs tulajdonosáé.
 */
export type Actor =
  | { type: 'user'; id: string; isAdmin: boolean; emailCleared: boolean }
  | {
      type: 'api_key'
      id: string
      isAdmin: false
      emailCleared: boolean
      keyId: string
      scopes: ApiKeyScope[]
    }

/**
 * Platform-admin jogosultság (`users.is_admin`): a munkaterületi szerepkörtől független. API kulcs
 * sosem platform-admin (`isAdmin: false`), ezért kulccsal az adminfelület nem érhető el.
 */
export function requirePlatformAdmin(actor: Actor): void {
  if (actor.type !== 'user' || !actor.isAdmin) {
    throw new AppError(403, 'forbidden', 'Admin rights required')
  }
}
