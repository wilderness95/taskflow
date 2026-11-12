import type { BoardView } from '../boards/types'
import { CalendarView } from './CalendarView'
import { ListView } from './ListView'
import { TimelineView } from './TimelineView'
import type { ViewProps } from './ViewProps'

type BoardAltViewProps = ViewProps & { view: Exclude<BoardView, 'kanban'> }

/** A nem Kanban nézetek közös belépési pontja. */
export function BoardAltView({ view, ...props }: BoardAltViewProps) {
  switch (view) {
    case 'list':
      return <ListView {...props} />
    case 'calendar':
      return <CalendarView {...props} />
    case 'timeline':
      return <TimelineView {...props} />
  }
}
