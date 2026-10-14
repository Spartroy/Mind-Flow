import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNow } from '@/features/timer/clock'
import { activeSession, formatDuration, loggedSec } from '@/features/timer/core'
import { nextUp, todayCards } from '@/features/today/logic'
import { QueuePanel, TodayLane, ViewToggle } from './BlitzViews'
import { CardTile } from './CardTile'
import { ColumnView } from './ColumnView'
import { cardHref, navigate } from '@/lib/router'
import { FilterBar } from './FilterBar'
import { useFilter } from './filterStore'
import { orderedColumns, useBoard, useBoardActions } from './hooks'
import { cardsIn, filterCards, planKeyboardMove, type MoveDir } from './logic'
import { useBoardView } from './viewStore'

/** Distinct linked cards per card, counting links in both directions. */
function linkCountMap(links: { from_card_id: string; to_card_id: string }[]) {
  const peers = new Map<string, Set<string>>()
  const add = (a: string, b: string) => (peers.get(a) ?? peers.set(a, new Set()).get(a)!).add(b)
  for (const l of links) {
    add(l.from_card_id, l.to_card_id)
    add(l.to_card_id, l.from_card_id)
  }
  return Object.fromEntries([...peers].map(([id, set]) => [id, set.size])) as Record<string, number>
}

