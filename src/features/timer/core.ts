import type { TimeSession } from '@/features/board/types'

/**
 * Elapsed focus time, derived only from timestamps: it survives refresh, tab sleep and
 * closing the browser because nothing is ever "counted" by ticks.
 * `nowMs` must be server-adjusted (see clock.ts) for a running session.
 */
export function elapsedMs(s: TimeSession, nowMs: number): number {
  const end = s.ended_at ? Date.parse(s.ended_at) : s.paused_at ? Date.parse(s.paused_at) : nowMs
  return Math.max(0, end - Date.parse(s.started_at) - s.paused_total_sec * 1000)
}

export const elapsedSec = (s: TimeSession, nowMs: number) => Math.floor(elapsedMs(s, nowMs) / 1000)
export const isActive = (s: TimeSession) => s.ended_at === null
export const isRunning = (s: TimeSession) => s.ended_at === null && s.paused_at === null
export const isPaused = (s: TimeSession) => s.ended_at === null && s.paused_at !== null

export const activeSession = (sessions: TimeSession[]) => sessions.find(isActive)

/** Total logged time on a card across all its sessions (running one included). */
export function loggedSec(sessions: TimeSession[], cardId: string, nowMs: number): number {
  return sessions.filter((s) => s.card_id === cardId).reduce((sum, s) => sum + elapsedSec(s, nowMs), 0)
}

export interface Progress {
  /** 0..1 of the estimate used (1 once over). */
  fraction: number
  overtime: boolean
  /** Seconds left, or seconds past the estimate when overtime. */
  seconds: number
}

export function progress(elapsed: number, estimateMin: number | null): Progress {
  if (!estimateMin) return { fraction: 0, overtime: false, seconds: elapsed }
  const target = estimateMin * 60
  return elapsed > target
    ? { fraction: 1, overtime: true, seconds: elapsed - target }
    : { fraction: elapsed / target, overtime: false, seconds: target - elapsed }
}

/** 27:42, or 1:05:09 from an hour up. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`
}

/** 4h 05m, 38m, 0m (planning and report totals). */
export function formatDuration(totalMin: number): string {
  const m = Math.round(totalMin)
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? (r ? `${h}h ${String(r).padStart(2, '0')}m` : `${h}h`) : `${r}m`
}

/** Offset between the database clock and this device, from one round trip (midpoint method). */
export function clockOffset(serverMs: number, sentAtMs: number, receivedAtMs: number): number {
  return serverMs - (sentAtMs + receivedAtMs) / 2
}

// ---------------------------------------------------------------- Pomodoro
// A break is a pause with on_break = true, so break time is never logged as work.
// Focus block n (1-based) ends when the session's own elapsed time reaches n * focus.

export interface PomodoroState {
  /** Focus block the session is in (while on a break: the block just finished). */
  block: number
  /** Seconds left in the current focus block; negative once the block is over. */
  blockRemainingSec: number
  /** A running focus block has ended: time to record the break. */
  breakDue: boolean
}

export function pomodoro(s: TimeSession, elapsed: number, focusMin: number): PomodoroState {
  const end = (s.breaks_taken + 1) * focusMin * 60
  const remaining = end - elapsed
  return {
    block: s.on_break ? s.breaks_taken : s.breaks_taken + 1,
    blockRemainingSec: remaining,
    breakDue: s.mode === 'pomodoro' && isRunning(s) && remaining <= 0,
  }
}

/** Seconds of the break left; negative once it is over.  is the "+2 min" total. */
export function breakRemainingSec(s: TimeSession, breakMin: number, extraSec: number, nowMs: number): number {
  if (!s.paused_at) return breakMin * 60 + extraSec
  return breakMin * 60 + extraSec - (nowMs - Date.parse(s.paused_at)) / 1000
}
