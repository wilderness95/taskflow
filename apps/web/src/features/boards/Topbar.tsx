import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher'

type TopbarProps = {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalTasks: number
}

export function Topbar({ searchQuery, onSearchChange, totalTasks }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-badge">T</div>
        <span className="brand-name">TaskFlow</span>
      </div>

      <WorkspaceSwitcher />

      <div className="search-box">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder="Keresés kártyákra, címkékre, határidőre..."
          aria-label="Keresés"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <div className="stat-pill">{totalTasks} feladat</div>
        <button type="button" className="icon-button" aria-label="Értesítések">
          ◔
        </button>
        <button type="button" className="icon-button" aria-label="Beállítások">
          ⚙
        </button>
        <div className="avatar">A</div>
      </div>
    </header>
  )
}
