import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Link2, Sun, Timer } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatMinutes, type MoveDir } from './logic'
import type { Card, Tag } from './types'

export function TagChip({ tag }: { tag: Tag }) {
  const c = `var(--tag-${(tag.color_index % 8) + 1})`
  return (
    <span
      dir="auto"
      className="inline-flex items-center rounded-full border-[1.5px] px-2 py-0.5 text-xs"
      style={{ borderColor: c, background: `color-mix(in srgb, ${c} 18%, transparent)` }}
    >
      {tag.name}
    </span>
  )
}

interface Props {
  card: Card
  tags: Tag[]
  linkCount: number
  onOpen: () => void
  onKeyMove: (dir: MoveDir) => void
  overlay?: boolean
}

export function CardTile({ card, tags, linkCount, onOpen, onKeyMove, overlay }: Props) {
  const { t } = useTranslation()
  const sortable = useSortable({ id: card.id, data: { type: 'card' }, disabled: overlay })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  // Alt+Arrow is the keyboard shortcut for moving; "prev/next" follow reading direction.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.altKey && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const rtl = document.documentElement.dir === 'rtl'
      const dir: MoveDir | null =
        e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down'
        : e.key === 'ArrowLeft' ? (rtl ? 'next' : 'prev')
        : e.key === 'ArrowRight' ? (rtl ? 'prev' : 'next') : null
      if (dir) onKeyMove(dir)
      return
    }
    listeners?.onKeyDown?.(e)
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-card border-[1.5px] border-border bg-surface p-3 shadow-sm',
        isDragging && 'opacity-40',
        overlay && 'shadow-lg',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={t('board.dragHandle', { title: card.title })}
          title={t('board.dragHint')}
          className="mt-0.5 cursor-grab rounded text-muted touch-none"
          data-handle={card.id}
          {...attributes}
          {...listeners}
          onKeyDown={onKeyDown}
        >
          <GripVertical size={16} strokeWidth={2} aria-hidden />
        </button>
        <button type="button" onClick={onOpen} dir="auto" className="min-w-0 flex-1 text-start text-sm font-medium break-words">
          {card.title || t('board.untitled')}
        </button>
        {card.is_today && <Sun size={16} strokeWidth={2} className="text-sun" aria-label={t('board.today')} role="img" />}
      </div>
      {(tags.length > 0 || card.estimate_min != null || linkCount > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => <TagChip key={tag.id} tag={tag} />)}
          {card.estimate_min != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs tabular">
              <Timer size={12} strokeWidth={2} aria-hidden />
              <span className="sr-only">{t('board.estimate')}</span>
              {formatMinutes(card.estimate_min)}
            </span>
          )}
          {linkCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs tabular">
              <Link2 size={12} strokeWidth={2} aria-hidden />
              <span className="sr-only">{t('board.links')}</span>
              {linkCount}
            </span>
          )}
        </div>
      )}
    </li>
  )
}
