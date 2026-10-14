import { generateKeyBetween } from 'fractional-indexing'
import { byPosition, sorted } from '@/features/board/logic'
import type { Card, Column } from '@/features/board/types'
import { loggedSec } from '@/features/timer/core'
import type { TimeSession } from '@/features/board/types'

/** Planning capacity for one day, in minutes. (A Settings field comes in Phase 5.) */
export const DAY_CAPACITY_MIN = 240

/** A card is done when it sits in the last column. With fewer than two columns nothing is "done". */
export function doneColumn(columns: Column[]): Column | undefined {
  const cols = sorted(columns)
  return cols.length >= 2 ? cols[cols.length - 1] : undefined
}
export const isDone = (card: Card, columns: Column[]) => {
  const done = doneColumn(columns)
  return done !== undefined && card.column_id === done.id
}

const posKey = (c: Card) => c.today_position ?? ''

/** Today's cards in the user's order. Cards without a position (old data) sort last, by board position. */
export function todayCards(cards: Card[]): Card[] {
  return cards
    .filter((c) => c.is_today && !c.archived_at)
    .sort((a, b) => Number(a.today_position === null) - Number(b.today_position === null) || (posKey(a) < posKey(b) ? -1 : posKey(a) > posKey(b) ? 1 : byPosition(a, b)))
}

/** Key for putting a card at `index` among today's other cards. */
export function todayPositionAt(cards: Card[], cardId: string, index: number): string {
  const others = todayCards(cards).filter((c) => c.id !== cardId && c.today_position !== null)
  const i = Math.max(0, Math.min(index, others.length))
  return generateKeyBetween(others[i - 1]?.today_position ?? null, others[i]?.today_position ?? null)
}

export interface Capacity {
  plannedMin: number
  doneSec: number
  capacityMin: number
  /** Minutes over capacity (0 when within). */
  overMin: number
  fraction: number // 0..1 of capacity planned
  state: 'empty' | 'planned' | 'over' | 'complete'
}

export function capacity(today: Card[], columns: Column[], sessions: TimeSession[], nowMs: number, capacityMin = DAY_CAPACITY_MIN): Capacity {
  const plannedMin = today.reduce((n, c) => n + (c.estimate_min ?? 0), 0)
  const doneSec = today.reduce((n, c) => n + loggedSec(sessions, c.id, nowMs), 0)
  const overMin = Math.max(0, plannedMin - capacityMin)
  const allDone = today.length > 0 && today.every((c) => isDone(c, columns))
  const state = today.length === 0 ? 'empty' : allDone ? 'complete' : overMin > 0 ? 'over' : 'planned'
  return { plannedMin, doneSec, capacityMin, overMin, fraction: Math.min(1, capacityMin ? plannedMin / capacityMin : 0), state }
}

/** Cards worth adding: open, estimated, not already planned. Soonest due first, then shortest. */
export function suggestions(cards: Card[], columns: Column[], limit = 3): Card[] {
  return cards
    .filter((c) => !c.is_today && !c.archived_at && c.estimate_min !== null && !isDone(c, columns))
    .sort((a, b) => (a.due_date ?? '9999') .localeCompare(b.due_date ?? '9999') || (a.estimate_min ?? 0) - (b.estimate_min ?? 0))
    .slice(0, limit)
}

/** First card in today's order that is not done: what "Blitz now" starts. */
export const nextUp = (today: Card[], columns: Column[]) => today.find((c) => !isDone(c, columns))