export function Board() {
  const { t, i18n } = useTranslation()
  const { data, isPending, error: loadError } = useBoard()
  const act = useBoardActions()
  const { filter, setFilter } = useFilter()
  const [dragId, setDragId] = useState<string | null>(null)
  const [newColumn, setNewColumn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const refocus = useRef<string | null>(null)
  const { view } = useBoardView()
  const now = useNow(15_000)

  // After a keyboard move the card remounts in its new spot; hand focus back to its handle.
  useEffect(() => {
    if (!refocus.current) return
    document.querySelector<HTMLElement>('[data-handle="' + refocus.current + '"]')?.focus()
    refocus.current = null
  }, [data])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visibleIds = useMemo(
    () => new Set(data ? filterCards(data.cards, data.cardTags, filter).map((c) => c.id) : []),
    [data, filter],
  )

  /** Run an async action; surface failures instead of swallowing them. */
  const safe = (p: Promise<unknown>) => void p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))

  if (isPending) return <p className="p-6 text-muted" role="status">{t('auth.loading')}</p>
  if (loadError) return <p className="p-6 text-danger" role="alert">{loadError.message}</p>

  const columns = orderedColumns(data)

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragId(null)
    if (!over || !data) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return
    const aType = active.data.current?.type
    const oType = over.data.current?.type
    if (aType === 'queue') {
      // Reordering Today's queue
      const cardId = String(active.data.current?.cardId)
      const order = todayCards(data.cards).map((c) => c.id)
      const overCardId = oType === 'queue' ? String(over.data.current?.cardId) : null
      if (overCardId) safe(act.moveToday(cardId, order.indexOf(overCardId)))
      return
    }
    if (aType === 'card' && (oType === 'today-drop' || oType === 'queue')) {
      // Dropping a board card into the Blitz queue plans it for today
      const idx = oType === 'queue' ? todayCards(data.cards).findIndex((c) => c.id === String(over.data.current?.cardId)) : -1
      const already = data.cards.find((c) => c.id === activeId)?.is_today
      safe((already ? Promise.resolve() : act.setToday(activeId, true)).then(() => (idx >= 0 ? act.moveToday(activeId, idx) : undefined)))
      return
    }
    const activeCard = data.cards.find((c) => c.id === activeId)
    if (!activeCard) return

    if (over.data.current?.type === 'column') {
      const target = cardsIn(data.cards, overId).filter((c) => c.id !== activeId)
      safe(act.moveCard(activeId, overId, target.length))
      return
    }
    const overCard = data.cards.find((c) => c.id === overId)
    if (!overCard?.column_id) return
    const siblings = cardsIn(data.cards, overCard.column_id).filter((c) => c.id !== activeId)
    const overIdx = siblings.findIndex((c) => c.id === overId)
    const col = cardsIn(data.cards, overCard.column_id)
    const movingDown =
      activeCard.column_id === overCard.column_id &&
      col.findIndex((c) => c.id === activeId) < col.findIndex((c) => c.id === overId)
    safe(act.moveCard(activeId, overCard.column_id, movingDown ? overIdx + 1 : overIdx))
  }

  function keyMove(cardId: string, dir: MoveDir) {
    if (!data) return
    const plan = planKeyboardMove(data.cards, data.columns, cardId, dir)
    if (!plan) return
    const title = data.cards.find((c) => c.id === cardId)?.title ?? ''
    const colName = data.columns.find((c) => c.id === plan.column_id)?.name ?? ''
    safe(act.updateCard(cardId, { column_id: plan.column_id, position: plan.position }))
    setAnnounce(t('board.moved', { title, column: colName, position: plan.index + 1 }))
    refocus.current = cardId
  }

  function deleteColumn(id: string) {
    const col = columns.find((c) => c.id === id)!
    const count = data!.cards.filter((c) => c.column_id === id).length
    const dest = columns.find((c) => c.id !== id)
    if (count && !dest) {
      setError(t('board.cannotDeleteLastColumn'))
      return
    }
    if (!window.confirm(t('board.confirmDeleteColumn', { name: col.name, count, dest: dest?.name ?? '' }))) return
    safe(act.deleteColumn(id, dest?.id ?? null))
  }

  const linkCounts = linkCountMap(data.links)
  const dragCard = dragId ? data.cards.find((c) => c.id === (dragId.startsWith('q:') ? dragId.slice(2) : dragId)) : undefined
  const blitzy = view !== 'board'
  const running = activeSession(data.sessions)
  const logged = Object.fromEntries(data.cards.map((c) => [c.id, Math.round(loggedSec(data.sessions, c.id, now) / 60)]))
  const todayList = todayCards(data.cards)
  const upNext = nextUp(todayList, data.columns)
  const dateLabel = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' }).format(now)
  const startFromBoard = (id: string) => safe(act.startSession(id))
  const columnSummary = (colId: string) => {
    const min = cardsIn(data.cards, colId).reduce((n, c) => n + (c.estimate_min ?? 0), 0)
    return min > 0 ? formatDuration(min) : undefined
  }
  const tagsOf = (id: string) =>
    data.cardTags.filter((x) => x.card_id === id).flatMap((x) => data.tags.find((tg) => tg.id === x.tag_id) ?? [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sr-only" role="status" aria-live="assertive">{announce}</div>
      {error && (
        <div role="alert" className="mx-4 mb-2 flex items-center justify-between rounded-control border-[1.5px] border-danger p-2 text-sm text-danger">
          <span dir="auto">{error}</span>
          <Button variant="ghost" onClick={() => setError(null)}>{t('board.dismiss')}</Button>
        </div>
      )}

      {columns.length === 0 ? (
        <div className="m-auto max-w-sm space-y-4 p-6 text-center">
          <h2 className="text-lg font-semibold">{t('board.emptyTitle')}</h2>
          <p className="text-muted">{t('board.emptyBody')}</p>
          <Button onClick={() => safe(act.addStarterColumns(t('board.starter', { returnObjects: true }) as string[]))}>{t('board.starterColumns')}</Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (newColumn.trim()) safe(act.addColumn(newColumn.trim()))
              setNewColumn('')
            }}
          >
            <Input value={newColumn} onChange={(e) => setNewColumn(e.target.value)} placeholder={t('board.columnName')} aria-label={t('board.columnName')} />
            <Button type="submit" variant="outline">{t('board.addColumn')}</Button>
          </form>
        </div>
      ) : (
        <>
          <header className="flex items-start justify-between gap-3 px-4 pt-4">
            <div>
              <h1 className="text-3xl font-extrabold">{view === 'board' ? t('boardPage.title') : t('dock.title')}</h1>
              <p className="text-sm text-muted">
                {t('boardPage.summary', { cards: data.cards.filter((c) => !c.archived_at).length, today: data.cards.filter((c) => c.is_today && !c.archived_at).length })}
              </p>
            </div>
            <ViewToggle />
          </header>
          {view === 'blitz' && <TodayLane data={data} now={now} runningCardId={running?.card_id} onOpen={(id) => navigate(cardHref(id))} />}
          <FilterBar filter={filter} onChange={setFilter} tags={data.tags} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragId(null)}
          >
            <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 items-start gap-4 overflow-x-auto p-4 pb-28">
              {columns.map((col) => (
                <ColumnView
                  key={col.id}
                  column={col}
                  cards={cardsIn(data.cards, col.id).filter((c) => visibleIds.has(c.id))}
                  totalCount={cardsIn(data.cards, col.id).length}
                  tags={data.tags}
                  cardTags={data.cardTags}
                  linkCounts={linkCounts}
                  logged={logged}
                  runningCardId={running?.card_id}
                  showPlay={blitzy}
                  onPlay={startFromBoard}
                  summary={blitzy ? columnSummary(col.id) : undefined}
                  narrow={view === 'plan'}
                  onAddCard={(title) => safe(act.addCard(title, col.id).done)}
                  onRename={(name) => safe(act.updateColumn(col.id, { name }))}
                  onDelete={() => deleteColumn(col.id)}
                  onOpenCard={(id) => navigate(cardHref(id))}
                  onKeyMove={keyMove}
                />
              ))}
              <form
                className="flex w-72 shrink-0 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const name = newColumn.trim()
                  if (!name) return
                  safe(act.addColumn(name, `tag-${(columns.length % 8) + 1}`))
                  setNewColumn('')
                }}
              >
                <Input value={newColumn} onChange={(e) => setNewColumn(e.target.value)} placeholder={t('board.columnName')} aria-label={t('board.columnName')} />
                <Button type="submit" variant="outline" aria-label={t('board.addColumn')}>
                  <Plus size={16} strokeWidth={2} aria-hidden />
                </Button>
              </form>
            </div>
              {view === 'plan' && (
                <QueuePanel
                  data={data}
                  now={now}
                  dateLabel={dateLabel}
                  canStart={upNext !== undefined || running !== undefined}
                  onStart={() => (running ? navigate('#/blitz') : upNext && navigate('#/blitz/' + encodeURIComponent(upNext.id)))}
                  onOpen={(id) => navigate(cardHref(id))}
                />
              )}
            </div>
            <DragOverlay>
              {dragCard && <CardTile overlay card={dragCard} tags={tagsOf(dragCard.id)} linkCount={linkCounts[dragCard.id] ?? 0} onOpen={() => {}} onKeyMove={() => {}} />}
            </DragOverlay>
          </DndContext>
        </>
      )}

    </div>
  )
}
