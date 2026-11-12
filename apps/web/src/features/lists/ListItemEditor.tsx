import type { ListItemDto, ListSectionDto } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListMutations } from './useListMutations'

type Props = {
  item: ListItemDto
  sections: ListSectionDto[]
  mutations: ListMutations
  onDone: () => void
}

/** Egy tétel szerkesztése: szöveg, szakasz és ismétlődés (érintőképernyőn is használható). */
export function ListItemEditor({ item, sections, mutations, onDone }: Props) {
  const { t } = useTranslation('lists')
  const [text, setText] = useState(item.text)
  const [sectionId, setSectionId] = useState(item.sectionId ?? '')
  const [recurring, setRecurring] = useState(item.recurring)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    const changed = trimmed !== item.text || recurring !== item.recurring
    if (changed) {
      try {
        await mutations.updateItem.mutateAsync({
          id: item.id,
          input: { text: trimmed, recurring, version: item.version },
        })
      } catch {
        return // a hibát a központi kezelő jelzi; a szerkesztő nyitva marad
      }
    }
    if ((item.sectionId ?? '') !== sectionId) {
      mutations.moveItem.mutate({
        id: item.id,
        target: { sectionId: sectionId || null, beforeItemId: null },
      })
    }
    onDone()
  }

  return (
    <form
      className="list-item-editor"
      onSubmit={handleSubmit}
      onKeyDown={(event) => event.key === 'Escape' && onDone()}
    >
      <label>
        {t('item.text')}
        <input
          type="text"
          required
          maxLength={300}
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label>
        {t('item.section')}
        <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
          <option value="">{t('item.noSection')}</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </select>
      </label>
      <label className="list-check-label">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(event) => setRecurring(event.target.checked)}
        />
        {t('item.recurring')}
      </label>
      <div className="list-editor-actions">
        <button type="submit" className="primary-button">
          {t('item.save')}
        </button>
        <button type="button" className="secondary-button" onClick={onDone}>
          {t('item.cancel')}
        </button>
      </div>
    </form>
  )
}
