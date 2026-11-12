import activity from './locales/hu/activity.json'
import archive from './locales/hu/archive.json'
import apikeys from './locales/hu/apikeys.json'
import auth from './locales/hu/auth.json'
import board from './locales/hu/board.json'
import card from './locales/hu/card.json'
import column from './locales/hu/column.json'
import comment from './locales/hu/comment.json'
import common from './locales/hu/common.json'
import filters from './locales/hu/filters.json'
import labels from './locales/hu/labels.json'
import notification from './locales/hu/notification.json'
import shortcuts from './locales/hu/shortcuts.json'
import views from './locales/hu/views.json'
import voice from './locales/hu/voice.json'
import workspace from './locales/hu/workspace.json'

/**
 * A magyar fordítás a kulcsok forrása (ebből jönnek a típusok).
 * Új nyelv: `locales/<lang>/*.json` fájlok + egy bejegyzés ide és a `SUPPORTED_LANGUAGES`-be.
 */
export const resources = {
  hu: {
    common,
    activity,
    archive,
    auth,
    apikeys,
    board,
    card,
    column,
    comment,
    filters,
    labels,
    notification,
    shortcuts,
    views,
    voice,
    workspace,
  },
} as const

export const defaultNS = 'common'

export const SUPPORTED_LANGUAGES = ['hu'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'hu'
