import { sorted } from '@/features/board/logic'
import type { BoardData, Card, TimeSession } from '@/features/board/types'
import { elapsedSec } from '@/features/timer/core'
import { isDone } from '@/features/today/logic'

export type RangeKind = 'day' | 'week' | 'month'

export interface Range {
  kind: RangeKind
  start: Date // inclusive, local midnight
  end: Date // exclusive
  /** Start of each bucket in the focus chart: hours for a day, days otherwise. */
  buckets: Date[]
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** The day / week / month containing `anchor`. `weekStart`: 0 = Sunday .. 6 = Saturday. */
export function rangeFor(kind: RangeKind, anchor: Date, weekStart: number): Range {
  const day = startOfDay(anchor)
  if (kind === 'day') {
    const end = addDays(day, 1)
    return { kind, start: day, end, buckets: Array.from({ length: 24 }, (_, h) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h)) }
  }
  if (kind === 'week') {
    const start = addDays(day, -((day.getDay() - weekStart + 7) % 7))
    return { kind, start, end: addDays(start, 7), buckets: Array.from({ length: 7 }, (_, i) => addDays(start, i)) }
  }
  const start = new Date(day.getFullYear(), day.getMonth(), 1)
  const end = new Date(day.getFullYear(), day.getMonth() + 1, 1)
  const n = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return { kind, start, end, buckets: Array.from({ length: n }, (_, i) => addDays(start, i)) }
}

/** The same range one step earlier (-1) or later (+1). */
export function shiftRange(r: Range, steps: number, weekStart: number): Range {
  const a = r.start
  const anchor =
    r.kind === 'day' ? addDays(a, steps)
    : r.kind === 'week' ? addDays(a, 7 * steps)
    : new Date(a.getFullYear(), a.getMonth() + steps, 1)
  return rangeFor(r.kind, anchor, weekStart)
}

const inRange = (s: TimeSession, r: { start: Date; end: Date }) => {
  const t = Date.parse(s.started_at)
  return t >= r.start.getTime() && t < r.end.getTime()
}

/** Sessions that started in the range (a session is counted whole, on the day it started). */
export const sessionsIn = (sessions: TimeSession[], r: { start: Date; end: Date }) => sessions.filter((s) => inRange(s, r))

export function focusByBucket(sessions: TimeSession[], r: Range, nowMs: number): number[] {
  const out = r.buckets.map(() => 0)
  for (const s of sessionsIn(sessions, r)) {
    const t = Date.parse(s.started_at)
    const i = r.kind === 'day' ? new Date(t).getHours() : Math.floor((startOfDay(new Date(t)).getTime() - r.start.getTime()) / 86_400_000 + 0.5)
    if (i >= 0 && i < out.length) out[i] += elapsedSec(s, nowMs)
  }
  return out
}

export interface TagShare {
  key: string // tag id, or 'none'
  name: string | null // null = untagged
  colorIndex: number | null
  sec: number
  pct: number
}

/** Focus time per tag. A card with several tags splits its time evenly between them. */
export function timeByTag(data: BoardData, r: Range, nowMs: number): TagShare[] {
  const acc = new Map<string, TagShare>()
  let total = 0
  for (const s of sessionsIn(data.sessions, r)) {
    const sec = elapsedSec(s, nowMs)
    if (!sec) continue
    total += sec
    const tags = data.cardTags.filter((x) => x.card_id === s.card_id).flatMap((x) => data.tags.find((t) => t.id === x.tag_id) ?? [])
    const targets = tags.length ? tags : [null]
    for (const tag of targets) {
      const key = tag?.id ?? 'none'
      const cur = acc.get(key) ?? { key, name: tag?.name ?? null, colorIndex: tag?.color_index ?? null, sec: 0, pct: 0 }
      cur.sec += sec / targets.length
      acc.set(key, cur)
    }
  }
  return [...acc.values()].map((x) => ({ ...x, pct: total ? (x.sec / total) * 100 : 0 })).sort((a, b) => b.sec - a.sec)
}

export interface EstimateRow {
  card: Card
  estimateMin: number
  actualMin: number
  diffMin: number
  /** Over by more than 10% of the estimate. */
  long: boolean
  lastSession: number
}

/** Cards with an estimate that had focus time in the range. Most recently worked first. */
export function estimateRows(data: BoardData, r: Range, nowMs: number): EstimateRow[] {
  const sessions = sessionsIn(data.sessions, r)
  const rows: EstimateRow[] = []
  for (const card of data.cards) {
    if (card.estimate_min === null) continue
    const mine = sessions.filter((s) => s.card_id === card.id)
    if (!mine.length) continue
    const actualMin = Math.round(mine.reduce((n, s) => n + elapsedSec(s, nowMs), 0) / 60)
    const diffMin = actualMin - card.estimate_min
    rows.push({
      card, estimateMin: card.estimate_min, actualMin, diffMin,
      long: diffMin > card.estimate_min * 0.1,
      lastSession: Math.max(...mine.map((s) => Date.parse(s.started_at))),
    })
  }
  return rows.sort((a, b) => b.lastSession - a.lastSession)
}

export interface Kpis {
  focusSec: number
  prevFocusSec: number
  finished: number
  perDay: number
  accuracy: { pct: number; within: number; of: number } | null
  over: { count: number; topTag: string | null }
}

export const WITHIN_MIN = 10

export function kpis(data: BoardData, r: Range, prev: Range, nowMs: number): Kpis {
  const sum = (rr: Range) => sessionsIn(data.sessions, rr).reduce((n, s) => n + elapsedSec(s, nowMs), 0)
  const rows = estimateRows(data, r, nowMs)
  const worked = new Set(sessionsIn(data.sessions, r).map((s) => s.card_id))
  const finished = data.cards.filter((c) => worked.has(c.id) && isDone(c, data.columns)).length
  const daysSoFar = Math.max(1, Math.min(r.buckets.length, Math.ceil((Math.min(nowMs, r.end.getTime()) - r.start.getTime()) / 86_400_000)))
  const days = r.kind === 'day' ? 1 : daysSoFar
  const within = rows.filter((x) => Math.abs(x.diffMin) <= WITHIN_MIN).length
  const overRows = rows.filter((x) => x.long)
  const tagCount = new Map<string, number>()
  for (const x of overRows) {
    for (const ct of data.cardTags.filter((c) => c.card_id === x.card.id)) {
      const name = data.tags.find((t) => t.id === ct.tag_id)?.name
      if (name) tagCount.set(name, (tagCount.get(name) ?? 0) + 1)
    }
  }
  const top = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    focusSec: sum(r),
    prevFocusSec: sum(prev),
    finished,
    perDay: finished / days,
    accuracy: rows.length ? { pct: Math.round((within / rows.length) * 100), within, of: rows.length } : null,
    over: { count: overRows.length, topTag: top ? top[0] : null },
  }
}

export interface LogRow {
  session: TimeSession
  card: Card | undefined
  sec: number
}

export function sessionLog(data: BoardData, r: Range, nowMs: number): LogRow[] {
  return sessionsIn(data.sessions, r)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .map((s) => ({ session: s, card: data.cards.find((c) => c.id === s.card_id), sec: elapsedSec(s, nowMs) }))
}

/** Reports count real work only: a fixed order for stable rendering when ties occur. */
export const byColumn = sorted
