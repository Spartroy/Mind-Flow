import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyBoard, type BoardData, type Card, type TimeSession } from '@/features/board/types'
import { estimateRows, focusByBucket, kpis, rangeFor, sessionLog, sessionsIn, shiftRange, timeByTag } from './logic'

// Local-time helpers so the tests hold in any time zone.
const L = (d: number, h = 9, m = 0) => new Date(2026, 9, d, h, m).getTime() // October 2026
const iso = (ms: number) => new Date(ms).toISOString()
const NOW = L(14, 18)

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id, title: id, body_md: '', column_id: 'todo', position: 'a0', estimate_min: null, is_today: false, today_position: null,
  due_date: null, archived_at: null, created_at: '', updated_at: '', ...extra,
})
const sess = (id: string, cardId: string, startMs: number, minutes: number, extra: Partial<TimeSession> = {}): TimeSession => ({
  id, card_id: cardId, started_at: iso(startMs), ended_at: iso(startMs + minutes * 60_000), paused_at: null, paused_total_sec: 0,
  mode: 'timer', on_break: false, breaks_taken: 0, estimate_snapshot_min: null, ...extra,
})

const data = (): BoardData => ({
  ...emptyBoard(),
  settings: defaultSettings,
  columns: [{ id: 'todo', name: 'To do', color: 'tag-1', position: 'a0' }, { id: 'done', name: 'Done', color: 'tag-4', position: 'a1' }],
  cards: [
    card('net', { estimate_min: 45, column_id: 'done' }),
    card('mark', { estimate_min: 90 }),
    card('mail', { estimate_min: 20 }),
    card('free'),
  ],
  tags: [{ id: 'tn', name: 'Networks', color_index: 4 }, { id: 'tt', name: 'Teaching', color_index: 2 }],
  cardTags: [{ card_id: 'net', tag_id: 'tn' }, { card_id: 'mark', tag_id: 'tt' }, { card_id: 'mark', tag_id: 'tn' }],
  sessions: [
    sess('s1', 'net', L(14, 9), 41), // today
    sess('s2', 'mark', L(13, 14), 118), // yesterday
    sess('s3', 'mail', L(12, 11), 35),
    sess('s4', 'free', L(11, 8), 10), // Sunday 11 Oct
    sess('old', 'net', L(7, 9), 60), // previous week
  ],
})

describe('ranges', () => {
  it('week honours the start-of-week setting', () => {
    const sun = rangeFor('week', new Date(2026, 9, 14), 0) // Wednesday 14 Oct, week starts Sunday
    expect(sun.start.getDate()).toBe(11)
    expect(sun.buckets).toHaveLength(7)
    const mon = rangeFor('week', new Date(2026, 9, 14), 1)
    expect(mon.start.getDate()).toBe(12)
    const sat = rangeFor('week', new Date(2026, 9, 14), 6)
    expect(sat.start.getDate()).toBe(10)
  })

  it('day has 24 hour buckets, month has one per day', () => {
    expect(rangeFor('day', new Date(2026, 9, 14), 0).buckets).toHaveLength(24)
    const m = rangeFor('month', new Date(2026, 9, 14), 0)
    expect(m.buckets).toHaveLength(31)
    expect(m.start.getDate()).toBe(1)
    expect(rangeFor('month', new Date(2026, 1, 3), 0).buckets).toHaveLength(28)
  })

  it('shifts to the previous and next range, across month and year ends', () => {
    const w = rangeFor('week', new Date(2026, 9, 14), 0)
    expect(shiftRange(w, -1, 0).start.getDate()).toBe(4)
    expect(shiftRange(w, 1, 0).start.getDate()).toBe(18)
    const jan = rangeFor('month', new Date(2026, 0, 15), 0)
    const dec = shiftRange(jan, -1, 0)
    expect([dec.start.getFullYear(), dec.start.getMonth()]).toEqual([2025, 11])
  })
})

