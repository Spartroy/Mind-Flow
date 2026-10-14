import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoardActions } from '@/features/board/hooks'
import { parseHash, useHash } from '@/lib/router'
import { useFloat } from './floatStore'
import { PipPortal } from './pip'
import { pipSupported, usePip } from './usePip'
import { TimerMini } from './TimerMini'
import { useActiveView } from './useActiveView'
import { useFinishFlow } from './useFinish'

const SIZE = { width: 300, height: 130 }
const MICRO = { width: 160, height: 60 }

/**
 * Owns the floating timer: a Document Picture-in-Picture window where the browser allows it,
 * otherwise (or if the browser refuses) a small widget inside the page. The timer itself is the
 * session in the main page, so closing the window or refreshing loses nothing.
 */
export function FloatHost() {
  const { t } = useTranslation()
  const act = useBoardActions()
  const finish = useFinishFlow()
  const v = useActiveView(1000)
  const pip = usePip()
  const { wanted, set } = useFloat()
  const route = parseHash(useHash())
  const [compact, setCompact] = useState(false)

  // Register the open/close entry points that buttons call from a user gesture.
  const { open: pipOpen, close: pipClose } = pip
  useEffect(() => {
    set({
      open: () => {
        set({ wanted: true, refused: false })
        if (!pipSupported()) return
        // Called synchronously from the click, so the browser sees the user gesture.
        void pipOpen(compact ? MICRO : SIZE).then((w) => {
          if (!w) set({ refused: true })
        })
      },
      close: () => {
        pipClose()
        set({ wanted: false })
      },
    })
  }, [pipOpen, pipClose, set, compact])

  // The user closing the PiP window means "I do not want it": do not fall back to the in-page widget.
  const hadWin = useRef(false)
  useEffect(() => {
    if (pip.win) hadWin.current = true
    else if (hadWin.current) {
      hadWin.current = false
      set({ wanted: false })
    }
  }, [pip.win, set])

  // No session (finished elsewhere, or none): nothing to float.
  // Short grace period: the window may be opened in the same click that starts the session, a moment before it exists.
  useEffect(() => {
    if (v.session || (!pip.win && !wanted)) return
    const id = setTimeout(() => {
      if (pip.win) pipClose()
      set({ wanted: false })
    }, 3000)
    return () => clearTimeout(id)
  }, [v.session, pip.win, pipClose, wanted, set])

  if (!v.session || !v.card) return null

  const toggle = () => void (v.running ? act.pauseSession(false) : act.resumeSession())
  const overtime = v.estimateMin ? v.prog.overtime : false
  const fraction = v.estimateMin ? v.prog.fraction : 0
  const view = (c: boolean, inPage: boolean) => (
    <TimerMini
      title={v.card!.title || t('nav.untitled')}
      seconds={v.estimateMin && overtime ? v.prog.seconds : v.elapsed}
      overtime={overtime}
      paused={v.paused}
      fraction={fraction}
      compact={c}
      onToggle={toggle}
      onFinish={() => void finish()}
      onClose={inPage ? () => set({ wanted: false }) : undefined}
      onCompact={
        inPage
          ? undefined
          : () => {
              const next = !c
              setCompact(next)
              try {
                pip.win?.resizeTo(next ? MICRO.width : SIZE.width, next ? MICRO.height : SIZE.height)
              } catch {
                /* some browsers do not allow resizing a PiP window: the layout still switches */
              }
            }
      }
      note={inPage ? t('float.fallback') : undefined}
    />
  )

  return (
    <>
      <PipPortal win={pip.win}>
        <div className="h-screen">{view(compact, false)}</div>
      </PipPortal>
      {wanted && !pip.win && route.name !== 'blitz' && (
        <div
          role="region"
          aria-label={t('float.label')}
          className="fixed end-4 bottom-24 z-40 w-72 overflow-hidden rounded-card border-[1.5px] border-primary shadow-[var(--shadow-floating)]"
        >
          {view(false, true)}
        </div>
      )}
    </>
  )
}
