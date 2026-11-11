import { classNames } from '../../shared/lib/classNames'
import { VIEWS, VIEW_OPTIONS } from './boardOptions'
import type { BoardView } from './types'

type ViewSwitcherProps = {
  activeView: BoardView
  onChange: (view: BoardView) => void
}

export function ViewSwitcher({ activeView, onChange }: ViewSwitcherProps) {
  return (
    <div className="view-switcher" aria-label="Nézet választó">
      {VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          className={classNames('view-tab', activeView === view && 'active')}
          onClick={() => onChange(view)}
        >
          {VIEW_OPTIONS[view].label}
        </button>
      ))}
    </div>
  )
}
