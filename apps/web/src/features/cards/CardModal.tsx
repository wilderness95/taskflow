import { isPriority, parseTags, PRIORITIES } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { Modal } from '../../shared/ui/Modal'
import type { Columns } from '../boards/types'
import { ChecklistEditor } from './ChecklistEditor'
import { priorityLabels } from './priorityLabels'
import type { TaskDraft } from './taskDraft'

type CardModalProps = {
  mode: 'create' | 'edit'
  initialDraft: TaskDraft
  columns: Columns
  onSave: (draft: TaskDraft) => void
  onClose: () => void
}

export function CardModal({ mode, initialDraft, columns, onSave, onClose }: CardModalProps) {
  const [draft, setDraft] = useState(initialDraft)
  const isCreate = mode === 'create'

  const setField = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) {
      return
    }
    onSave(draft)
  }

  return (
    <Modal
      eyebrow={isCreate ? 'Új feladat' : 'Feladat szerkesztése'}
      title={isCreate ? 'Kártya hozzáadása' : 'Kártya módosítása'}
      onClose={onClose}
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          Cím
          <input
            type="text"
            value={draft.title}
            placeholder="Pl. Jira ticket frissítése"
            onChange={(event) => setField('title', event.target.value)}
          />
        </label>

        <label>
          Leírás
          <textarea
            rows={4}
            value={draft.description}
            placeholder="Mit kell megcsinálni?"
            onChange={(event) => setField('description', event.target.value)}
          />
        </label>

        <div className="form-row">
          <label>
            Prioritás
            <select
              value={draft.priority}
              onChange={(event) => {
                if (isPriority(event.target.value)) {
                  setField('priority', event.target.value)
                }
              }}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Oszlop
            <select
              value={draft.column}
              onChange={(event) => setField('column', event.target.value)}
            >
              {Object.entries(columns).map(([columnId, column]) => (
                <option key={columnId} value={columnId}>
                  {column.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="single-field">
          Címkék
          <input
            type="text"
            value={draft.tags}
            placeholder="UI, UX, Marketing"
            onChange={(event) => setField('tags', event.target.value)}
          />
          <div className="tag-preview-row">
            {parseTags(draft.tags).map((tag) => (
              <span key={`${tag.label}-${tag.color}`} className={`task-tag tag-${tag.color}`}>
                {tag.label}
              </span>
            ))}
          </div>
        </label>

        <label className="single-field">
          Határidő
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) => setField('dueDate', event.target.value)}
          />
        </label>

        <ChecklistEditor
          title={draft.checklistTitle}
          items={draft.checklistItems}
          onTitleChange={(title) => setField('checklistTitle', title)}
          onItemsChange={(items) => setField('checklistItems', items)}
        />

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Mégse
          </button>
          <button type="submit" className="primary-button">
            {isCreate ? 'Hozzáadás' : 'Mentés'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
