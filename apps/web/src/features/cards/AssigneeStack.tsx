import { useTranslation } from 'react-i18next'
import { Avatar } from '../auth/Avatar'
import type { Assignee } from '../boards/types'
import './AssigneeStack.css'

type AssigneeStackProps = {
  assignees: Assignee[]
  /** Ennyi avatár után "+N" jelölő jön. */
  max?: number
}

/** A kártya felelőseinek egymásra csúsztatott avatarjai. */
export function AssigneeStack({ assignees, max = 4 }: AssigneeStackProps) {
  const { t } = useTranslation('card')
  if (assignees.length === 0) return null
  const shown = assignees.slice(0, max)
  const extra = assignees.length - shown.length

  return (
    <div
      className="assignee-stack"
      role="group"
      aria-label={t('assignees.stackAria', { names: assignees.map((a) => a.name).join(', ') })}
    >
      {shown.map((assignee) => (
        <span key={assignee.id} className="assignee-stack-item" title={assignee.name}>
          <Avatar user={assignee} />
        </span>
      ))}
      {extra > 0 && <span className="assignee-stack-more">+{extra}</span>}
    </div>
  )
}
