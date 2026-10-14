import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { useBoardActions, useSettings } from '@/features/board/hooks'
import type { Settings } from '@/features/board/types'
import { usePrefs } from '@/lib/prefs'
import { ColumnsSection } from './ColumnsSection'
import { DataSection } from './DataSection'

const selectCls = 'rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-sm font-semibold'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-card border-[1.5px] border-border bg-surface p-6 shadow-[var(--shadow-raised)]">
      <h2 className="mb-1 border-b-[1.5px] border-border pb-3 text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-bold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Minutes({ value, label, min = 1, max = 600, onCommit }: { value: number; label: string; min?: number; max?: number; onCommit: (n: number) => void }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(String(value))
  const commit = () => {
    const n = Math.round(Number(draft))
    if (Number.isFinite(n) && n >= min && n <= max) onCommit(n)
    else setDraft(String(value))
  }
  return (
    <span className="flex items-center gap-2">
      <input
        type="number"
        dir="ltr"
        min={min}
        max={max}
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-20 rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-center text-sm font-bold tabular"
      />
      <span className="text-sm text-muted">{t('settings.min')}</span>
    </span>
  )
}

const SHORTCUTS: [string, string][] = [
  ['settings.sc.search', 'Ctrl K'],
  ['settings.sc.newCard', 'N'],
  ['settings.sc.blitz', 'B'],
  ['settings.sc.pause', 'Space'],
  ['settings.sc.today', 'T'],
  ['settings.sc.direction', 'Ctrl Shift D'],
  ['settings.sc.move', 'Alt ←↑→↓'],
]

export function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettings()
  const act = useBoardActions()
  const prefs = usePrefs()
  const [error, setError] = useState<string | null>(null)
  const save = (patch: Partial<Settings>) => void act.updateSettings(patch).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ d, label: new Intl.DateTimeFormat(prefs.locale, { weekday: 'long' }).format(new Date(2026, 9, 11 + d)) }))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-28">
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-3xl font-extrabold">{t('nav.settings')}</h1>
        {error && <p role="alert" className="text-sm text-coral" dir="auto">{error}</p>}

        <Section title={t('settings.general')}>
          <Row label={t('settings.language')} hint={t('settings.languageHint')}>
            <select
              value={prefs.locale}
              aria-label={t('settings.language')}
              onChange={(e) => {
                const l = e.target.value as Settings['locale']
                prefs.setLocale(l)
                save({ locale: l })
              }}
              className={selectCls}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </Row>
          <Row label={t('settings.theme')} hint={t('settings.themeHint')}>
            <select
              value={prefs.theme}
              aria-label={t('settings.theme')}
              onChange={(e) => {
                const v = e.target.value as Settings['theme']
                prefs.setTheme(v)
                save({ theme: v })
              }}
              className={selectCls}
            >
              <option value="system">{t('settings.system')}</option>
              <option value="light">{t('settings.light')}</option>
              <option value="dark">{t('settings.dark')}</option>
            </select>
          </Row>
          <Row label={t('settings.weekStart')} hint={t('settings.weekStartHint')}>
            <select value={settings.week_start} aria-label={t('settings.weekStart')} onChange={(e) => save({ week_start: Number(e.target.value) })} className={selectCls}>
              {days.map((x) => <option key={x.d} value={x.d}>{x.label}</option>)}
            </select>
          </Row>
        </Section>

        <Section title={t('settings.focus')}>
          <Row label={t('settings.defaultEstimate')} hint={t('settings.defaultEstimateHint')}>
            <Minutes value={settings.default_estimate_min} label={t('settings.defaultEstimate')} onCommit={(n) => save({ default_estimate_min: n })} />
          </Row>
          <Row label={t('settings.pomodoroLength')} hint={t('settings.pomodoroLengthHint')}>
            <Minutes value={settings.pomodoro_focus_min} label={t('settings.pomodoroLength')} onCommit={(n) => save({ pomodoro_focus_min: n })} />
          </Row>
          <Row label={t('settings.shortBreak')} hint={t('settings.shortBreakHint')}>
            <Minutes value={settings.pomodoro_break_min} label={t('settings.shortBreak')} max={120} onCommit={(n) => save({ pomodoro_break_min: n })} />
          </Row>
          <Row label={t('settings.autoFloat')} hint={t('settings.autoFloatHint')}>
            <Switch checked={settings.auto_float_timer} onChange={(v) => save({ auto_float_timer: v })} label={t('settings.autoFloat')} />
          </Row>
          <Row label={t('settings.overtime')} hint={t('settings.overtimeHint')}>
            <Switch checked={settings.overtime_message} onChange={(v) => save({ overtime_message: v })} label={t('settings.overtime')} />
          </Row>
          <Row label={t('settings.sound')} hint={t('settings.soundHint')}>
            <Switch checked={settings.sound} onChange={(v) => save({ sound: v })} label={t('settings.sound')} />
          </Row>
        </Section>

        <Section title={t('settings.columns')}>
          <ColumnsSection />
        </Section>

        <Section title={t('settings.data')}>
          <DataSection />
        </Section>

        <Section title={t('settings.shortcuts')}>
          <ul>
            {SHORTCUTS.map(([k, keys]) => (
              <li key={k} className="flex items-center justify-between gap-3 border-b-[1.5px] border-border py-3 last:border-b-0">
                <span>{t(k)}</span>
                <kbd dir="ltr" className="rounded-[8px] border-[1.5px] border-border bg-surface-muted px-2 py-0.5 text-xs font-bold">{keys}</kbd>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
