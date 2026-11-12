import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDayOfMonth, formatMediumDate } from '../../i18n/format'
import { classNames } from '../../shared/lib/classNames'
import { parseIsoDate, toIsoDate } from './dates'
import { buildTimeline, flattenColumns } from './viewItems'
import { ViewTaskButton } from './ViewTaskButton'
import type { ViewProps } from './ViewProps'
import './TimelineView.css'

/** Idővonal nézet: a kártyák sávként a létrehozásuktól a határidejükig, napi tengellyel. */
export function TimelineView({ columns, onOpenTask }: ViewProps) {
  const { t } = useTranslation('views')
  const [now] = useState(() => new Date())
  const timeline = buildTimeline(flattenColumns(columns), now)
  const today = toIsoDate(now)

  if (timeline.days.length === 0) {
    return <p className="view-empty">{t('timeline.empty')}</p>
  }

  const gridStyle = { gridTemplateColumns: `200px repeat(${timeline.days.length}, 28px)` }

  return (
    <div className="timeline-view" role="table" aria-label={t('timeline.aria')}>
      <div className="timeline-row timeline-axis" role="row" style={gridStyle}>
        <div role="columnheader" className="timeline-label">
          {t('timeline.card')}
        </div>
        {timeline.days.map((day, index) => {
          const firstOfMonth = parseIsoDate(day).getDate() === 1
          return (
            <div
              key={day}
              role="columnheader"
              title={formatMediumDate(day)}
              className={classNames(
                'timeline-day',
                day === today && 'is-today',
                (firstOfMonth || index === 0) && 'is-month-start',
              )}
            >
              {formatDayOfMonth(day)}
            </div>
          )
        })}
      </div>

      {timeline.rows.map(({ item, offset, span }) => (
        <div key={item.task.id} className="timeline-row" role="row" style={gridStyle}>
          <div role="rowheader" className="timeline-label">
            <ViewTaskButton
              task={item.task}
              onOpen={onOpenTask && (() => onOpenTask(item.columnId, item.task))}
            />
          </div>
          <div
            role="cell"
            className={classNames('timeline-bar', item.done && 'is-done')}
            style={{ gridColumn: `${offset + 2} / span ${span}` }}
            title={`${item.task.title} – ${item.task.dueDate ? formatMediumDate(item.task.dueDate) : ''}`}
          />
        </div>
      ))}

      {timeline.unscheduled.length > 0 && (
        <section className="timeline-unscheduled" aria-label={t('timeline.unscheduled')}>
          <h3>{t('timeline.unscheduled')}</h3>
          <ul>
            {timeline.unscheduled.map(({ task, columnId }) => (
              <li key={task.id}>
                <ViewTaskButton
                  task={task}
                  onOpen={onOpenTask && (() => onOpenTask(columnId, task))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
