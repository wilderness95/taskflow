import type { BoardView, Visibility } from './types'

// A megjelenített szövegek a `board` névtérben vannak (visibility.*, views.*).
export const VISIBILITIES: Visibility[] = ['private', 'workspace', 'public']

export const VISIBILITY_ICONS: Record<Visibility, string> = {
  private: '🔒',
  workspace: '👥',
  public: '🌍',
}

export const VIEWS: BoardView[] = ['kanban', 'list', 'calendar', 'timeline']
