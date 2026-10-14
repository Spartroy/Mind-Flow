import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, ChevronRight, Clock, GripVertical, Sun, Timer, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/features/board/CardTile'
import { useBoard, useBoardActions, useSettings } from '@/features/board/hooks'
import { autoFloat } from '@/features/timer/floatStore'
import type { BoardData, Card } from '@/features/board/types'
import { useNow } from '@/features/timer/clock'
import { activeSession, formatDuration, loggedSec } from '@/features/timer/core'
import { cardHref, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { capacity, doneColumn, isDone, nextUp, suggestions, todayCards, DAY_CAPACITY_MIN } from './logic'

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const settings = useSettings()
  const now = useNow(15_000)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  if (!data) return null

  const safe = (p: Promise<unknown>) => void p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  const today = todayCards(data.cards)
  const cap = capacity(today, data.columns, data.sessions, now)
  const active = activeSession(data.sessions)
  const next = nextUp(today, data.columns)
  const canComplete = doneColumn(data.columns) !== undefined
  const avail = formatDuration(DAY_CAPACITY_MIN)
  const dateLabel = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  function reorder(id: string, toIndex: number) {
    const from = today.findIndex((c) => c.id === id)
    if (from < 0 || toIndex < 0 || toIndex >= today.length || from === toIndex) return
    safe(act.moveToday(id, toIndex))
    const title = today[from].title
    setAnnounce(t('today.moved', { title, n: toIndex + 1 }))
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-today-handle="${id}"]`)?.focus())
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    if (!over || a.id === over.id) return
    const ids = today.map((c) => c.id)
    const to = arrayMove(ids, ids.indexOf(String(a.id)), ids.indexOf(String(over.id))).indexOf(String(a.id))
    reorder(String(a.id), to)
  }

  function blitzNow() {
    autoFloat(settings.auto_float_timer)
    if (active) navigate('#/blitz')
    else if (next) navigate(`#/blitz/${encodeURIComponent(next.id)}`)
  }

  const sugg = suggestions(data.cards, data.columns)
  const doneCards = today.filter((c) => isDone(c, data.columns))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-28">
      <div className="sr-only" role="status" aria-live="assertive">{announce}</div>
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-primary uppercase">{t('today.eyebrow')}</p>
            <h1 className="text-3xl font-extrabold">{dateLabel}</h1>
          </div>
          <Button onClick={blitzNow} disabled={!active && !next}>
            <Timer size={18} strokeWidth={2} aria-hidden /> {t('today.blitzNow')}
          </Button>
        </header>

        {error && <p role="alert" className="rounded-control border-[1.5px] border-coral bg-coral-soft p-2 text-sm text-coral" dir="auto">{error}</p>}

        <CapacityCard cap={cap} avail={avail} />

        {cap.state === 'complete' && (
          <section className="flex items-center gap-4 rounded-card border-[1.5px] border-success bg-success-soft p-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-success text-primary-fg" aria-hidden>
              <Check size={28} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-success">{t('today.allDoneTitle')}</h2>
              <p className="text-sm text-fg-2">
                {t('today.allDoneBody', { count: doneCards.length, time: formatDuration(Math.round(cap.doneSec / 60)) })}
              </p>
            </div>
            <Button variant="outline" onClick={() => doneCards.forEach((c) => safe(act.setToday(c.id, false)))}>
              {t('today.planTomorrow')}
            </Button>
          </section>
        )}

        {today.length === 0 ? (
          <section className="grid place-items-center rounded-card border-[1.5px] border-dashed border-border px-6 py-14 text-center">
            <Sun size={56} strokeWidth={2} className="text-sun" aria-hidden />
            <h2 className="mt-4 text-xl font-extrabold">{t('today.emptyTitle')}</h2>
            <p className="mt-1 max-w-md text-sm text-muted" dir="auto">{t('today.emptyBody')}</p>
          </section>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={today.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-3">
                {today.map((card, i) => (
                  <TodayRow
                    key={card.id}
                    card={card}
                    data={data}
                    now={now}
                    running={active?.card_id === card.id}
                    canComplete={canComplete}
                    onOpen={() => navigate(cardHref(card.id))}
                    onDone={(v) => safe(act.setDone(card.id, v))}
                    onRemove={() => safe(act.setToday(card.id, false))}
                    onKeyMove={(delta) => reorder(card.id, i + delta)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <section>
          <button
            type="button"
            aria-expanded={suggestOpen}
            onClick={() => setSuggestOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-control border-[1.5px] border-border bg-surface-muted px-4 py-3 text-start text-sm font-bold"
          >
            {suggestOpen ? <ChevronDown size={16} strokeWidth={2} aria-hidden /> : <ChevronRight size={16} strokeWidth={2} aria-hidden className="rtl:rotate-180" />}
            <span className="flex-1">{t('today.suggested')}</span>
            <span className="grid min-w-6 place-items-center rounded-full bg-sun px-1.5 text-xs font-bold text-[#1d2733] tabular">{sugg.length}</span>
          </button>
          {suggestOpen && (
            <ul className="mt-2 space-y-2">
              {sugg.length === 0 && <li className="px-2 text-sm text-muted" dir="auto">{t('today.noSuggestions')}</li>}
              {sugg.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-control border-[1.5px] border-dashed border-border bg-surface px-4 py-2.5">
                  <span dir="auto" className="min-w-0 flex-1 truncate text-start text-sm font-semibold">{c.title}</span>
                  <span className="text-xs text-muted tabular">{formatDuration(c.estimate_min ?? 0)}</span>
                  <Button variant="ghost" className="border-primary bg-primary-soft py-1.5 text-xs" onClick={() => safe(act.setToday(c.id, true))}>
                    {t('today.addToToday')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function CapacityCard({ cap, avail }: { cap: ReturnType<typeof capacity>; avail: string }) {
  const { t } = useTranslation()
  const bar = cap.state === 'over' ? 'bg-warning' : cap.state === 'complete' ? 'bg-success' : 'bg-primary'
  const headline =
    cap.state === 'empty' ? t('today.available', { avail }) : cap.state === 'complete'
      ? t('today.plannedDone', { planned: formatDuration(cap.plannedMin), done: formatDuration(Math.round(cap.doneSec / 60)) })
      : t('today.planned', { planned: formatDuration(cap.plannedMin), avail })
  return (
    <section className="rounded-card border-[1.5px] border-border bg-surface p-5 shadow-[var(--shadow-raised)]" aria-label={headline}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xl font-extrabold tabular">{headline}</p>
        {cap.state === 'over' && <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-bold text-warning">{t('today.over', { min: cap.overMin })}</span>}
        {cap.state === 'complete' && <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">{t('today.complete')}</span>}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cap.capacityMin}
        aria-valuenow={Math.min(cap.plannedMin, cap.capacityMin)}
        className="mt-3 h-3 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full', bar)} style={{ width: `${cap.fraction * 100}%` }} />
      </div>
      {cap.state === 'over' && <p className="mt-2 text-sm text-fg-2" dir="auto">{t('today.overNote', { min: cap.overMin })}</p>}
    </section>
  )
}

interface RowProps {
  card: Card
  data: BoardData
  now: number
  running: boolean
  canComplete: boolean
  onOpen: () => void
  onDone: (done: boolean) => void
  onRemove: () => void
  onKeyMove: (delta: number) => void
}

function TodayRow({ card, data, now, running, canComplete, onOpen, onDone, onRemove, onKeyMove }: RowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const done = isDone(card, data.columns)
  const column = data.columns.find((c) => c.id === card.column_id)
  const tags = data.cardTags.filter((x) => x.card_id === card.id).flatMap((x) => data.tags.find((tg) => tg.id === x.tag_id) ?? [])
  const logged = Math.round(loggedSec(data.sessions, card.id, now) / 60)
  const over = card.estimate_min !== null && logged > card.estimate_min

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      onKeyMove(e.key === 'ArrowUp' ? -1 : 1)
      return
    }
    listeners?.onKeyDown?.(e)
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border-[1.5px] bg-surface px-4 py-3 shadow-[var(--shadow-raised)]',
        running ? 'border-primary' : 'border-border',
        isDragging && 'opacity-50',
        done && 'opacity-75',
      )}
    >
      <button
        type="button"
        aria-label={t('today.reorder', { title: card.title })}
        title={t('today.reorderHint')}
        data-today-handle={card.id}
        className="cursor-grab touch-none text-muted"
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
      >
        <GripVertical size={16} strokeWidth={2} aria-hidden />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={t('today.markDone', { title: card.title })}
        disabled={!canComplete}
        title={canComplete ? undefined : t('today.needTwoColumns')}
        onClick={() => onDone(!done)}
        className={cn('grid size-6 shrink-0 place-items-center rounded-[8px] border-[1.5px]', done ? 'border-success bg-success text-primary-fg' : 'border-border bg-surface')}
      >
        {done && <Check size={14} strokeWidth={3} aria-hidden />}
      </button>

      <div className="min-w-[9rem] flex-1">
        <button type="button" onClick={onOpen} dir="auto" className={cn('block max-w-full text-start text-sm font-bold break-words', done && 'line-through')}>
          {card.title || t('nav.untitled')}
        </button>
        {(tags.length > 0 || running) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => <TagChip key={tag.id} tag={tag} />)}
            {running && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-fg">
                <span className="size-1.5 rounded-full bg-current" aria-hidden /> {t('today.running')}
              </span>
            )}
          </div>
        )}
      </div>

      <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold tabular" title={t('today.estimate')}>
        <Clock size={12} strokeWidth={2} aria-hidden />
        <span className="sr-only">{t('today.estimate')}</span>
        {card.estimate_min !== null ? formatDuration(card.estimate_min) : '—'}
      </span>
      <span
        className={cn('min-w-12 rounded-full px-2.5 py-1 text-center text-xs font-semibold tabular', over ? 'bg-coral-soft text-coral' : 'bg-primary-soft text-primary')}
        title={t('today.logged')}
      >
        <span className="sr-only">{t('today.logged')} </span>
        {logged > 0 ? formatDuration(logged) : '—'}
      </span>
      {column && (
        <span className="hidden items-center gap-1.5 rounded-full border-[1.5px] border-border px-2.5 py-1 text-xs font-semibold sm:inline-flex">
          <span className="size-2 rounded-full" style={{ background: `var(--${column.color})` }} aria-hidden />
          <span dir="auto">{column.name}</span>
        </span>
      )}
      <button type="button" aria-label={t('today.remove', { title: card.title })} onClick={onRemove} className="grid size-8 place-items-center rounded-control text-muted hover:bg-surface-muted">
        <X size={16} strokeWidth={2} aria-hidden />
      </button>
    </li>
  )
}
