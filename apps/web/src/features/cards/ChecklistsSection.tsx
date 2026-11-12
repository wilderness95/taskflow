import { useTranslation } from 'react-i18next'
import { createId } from '../../shared/lib/ids'
import type { TaskChecklist } from '../boards/types'
import { ChecklistEditor } from './ChecklistEditor'
import '../../shared/styles/buttons.css'

type ChecklistsSectionProps = {
  checklists: TaskChecklist[]
  defaultTitle: string
  onChange: (checklists: TaskChecklist[]) => void
}

/** A kártya checklistjei: tetszőleges számú lista felvétele, szerkesztése és törlése. */
export function ChecklistsSection({ checklists, defaultTitle, onChange }: ChecklistsSectionProps) {
  const { t } = useTranslation('card')

  const replace = (id: string, changes: Partial<TaskChecklist>) =>
    onChange(checklists.map((list) => (list.id === id ? { ...list, ...changes } : list)))

  return (
    <section className="checklists-section" aria-label={t('checklist.sectionAria')}>
      {checklists.map((list) => (
        <ChecklistEditor
          key={list.id}
          title={list.title}
          items={list.items}
          onTitleChange={(title) => replace(list.id, { title })}
          onItemsChange={(items) => replace(list.id, { items })}
          onDelete={() => onChange(checklists.filter((other) => other.id !== list.id))}
        />
      ))}
      <button
        type="button"
        className="secondary-button"
        onClick={() =>
          onChange([...checklists, { id: createId('checklist'), title: defaultTitle, items: [] }])
        }
      >
        {t('checklist.add')}
      </button>
    </section>
  )
}
