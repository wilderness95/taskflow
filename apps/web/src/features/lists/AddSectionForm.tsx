import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListMutations } from './useListMutations'

export function AddSectionForm({ mutations }: { mutations: ListMutations }) {
  const { t } = useTranslation('lists')
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')

  if (!isOpen) {
    return (
      <button type="button" className="secondary-button" onClick={() => setIsOpen(true)}>
        {t('section.add')}
      </button>
    )
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    mutations.createSection.mutate(trimmed, {
      onSuccess: () => {
        setTitle('')
        setIsOpen(false)
      },
    })
  }

  return (
    <form
      className="list-add-form"
      onSubmit={handleSubmit}
      onKeyDown={(event) => event.key === 'Escape' && setIsOpen(false)}
    >
      <input
        type="text"
        aria-label={t('section.titleLabel')}
        placeholder={t('section.addTitle')}
        maxLength={200}
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button type="submit" className="primary-button" disabled={mutations.createSection.isPending}>
        {t('section.addSubmit')}
      </button>
    </form>
  )
}
