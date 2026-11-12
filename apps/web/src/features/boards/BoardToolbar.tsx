import { useTranslation } from 'react-i18next'
import type { BoardMeta } from './useBoardData'
import '../../shared/styles/base.css'
import './BoardToolbar.css'

type BoardToolbarProps = {
  meta: BoardMeta
  searchQuery: string
  onSearchChange: (query: string) => void
  /** A haladó szűrő aktív feltételeinek száma. */
  activeFilterCount: number
  filtersOpen: boolean
  onToggleFilters: () => void
}

export function BoardToolbar({
  meta,
  searchQuery,
  onSearchChange,
  activeFilterCount,
  filtersOpen,
  onToggleFilters,
}: BoardToolbarProps) {
  const { t } = useTranslation(['board', 'filters'])

  return (
    <div className="board-toolbar">
      <div className="board-filter-bar">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder={t('filter.placeholder')}
          aria-label={t('filter.aria')}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <button
        type="button"
        className="secondary-button"
        aria-expanded={filtersOpen}
        onClick={onToggleFilters}
      >
        {activeFilterCount > 0
          ? t('filters:openCount', { count: activeFilterCount })
          : t('filters:open')}
      </button>

      <div className="board-meta">
        <span className="meta-pill">
          {t('meta.visibility', { label: t(`visibility.${meta.visibility}.label`) })}
        </span>
        <span className="meta-pill">{t(`views.${meta.activeView}.short`)}</span>
        <span className="meta-pill">
          {meta.isStarred ? t('meta.starred') : t('meta.notStarred')}
        </span>
      </div>
    </div>
  )
}
