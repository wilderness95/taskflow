import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMonthYear, formatDayOfMonth, formatWeekday } from '../../i18n/format'
import { classNames } from '../../shared/lib/classNames'
import { buildMonthGrid, parseIsoDate, shiftMonth, toIsoDate } from './dates'
import { flattenColumns, groupByDueDate } from './viewItems'
import { ViewTaskButton } from './ViewTaskButton'
import type { ViewProps } from './ViewProps'
import '../../shared/styles/buttons.css'
import './CalendarView.css'

/** Naptár nézet: a kártyák a határidejük napján, hónaponként lapozva. */
export function CalendarView({ columns, onOpenTask }: ViewProps) {
  const { t } = useTranslation('views')
  // A "ma" a nézet megnyitásakor rögzül (a render tiszta marad).
  const [now] = useState(() => new Date())
  const today = toIsoDate(now)
  const [month, setMonth] = useState({ year: now.getFullYear(), monthIndex: now.getMonth() })

  const items = flattenColumns(columns)
  const byDay = groupByDueDate(items)
  const unscheduled = items.filter((item) => !item.task.dueDate)
  const weeks = buildMonthGrid(month.year, month.monthIndex)
  const goTo = (delta: number) => setMonth(shiftMonth(month.year, month.monthIndex, delta))

  return (
    <div className="calendar-view">
      <div className="calendar-nav">
        <button
          type="button"
          className="secondary-button"
          aria-label={t('calendar.previous')}
          onClick={() => goTo(-1)}
        >
          ‹
        </button>
        <h2 aria-live="polite">{formatMonthYear(month.year, month.monthIndex)}</h2>
        <button
          type="button"
          className="secondary-button"
          aria-label={t('calendar.next')}
          onClick={() => goTo(1)}
        >
          ›
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setMonth({ year: now.getFullYear(), monthIndex: now.getMonth() })}
        >
          {t('calendar.today')}
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label={t('calendar.aria')}>
        <div className="calendar-row" role="row">
          {weeks[0]?.map((day) => (
            <div key={day} className="calendar-weekday" role="columnheader">
              {formatWeekday(day)}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="calendar-row" role="row">
            {week.map((day) => {
              const inMonth = parseIsoDate(day).getMonth() === month.monthIndex
              const cards = byDay.get(day) ?? []
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={formatWeekday(day, 'long')}
                  className={classNames(
                    'calendar-cell',
                    !inMonth && 'is-outside',
                    day === today && 'is-today',
                  )}
                >
                  <span className="calendar-day">{formatDayOfMonth(day)}</span>
                  <ul>
                    {cards.map(({ task, columnId, done }) => (
                      <li key={task.id}>
                        <ViewTaskButton
                          task={task}
                          className={classNames('calendar-task', done && 'is-done')}
                          onOpen={onOpenTask && (() => onOpenTask(columnId, task))}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {unscheduled.length > 0 && (
        <section className="calendar-unscheduled" aria-label={t('calendar.unscheduled')}>
          <h3>{t('calendar.unscheduled')}</h3>
          <ul>
            {unscheduled.map(({ task, columnId }) => (
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
