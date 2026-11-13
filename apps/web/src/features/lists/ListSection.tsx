import type { ListGroup } from '@taskflow/shared'
import { useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { Icon } from '../../shared/ui/Icon'
import type { ListMutations } from './useListMutations'

type Props = {
  group: ListGroup
  canWrite: boolean
  mutations: ListMutations
  hasDrag: boolean
  onDropEnd: () => void
  children: React.ReactNode
}

/** Egy csoport: a szakasz fejléce (átnevezés, törlés) és a tételei; a szakasz nélküli csoportnak nincs fejléce. */
export function ListSection({ group, canWrite, mutations, hasDrag, onDropEnd, children }: Props) {
  const { t } = useTranslation('lists')
  const { section } = group
  const [isRenaming, setIsRenaming] = useState(false)
  const [draft, setDraft] = useState(section?.title ?? '')
  const [isDeleting, setIsDeleting] = useState(false)

  const submitRename = () => {
    const trimmed = draft.trim()
    if (section && trimmed && trimmed !== section.title) {
      mutations.renameSection.mutate({ id: section.id, title: trimmed })
    }
    setIsRenaming(false)
  }
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    onDropEnd()
  }

  return (
    <section
      className="list-section"
      aria-label={section?.title ?? t('section.loose')}
      onDragOver={(event) => hasDrag && event.preventDefault()}
      onDrop={handleDrop}
    >
      {section && (
        <header className="list-section-header">
          {isRenaming ? (
            <input
              type="text"
              aria-label={t('section.titleLabel')}
              maxLength={200}
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={submitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitRename()
                if (event.key === 'Escape') setIsRenaming(false)
              }}
            />
          ) : (
            <h2>{section.title}</h2>
          )}
          {canWrite && !isRenaming && (
            <div className="list-item-actions">
              <button
                type="button"
                className="list-icon-button"
                title={t('section.rename')}
                aria-label={t('section.renameAria', { title: section.title })}
                onClick={() => {
                  setDraft(section.title)
                  setIsRenaming(true)
                }}
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                type="button"
                className="list-icon-button"
                title={t('section.delete')}
                aria-label={t('section.deleteAria', { title: section.title })}
                onClick={() => setIsDeleting(true)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
        </header>
      )}
      {group.items.length === 0 ? (
        <p className="list-section-empty">{t('section.empty')}</p>
      ) : (
        <ul className="list-items">{children}</ul>
      )}
      {isDeleting && section && (
        <ConfirmModal
          eyebrow={t('section.deleteTitle')}
          title={t('section.deleteTitle')}
          message={t('section.deleteMessage', { title: section.title })}
          confirmLabel={t('section.delete')}
          onClose={() => setIsDeleting(false)}
          onConfirm={() => {
            mutations.deleteSection.mutate(section.id)
            setIsDeleting(false)
          }}
        />
      )}
    </section>
  )
}
