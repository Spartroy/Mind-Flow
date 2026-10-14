import type { SessionMode, TimeSession } from '@/features/board/types'

/**
 * Pure mirror of the session_* SQL functions (supabase/migrations/..._sessions.sql), used by
 * the in-memory demo repo. Keep the two in step: the same semantics, with `nowMs` standing in
 * for the database clock.
 */
export interface OpResult {
  sessions: TimeSession[]
  /** The affected session, or null when nothing matched. */
  row: TimeSession | null
}

const iso = (ms: number) => new Date(ms).toISOString()
const active = (s: TimeSession) => s.ended_at === null

function updateActive(sessions: TimeSession[], pick: (s: TimeSession) => boolean, change: (s: TimeSession) => TimeSession): OpResult {
  let row: TimeSession | null = null
  const next = sessions.map((s) => {
    if (!active(s) || !pick(s)) return s
    row = change(s)
    return row
  })
  return { sessions: next, row }
}

export function finish(sessions: TimeSession[], nowMs: number): OpResult {
  return updateActive(sessions, () => true, (s) => ({
    ...s,
    paused_total_sec: s.paused_total_sec + (s.paused_at ? Math.round((nowMs - Date.parse(s.paused_at)) / 1000) : 0),
    paused_at: null,
    on_break: false,
    ended_at: iso(nowMs),
  }))
}

export function start(
  sessions: TimeSession[], cardId: string, mode: SessionMode, estimateMin: number | null, nowMs: number, id: string,
): OpResult {
  const ended = finish(sessions, nowMs).sessions
  const row: TimeSession = {
    id, card_id: cardId, started_at: iso(nowMs), ended_at: null, paused_at: null, paused_total_sec: 0,
    mode, on_break: false, breaks_taken: 0, estimate_snapshot_min: estimateMin,
  }
  return { sessions: [...ended, row], row }
}

export const pause = (sessions: TimeSession[], onBreak: boolean, nowMs: number): OpResult =>
  updateActive(sessions, (s) => s.paused_at === null, (s) => ({
    ...s, paused_at: iso(nowMs), on_break: onBreak, breaks_taken: s.breaks_taken + (onBreak ? 1 : 0),
  }))

export const resume = (sessions: TimeSession[], nowMs: number): OpResult =>
  updateActive(sessions, (s) => s.paused_at !== null, (s) => ({
    ...s,
    paused_total_sec: s.paused_total_sec + Math.round((nowMs - Date.parse(s.paused_at!)) / 1000),
    paused_at: null,
    on_break: false,
  }))

export const extend = (sessions: TimeSession[], minutes: number): OpResult =>
  updateActive(sessions, () => true, (s) => ({ ...s, estimate_snapshot_min: (s.estimate_snapshot_min ?? 0) + minutes }))
