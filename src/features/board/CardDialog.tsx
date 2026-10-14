import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TagChip } from './CardTile'
import { sorted } from './logic'
import type { BoardData, Card, Tag } from './types'

interface Props {
  card: Card
  data: BoardData
  onClose: () => void
  onSave: (patch: Partial<Omit<Card, 'id'>>, tagIds: string[]) => void
  onDelete: () => void
  onCreateTag: (name: string) => Promise<Tag>
}

/** Minimal editor for Phase 1. The full side-panel editor (Markdown, links) arrives in Phase 2. */
export function CardDialog({ card, data, onClose, onSave, onDelete, onCreateTag }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(card.title)
  const [estimate, setEstimate] = useState(card.estimate_min?.toString() ?? '')
  const [columnId, setColumnId] = useState(card.column_id ?? '')
  const [today, setToday] = useState(card.is_today)
  const [due, setDue] = useState(card.due_date ?? '')
  const [tagIds, setTagIds] = useState(data.cardTags.filter((c) => c.card_id === card.id).map((c) => c.tag_id))
  const [newTag, setNewTag] = useState('')
  const [extraTags, setExtraTags] = useState<Tag[]>([])

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  const allTags = [...data.tags, ...extraTags.filter((x) => !data.tags.some((d) => d.id === x.id))]

  function submit(e: FormEvent) {
    e.preventDefault()
    const est = estimate.trim() === '' ? null : Math.max(0, Math.round(Number(estimate)))
    onSave(
      {
        title: title.trim(),
        estimate_min: Number.isFinite(est) ? est : null,
        column_id: columnId || card.column_id,
        is_today: today,
        due_date: due || null,
      },
      tagIds,
    )
    onClose()
  }

  async function addTag() {
    const name = newTag.trim()
    if (!name) return
    const existing = allTags.find((x) => x.name.toLowerCase() === name.toLowerCase())
    const tag = existing ?? (await onCreateTag(name))
    if (!existing) setExtraTags((x) => [...x, tag])
    setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]))
    setNewTag('')
  }

  const label = 'block space-y-1 text-sm'
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={t('board.editCard')}
      className="m-auto w-full max-w-md rounded-card border-[1.5px] border-border bg-surface p-0 text-fg backdrop:bg-black/40"
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className={label}>
          <span>{t('board.title')}</span>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            <span>{t('board.estimateMin')}</span>
            <Input type="number" min={0} dir="ltr" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
          </label>
          <label className={label}>
            <span>{t('board.due')}</span>
            <Input type="date" dir="ltr" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <label className={label}>
          <span>{t('board.column')}</span>
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="w-full rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-sm"
          >
            {sorted(data.columns).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={today} onChange={(e) => setToday(e.target.checked)} />
          {t('board.flagToday')}
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm">{t('board.tags')}</legend>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const on = tagIds.includes(tag.id)
              return (
                <button
                  type="button"
                  key={tag.id}
                  aria-pressed={on}
                  onClick={() => setTagIds((ids) => (on ? ids.filter((i) => i !== tag.id) : [...ids, tag.id]))}
                  className={on ? 'rounded-full ring-2 ring-primary' : 'rounded-full opacity-70'}
                >
                  <TagChip tag={tag} />
                  <span className="sr-only">{on ? t('board.selected') : ''}</span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder={t('board.newTag')}
              aria-label={t('board.newTag')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addTag()
                }
              }}
            />
            <Button variant="outline" onClick={() => void addTag()}>{t('board.addTag')}</Button>
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            className="text-danger"
            onClick={() => {
              if (window.confirm(t('board.confirmDelete'))) {
                onDelete()
                onClose()
              }
            }}
          >
            {t('board.delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => ref.current?.close()}>{t('board.cancel')}</Button>
            <Button type="submit">{t('board.save')}</Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
