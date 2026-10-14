import { Activity, Check, Coffee, Droplet, Eye, Pause, PictureInPicture2, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/features/board/CardTile'
import { useBoardActions, useSettings } from '@/features/board/hooks'
import type { BoardData, Card, SessionMode, TimeSession } from '@/features/board/types'
import { useNoteDraft } from '@/features/card/useNoteDraft'
import { EditorToolbar } from '@/features/card/EditorToolbar'
import { MarkdownEditor, type DirMode } from '@/features/editor/MarkdownEditor'
import { breakRemainingSec, formatClock, pomodoro } from '@/features/timer/core'
import { chime } from '@/features/timer/chime'
import { useFloat } from '@/features/timer/floatStore'
import { Ring } from '@/features/timer/Ring'
import { useActiveView } from '@/features/timer/useActiveView'
import { useFinishFlow } from '@/features/timer/useFinish'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { parseChecklist, toggleChecklistItem } from './checklist'

const MODES: SessionMode[] = ['timer', 'pomodoro', 'writing']
const MODE_KEY = { timer: 'blitz.timer', pomodoro: 'blitz.pomodoro', writing: 'blitz.writing' } as const

export function BlitzPage({ cardId }: { cardId: string | null }) {
  const { t } = useTranslation()
  const act = useBoardActions()
  const v = useActiveView(500)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(new Set<string>())

  // #/blitz/:id starts a session on that card unless it is already the running one.
  // The ref guards React StrictMode's double effect (two starts would split the time).
  useEffect(() => {
    if (!cardId || !v.data || started.current.has(cardId)) return
    // Seeing the card's own running session counts as "started": finishing it must not restart it.
    started.current.add(cardId)
    if (v.session?.card_id === cardId) return
    act.startSession(cardId).catch((e: unknown) => setError(t('blitz.startFailed', { message: e instanceof Error ? e.message : String(e) })))
  }, [cardId, v.data, v.session?.card_id, act, t])

  if (!v.data) return null
  if (!v.session || !v.card) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-xl font-extrabold">{t('blitz.noSession')}</p>
          <p className="text-muted">{t('blitz.pickCard')}</p>
          {error && <p role="alert" className="text-sm text-coral">{error}</p>}
          <Button onClick={() => navigate('#/today')}>{t('blitz.backToToday')}</Button>
        </div>
      </div>
    )
  }
  return <BlitzScreen session={v.session} card={v.card} data={v.data} elapsed={v.elapsed} now={v.now} estimateMin={v.estimateMin} />
}

interface ScreenProps {
  session: TimeSession
  card: Card
  data: BoardData
  elapsed: number
  now: number
  estimateMin: number | null
}

