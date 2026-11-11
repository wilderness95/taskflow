import { useTranslation } from 'react-i18next'
import type { BoardMeta } from './useBoardMeta'

type BoardToolbarProps = {
  meta: BoardMeta
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function BoardToolbar({ meta, searchQuery, onSearchChange }: BoardToolbarProps) {
  const { t } = useTranslation('board')

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
