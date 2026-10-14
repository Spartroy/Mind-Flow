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
import { CardTile } from './CardTile'
import { ColumnView } from './ColumnView'
import { cardHref, navigate } from '@/lib/router'
import { FilterBar } from './FilterBar'
import { useFilter } from './filterStore'
import { orderedColumns, useBoard, useBoardActions } from './hooks'
import { cardsIn, filterCards, planKeyboardMove, type MoveDir } from './logic'

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
  const { t } = useTranslation()
  const { data, isPending, error: loadError } = useBoard()
  const act = useBoardActions()
  const { filter, setFilter } = useFilter()
  const [dragId, setDragId] = useState<string | null>(null)
  const [newColumn, setNewColumn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const refocus = useRef<string | null>(null)

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
  const dragCard = dragId ? data.cards.find((c) => c.id === dragId) : undefined
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
          <header className="px-4 pt-4">
            <h1 className="text-3xl font-extrabold">{t('boardPage.title')}</h1>
            <p className="text-sm text-muted">
              {t('boardPage.summary', { cards: data.cards.filter((c) => !c.archived_at).length, today: data.cards.filter((c) => c.is_today && !c.archived_at).length })}
            </p>
          </header>
          <FilterBar filter={filter} onChange={setFilter} tags={data.tags} />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragId(null)}
          >
            <div className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
              {columns.map((col) => (
                <ColumnView
                  key={col.id}
                  column={col}
                  cards={cardsIn(data.cards, col.id).filter((c) => visibleIds.has(c.id))}
                  totalCount={cardsIn(data.cards, col.id).length}
                  tags={data.tags}
                  cardTags={data.cardTags}
                  linkCounts={linkCounts}
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
            <DragOverlay>
              {dragCard && <CardTile overlay card={dragCard} tags={tagsOf(dragCard.id)} linkCount={linkCounts[dragCard.id] ?? 0} onOpen={() => {}} onKeyMove={() => {}} />}
            </DragOverlay>
          </DndContext>
        </>
      )}

    </div>
  )
}
