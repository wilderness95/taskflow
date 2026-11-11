import type { BoardView, Visibility } from './types'

// Átmeneti szövegek: az i18n lépésben kerülnek a fordítási fájlokba.
type VisibilityOption = { icon: string; label: string; description: string }
type ViewOption = { label: string; shortLabel: string }

export const VISIBILITIES: Visibility[] = ['private', 'workspace', 'public']

export const VISIBILITY_OPTIONS: Record<Visibility, VisibilityOption> = {
  private: { icon: '🔒', label: 'Privát', description: 'Csak meghívottak látják' },
  workspace: {
    icon: '👥',
    label: 'Munkaterületi',
    description: 'A munkaterület tagjai látják',
  },
  public: { icon: '🌍', label: 'Nyilvános', description: 'Bárki megtekintheti' },
}

export const VIEWS: BoardView[] = ['kanban', 'list', 'calendar', 'timeline']

export const VIEW_OPTIONS: Record<BoardView, ViewOption> = {
  kanban: { label: 'Kanban Tábla', shortLabel: 'Táblás' },
  list: { label: 'Lista', shortLabel: 'Lista' },
  calendar: { label: 'Naptár', shortLabel: 'Naptár' },
  timeline: { label: 'Idővonal', shortLabel: 'Idővonal' },
}
