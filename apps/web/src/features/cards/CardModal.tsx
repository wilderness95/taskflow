import { isPriority, parseTags, PRIORITIES } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../shared/ui/Modal'
import type { Assignee, Columns } from '../boards/types'
import { AssigneePicker } from './AssigneePicker'
import { ChecklistEditor } from './ChecklistEditor'
import type { TaskDraft } from './taskDraft'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import '../../shared/styles/tags.css'

type CardModalProps = {
  mode: 'create' | 'edit'
  initialDraft: TaskDraft
  columns: Columns
  participants: Assignee[]
  onSave: (draft: TaskDraft) => void
  onClose: () => void
}

export function CardModal({
  mode,
  initialDraft,
  columns,
  participants,
  onSave,
  onClose,
}: CardModalProps) {
  const { t } = useTranslation(['card', 'common'])
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
      eyebrow={isCreate ? t('card:modal.createEyebrow') : t('card:modal.editEyebrow')}
      title={isCreate ? t('card:modal.createTitle') : t('card:modal.editTitle')}
      onClose={onClose}
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('card:fields.title')}
          <input
            type="text"
            value={draft.title}
            placeholder={t('card:fields.titlePlaceholder')}
            onChange={(event) => setField('title', event.target.value)}
          />
        </label>

        <label>
          {t('card:fields.description')}
          <textarea
            rows={4}
            value={draft.description}
            placeholder={t('card:fields.descriptionPlaceholder')}
            onChange={(event) => setField('description', event.target.value)}
          />
        </label>

        <div className="form-row">
          <label>
            {t('card:fields.priority')}
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
                  {t(`card:priority.${priority}`)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('card:fields.column')}
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
          {t('card:fields.tags')}
          <input
            type="text"
            value={draft.tags}
            placeholder={t('card:fields.tagsPlaceholder')}
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

        <AssigneePicker
          participants={participants}
          selectedIds={draft.assigneeIds}
          onChange={(ids) => setField('assigneeIds', ids)}
        />

        <label className="single-field">
          {t('card:fields.dueDate')}
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
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button">
            {isCreate ? t('card:modal.create') : t('card:modal.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
