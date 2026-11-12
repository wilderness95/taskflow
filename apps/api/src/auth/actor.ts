import type { ApiKeyScope } from '@taskflow/shared'

/**
 * Session és API kulcs egyaránt Actor-rá képződik le; a service nem tudja, honnan jön a kérés.
 * Az `id` mindkét esetben a (tulajdonos) felhasználó azonosítója, így a policy ugyanúgy működik;
 * a kulcs hatókörét az auth plugin kényszeríti az útvonalakon (a `scopes` itt csak információ).
 */
export type Actor =
  | { type: 'user'; id: string; isAdmin: boolean }
  | { type: 'api_key'; id: string; isAdmin: false; keyId: string; scopes: ApiKeyScope[] }
