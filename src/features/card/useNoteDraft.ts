import { useCallback, useEffect, useRef } from 'react'
import { useBoardActions } from '@/features/board/hooks'

const SAVE_DELAY_MS = 700

/**
 * Debounced note autosave shared by the card panel and Blitz. Flushes on unmount, on
 * pagehide (tab close / refresh) and on demand, so a keystroke is never lost on navigation.
 * Nothing is written until the text actually differs from what was last saved.
 */
export function useNoteDraft(cardId: string, savedBody: string, onError: (e: unknown) => void) {
  const act = useBoardActions()
  const draft = useRef(savedBody)
  const saved = useRef(savedBody)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (draft.current === saved.current) return
    saved.current = draft.current
    act.saveBody(cardId, draft.current).catch((e: unknown) => onErrorRef.current(e))
  }, [act, cardId])

  const onChange = useCallback(
    (md: string) => {
      draft.current = md
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY_MS)
    },
    [flush],
  )

  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [flush])

  return { onChange, flush }
}
