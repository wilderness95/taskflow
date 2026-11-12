import { getDueDateState } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { formatMediumDate } from '../../i18n/format'
import { classNames } from '../../shared/lib/classNames'
import { flattenColumns } from './viewItems'
import { ViewTaskButton } from './ViewTaskButton'
import type { ViewProps } from './ViewProps'
import '../../shared/styles/tags.css'
import './ListView.css'

/** Lista nézet: a kártyák táblázatban, oszlopok szerint rendezve. */
export function ListView({ columns, onOpenTask }: ViewProps) {
  const { t } = useTranslation(['views', 'card'])
  const items = flattenColumns(columns)

  if (items.length === 0) {
    return <p className="view-empty">{t('views:list.empty')}</p>
  }

  return (
    <div className="list-view-wrap">
      <table className="list-view">
        <caption className="view-caption">{t('views:list.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('views:list.title')}</th>
            <th scope="col">{t('views:list.column')}</th>
            <th scope="col">{t('views:list.priority')}</th>
            <th scope="col">{t('views:list.labels')}</th>
            <th scope="col">{t('views:list.assignees')}</th>
            <th scope="col">{t('views:list.due')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ task, columnId, columnTitle }) => (
            <tr key={task.id}>
              <th scope="row">
                <ViewTaskButton
                  task={task}
                  onOpen={onOpenTask && (() => onOpenTask(columnId, task))}
                />
              </th>
              <td>{columnTitle}</td>
              <td>
                <span className={`priority-pill priority-${task.priority}`}>
                  {t(`card:priority.${task.priority}`)}
                </span>
              </td>
              <td>
                {task.tags.map((tag) => (
                  <span key={tag.label} className={`task-tag tag-${tag.color}`}>
                    {tag.label}
                  </span>
                ))}
              </td>
              <td>{task.assignees.map((assignee) => assignee.name).join(', ')}</td>
              <td>
                {task.dueDate && (
                  <span className={classNames('list-due', getDueDateState(task.dueDate))}>
                    {formatMediumDate(task.dueDate)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
