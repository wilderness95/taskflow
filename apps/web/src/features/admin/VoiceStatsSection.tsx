import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatMinutes, formatNumber } from '../../i18n/format'
import { useVoiceStats } from './useAdmin'

const PERIODS = [7, 30, 90] as const

/** A hangasszisztens használata (költségkontroll): hossz, megszakítások, hibák, hangmennyiség. */
export function VoiceStatsSection() {
  const { t } = useTranslation('admin')
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const { data, isError, isPending } = useVoiceStats(days)

  const stats = data
    ? ([
        { key: 'sessions', value: formatNumber(data.totals.sessions) },
        { key: 'totalTime', value: formatMinutes(data.totals.durationMs) },
        { key: 'avgTime', value: formatMinutes(data.totals.avgDurationMs) },
        { key: 'maxTime', value: formatMinutes(data.totals.maxDurationMs) },
        { key: 'interruptions', value: formatNumber(data.totals.interruptions) },
        { key: 'toolCalls', value: formatNumber(data.totals.toolCalls) },
        { key: 'toolErrors', value: formatNumber(data.totals.toolErrors) },
        { key: 'audioIn', value: formatMinutes(data.totals.audioInMs) },
        { key: 'audioOut', value: formatMinutes(data.totals.audioOutMs) },
      ] as const)
    : []

  return (
    <section className="admin-section" aria-label={t('voice.title')}>
      <h2>{t('voice.title')}</h2>
      <div className="admin-filters">
        <label>
          <span>{t('voice.period')}</span>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as (typeof PERIODS)[number])}
          >
            {PERIODS.map((period) => (
              <option key={period} value={period}>
                {t('voice.days', { count: period })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isError && <p role="alert">{t('loadError')}</p>}
      {isPending && (
        <p role="status" className="admin-empty">
          {t('loading')}
        </p>
      )}
      {data && data.totals.sessions === 0 && <p className="admin-empty">{t('voice.empty')}</p>}
      {data && data.totals.sessions > 0 && (
        <>
          <dl className="admin-stats">
            {stats.map((stat) => (
              <div key={stat.key} className="admin-stat">
                <dt>{t(`voice.${stat.key}`)}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
          <h3>{t('voice.endReasons')}</h3>
          <ul className="admin-health">
            {data.byReason.map((row) => (
              <li
                key={row.reason}
                data-state={row.reason === 'upstream_error' ? 'error' : undefined}
              >
                <span>{t(`voice.reasons.${row.reason}`)}</span>
                <strong>{formatNumber(row.count)}</strong>
              </li>
            ))}
          </ul>
          <h3>{t('voice.topUsers')}</h3>
          <ul>
            {data.topUsers.map((user) => (
              <li key={user.userId ?? 'deleted'}>
                {t('voice.userLine', {
                  name: user.name ?? t('voice.unknownUser'),
                  sessions: formatNumber(user.sessions),
                  time: formatMinutes(user.durationMs),
                })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
