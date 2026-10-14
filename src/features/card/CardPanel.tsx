import { Calendar, ChevronDown, Clock, MoreHorizontal, Plus, Sun, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TagChip } from '@/features/board/CardTile'
import { useBoard, useBoardActions } from '@/features/board/hooks'
import { refreshWikiTitles } from '@/features/board/links'
import { normalize, sorted } from '@/features/board/logic'
import type { BoardData, Card } from '@/features/board/types'
import { MarkdownEditor, type DirMode } from '@/features/editor/MarkdownEditor'
import { cardHref, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { EditorToolbar } from './EditorToolbar'
import { formatEstimateInput, parseEstimate } from './estimate'

const SAVE_DELAY_MS = 700
const closeToBoard = () => navigate('#/board')

export function CardPanel({ id, page }: { id: string; page: boolean }) {
  const { t } = useTranslation()
  const { data } = useBoard()
  const card = data?.cards.find((c) => c.id === id)
  if (!data) return null
  if (!card) {
    return (
      <div role="alert" className="m-6 rounded-card border-[1.5px] border-border bg-surface p-6">
        <p dir="auto">{t('panel.notFound')}</p>
        <Button className="mt-4" onClick={closeToBoard}>{t('nav.board')}</Button>
      </div>
    )
  }
  // Keyed so every card gets a fresh editor and draft state.
  return <PanelBody key={card.id} card={card} data={data} page={page} />
}

function PanelBody({ card, data, page }: { card: Card; data: BoardData; page: boolean }) {
  const { t, i18n } = useTranslation()
  const act = useBoardActions()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirMode, setDirMode] = useState<DirMode>('auto')
  const [now] = useState(() => new Date())

  const report = useCallback(
    (p: Promise<unknown>) => void p.catch((e: unknown) => setError(t('panel.saveFailed', { message: e instanceof Error ? e.message : String(e) }))),
    [t],
  )

  // ---- note: debounced autosave, flushed on close
  // Computed once per open: shows renamed targets by their current title without re-saving.
  const [initialBody] = useState(() => refreshWikiTitles(card.body_md, data.cards))
  const draft = useRef(card.body_md)
  const saved = useRef(card.body_md)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (draft.current === saved.current) return
    saved.current = draft.current
    report(act.saveBody(card.id, draft.current))
  }, [act, card.id, report])
  const onBody = (md: string) => {
    draft.current = md
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  // ---- fields
  const [title, setTitle] = useState(card.title)
  const [estimate, setEstimate] = useState(formatEstimateInput(card.estimate_min))
  const [estimateBad, setEstimateBad] = useState(false)
  const [tagInput, setTagInput] = useState<string | null>(null)
  const columns = sorted(data.columns)
  const column = data.columns.find((c) => c.id === card.column_id)
  const cardTagIds = data.cardTags.filter((x) => x.card_id === card.id).map((x) => x.tag_id)
  const tags = cardTagIds.flatMap((tid) => data.tags.find((tg) => tg.id === tid) ?? [])

  const commitTitle = () => {
    const v = title.trim()
    if (v !== card.title) report(act.updateCard(card.id, { title: v }))
  }
  const commitEstimate = () => {
    const r = parseEstimate(estimate)
    setEstimateBad(!r.ok)
    if (r.ok && r.minutes !== card.estimate_min) report(act.updateCard(card.id, { estimate_min: r.minutes }))
    if (r.ok) setEstimate(formatEstimateInput(r.minutes))
  }
  async function addTag(name: string) {
    const v = name.trim()
    if (!v) return
    const existing = data.tags.find((x) => x.name.toLowerCase() === v.toLowerCase())
    const tag = existing ?? (await act.createTag(v))
    if (!cardTagIds.includes(tag.id)) report(act.setCardTags(card.id, [...cardTagIds, tag.id]))
    setTagInput(null)
  }

  // ---- links
  const byId = (cid: string) => data.cards.find((c) => c.id === cid && !c.archived_at)
  const unique = (ids: string[]) => [...new Set(ids)].flatMap((x) => byId(x) ?? [])
  const backlinks = unique(data.links.filter((l) => l.to_card_id === card.id).map((l) => l.from_card_id))
  const linked = unique(data.links.filter((l) => l.from_card_id === card.id).map((l) => l.to_card_id))
  const getLinkItems = useCallback(
    (query: string) => {
      const q = normalize(query.trim())
      return data.cards
        .filter((c) => c.id !== card.id && !c.archived_at && (!q || normalize(c.title).includes(q)))
        .slice(0, 8)
        .map((c) => ({ id: c.id, title: c.title || t('nav.untitled'), hint: data.columns.find((x) => x.id === c.column_id)?.name }))
    },
    [data.cards, data.columns, card.id, t],
  )

  // ---- dialog (side panel) behaviour
  useEffect(() => {
    if (!page) dialogRef.current?.showModal()
  }, [page])

  const dateFmt = (iso: string) =>
    iso ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(iso)) : ''
  const updatedLabel = (() => {
    if (!card.updated_at) return ''
    const d = new Date(card.updated_at)
    const sameDay = d.toDateString() === now.toDateString()
    const time = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(d)
    return sameDay ? `${t('panel.today_')} ${time}` : dateFmt(card.updated_at)
  })()

  const icon = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const
  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b-[1.5px] border-border px-6 py-4">
        <label className="relative">
          <span className="sr-only">{t('panel.column')}</span>
          <span className="pointer-events-none absolute start-3 top-1/2 size-2.5 -translate-y-1/2 rounded-full" style={{ background: `var(--${column?.color ?? 'tag-5'})` }} aria-hidden />
          <select
            value={card.column_id ?? ''}
            onChange={(e) => report(act.moveCard(card.id, e.target.value, Number.MAX_SAFE_INTEGER))}
            className="appearance-none rounded-control border-[1.5px] border-border bg-surface py-2 ps-8 pe-9 text-sm font-semibold"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown size={14} strokeWidth={2} aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2" />
        </label>
        <div className="ms-auto flex items-center gap-2">
          <Button variant={card.is_today ? 'sun' : 'outline'} aria-pressed={card.is_today} onClick={() => report(act.updateCard(card.id, { is_today: !card.is_today }))}>
            <Sun {...icon} /> {t('panel.today')}
          </Button>
          <Button disabled title={t('panel.blitzSoon')}>
            <Timer {...icon} /> {t('panel.blitz')}
          </Button>
          <details className="relative">
            <summary aria-label={t('panel.more')} className="grid size-10 cursor-pointer list-none place-items-center rounded-control border-[1.5px] border-border bg-surface [&::-webkit-details-marker]:hidden">
              <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
            </summary>
            <div className="absolute end-0 z-10 mt-2 w-52 rounded-card border-[1.5px] border-border bg-surface p-1.5 shadow-[var(--shadow-floating)]">
              <button type="button" className="w-full rounded-control px-3 py-2 text-start text-sm hover:bg-surface-muted" onClick={() => navigate(cardHref(card.id, !page))}>
                {page ? t('panel.backToPanel') : t('panel.openAsPage')}
              </button>
              <button
                type="button"
                className="w-full rounded-control px-3 py-2 text-start text-sm font-semibold text-coral hover:bg-coral-soft"
                onClick={() => {
                  if (!window.confirm(t('panel.confirmDelete'))) return
                  report(act.deleteCard(card.id))
                  closeToBoard()
                }}
              >
                {t('panel.delete')}
              </button>
            </div>
          </details>
          <button type="button" aria-label={t('panel.close')} onClick={closeToBoard} className="grid size-10 place-items-center rounded-control hover:bg-surface-muted">
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        {error && (
          <p role="alert" className="mt-4 rounded-control border-[1.5px] border-coral bg-coral-soft p-2 text-sm text-coral" dir="auto">{error}</p>
        )}
        <input
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder={t('panel.titlePlaceholder')}
          aria-label={t('panel.title')}
          className="mt-5 w-full bg-transparent text-start text-3xl font-extrabold placeholder:text-muted"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className={cn('flex items-center gap-2 rounded-control border-[1.5px] bg-surface px-3 py-1.5 text-sm', estimateBad ? 'border-coral' : 'border-border')}>
            <Clock {...icon} className="text-fg-2" />
            <span className="text-fg-2">{t('panel.estimate')}</span>
            <input
              dir="ltr"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              onBlur={commitEstimate}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              aria-invalid={estimateBad}
              aria-describedby={estimateBad ? 'estimate-hint' : undefined}
              className="w-16 bg-transparent font-bold tabular"
              placeholder="45m"
            />
          </label>
          {tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1">
              <TagChip tag={tag} />
              <button
                type="button"
                aria-label={t('panel.removeTag', { name: tag.name })}
                onClick={() => report(act.setCardTags(card.id, cardTagIds.filter((x) => x !== tag.id)))}
                className="grid size-5 place-items-center rounded-full text-muted hover:bg-surface-muted"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ))}
          {tagInput === null ? (
            <button type="button" onClick={() => setTagInput('')} className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-dashed border-border px-3 py-1 text-xs font-semibold text-fg-2">
              <Plus size={12} strokeWidth={2} aria-hidden /> {t('panel.addTag')}
            </button>
          ) : (
            <>
              <input
                autoFocus
                list="nf-tags"
                dir="auto"
                value={tagInput}
                aria-label={t('panel.tagName')}
                onChange={(e) => setTagInput(e.target.value)}
                onBlur={() => void addTag(tagInput)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addTag(tagInput)
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setTagInput(null)
                  }
                }}
                className="w-32 rounded-full border-[1.5px] border-border bg-surface px-3 py-1 text-xs"
              />
              <datalist id="nf-tags">{data.tags.map((tg) => <option key={tg.id} value={tg.name} />)}</datalist>
            </>
          )}
          <label className="flex items-center gap-2 rounded-control border-[1.5px] border-border bg-surface px-3 py-1.5 text-sm">
            <Calendar {...icon} className="text-fg-2" />
            <span className="sr-only">{t('panel.due')}</span>
            <input
              type="date"
              dir="ltr"
              value={card.due_date ?? ''}
              onChange={(e) => report(act.updateCard(card.id, { due_date: e.target.value || null }))}
              className="bg-transparent font-bold"
            />
          </label>
        </div>
        {estimateBad && <p id="estimate-hint" className="mt-1 text-xs text-coral">{t('panel.estimateHint')}</p>}
        <p className="mt-3 text-xs text-muted">
          {t('panel.created', { date: dateFmt(card.created_at) })} · {t('panel.updated', { date: updatedLabel })}
        </p>

        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
          <MarkdownEditor
            value={initialBody}
            onChange={onBody}
            dirMode={dirMode}
            ariaLabel={t('editor.note')}
            placeholder={t('editor.placeholder')}
            noMatchLabel={t('editor.noMatch')}
            getLinkItems={getLinkItems}
            toolbar={(editor) => <EditorToolbar editor={editor} dirMode={dirMode} onDirMode={setDirMode} />}
          />
          <aside className="space-y-5 md:border-s-[1.5px] md:border-border md:ps-5">
            <Rail title={t('panel.backlinks')} empty={t('panel.noBacklinks')}>
              {backlinks.map((c) => <CardLinkRow key={c.id} card={c} data={data} />)}
            </Rail>
            <Rail title={t('panel.linked')} empty={t('panel.noLinks')}>
              {linked.map((c) => <CardLinkRow key={c.id} card={c} data={data} />)}
            </Rail>
            <Rail title={t('panel.sessions')} empty={t('panel.noSessions')}>{[]}</Rail>
          </aside>
        </div>
      </div>
    </div>
  )

  if (page) return <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">{body}</div>
  return (
    <dialog
      ref={dialogRef}
      aria-label={t('panel.label')}
      onClose={closeToBoard}
      className="fixed inset-y-0 start-auto end-0 m-0 h-dvh max-h-none w-[min(60vw,100vw)] max-w-none min-w-[min(40rem,100vw)] flex-col border-s-[1.5px] border-border bg-surface p-0 text-fg open:flex backdrop:bg-[var(--scrim)]"
    >
      {body}
    </dialog>
  )
}

function Rail({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children]
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">{title}</h3>
      {items.length ? <ul className="space-y-2">{items}</ul> : <p className="text-sm text-muted" dir="auto">{empty}</p>}
    </section>
  )
}

function CardLinkRow({ card, data }: { card: Card; data: BoardData }) {
  const { t } = useTranslation()
  const col = data.columns.find((c) => c.id === card.column_id)
  return (
    <li>
      <a
        href={cardHref(card.id)}
        className="flex items-center gap-2 rounded-control border-[1.5px] border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
      >
        <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--${col?.color ?? 'tag-5'})` }} aria-hidden />
        <span dir="auto" className="min-w-0 flex-1 text-start break-words">{card.title || t('nav.untitled')}</span>
      </a>
    </li>
  )
}
