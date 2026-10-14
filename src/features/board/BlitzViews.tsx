import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/features/timer/core'
import { capacity, DAY_CAPACITY_MIN, todayCards } from '@/features/today/logic'
import { cn } from '@/lib/utils'
import type { BoardData, Card } from './types'
import { useBoardView, type BoardView } from './viewStore'

/** Board | Blitz | Plan switch shown in the board header. */
export function ViewToggle() {
  const { t } = useTranslation()
  const { view, setView } = useBoardView()
  const items: { v: BoardView; label: string }[] = [
    { v: 'board', label: t('dock.board') },
    { v: 'blitz', label: t('dock.blitz') },
    { v: 'plan', label: t('dock.plan') },
  ]
  return (
    <div role="group" aria-label={t('dock.view')} className="flex rounded-control border-[1.5px] border-border bg-surface-muted p-1">
      {items.map(({ v, label }) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={cn('inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-bold', view === v ? 'bg-primary text-primary-fg' : 'text-fg-2')}
        >
          {v === 'blitz' && <Play size={12} strokeWidth={2.5} aria-hidden className="rtl:scale-x-[-1]" />}
          {label}
        </button>
      ))}
    </div>
  )
}

/** Today's lane: the planned cards as chips with the day's capacity at the end. */
export function TodayLane({ data, now, runningCardId, onOpen }: { data: BoardData; now: number; runningCardId?: string; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const today = todayCards(data.cards)
  const cap = capacity(today, data.columns, data.sessions, now)
  return (
    <section aria-label={t('dock.lane')} className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-card border-[1.5px] border-border bg-surface px-4 py-3">
      <h2 className="text-sm font-extrabold">{t('dock.lane')}</h2>
      {today.map((c) => {
        const col = data.columns.find((x) => x.id === c.column_id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            dir="auto"
            className={cn(
              'inline-flex max-w-52 items-center gap-2 rounded-full border-[1.5px] px-3 py-1 text-xs font-bold',
              runningCardId === c.id ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface',
            )}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--${col?.color ?? 'tag-5'})` }} aria-hidden />
            <span className="truncate">{c.title}</span>
            {c.estimate_min != null && <span className="font-semibold text-muted tabular">{formatDuration(c.estimate_min)}</span>}
          </button>
        )
      })}
      <div className="ms-auto flex items-center gap-3 text-xs font-bold text-fg-2 tabular">
        <span>{t('today.planned', { planned: formatDuration(cap.plannedMin), avail: formatDuration(DAY_CAPACITY_MIN) })}</span>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <div className={cn('h-full rounded-full', cap.state === 'over' ? 'bg-warning' : 'bg-primary')} style={{ width: `${cap.fraction * 100}%` }} />
        </div>
      </div>
    </section>
  )
}

function QueueItem({ card, index, onOpen }: { card: Card; index: number; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `q:${card.id}`, data: { type: 'queue', cardId: card.id } })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2 rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-sm', isDragging && 'opacity-50')}
    >
      <span className="w-4 text-xs text-muted tabular">{index + 1}</span>
      <button type="button" {...attributes} {...listeners} onClick={onOpen} dir="auto" className="min-w-0 flex-1 cursor-grab truncate text-start font-semibold">
        {card.title}
      </button>
      <span className="text-xs font-semibold tabular">{card.estimate_min != null ? formatDuration(card.estimate_min) : '—'}</span>
    </li>
  )
}

/** Plan layout: the Blitz queue with its capacity bar and a drop zone for adding cards from the board. */
export function QueuePanel({ data, now, canStart, onStart, onOpen, dateLabel }: {
  data: BoardData; now: number; canStart: boolean; onStart: () => void; onOpen: (id: string) => void; dateLabel: string
}) {
  const { t } = useTranslation()
  const today = todayCards(data.cards)
  const cap = capacity(today, data.columns, data.sessions, now)
  const { setNodeRef, isOver } = useDroppable({ id: 'today-drop', data: { type: 'today-drop' } })
  return (
    <aside aria-label={t('dock.queue')} className="m-4 ms-0 w-72 shrink-0 self-start rounded-card border-[1.5px] border-primary bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><span className="size-2.5 rounded-full bg-sun" aria-hidden />{t('dock.queue')}</h2>
        <span className="text-xs text-muted">{dateLabel}</span>
      </div>
      <p className="mt-2 flex justify-between text-xs font-bold tabular">
        <span>{t('dock.plannedLabel', { planned: formatDuration(cap.plannedMin) })}</span>
        <span>{t('dock.ofCap', { cap: formatDuration(cap.capacityMin) })}</span>
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn('h-full rounded-full', cap.state === 'over' ? 'bg-warning' : 'bg-primary')} style={{ width: `${cap.fraction * 100}%` }} />
      </div>
      <SortableContext items={today.map((c) => `q:${c.id}`)} strategy={verticalListSortingStrategy}>
        <ul className="mt-3 space-y-2">
          {today.map((c, i) => <QueueItem key={c.id} card={c} index={i} onOpen={() => onOpen(c.id)} />)}
        </ul>
      </SortableContext>
      <div
        ref={setNodeRef}
        className={cn('mt-3 grid min-h-20 place-items-center rounded-control border-2 border-dashed border-primary p-3 text-center text-sm font-bold text-primary', isOver ? 'bg-primary-soft' : 'bg-primary-soft/40')}
      >
        {t('dock.dropHere')}
      </div>
      <Button className="mt-3 w-full" disabled={!canStart} onClick={onStart}>
        <Play size={14} strokeWidth={2.5} aria-hidden className="rtl:scale-x-[-1]" /> {t('dock.start')}
      </Button>
      <p className="mt-2 text-center text-xs text-muted">{t('dock.reorderHint')}</p>
    </aside>
  )
}
