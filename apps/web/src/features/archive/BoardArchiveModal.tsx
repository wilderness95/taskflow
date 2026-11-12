import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { Modal } from '../../shared/ui/Modal'
import { useBoardArchive } from './useBoardArchive'
import '../../shared/styles/buttons.css'
import './BoardArchiveModal.css'

type BoardArchiveModalProps = { boardId: string; canRestore: boolean; onClose: () => void }

/** A tábla archivált kártyái és oszlopai; az írási joggal rendelkező vissza is állíthatja őket. */
export function BoardArchiveModal({ boardId, canRestore, onClose }: BoardArchiveModalProps) {
  const { t } = useTranslation('archive')
  const { query, restoreCard, restoreColumn } = useBoardArchive(boardId)
  const data = query.data
  const columnArchived =
    restoreCard.error instanceof ApiError && restoreCard.error.code === 'column_archived'

  return (
    <Modal eyebrow={t('eyebrow')} title={t('title')} onClose={onClose}>
      {query.isPending && <p role="status">{t('loading')}</p>}
      {query.isError && <p role="alert">{t('loadError')}</p>}
      {data && data.cards.length === 0 && data.columns.length === 0 && (
        <p className="archive-empty">{t('empty')}</p>
      )}
      {columnArchived && <p role="alert">{t('columnArchived')}</p>}

      {data && data.columns.length > 0 && (
        <section aria-label={t('columns')}>
          <h3>{t('columns')}</h3>
          <ul className="archive-list">
            {data.columns.map((column) => (
              <li key={column.id}>
                <span>{column.title}</span>
                {canRestore && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={restoreColumn.isPending}
                    onClick={() => restoreColumn.mutate(column.id)}
                  >
                    {t('restore')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && data.cards.length > 0 && (
        <section aria-label={t('cards')}>
          <h3>{t('cards')}</h3>
          <ul className="archive-list">
            {data.cards.map((card) => (
              <li key={card.id}>
                <span>{card.title}</span>
                {canRestore && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={restoreCard.isPending}
                    onClick={() => restoreCard.mutate(card.id)}
                  >
                    {t('restore')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Modal>
  )
}
