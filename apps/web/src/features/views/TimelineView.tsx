import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDayOfMonth, formatMediumDate, formatShortDate } from '../../i18n/format'
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
  const todayRef = useRef<HTMLDivElement>(null)
  const timeline = buildTimeline(flattenColumns(columns), now)
  const today = toIsoDate(now)

  useEffect(() => {
    todayRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [timeline.days.length])

  if (timeline.days.length === 0) {
    return <p className="view-empty">{t('timeline.empty')}</p>
  }

  const gridStyle = {
    gridTemplateColumns: `var(--timeline-label-width, 200px) repeat(${timeline.days.length}, 32px)`,
  }

  return (
    <div className="timeline-view" role="table" aria-label={t('timeline.aria')}>
      <div className="timeline-row timeline-axis" role="row" style={gridStyle}>
        <div role="columnheader" className="timeline-label">
          {t('timeline.card')}
        </div>
        {timeline.days.map((day, index) => {
          const firstOfMonth = parseIsoDate(day).getDate() === 1
          const isToday = day === today
          return (
            <div
              key={day}
              ref={isToday ? todayRef : undefined}
              role="columnheader"
              title={formatMediumDate(day)}
              className={classNames(
                'timeline-day',
                isToday && 'is-today',
                (firstOfMonth || index === 0) && 'is-month-start',
              )}
            >
              {formatDayOfMonth(day)}
            </div>
          )
        })}
      </div>

      {timeline.rows.map(({ item, offset, span }) => {
        const dueLabel = item.task.dueDate ? formatShortDate(item.task.dueDate) : ''
        return (
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
              title={`${item.task.title}${item.task.dueDate ? ` – ${formatMediumDate(item.task.dueDate)}` : ''}`}
            >
              <span className="timeline-bar-text">
                {span >= 3 ? `${item.task.title} (${dueLabel})` : dueLabel || item.task.title}
              </span>
            </div>
          </div>
        )
      })}

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
