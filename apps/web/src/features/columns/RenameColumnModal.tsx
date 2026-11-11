import { useState, type FormEvent } from 'react'
import { classNames } from '../../shared/lib/classNames'
import { Modal } from '../../shared/ui/Modal'
import { COLUMN_ACCENTS, type Column, type ColumnAccent } from '../boards/types'

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
    <Modal eyebrow="Oszlop neve" title="Átnevezés" onClose={onClose}>
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          Név
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Írd be az új oszlop nevét"
          />
        </label>

        <label>
          Pötty szín
          <div className="accent-picker">
            {COLUMN_ACCENTS.map((value) => (
              <button
                key={value}
                type="button"
                className={classNames('accent-swatch', accent === value && 'selected')}
                style={{ background: ACCENT_COLORS[value] }}
                aria-label={`Szín: ${value}`}
                onClick={() => setAccent(value)}
              />
            ))}
          </div>
        </label>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Mégse
          </button>
          <button type="submit" className="primary-button">
            Mentés
          </button>
        </div>
      </form>
    </Modal>
  )
}
