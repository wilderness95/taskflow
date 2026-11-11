import { VIEW_OPTIONS, VISIBILITY_OPTIONS } from './boardOptions'
import type { BoardMeta } from './useBoardMeta'

type BoardToolbarProps = {
  meta: BoardMeta
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function BoardToolbar({ meta, searchQuery, onSearchChange }: BoardToolbarProps) {
  return (
    <div className="board-toolbar">
      <div className="board-filter-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Szűrés..."
          aria-label="Szűrés"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="board-meta">
        <span className="meta-pill">Láthatóság: {VISIBILITY_OPTIONS[meta.visibility].label}</span>
        <span className="meta-pill">{VIEW_OPTIONS[meta.activeView].shortLabel}</span>
        <span className="meta-pill">{meta.isStarred ? 'Kedvenc' : 'Normál'}</span>
      </div>
    </div>
  )
}
