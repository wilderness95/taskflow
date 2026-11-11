import auth from './locales/hu/auth.json'
import board from './locales/hu/board.json'
import card from './locales/hu/card.json'
import column from './locales/hu/column.json'
import common from './locales/hu/common.json'
import workspace from './locales/hu/workspace.json'

/**
 * A magyar fordítás a kulcsok forrása (ebből jönnek a típusok).
 * Új nyelv: `locales/<lang>/*.json` fájlok + egy bejegyzés ide és a `SUPPORTED_LANGUAGES`-be.
 */
export const resources = {
  hu: { common, auth, board, card, column, workspace },
} as const

export const defaultNS = 'common'

export const SUPPORTED_LANGUAGES = ['hu'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'hu'
