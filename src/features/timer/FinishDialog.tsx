import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useBoard, useBoardActions } from '@/features/board/hooks'
import { sorted } from '@/features/board/logic'
import type { TimeSession } from '@/features/board/types'
import { isDone, nextUp, todayCards, doneColumn } from '@/features/today/logic'
import { navigate, parseHash } from '@/lib/router'
import { cn } from '@/lib/utils'
import { elapsedSec, formatClock } from './core'
import { useFinished } from './finishStore'

/** Renders the dialog while a just-finished session is waiting to be wrapped up. */
export function FinishHost() {
  const finished = useFinished((s) => s.finished)
  const { data } = useBoard()
  if (!finished || !data) return null
  return <FinishDialog key={finished.id} session={finished} />
}

function FinishDialog({ session }: { session: TimeSession }) {
  const { t } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const close = useFinished((s) => s.set)
  const ref = useRef<HTMLDialogElement>(null)
  const card = data!.cards.find((c) => c.id === session.card_id)
  const columns = sorted(data!.columns)
  const done = doneColumn(columns)
  const [target, setTarget] = useState(card && done && card.column_id !== done.id ? done.id : '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const spent = elapsedSec(session, Date.parse(session.ended_at ?? session.started_at))
  const est = session.estimate_snapshot_min
  const diff = est === null ? null : spent - est * 60
  const under = diff !== null && diff <= 0

  async function apply() {
    if (card && target && target !== card.column_id) await act.moveCard(card.id, target, Number.MAX_SAFE_INTEGER)
  }
  async function run(next: boolean) {
    try {
      await apply()
      const snap = act.snapshot()
      const nextCard = next && snap ? nextUp(todayCards(snap.cards).filter((c) => c.id !== session.card_id), snap.columns) : undefined
      close(null)
      if (nextCard) {
        await act.startSession(nextCard.id)
        navigate(`#/blitz/${encodeURIComponent(nextCard.id)}`)
      } else if (parseHash(location.hash).name === 'blitz') {
        navigate('#/today')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const snap = data!
  const hasNext = nextUp(todayCards(snap.cards).filter((c) => c.id !== session.card_id && !isDone(c, snap.columns)), snap.columns) !== undefined
  const stat = 'rounded-control px-3 py-3 text-center'

  return (
    <dialog
      ref={ref}
      aria-labelledby="finish-title"
      onClose={() => close(null)}
      className="m-auto w-full max-w-md rounded-[28px] border-[1.5px] border-border bg-surface p-0 text-fg shadow-[var(--shadow-floating)] backdrop:bg-[var(--scrim)]"
    >
      <div className="space-y-5 p-8 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary text-primary-fg shadow-[0_4px_0_var(--primary-edge)]" aria-hidden>
          <Check size={40} strokeWidth={3} />
        </span>
        <div>
          <h2 id="finish-title" className="text-3xl font-extrabold">{t('finishDlg.title')}</h2>
          <p dir="auto" className="mt-1 text-sm text-fg-2">{card?.title}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className={cn(stat, 'bg-surface-muted')}>
            <p className="text-xs font-semibold text-fg-2">{t('finishDlg.spent')}</p>
            <p className="text-2xl font-extrabold tabular">{formatClock(spent)}</p>
          </div>
          <div className={cn(stat, 'bg-surface-muted')}>
            <p className="text-xs font-semibold text-fg-2">{t('finishDlg.estimate')}</p>
            <p className="text-2xl font-extrabold tabular">{est === null ? '—' : formatClock(est * 60)}</p>
          </div>
          <div className={cn(stat, diff === null ? 'bg-surface-muted' : under ? 'bg-success-soft text-success' : 'bg-coral-soft text-coral')}>
            <p className="text-xs font-semibold">{t('finishDlg.difference')}</p>
            <p className="text-2xl font-extrabold tabular">{diff === null ? '—' : `${under ? '−' : '+'}${formatClock(Math.abs(diff))}`}</p>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span>{t('finishDlg.moveTo')}</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-control border-[1.5px] border-border bg-surface px-3 py-2">
            <option value="">{t('finishDlg.keepColumn')}</option>
            {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-coral">{error}</p>}
        <div className="space-y-2">
          <Button className="w-full" disabled={!hasNext} onClick={() => void run(true)}>{t('finishDlg.next')}</Button>
          <Button variant="outline" className="w-full" onClick={() => void run(false)}>{t('finishDlg.doneForNow')}</Button>
        </div>
      </div>
    </dialog>
  )
}