function BlitzScreen({ session, card, data, elapsed, now, estimateMin }: ScreenProps) {
  const { t } = useTranslation()
  const act = useBoardActions()
  const finish = useFinishFlow()
  const settings = useSettings()
  const focusMin = settings.pomodoro_focus_min
  const breakMin = settings.pomodoro_break_min
  const openFloat = useFloat((s) => s.open)
  const paused = session.paused_at !== null
  const mode = session.mode
  const pomo = pomodoro(session, elapsed, focusMin)
  const [breakExtra, setBreakExtra] = useState({ for: session.breaks_taken, sec: 0 })
  const extraSec = breakExtra.for === session.breaks_taken ? breakExtra.sec : 0
  const tags = data.cardTags.filter((x) => x.card_id === card.id).flatMap((x) => data.tags.find((tg) => tg.id === x.tag_id) ?? [])

  // Start the break the moment a focus block ends (once per block).
  const breakStarted = useRef<string | null>(null)
  useEffect(() => {
    const key = `${session.id}:${session.breaks_taken}`
    if (mode === 'pomodoro' && pomo.breakDue && breakStarted.current !== key) {
      breakStarted.current = key
      if (settings.sound) chime()
      void act.pauseSession(true)
    }
  }, [mode, pomo.breakDue, session.id, session.breaks_taken, act, settings.sound])

  // Space pauses/resumes, but never while typing; Esc leaves in writing-only mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))
      if (e.key === ' ' && !typing && !(el instanceof HTMLButtonElement)) {
        e.preventDefault()
        void (paused ? act.resumeSession() : act.pauseSession(false))
      }
      if (e.key === 'Escape' && mode === 'writing' && !document.querySelector('dialog[open]')) navigate('#/today')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paused, mode, act])

  const onBreak = mode === 'pomodoro' && session.on_break
  const overtime = mode !== 'pomodoro' && estimateMin !== null && elapsed > estimateMin * 60
  const toggle = () => void (paused ? act.resumeSession() : act.pauseSession(false))

  const topBar = (
    <header className="flex items-center justify-between gap-3 p-5">
      <Button variant="outline" onClick={() => navigate('#/today')}>
        <X size={16} strokeWidth={2} aria-hidden /> {t('blitz.exit')}
      </Button>
      <div role="group" aria-label={t('blitz.modes')} className="flex rounded-control border-[1.5px] border-border bg-surface-muted p-1">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => mode !== m && void act.setSessionMode(m)}
            className={cn('rounded-[10px] px-4 py-1.5 text-sm font-bold', mode === m ? 'bg-primary text-primary-fg' : 'text-fg-2')}
          >
            {t(MODE_KEY[m])}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {mode === 'pomodoro' && <span className="rounded-full bg-sun-soft px-3 py-1 text-xs font-bold">{t('blitz.pomodoroBlock', { n: pomo.block })}</span>}
        {openFloat && (
          <Button variant="outline" onClick={() => openFloat()}>
            <PictureInPicture2 size={16} strokeWidth={2} aria-hidden /> {t('blitz.floatTimer')}
          </Button>
        )}
      </div>
    </header>
  )

  if (mode === 'writing') {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <WritingOnly card={card} elapsed={elapsed} paused={paused} onToggle={toggle} onMode={() => void act.setSessionMode('timer')} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {topBar}
      {onBreak ? (
        <BreakCard session={session} card={card} now={now} breakMin={breakMin} sound={settings.sound} extraSec={extraSec} onExtra={() => setBreakExtra({ for: session.breaks_taken, sec: extraSec + 120 })} onResume={() => void act.resumeSession()} />
      ) : (
        <div className="mx-auto grid w-full max-w-5xl flex-1 gap-5 p-5 pt-0 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section className="h-fit rounded-[28px] border-[1.5px] border-border bg-surface p-6 text-center shadow-[var(--shadow-raised)]">
            <div className="flex flex-wrap justify-center gap-1.5">{tags.map((tag) => <TagChip key={tag.id} tag={tag} />)}</div>
            <h1 dir="auto" className="mt-3 text-2xl font-extrabold">{card.title || t('nav.untitled')}</h1>
            <TimerFace mode={mode} session={session} elapsed={elapsed} estimateMin={estimateMin} pomoRemaining={pomo.blockRemainingSec} paused={paused} focusMin={focusMin} />
            {overtime && settings.overtime_message && (
              <p role="status" dir="auto" className="mt-4 flex items-start gap-2 rounded-control bg-coral-soft p-3 text-start text-sm font-semibold text-fg">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-coral" aria-hidden />
                {t('blitz.overtimeMsg')}
              </p>
            )}
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={toggle}
                aria-label={paused ? t('blitz.resume') : t('blitz.pause')}
                className="grid size-14 place-items-center rounded-full border-[1.5px] border-border bg-surface shadow-[var(--shadow-raised)]"
              >
                {paused ? <Play size={22} strokeWidth={2} aria-hidden className="rtl:scale-x-[-1]" /> : <Pause size={22} strokeWidth={2} aria-hidden />}
              </button>
              {mode === 'timer' && (
                <Button variant="outline" onClick={() => void act.extendSession(10)}>{t('blitz.plus10')}</Button>
              )}
              <Button onClick={() => void finish()}>
                <Check size={16} strokeWidth={2.5} aria-hidden /> {t('blitz.finish')}
              </Button>
            </div>
          </section>
          <BlitzNote key={card.id} card={card} />
        </div>
      )}
    </div>
  )
}

