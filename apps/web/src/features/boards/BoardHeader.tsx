import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { BoardTitle } from './BoardTitle'
import type { BoardMeta } from './useBoardMeta'
import { ViewSwitcher } from './ViewSwitcher'
import { VisibilityMenu } from './VisibilityMenu'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import './BoardHeader.css'

type BoardHeaderProps = {
  meta: BoardMeta
  onInvite: () => void
  onAddColumn: () => void
}

export function BoardHeader({ meta, onInvite, onAddColumn }: BoardHeaderProps) {
  const { t } = useTranslation('board')

  return (
    <section className="board-header">
      <div className="board-header-main">
        <span className="eyebrow">{t('eyebrow')}</span>
        <BoardTitle title={meta.title} onChange={meta.setTitle} />
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

        <VisibilityMenu visibility={meta.visibility} onChange={meta.setVisibility} />
        <ViewSwitcher activeView={meta.activeView} onChange={meta.setActiveView} />

        <div className="member-stack">
          <span className="member">A</span>
          <span className="member">B</span>
          <span className="member">C</span>
        </div>

        <button type="button" className="secondary-button" onClick={onInvite}>
          {t('invite')}
        </button>
        <button type="button" className="primary-button" onClick={onAddColumn}>
          {t('addColumn')}
        </button>
      </div>
    </section>
  )
}
