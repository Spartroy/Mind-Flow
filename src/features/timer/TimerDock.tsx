import { Check, Maximize2, Pause, Play, PictureInPicture2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useBoardActions } from '@/features/board/hooks'
import { cn } from '@/lib/utils'
import { formatClock, formatDuration } from './core'
import { useFloat } from './floatStore'
import { Ring } from './Ring'
import { useActiveView } from './useActiveView'
import { useFinishFlow } from './useFinish'
import { navigate } from '@/lib/router'

/** The floating dock at the bottom of the board: the running card, its timer, pause, finish, expand. */
export function TimerDock() {
  const { t } = useTranslation()
  const act = useBoardActions()
  const finish = useFinishFlow()
  const v = useActiveView(1000)
  const openFloat = useFloat((s) => s.open)
  if (!v.session || !v.card || !v.data) return null

  const overtime = v.estimateMin ? v.prog.overtime : false
  const column = v.data.columns.find((c) => c.id === v.card!.column_id)
  const sub =
    column && v.estimateMin ? t('dock.inEstimate', { column: column.name, est: formatDuration(v.estimateMin) }) : (column?.name ?? '')

  return (
    <div
      role="region"
      aria-label={t('dock.running', { title: v.card.title })}
      className={cn(
        'pointer-events-auto absolute inset-x-4 bottom-4 z-30 flex items-center gap-4 rounded-card border-[1.5px] bg-surface px-4 py-3 shadow-[var(--shadow-floating)]',
        overtime ? 'border-coral' : 'border-primary',
      )}
    >
      <Ring fraction={v.estimateMin ? v.prog.fraction : 0} tone={overtime ? 'coral' : 'primary'} size={44} stroke={6}>
        {v.paused ? <Pause size={14} strokeWidth={2} aria-hidden /> : <Play size={14} strokeWidth={2} aria-hidden className="rtl:scale-x-[-1]" />}
      </Ring>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-start text-sm font-bold">{v.card.title || t('nav.untitled')}</p>
        <p dir="auto" className="truncate text-start text-xs text-muted">{sub}</p>
      </div>
      <span className={cn('text-3xl font-extrabold tabular', overtime && 'text-coral')} aria-label={t('blitz.timerLabel')}>
        {overtime ? '+' : ''}{formatClock(overtime ? v.prog.seconds : v.elapsed)}
      </span>
      <button
        type="button"
        onClick={() => void (v.running ? act.pauseSession(false) : act.resumeSession())}
        aria-label={v.running ? t('blitz.pause') : t('blitz.resume')}
        className="grid size-10 place-items-center rounded-full border-[1.5px] border-border"
      >
        {v.running ? <Pause size={16} strokeWidth={2} aria-hidden /> : <Play size={16} strokeWidth={2} aria-hidden className="rtl:scale-x-[-1]" />}
      </button>
      {openFloat && (
        <button type="button" onClick={() => openFloat()} aria-label={t('blitz.floatTimer')} className="grid size-10 place-items-center rounded-control border-[1.5px] border-border">
          <PictureInPicture2 size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
      <Button onClick={() => void finish()}>
        <Check size={16} strokeWidth={2.5} aria-hidden /> {t('blitz.finish')}
      </Button>
      <button type="button" onClick={() => navigate('#/blitz')} aria-label={t('dock.expand')} className="grid size-10 place-items-center rounded-control border-[1.5px] border-border">
        <Maximize2 size={16} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}
