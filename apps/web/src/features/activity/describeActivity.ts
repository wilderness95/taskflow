import type { ActivityDto } from '@taskflow/shared'
import i18n from '../../i18n'

/** A fordítófüggvény szűkített alakja (a kulcsok futásidőben állnak össze). */
const translate = i18n.t.bind(i18n) as unknown as (
  key: string | string[],
  options?: Record<string, unknown>,
) => string

/**
 * Egy naplóbejegyzés szövege: az `activity:actions.<entity>.<verb>` kulcs fordítja; ismeretlen
 * művelethez az általános szöveg jön (a backend nem küld megjelenítendő szöveget).
 */
export function describeActivity(entry: ActivityDto): string {
  const actor = entry.actorName ?? translate('activity:unknownActor')
  const title = typeof entry.meta.title === 'string' ? entry.meta.title : ''
  const key = `activity:actions.${entry.action}`
  const params = { actor, title, name: title, role: String(entry.meta.role ?? '') }
  return translate([key, 'activity:actions.unknown'], { ...params, action: entry.action })
}
