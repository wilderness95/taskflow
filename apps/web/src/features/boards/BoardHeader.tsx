import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { BoardMoreMenu } from './BoardMoreMenu'
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

        <BoardMoreMenu
          items={[
            { key: 'members', label: t('members.open'), onSelect: onMembers },
            { key: 'activity', label: t('activity.open'), onSelect: onActivity },
            { key: 'labels', label: t('labels:open'), onSelect: onLabels },
            { key: 'archive', label: t('archive:open'), onSelect: onArchive },
            { key: 'shortcuts', label: t('shortcuts:open'), onSelect: onShortcuts },
            ...(meta.permissions.update
              ? [
                  {
                    key: 'archive-board',
                    label: t('archive:board.archive'),
                    onSelect: onArchiveBoard,
                    danger: true,
                  },
                ]
              : []),
          ]}
        />
        {meta.permissions.write && (
          <button type="button" className="primary-button" onClick={onAddColumn}>
            {t('addColumn')}
          </button>
        )}
      </div>
    </section>
  )
}
