import { Command } from 'cmdk'
import { BarChart3, Columns3, FileText, Languages, Moon, Network, Plus, Search, Settings, Sun, Timer } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TagChip } from '@/features/board/CardTile'
import { useBoard, useBoardActions, useSettings } from '@/features/board/hooks'
import { normalize } from '@/features/board/logic'
import { quickCreateCard } from '@/features/board/quickCreate'
import type { Card } from '@/features/board/types'
import { autoFloat } from '@/features/timer/floatStore'
import { cardHref, navigate } from '@/lib/router'
import { usePrefs } from '@/lib/prefs'
import { usePalette, useRecents } from './recents'

const MAX_CARDS = 8

export function CommandPalette() {
  const { open, setOpen } = usePalette()
  if (!open) return null
  return <PaletteBody onClose={() => setOpen(false)} />
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { data } = useBoard()
  const act = useBoardActions()
  const settings = useSettings()
  const prefs = usePrefs()
  const recents = useRecents((s) => s.ids)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('')
  const q = normalize(query.trim())
  const icon = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const

  const live = useMemo(() => (data?.cards ?? []).filter((c) => !c.archived_at), [data])
  const matches = useMemo<Card[]>(() => {
    if (!q) return recents.flatMap((id) => live.find((c) => c.id === id) ?? []).slice(0, MAX_CARDS)
    return live.filter((c) => normalize(c.title).includes(q) || normalize(c.body_md).includes(q)).slice(0, MAX_CARDS)
  }, [q, live, recents])

  const go = (hash: string) => {
    onClose()
    navigate(hash)
  }
  const starter = t('board.starter', { returnObjects: true }) as string[]
  async function create(today: boolean) {
    const title = query.trim()
    if (!title) return
    onClose()
    const { id } = await quickCreateCard(act, starter, title, { today })
    navigate(cardHref(id))
  }
  function blitz(card: Card) {
    onClose()
    autoFloat(settings.auto_float_timer)
    navigate(`#/blitz/${encodeURIComponent(card.id)}`)
  }
  function toToday(card: Card) {
    onClose()
    void act.setToday(card.id, true)
  }

  const actions: { id: string; label: string; icon: ReactNode; run: () => void }[] = [
    { id: 'a-board', label: t('palette.goBoard'), icon: <Columns3 {...icon} />, run: () => go('#/board') },
    { id: 'a-today', label: t('palette.goToday'), icon: <Sun {...icon} />, run: () => go('#/today') },
    { id: 'a-map', label: t('palette.goMap'), icon: <Network {...icon} />, run: () => go('#/map') },
    { id: 'a-reports', label: t('palette.goReports'), icon: <BarChart3 {...icon} />, run: () => go('#/reports') },
    { id: 'a-settings', label: t('palette.goSettings'), icon: <Settings {...icon} />, run: () => go('#/settings') },
    { id: 'a-new', label: t('palette.newCard'), icon: <Plus {...icon} />, run: () => {
      onClose()
      void quickCreateCard(act, starter, '').then(({ id }) => navigate(cardHref(id)))
    } },
    { id: 'a-theme', label: t('palette.toggleTheme'), icon: <Moon {...icon} />, run: () => {
      onClose()
      const dark = document.documentElement.classList.contains('dark')
      prefs.setTheme(dark ? 'light' : 'dark')
      void act.updateSettings({ theme: dark ? 'light' : 'dark' })
    } },
    { id: 'a-dir', label: t('palette.toggleLang'), icon: <Languages {...icon} />, run: () => {
      onClose()
      const next = prefs.locale === 'ar' ? 'en' : 'ar'
      prefs.setLocale(next)
      void act.updateSettings({ locale: next })
    } },
  ]
  const shownActions = q ? actions.filter((a) => normalize(a.label).includes(q)) : []
  const highlighted = matches.find((c) => `card-${c.id}` === active)

  const cardRow = (c: Card) => {
    const col = data?.columns.find((x) => x.id === c.column_id)
    const tag = data?.cardTags.filter((x) => x.card_id === c.id).flatMap((x) => data.tags.find((tg) => tg.id === x.tag_id) ?? [])[0]
    return (
      <Command.Item key={c.id} value={`card-${c.id}`} onSelect={() => go(cardHref(c.id))} className="palette-item">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-muted text-fg-2"><FileText {...icon} /></span>
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-start font-bold">{c.title || t('nav.untitled')}</span>
          <span className="block truncate text-start text-xs text-muted">{[col?.name, c.estimate_min != null ? t('palette.estimate', { min: c.estimate_min }) : null].filter(Boolean).join(' · ')}</span>
        </span>
        {tag && <TagChip tag={tag} />}
      </Command.Item>
    )
  }

  const noMatch = q !== '' && matches.length === 0 && shownActions.length === 0

  return (
    <Command.Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      label={t('palette.label')}
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      overlayClassName="palette-overlay"
      contentClassName="palette"
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        if ((e.ctrlKey || e.metaKey) && query.trim() && (noMatch || !highlighted)) {
          e.preventDefault()
          void create(true) // Ctrl+Enter: create and add to Today
        } else if ((e.ctrlKey || e.metaKey) && highlighted) {
          e.preventDefault()
          toToday(highlighted)
        } else if (e.shiftKey && highlighted) {
          e.preventDefault()
          blitz(highlighted)
        }
      }}
    >
      <div className="flex items-center gap-3 border-b-[1.5px] border-border px-4 py-3">
        <Search {...icon} className="text-fg-2" />
        <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder={t('palette.placeholder')} dir="auto" className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-muted" />
        <kbd className="rounded-[8px] border-[1.5px] border-border px-1.5 py-0.5 text-xs font-bold text-fg-2">Esc</kbd>
      </div>

      <Command.List className="max-h-[22rem] overflow-y-auto p-2">
        {noMatch && (
          <Command.Group heading={t('palette.quickCapture')}>
            <Command.Item value="create-card" onSelect={() => void create(false)} className="palette-item">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary text-primary-fg"><Plus {...icon} /></span>
              <span dir="auto" className="min-w-0 flex-1 truncate text-start font-bold">{t('palette.createCard')} <span className="text-primary">{query.trim()}</span></span>
              <kbd className="rounded-[6px] border-[1.5px] border-border px-1.5 text-xs font-bold">Enter</kbd>
            </Command.Item>
          </Command.Group>
        )}
        {noMatch && (
          <Command.Group heading={t('palette.options')}>
            <Command.Item value="create-plain" onSelect={() => void create(false)} className="palette-item">
              <span className="min-w-0 flex-1 text-start"><span className="block font-bold">{t('palette.createInFirst')}</span><span className="text-xs text-muted">{t('palette.default')}</span></span>
            </Command.Item>
            <Command.Item value="create-today" onSelect={() => void create(true)} className="palette-item">
              <span className="min-w-0 flex-1 text-start"><span className="block font-bold">{t('palette.createToday')}</span><span className="text-xs text-muted">Ctrl Enter</span></span>
              <Timer {...icon} className="text-sun" />
            </Command.Item>
          </Command.Group>
        )}

        {matches.length > 0 && <Command.Group heading={q ? t('palette.cards') : t('palette.recent')}>{matches.map(cardRow)}</Command.Group>}
        {!q && matches.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{t('palette.empty')}</p>}

        {(highlighted || shownActions.length > 0) && (
          <Command.Group heading={t('palette.actions')}>
            {highlighted && (
              <>
                <Command.Item value="act-blitz" onSelect={() => blitz(highlighted)} className="palette-item">
                  <span className="min-w-0 flex-1 text-start"><span className="block font-bold">{t('palette.startBlitz')}</span><span className="text-xs text-muted">Shift Enter</span></span>
                </Command.Item>
                <Command.Item value="act-today" onSelect={() => toToday(highlighted)} className="palette-item">
                  <span className="min-w-0 flex-1 text-start"><span className="block font-bold">{t('palette.addToday')}</span><span className="text-xs text-muted">Ctrl Enter</span></span>
                </Command.Item>
              </>
            )}
            {shownActions.map((a) => (
              <Command.Item key={a.id} value={a.id} onSelect={a.run} className="palette-item">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-muted text-fg-2">{a.icon}</span>
                <span className="min-w-0 flex-1 truncate text-start font-bold">{a.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {q !== '' && !noMatch && (
          <Command.Group heading={t('palette.quickCapture')}>
            <Command.Item value="create-card" onSelect={() => void create(false)} className="palette-item">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-muted text-fg-2"><Plus {...icon} /></span>
              <span dir="auto" className="min-w-0 flex-1 truncate text-start font-bold">{t('palette.createCard')} <span className="text-primary">{query.trim()}</span></span>
            </Command.Item>
          </Command.Group>
        )}
      </Command.List>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t-[1.5px] border-border bg-surface-muted px-4 py-2 text-xs font-bold text-fg-2">
        <span>{t('palette.hintMove')}</span>
        <span>{t('palette.hintOpen')}</span>
        {highlighted && <span>{t('palette.hintToday')}</span>}
        {noMatch && <span>{t('palette.hintCreate')}</span>}
      </div>
    </Command.Dialog>
  )
}
