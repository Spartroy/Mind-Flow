import { useTranslation } from 'react-i18next'
import { usePrefs, type ThemePref } from '@/lib/prefs'
import type { Locale } from '@/i18n'

export function PrefsBar() {
  const { t } = useTranslation()
  const { theme, locale, setTheme, setLocale } = usePrefs()
  const sel = 'rounded-control border-[1.5px] border-border bg-surface px-2 py-1 text-sm text-fg'
  return (
    <div className="flex gap-2">
      <select
        aria-label={t('settings.theme')}
        className={sel}
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemePref)}
      >
        <option value="system">{t('settings.system')}</option>
        <option value="light">{t('settings.light')}</option>
        <option value="dark">{t('settings.dark')}</option>
      </select>
      <select
        aria-label={t('settings.language')}
        className={sel}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        <option value="en">English (LTR)</option>
        <option value="ar">العربية (RTL)</option>
      </select>
    </div>
  )
}
