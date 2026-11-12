import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardFilter } from '@taskflow/shared'
import { ApiError } from '../../api/client'
import { useSavedFilters } from './useSavedFilters'
import '../../shared/styles/buttons.css'

type SavedFiltersProps = {
  boardId: string
  current: BoardFilter
  canSave: boolean
  onApply: (filter: BoardFilter) => void
}

/** A mentett szűrők: alkalmazás, törlés, és az aktuális szűrő mentése névvel. */
export function SavedFilters({ boardId, current, canSave, onApply }: SavedFiltersProps) {
  const { t } = useTranslation('filters')
  const { list, save, remove } = useSavedFilters(boardId)
  const [name, setName] = useState('')
  const saved = list.data ?? []
  const nameTaken = save.error instanceof ApiError && save.error.code === 'filter_name_taken'

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    save.mutate({ name: name.trim(), filter: current }, { onSuccess: () => setName('') })
  }

  return (
    <section className="saved-filters" aria-label={t('saved.title')}>
      <h3>{t('saved.title')}</h3>
      {list.isError && <p role="alert">{t('saved.loadError')}</p>}
      {list.data && saved.length === 0 && <p className="filter-hint">{t('saved.empty')}</p>}
      <ul>
        {saved.map((item) => (
          <li key={item.id}>
            <button type="button" className="secondary-button" onClick={() => onApply(item.filter)}>
              {item.name}
            </button>
            <button
              type="button"
              className="saved-filter-delete"
              aria-label={t('saved.deleteAria', { name: item.name })}
              disabled={remove.isPending}
              onClick={() => remove.mutate(item.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {canSave && (
        <form className="saved-filter-form" onSubmit={handleSave}>
          <input
            type="text"
            value={name}
            maxLength={60}
            placeholder={t('saved.namePlaceholder')}
            aria-label={t('saved.nameAria')}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            className="secondary-button"
            disabled={!name.trim() || save.isPending}
          >
            {t('saved.save')}
          </button>
        </form>
      )}
      {save.isError && (
        <p role="alert">{nameTaken ? t('saved.nameTaken') : t('saved.saveError')}</p>
      )}
    </section>
  )
}
