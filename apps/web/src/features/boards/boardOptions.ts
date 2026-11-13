import type { IconName } from '../../shared/ui/Icon'
import type { BoardView, Visibility } from './types'

// A megjelenített szövegek a `board` névtérben vannak (visibility.*, views.*).
export const VISIBILITIES: Visibility[] = ['private', 'workspace', 'public']

export const VISIBILITY_ICONS: Record<Visibility, IconName> = {
  private: 'lock',
  workspace: 'users',
  public: 'globe',
}

export const VIEWS: BoardView[] = ['kanban', 'list', 'calendar', 'timeline']
