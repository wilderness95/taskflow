import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { BoardTitle } from './BoardTitle'
import type { BoardMeta } from './useBoardData'
import { ViewSwitcher } from './ViewSwitcher'
import { VisibilityMenu } from './VisibilityMenu'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import './BoardHeader.css'

type BoardHeaderProps = {
  meta: BoardMeta
  onMembers: () => void
  onActivity: () => void
  onArchive: () => void
  onLabels: () => void
  onShortcuts: () => void
  onArchiveBoard: () => void
  onAddColumn: () => void
}

export function BoardHeader({
  meta,
  onMembers,
  onActivity,
  onArchive,
  onLabels,
  onShortcuts,
  onArchiveBoard,
  onAddColumn,
}: BoardHeaderProps) {
  const { t } = useTranslation(['board', 'archive', 'labels', 'shortcuts'])

  return (
    <section className="board-header">
      <div className="board-header-main">
        <span className="eyebrow">{t('eyebrow')}</span>
        <BoardTitle
          title={meta.title}
          onChange={meta.setTitle}
          readOnly={!meta.permissions.update}
        />
      </div>

      <div className="board-actions">
        <button
          type="button"
          className={classNames('board-star-button', meta.isStarred && 'is-starred')}
          onClick={meta.toggleStar}
          aria-label={meta.isStarred ? t('star.remove') : t('star.add')}
        >
          ★
        </button>

        <VisibilityMenu
          visibility={meta.visibility}
          onChange={meta.setVisibility}
          readOnly={!meta.permissions.update}
        />
        <ViewSwitcher activeView={meta.activeView} onChange={meta.setActiveView} />

        <button type="button" className="secondary-button" onClick={onMembers}>
          {t('members.open')}
        </button>
        <button type="button" className="secondary-button" onClick={onActivity}>
          {t('activity.open')}
        </button>
        <button
          type="button"
          className="secondary-button"
          aria-keyshortcuts="?"
          onClick={onShortcuts}
        >
          {t('shortcuts:open')}
        </button>
        <button type="button" className="secondary-button" onClick={onLabels}>
          {t('labels:open')}
        </button>
        <button type="button" className="secondary-button" onClick={onArchive}>
          {t('archive:open')}
        </button>
        {meta.permissions.update && (
          <button type="button" className="secondary-button" onClick={onArchiveBoard}>
            {t('archive:board.archive')}
          </button>
        )}
        {meta.permissions.write && (
          <button type="button" className="primary-button" onClick={onAddColumn}>
            {t('addColumn')}
          </button>
        )}
      </div>
    </section>
  )
}
