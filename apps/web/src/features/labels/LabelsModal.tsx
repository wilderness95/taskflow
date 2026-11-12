import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client'
import { Modal } from '../../shared/ui/Modal'
import { LabelRow } from './LabelRow'
import { useLabels } from './useLabels'

type LabelsModalProps = { boardId: string; canEdit: boolean; onClose: () => void }

/** A tábla címkéinek átnevezése, átszínezése és törlése. */
export function LabelsModal({ boardId, canEdit, onClose }: LabelsModalProps) {
  const { t } = useTranslation('labels')
  const { query, update, remove } = useLabels(boardId)
  const labels = query.data ?? []
  const nameTaken = update.error instanceof ApiError && update.error.code === 'label_name_taken'

  return (
    <Modal eyebrow={t('eyebrow')} title={t('title')} onClose={onClose}>
      {query.isError && <p role="alert">{t('loadError')}</p>}
      {query.data && labels.length === 0 && <p>{t('empty')}</p>}
      {update.isError && <p role="alert">{nameTaken ? t('nameTaken') : t('saveError')}</p>}
      <ul className="labels-list">
        {labels.map((label) => (
          <LabelRow
            key={`${label.id}-${label.name}-${label.color}`}
            label={label}
            canEdit={canEdit}
            busy={update.isPending || remove.isPending}
            onSave={(input) => update.mutate({ id: label.id, input })}
            onDelete={() => remove.mutate(label.id)}
          />
        ))}
      </ul>
    </Modal>
  )
}
