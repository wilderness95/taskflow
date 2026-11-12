import { useTranslation } from 'react-i18next'
import { THEME_PREFERENCES } from '../../shared/theme/theme'
import { useTheme } from '../../shared/theme/useTheme'

/** Téma választó: rendszer / világos / sötét (a felhasználói menüben). */
export function ThemeSwitcher() {
  const { t } = useTranslation('common')
  const { preference, setPreference } = useTheme()

  return (
    <div className="theme-switcher" role="radiogroup" aria-label={t('theme.label')}>
      {THEME_PREFERENCES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={preference === option}
          className={preference === option ? 'theme-option is-active' : 'theme-option'}
          onClick={() => setPreference(option)}
        >
          {t(`theme.${option}`)}
        </button>
      ))}
    </div>
  )
}