function TimerFace({ mode, session, elapsed, estimateMin, pomoRemaining, paused, focusMin }: {
  mode: SessionMode; session: TimeSession; elapsed: number; estimateMin: number | null; pomoRemaining: number; paused: boolean; focusMin: number
}) {
  const { t } = useTranslation()
  let main: string
  let sub: string
  let fraction = 0
  let tone: 'primary' | 'coral' = 'primary'
  if (mode === 'pomodoro') {
    const total = focusMin * 60
    main = formatClock(Math.max(0, pomoRemaining))
    sub = t('blitz.pomodoroBlock', { n: session.breaks_taken + 1 }) + ` · ${formatClock(total)}`
    fraction = 1 - Math.max(0, pomoRemaining) / total
  } else if (estimateMin) {
    const target = estimateMin * 60
    if (elapsed > target) {
      main = `+${formatClock(elapsed - target)}`
      sub = t('blitz.pastEstimate', { est: formatClock(target) })
      fraction = 1
      tone = 'coral'
    } else {
      main = formatClock(elapsed)
      sub = t('blitz.estLeft', { est: formatClock(target), left: formatClock(target - elapsed) })
      fraction = elapsed / target
    }
  } else {
    main = formatClock(elapsed)
    sub = t('blitz.noEstimateShort')
  }
  return (
    <div className="mt-4 flex justify-center">
      <Ring fraction={fraction} tone={tone} size={280} stroke={20}>
        <div>
          <p className={cn('text-[56px] leading-none font-extrabold tabular', tone === 'coral' && 'text-coral', paused && 'text-fg-2')} aria-label={t('blitz.timerLabel')} role="timer">
            {main}
          </p>
          <p className="mx-auto mt-2 max-w-[11rem] text-xs font-semibold text-fg-2 tabular">{paused ? t('blitz.paused') : sub}</p>
        </div>
      </Ring>
    </div>
  )
}

