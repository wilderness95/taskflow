import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { Modal } from '../../shared/ui/Modal'
import { COLUMN_ACCENTS, type Column, type ColumnAccent } from '../boards/types'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import './RenameColumnModal.css'

const ACCENT_COLORS: Record<ColumnAccent, string> = {
  blue: '#60a5fa',
  amber: '#fbbf24',
  green: '#34d399',
  purple: '#a78bfa',
  rose: '#fb7185',
}

type RenameColumnModalProps = {
  column: Column
  onSave: (title: string, accent: ColumnAccent) => void
  onClose: () => void
}

export function RenameColumnModal({ column, onSave, onClose }: RenameColumnModalProps) {
  const { t } = useTranslation(['column', 'common'])
  const [title, setTitle] = useState(column.title)
  const [accent, setAccent] = useState(column.accent)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (trimmed) {
      onSave(trimmed, accent)
    }
  }

  return (
    <Modal eyebrow={t('column:rename.eyebrow')} title={t('column:rename.title')} onClose={onClose}>
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('column:rename.name')}
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('column:rename.namePlaceholder')}
          />
        </label>

        <label>
          {t('column:rename.accent')}
          <div className="accent-picker">
            {COLUMN_ACCENTS.map((value) => (
              <button
                key={value}
                type="button"
                className={classNames('accent-swatch', accent === value && 'selected')}
                style={{ background: ACCENT_COLORS[value] }}
                aria-label={t('column:rename.accentAria', { color: t(`column:accent.${value}`) })}
                onClick={() => setAccent(value)}
              />
            ))}
          </div>
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button">
            {t('common:save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
