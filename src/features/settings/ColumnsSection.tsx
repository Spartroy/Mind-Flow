import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBoard, useBoardActions } from '@/features/board/hooks'
import { columnPositionAt, sorted } from '@/features/board/logic'
import type { Column } from '@/features/board/types'

const COLORS = ['tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5', 'tag-6', 'tag-7', 'tag-8']

export function ColumnsSection() {
  const { t } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  if (!data) return null
  const columns = sorted(data.columns)
  const safe = (p: Promise<unknown>) => void p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = columns.map((c) => c.id)
    const to = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))).indexOf(String(active.id))
    safe(act.updateColumn(String(active.id), { position: columnPositionAt(columns, String(active.id), to) }))
  }

  function remove(col: Column) {
    const dest = columns.find((c) => c.id !== col.id)
    const count = data!.cards.filter((c) => c.column_id === col.id).length
    if (count && !dest) return setError(t('board.cannotDeleteLastColumn'))
    if (!window.confirm(t('board.confirmDeleteColumn', { name: col.name, count, dest: dest?.name ?? '' }))) return
    safe(act.deleteColumn(col.id, dest?.id ?? null))
  }

  return (
    <div>
      {error && <p role="alert" className="mb-2 text-sm text-coral" dir="auto">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {columns.map((col) => (
              <ColumnRow
                key={col.id}
                col={col}
                onRename={(n) => safe(act.updateColumn(col.id, { name: n }))}
                onColor={() => safe(act.updateColumn(col.id, { color: COLORS[(COLORS.indexOf(col.color) + 1) % COLORS.length] }))}
                onDelete={() => remove(col)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          safe(act.addColumn(n, COLORS[columns.length % COLORS.length]))
          setName('')
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('board.columnName')} aria-label={t('board.columnName')} className="max-w-xs" />
        <Button type="submit" variant="outline">{t('board.addColumn')}</Button>
      </form>
    </div>
  )
}

function ColumnRow({ col, onRename, onColor, onDelete }: { col: Column; onRename: (n: string) => void; onColor: () => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id, transition: ROW_TRANSITION })
  const [editing, setEditing] = useState(false)
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 border-b-[1.5px] border-border bg-surface py-3 last:border-b-0 ${isDragging ? 'opacity-60' : ''}`}
    >
      <button type="button" aria-label={t('settings.reorderColumn', { name: col.name })} className="cursor-grab touch-none text-muted" {...attributes} {...listeners}>
        <GripVertical size={16} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onColor}
        aria-label={t('settings.changeColor', { name: col.name })}
        title={t('settings.changeColor', { name: col.name })}
        className="size-4 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-border"
        style={{ background: `var(--${col.color})` }}
      />
      {editing ? (
        <Input
          autoFocus
          defaultValue={col.name}
          aria-label={t('board.renameColumn')}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== col.name) onRename(v)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="max-w-xs"
        />
      ) : (
        <span dir="auto" className="min-w-0 flex-1 truncate text-start font-bold">{col.name}</span>
      )}
      <div className="ms-auto flex items-center gap-2">
        <Button variant="outline" className="py-1 text-xs" onClick={() => setEditing(true)}>{t('settings.rename')}</Button>
        <button type="button" aria-label={t('board.deleteColumn', { name: col.name })} onClick={onDelete} className="rounded p-1.5 text-muted hover:text-danger">
          <Trash2 size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </li>
  )
}

const ROW_TRANSITION = { duration: 200, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
