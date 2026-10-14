import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { CardTile } from './CardTile'
import type { MoveDir } from './logic'
import type { Card, CardTag, Column, Tag } from './types'

interface Props {
  column: Column
  cards: Card[] // visible (filtered + sorted)
  totalCount: number
  tags: Tag[]
  cardTags: CardTag[]
  linkCounts: Record<string, number>
  onAddCard: (title: string) => void
  onRename: (name: string) => void
  onDelete: () => void
  onOpenCard: (id: string) => void
  onKeyMove: (id: string, dir: MoveDir) => void
}

export function ColumnView(p: Props) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: p.column.id, data: { type: 'column' } })
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  const tagsFor = (cardId: string) =>
    p.cardTags.filter((ct) => ct.card_id === cardId).flatMap((ct) => p.tags.find((t) => t.id === ct.tag_id) ?? [])

  return (
    <section
      aria-label={p.column.name}
      className="flex w-72 shrink-0 flex-col rounded-card border-[1.5px] border-border bg-surface-muted"
      style={{ borderBlockStartWidth: 5, borderBlockStartColor: `var(--${p.column.color})` }}
    >
      <header className="flex items-center gap-2 p-3">
        {editing ? (
          <Input
            autoFocus
            defaultValue={p.column.name}
            aria-label={t('board.renameColumn')}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== p.column.name) p.onRename(v)
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <button type="button" dir="auto" onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-start font-semibold">
            {p.column.name}
          </button>
        )}
        <span className="rounded-full bg-surface px-2 text-xs tabular" aria-label={t('board.cardCount', { count: p.totalCount })}>
          {p.cards.length === p.totalCount ? p.totalCount : `${p.cards.length}/${p.totalCount}`}
        </span>
        <button type="button" onClick={p.onDelete} aria-label={t('board.deleteColumn', { name: p.column.name })} className="rounded p-1 text-muted hover:text-danger">
          <Trash2 size={16} strokeWidth={2} aria-hidden />
        </button>
      </header>

      <form
        className="px-3 pb-2"
        onSubmit={(e) => {
          e.preventDefault()
          const title = draft.trim()
          if (!title) return
          p.onAddCard(title)
          setDraft('')
        }}
      >
        <div className="relative">
          <Plus size={16} strokeWidth={2} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('board.quickAdd')}
            aria-label={t('board.quickAddLabel', { name: p.column.name })}
            className="ps-9"
          />
        </div>
      </form>

      <SortableContext items={p.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`flex min-h-16 flex-1 flex-col gap-2 rounded-b-card p-3 pt-1 ${isOver ? 'bg-surface' : ''}`}
        >
          {p.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              tags={tagsFor(card.id)}
              linkCount={p.linkCounts[card.id] ?? 0}
              onOpen={() => p.onOpenCard(card.id)}
              onKeyMove={(dir) => p.onKeyMove(card.id, dir)}
            />
          ))}
        </ul>
      </SortableContext>
    </section>
  )
}