function BreakCard({ session, card, now, breakMin, sound, extraSec, onExtra, onResume }: {
  session: TimeSession; card: Card; now: number; breakMin: number; sound: boolean; extraSec: number; onExtra: () => void; onResume: () => void
}) {
  const { t } = useTranslation()
  const remaining = breakRemainingSec(session, breakMin, extraSec, now)
  const over = remaining <= 0
  // One soft chime when the break runs out (not on every re-render).
  const chimed = useRef(false)
  useEffect(() => {
    if (over && sound && !chimed.current) {
      chimed.current = true
      chime()
    }
    if (!over) chimed.current = false
  }, [over, sound])
  const tips = [
    { icon: Activity, k: 'stretch', tint: 'bg-[#dbeeff] text-[#1f6fbf]' },
    { icon: Droplet, k: 'water', tint: 'bg-primary-soft text-primary' },
    { icon: Eye, k: 'look', tint: 'bg-[#f3e0ff] text-[#8a2fb5]' },
  ] as const
  return (
    <div className="mx-auto w-full max-w-3xl p-5 pt-0">
      <section className="overflow-hidden rounded-[28px] border-[1.5px] border-border bg-surface shadow-[var(--shadow-raised)]">
        <div className="flex items-center gap-6 bg-sun-soft p-8 text-[#1d2733]">
          <span className="grid size-24 shrink-0 place-items-center rounded-full bg-sun" aria-hidden>
            <Coffee size={40} strokeWidth={2} />
          </span>
          <div>
            <p className="text-xs font-extrabold tracking-wide uppercase">{t('blitz.sessionComplete', { n: session.breaks_taken })}</p>
            <h1 className="text-3xl font-extrabold">{over ? t('blitz.breakOver') : t('blitz.breakTime')}</h1>
            <p className="text-6xl leading-none font-extrabold tabular" role="timer">{formatClock(Math.max(0, remaining))}</p>
          </div>
        </div>
        <div className="grid gap-3 p-6 sm:grid-cols-3">
          {tips.map(({ icon: Icon, k, tint }) => {
            const [title, body] = t(`blitz.tips.${k}`, { returnObjects: true }) as string[]
            return (
              <div key={k} className="rounded-card border-[1.5px] border-border p-4">
                <span className={cn('grid size-10 place-items-center rounded-control', tint)} aria-hidden><Icon size={18} strokeWidth={2} /></span>
                <h2 className="mt-3 font-bold">{title}</h2>
                <p className="mt-1 text-sm text-fg-2">{body}</p>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-3 px-6 pb-6">
          <p dir="auto" className="min-w-0 truncate text-sm font-semibold text-fg-2">{t('blitz.upNext', { title: card.title })}</p>
          <div className="flex gap-2">
            {!over && <Button variant="outline" onClick={onExtra}>{t('blitz.plus2')}</Button>}
            <Button onClick={onResume}>{over ? t('blitz.startNext') : t('blitz.skipBreak')}</Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function BlitzNote({ card }: { card: Card }) {
  const { t } = useTranslation()
  const [md, setMd] = useState(card.body_md)
  const [dirMode, setDirMode] = useState<DirMode>('auto')
  const [error, setError] = useState<string | null>(null)
  const { onChange } = useNoteDraft(card.id, card.body_md, (e) => setError(e instanceof Error ? e.message : String(e)))
  const items = parseChecklist(md)
  const doneCount = items.filter((i) => i.checked).length
  const update = (next: string) => {
    setMd(next)
    onChange(next)
  }
  return (
    <div className="space-y-5">
      <section className="rounded-card border-[1.5px] border-border bg-surface p-5 shadow-[var(--shadow-raised)]">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold">{t('blitz.checklist')}</h2>
          {items.length > 0 && <span className="text-sm text-fg-2 tabular">{doneCount}/{items.length}</span>}
        </div>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted" dir="auto">{t('blitz.noChecklist')}</p>
        ) : (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>
            <ul className="mt-3 space-y-2">
              {items.map((i) => (
                <li key={i.line}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={i.checked}
                    onClick={() => update(toggleChecklistItem(md, i.line))}
                    className="flex w-full items-center gap-3 text-start text-sm font-semibold"
                  >
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-[8px] border-[1.5px]', i.checked ? 'border-primary bg-primary text-primary-fg' : 'border-border')}>
                      {i.checked && <Check size={14} strokeWidth={3} aria-hidden />}
                    </span>
                    <span dir="auto" className={cn(i.checked && 'text-muted line-through')}>{i.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="rounded-card border-[1.5px] border-border bg-surface p-5 shadow-[var(--shadow-raised)]">
        {error && <p role="alert" className="mb-2 text-sm text-coral">{error}</p>}
        <MarkdownEditor
          value={md}
          onChange={update}
          dirMode={dirMode}
          ariaLabel={t('blitz.note')}
          placeholder={t('editor.placeholder')}
          toolbar={(editor) => <EditorToolbar editor={editor} dirMode={dirMode} onDirMode={setDirMode} />}
        />
      </section>
    </div>
  )
}

function WritingOnly({ card, elapsed, paused, onToggle, onMode }: {
  card: Card; elapsed: number; paused: boolean; onToggle: () => void; onMode: () => void
}) {
  const { t } = useTranslation()
  const [md, setMd] = useState(card.body_md)
  const { onChange } = useNoteDraft(card.id, card.body_md, () => {})
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <h1 dir="auto" className="mb-8 text-start text-3xl font-extrabold">{card.title}</h1>
      <MarkdownEditor
        value={md}
        onChange={(m) => {
          setMd(m)
          onChange(m)
        }}
        ariaLabel={t('blitz.note')}
        placeholder={t('editor.placeholder')}
      />
      <p className="fixed start-7 bottom-6 text-sm text-muted">
        {t('blitz.escToLeave')} ·{' '}
        <button type="button" onClick={onMode} className="underline">{t('blitz.timer')}</button>
      </p>
      <div className="fixed end-7 bottom-6 flex items-center gap-2 rounded-full border-[1.5px] border-border bg-surface px-4 py-2 shadow-[var(--shadow-raised)]">
        <span className="text-sm font-bold tabular" role="timer" aria-label={t('blitz.timerLabel')}>{formatClock(elapsed)}</span>
        <button type="button" onClick={onToggle} aria-label={paused ? t('blitz.resume') : t('blitz.pause')} className="grid size-6 place-items-center rounded-full bg-surface-muted">
          {paused ? <Play size={12} strokeWidth={2} aria-hidden /> : <Pause size={12} strokeWidth={2} aria-hidden />}
        </button>
      </div>
    </main>
  )
}
