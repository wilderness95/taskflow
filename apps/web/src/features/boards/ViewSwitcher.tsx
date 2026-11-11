import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { VIEWS } from './boardOptions'
import type { BoardView } from './types'

type ViewSwitcherProps = {
  activeView: BoardView
  onChange: (view: BoardView) => void
}

export function ViewSwitcher({ activeView, onChange }: ViewSwitcherProps) {
  const { t } = useTranslation('board')

  return (
    <div className="view-switcher" aria-label={t('views.aria')}>
      {VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          className={classNames('view-tab', activeView === view && 'active')}
          onClick={() => onChange(view)}
        >
          {t(`views.${view}.label`)}
        </button>
      ))}
    </div>
  )
}
