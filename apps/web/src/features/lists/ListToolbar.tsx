import { clearableItems, resettableItems, type ListDetailDto } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { AddSectionForm } from './AddSectionForm'
import type { ListMutations } from './useListMutations'

type Props = { list: ListDetailDto; mutations: ListMutations }

/** A lista műveletei: szakasz felvétele, ismétlődők visszaállítása, kipipáltak törlése, archiválás. */
export function ListToolbar({ list, mutations }: Props) {
  const { t } = useTranslation('lists')
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'clear' | 'archive' | null>(null)
  const clearable = clearableItems(list.items).length
  const resettable = resettableItems(list.items).length

  return (
    <div className="list-toolbar">
      <AddSectionForm mutations={mutations} />
      <button
        type="button"
        className="secondary-button"
        disabled={resettable === 0}
        onClick={() => mutations.resetRecurring.mutate()}
      >
        {t('actions.resetRecurring', { count: resettable })}
      </button>
      <button
        type="button"
        className="secondary-button"
        disabled={clearable === 0}
        onClick={() => setConfirm('clear')}
      >
        {t('actions.clearDone', { count: clearable })}
      </button>
      <button type="button" className="secondary-button" onClick={() => setConfirm('archive')}>
        {t('actions.archive')}
      </button>

      {confirm === 'clear' && (
        <ConfirmModal
          eyebrow={t('actions.clearDoneTitle')}
          title={t('actions.clearDoneTitle')}
          message={t('actions.clearDoneMessage', { count: clearable })}
          confirmLabel={t('actions.confirm')}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            mutations.clearDone.mutate()
            setConfirm(null)
          }}
        />
      )}
      {confirm === 'archive' && (
        <ConfirmModal
          eyebrow={t('actions.archiveTitle')}
          title={t('actions.archiveTitle')}
          message={t('actions.archiveMessage', { title: list.title })}
          confirmLabel={t('actions.archive')}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            mutations.archive.mutate(undefined, {
              onSuccess: () => navigate(`/w/${list.workspaceId}/lists`),
            })
          }
        />
      )}
    </div>
  )
}
