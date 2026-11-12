import { useTranslation } from 'react-i18next'
import '../../shared/styles/base.css'
import './BoardToolbar.css'

type BoardToolbarProps = {
  /** A haladó szűrő aktív feltételeinek száma. */
  activeFilterCount: number
  filtersOpen: boolean
  onToggleFilters: () => void
}

/** A tábla eszköztára: a haladó szűrők kapcsolója (a keresés a felső sávban van). */
export function BoardToolbar({
  activeFilterCount,
  filtersOpen,
  onToggleFilters,
}: BoardToolbarProps) {
  const { t } = useTranslation('filters')

  return (
    <div className="board-toolbar">
      <button
        type="button"
        className="secondary-button"
        aria-expanded={filtersOpen}
        onClick={onToggleFilters}
        aria-keyshortcuts="F"
      >
        {activeFilterCount > 0 ? t('openCount', { count: activeFilterCount }) : t('open')}
      </button>
    </div>
  )
}
