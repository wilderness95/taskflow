import {
  isBoardFilterEmpty,
  PRIORITIES,
  EMPTY_BOARD_FILTER,
  type BoardFilter,
  type DueDateState,
  type LabelDto,
} from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import type { Assignee } from '../boards/types'
import { FilterGroup } from './FilterGroup'
import { SavedFilters } from './SavedFilters'
import '../../shared/styles/buttons.css'
import './BoardFilterPanel.css'

const DUE_STATES: DueDateState[] = ['overdue', 'soon', 'normal', 'none']

type BoardFilterPanelProps = {
  boardId: string
  filter: BoardFilter
  onChange: (filter: BoardFilter) => void
  labels: LabelDto[]
  participants: Assignee[]
}

/** A haladó szűrő: prioritás, címke, felelős és határidő szerint, mentett szűrőkkel. */
export function BoardFilterPanel({
  boardId,
  filter,
  onChange,
  labels,
  participants,
}: BoardFilterPanelProps) {
  const { t } = useTranslation(['filters', 'card'])
  const set = <K extends keyof BoardFilter>(key: K, value: BoardFilter[K]) =>
    onChange({ ...filter, [key]: value })

  return (
    <div className="board-filter-panel" role="region" aria-label={t('filters:title')}>
      <div className="filter-groups">
        <FilterGroup
          legend={t('filters:priority')}
          options={PRIORITIES.map((value) => ({ value, label: t(`card:priority.${value}`) }))}
          selected={filter.priorities}
          onChange={(value) => set('priorities', value)}
        />
        <FilterGroup
          legend={t('filters:labels')}
          options={labels.map((label) => ({ value: label.id, label: label.name }))}
          selected={filter.labelIds}
          onChange={(value) => set('labelIds', value)}
        />
        <FilterGroup
          legend={t('filters:assignees')}
          options={participants.map((person) => ({ value: person.id, label: person.name }))}
          selected={filter.assigneeIds}
          onChange={(value) => set('assigneeIds', value)}
        />
        <FilterGroup
          legend={t('filters:due')}
          options={DUE_STATES.map((value) => ({ value, label: t(`filters:dueStates.${value}`) }))}
          selected={filter.due}
          onChange={(value) => set('due', value)}
        />
      </div>

      <button
        type="button"
        className="secondary-button"
        disabled={isBoardFilterEmpty(filter)}
        onClick={() => onChange(EMPTY_BOARD_FILTER)}
      >
        {t('filters:clear')}
      </button>

      <SavedFilters
        boardId={boardId}
        current={filter}
        canSave={!isBoardFilterEmpty(filter)}
        onApply={onChange}
      />
    </div>
  )
}
