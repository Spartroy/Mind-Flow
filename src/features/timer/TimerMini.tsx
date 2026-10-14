import { Check, Minimize2, Pause, Play, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatClock } from './core'

interface Props {
  title: string
  seconds: number // the number to show (elapsed, or overtime seconds)
  overtime: boolean
  paused: boolean
  fraction: number
  compact?: boolean
  onToggle: () => void
  onFinish: () => void
  onClose?: () => void
  onCompact?: () => void
  note?: string
}

/** One layout for both the Document PiP window (300x130 / 160x60) and the in-page fallback. */
export function TimerMini({ title, seconds, overtime, paused, fraction, compact, onToggle, onFinish, onClose, onCompact, note }: Props) {
  const { t } = useTranslation()
  const icon = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const
  const clock = `${overtime ? '+' : ''}${formatClock(seconds)}`
  const toggle = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={paused ? t('blitz.resume') : t('blitz.pause')}
      className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-border bg-surface text-fg"
    >
      {paused ? <Play {...icon} /> : <Pause {...icon} />}
    </button>
  )
  if (compact) {
    return (
      <div className="flex h-full items-center justify-between gap-2 bg-surface px-3 text-fg">
        <span className={cn('text-xl font-extrabold tabular', overtime && 'text-coral')} aria-label={t('blitz.timerLabel')}>{clock}</span>
        {toggle}
        {onCompact && (
          <button type="button" onClick={onCompact} aria-label={t('float.label')} className="text-muted"><Minimize2 {...icon} className="rotate-180" /></button>
        )}
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col justify-between gap-1 bg-surface p-3 text-fg">
      <div className="flex items-center gap-2">
        <span className={cn('size-2 shrink-0 rounded-full', paused ? 'bg-warning' : 'bg-primary')} aria-hidden />
        <p dir="auto" className="min-w-0 flex-1 truncate text-start text-xs font-semibold">
          {paused && <span className="me-1 text-warning">{t('blitz.paused')} ·</span>}
          {title}
        </p>
        {onCompact && <button type="button" onClick={onCompact} aria-label={t('float.label')} className="text-muted"><Minimize2 {...icon} /></button>}
        {onClose && <button type="button" onClick={onClose} aria-label={t('float.close')} className="text-muted"><X {...icon} /></button>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[40px] leading-none font-extrabold tabular', overtime ? 'text-coral' : paused && 'text-fg-2')} aria-label={t('blitz.timerLabel')}>
          {clock}
        </span>
        <div className="flex gap-2">
          {toggle}
          <button type="button" onClick={onFinish} aria-label={t('blitz.finish')} className="grid size-9 place-items-center rounded-full bg-primary text-primary-fg shadow-[0_2px_0_var(--primary-edge)]">
            <Check {...icon} />
          </button>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn('h-full rounded-full', overtime ? 'bg-coral' : 'bg-primary')} style={{ width: `${Math.min(1, fraction) * 100}%` }} />
      </div>
      {note && <p className="text-[11px] leading-snug text-muted">{note}</p>}
    </div>
  )
}
