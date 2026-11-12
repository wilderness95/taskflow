import type { ListSectionDto } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListMutations } from './useListMutations'

type Props = { sections: ListSectionDto[]; mutations: ListMutations }

/** Gyors tételfelvétel: Enter hozzáadja, és az beviteli mező marad fókuszban a következő tételhez. */
export function AddItemForm({ sections, mutations }: Props) {
  const { t } = useTranslation('lists')
  const [text, setText] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [recurring, setRecurring] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    mutations.createItem.mutate(
      { text: trimmed, sectionId: sectionId || null, recurring },
      { onSuccess: () => setText('') },
    )
  }

  return (
    <form className="list-add-form" onSubmit={handleSubmit}>
      <input
        type="text"
        aria-label={t('add.label')}
        placeholder={t('add.placeholder')}
        maxLength={300}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {sections.length > 0 && (
        <select
          aria-label={t('add.section')}
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
        >
          <option value="">{t('item.noSection')}</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </select>
      )}
      <label className="list-check-label">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(event) => setRecurring(event.target.checked)}
        />
        {t('add.recurring')}
      </label>
      <button type="submit" className="primary-button" disabled={mutations.createItem.isPending}>
        {t('add.submit')}
      </button>
    </form>
  )
}
