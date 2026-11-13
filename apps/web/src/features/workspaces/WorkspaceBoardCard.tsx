import type { BoardSummaryDto } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { classNames } from '../../shared/lib/classNames'
import { Icon } from '../../shared/ui/Icon'
import { VISIBILITY_ICONS } from '../boards/boardOptions'

type WorkspaceBoardCardProps = {
  board: BoardSummaryDto
  onToggleStar: () => void
}

export function WorkspaceBoardCard({ board, onToggleStar }: WorkspaceBoardCardProps) {
  const { t } = useTranslation(['workspace', 'board'])

  return (
    <div className="workspace-board-card">
      <Link to={`/b/${board.id}`} className="workspace-board-link">
        <strong>{board.title}</strong>
        <span className="workspace-board-meta">
          <Icon name={VISIBILITY_ICONS[board.visibility]} size={14} />
          <span>{t(`board:visibility.${board.visibility}.label`)}</span>
        </span>
      </Link>
      <button
        type="button"
        className={classNames('board-star-button', board.starred && 'is-starred')}
        aria-pressed={board.starred}
        aria-label={board.starred ? t('board:star.remove') : t('board:star.add')}
        onClick={onToggleStar}
      >
        <Icon name="star" size={16} filled={board.starred} />
      </button>
    </div>
  )
}
