import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listCardActivity } from '../../api/activity'
import { ActivityList } from './ActivityList'

type CardActivityProps = { boardId: string; cardId: string }

/** A kártya naplója összecsukható szakaszban; csak kinyitva töltődik be. */
export function CardActivity({ boardId, cardId }: CardActivityProps) {
  const { t } = useTranslation('activity')
  const [open, setOpen] = useState(false)

  return (
    <details className="card-activity" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t('cardTitle')}</summary>
      {open && (
        <ActivityList
          queryKey={['board', boardId, 'card-activity', cardId]}
          fetchPage={(cursor) => listCardActivity(cardId, cursor)}
        />
      )}
    </details>
  )
}
