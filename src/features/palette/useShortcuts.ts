import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoardActions, useSettings } from '@/features/board/hooks'
import { quickCreateCard } from '@/features/board/quickCreate'
import { autoFloat } from '@/features/timer/floatStore'
import { cardHref, navigate, parseHash } from '@/lib/router'
import { usePrefs } from '@/lib/prefs'
import { usePalette, useRecents } from './recents'

const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null
  return !!e && (e.isContentEditable || /^(input|textarea|select)$/i.test(e.tagName))
}

/**
 * Global shortcuts. Single keys (N, B, T) never fire while typing, with a modifier held, or while a dialog is open.
 * Ctrl/Cmd+K works everywhere, including inside text fields.
 */
export function useShortcuts() {
  const { t } = useTranslation()
  const act = useBoardActions()
  const settings = useSettings()
  const setOpen = usePalette((s) => s.setOpen)

  // Remember opened cards for the palette's "Recent" list.
  useEffect(() => {
    const record = () => {
      const r = parseHash(location.hash)
      if (r.name === 'card') useRecents.getState().push(r.id)
    }
    record()
    window.addEventListener('hashchange', record)
    return () => window.removeEventListener('hashchange', record)
  }, [])

  useEffect(() => {
    const starter = () => t('board.starter', { returnObjects: true }) as string[]
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const s = usePalette.getState()
        s.setOpen(!s.open)
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        const p = usePrefs.getState()
        const next = p.locale === 'ar' ? 'en' : 'ar'
        p.setLocale(next)
        void act.updateSettings({ locale: next })
        return
      }
      if (mod || e.altKey || e.shiftKey || isTyping(e.target) || document.querySelector('dialog[open]:not([data-card-panel]), [role=dialog]')) return
      const route = parseHash(location.hash)
      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        void quickCreateCard(act, starter(), '').then(({ id }) => navigate(cardHref(id)))
      } else if (key === 'b' && route.name === 'card') {
        e.preventDefault()
        autoFloat(settings.auto_float_timer)
        navigate(`#/blitz/${encodeURIComponent(route.id)}`)
      } else if (key === 't' && route.name === 'card') {
        e.preventDefault()
        const card = act.snapshot()?.cards.find((c) => c.id === route.id)
        if (card) void act.setToday(card.id, !card.is_today)
      } else if (key === '/') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, settings.auto_float_timer, setOpen, t])
}
