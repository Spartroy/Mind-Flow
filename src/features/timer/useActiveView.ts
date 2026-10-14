import { useBoard } from '@/features/board/hooks'
import { useNow } from './clock'
import { activeSession, elapsedSec, isPaused, isRunning, progress } from './core'

/** The running (or paused) session with everything the timer screens derive from it. */
export function useActiveView(intervalMs = 1000) {
  const { data } = useBoard()
  const now = useNow(intervalMs)
  const session = data ? activeSession(data.sessions) : undefined
  const card = session && data ? data.cards.find((c) => c.id === session.card_id) : undefined
  const elapsed = session ? elapsedSec(session, now) : 0
  const estimateMin = session?.estimate_snapshot_min ?? null
  return {
    data, now, session, card, elapsed, estimateMin,
    prog: progress(elapsed, estimateMin),
    running: session ? isRunning(session) : false,
    paused: session ? isPaused(session) : false,
  }
}