describe('focus time', () => {
  const week = rangeFor('week', new Date(2026, 9, 14), 0)

  it('buckets sessions by the day they started', () => {
    const per = focusByBucket(data().sessions, week, NOW)
    expect(per.map((s) => s / 60)).toEqual([10, 35, 118, 41, 0, 0, 0]) // Sun 11 .. Sat 17
  })

  it('buckets by hour for a day', () => {
    const per = focusByBucket(data().sessions, rangeFor('day', new Date(2026, 9, 14), 0), NOW)
    expect(per[9]).toBe(41 * 60)
    expect(per.reduce((a, b) => a + b, 0)).toBe(41 * 60)
  })

  it('excludes sessions outside the range', () => {
    expect(sessionsIn(data().sessions, week).map((s) => s.id).sort()).toEqual(['s1', 's2', 's3', 's4'])
  })

  it('counts a running session up to now, and pauses stop the clock', () => {
    const running = sess('r', 'net', L(14, 17), 0, { ended_at: null })
    const paused = sess('p', 'net', L(14, 10), 0, { ended_at: null, paused_at: iso(L(14, 10, 20)) })
    const per = focusByBucket([running, paused], week, NOW)
    expect(per[3]).toBe(3600 + 20 * 60) // 1h running + 20min until paused
  })
})

describe('time by tag', () => {
  it('splits a multi-tag card evenly and reports percentages', () => {
    const shares = timeByTag(data(), rangeFor('week', new Date(2026, 9, 14), 0), NOW)
    const sec = Object.fromEntries(shares.map((s) => [s.name ?? 'none', Math.round(s.sec / 60)]))
    expect(sec).toEqual({ Networks: 41 + 59, Teaching: 59, none: 45 }) // mark (118) halves; mail+free untagged
    expect(shares.reduce((n, s) => n + s.pct, 0)).toBeCloseTo(100)
    expect(shares[0].name).toBe('Networks')
  })

  it('is empty with no sessions', () => {
    expect(timeByTag({ ...data(), sessions: [] }, rangeFor('week', new Date(2026, 9, 14), 0), NOW)).toEqual([])
  })
})

describe('estimate vs actual and KPIs', () => {
  const week = rangeFor('week', new Date(2026, 9, 14), 0)

  it('lists estimated cards that were worked, with the difference and a "long" flag', () => {
    const rows = estimateRows(data(), week, NOW)
    expect(rows.map((r) => [r.card.id, r.actualMin, r.diffMin, r.long])).toEqual([
      ['net', 41, -4, false],
      ['mark', 118, 28, true],
      ['mail', 35, 15, true],
    ])
  })

  it('a small overrun (under 10%) is not "long"', () => {
    const d = data()
    d.sessions = [sess('x', 'net', L(14, 9), 48)] // 45 estimated, +3m
    expect(estimateRows(d, week, NOW)[0].long).toBe(false)
  })

  it('computes totals, comparison, accuracy and overruns', () => {
    const d = data()
    const k = kpis(d, week, shiftRange(week, -1, 0), NOW)
    expect(k.focusSec).toBe((41 + 118 + 35 + 10) * 60)
    expect(k.prevFocusSec).toBe(60 * 60)
    expect(k.finished).toBe(1) // only "net" is in the last column
    expect(k.accuracy).toEqual({ pct: 33, within: 1, of: 3 }) // net within 10 min
    expect(k.over.count).toBe(2)
    expect(['Teaching', 'Networks']).toContain(k.over.topTag) // mark has both tags: tie broken by order
  })

  it('has no accuracy when nothing with an estimate was worked', () => {
    const k = kpis({ ...data(), sessions: [] }, week, shiftRange(week, -1, 0), NOW)
    expect(k.accuracy).toBeNull()
    expect(k.focusSec).toBe(0)
  })
})

describe('session log', () => {
  it('is newest first with the card and duration', () => {
    const log = sessionLog(data(), rangeFor('week', new Date(2026, 9, 14), 0), NOW)
    expect(log.map((l) => l.session.id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(log[0]).toMatchObject({ sec: 41 * 60 })
    expect(log[0].card?.id).toBe('net')
  })
})
