import { describe, expect, it } from 'vitest'
import type { Card, Column, TimeSession } from '@/features/board/types'
import { capacity, DAY_CAPACITY_MIN, doneColumn, isDone, nextUp, suggestions, todayCards, todayPositionAt } from './logic'

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id, title: id, body_md: '', column_id: 'todo', position: 'a0', estimate_min: null, is_today: false, today_position: null,
  due_date: null, archived_at: null, created_at: '', updated_at: '', ...extra,
})
const cols: Column[] = [
  { id: 'todo', name: 'To do', color: 'tag-1', position: 'a0' },
  { id: 'done', name: 'Done', color: 'tag-4', position: 'a2' },
]
const now = Date.parse('2026-10-14T12:00:00Z')

describe('done = last column', () => {
  it('needs at least two columns', () => {
    expect(doneColumn(cols)?.id).toBe('done')
    expect(doneColumn([cols[0]])).toBeUndefined()
    expect(isDone(card('a', { column_id: 'done' }), cols)).toBe(true)
    expect(isDone(card('a'), cols)).toBe(false)
    expect(isDone(card('a', { column_id: 'todo' }), [cols[0]])).toBe(false)
  })
})

describe('today order', () => {
  it('sorts by today_position, unpositioned last', () => {
    const cs = [
      card('c', { is_today: true, today_position: 'a2' }),
      card('x', { is_today: true, today_position: null, position: 'a9' }),
      card('a', { is_today: true, today_position: 'a0' }),
      card('n', { is_today: false, today_position: 'a1' }),
      card('arch', { is_today: true, today_position: 'a1', archived_at: 'x' }),
    ]
    expect(todayCards(cs).map((c) => c.id)).toEqual(['a', 'c', 'x'])
  })

  it('computes a position without renumbering others', () => {
    const cs = [card('a', { is_today: true, today_position: 'a0' }), card('b', { is_today: true, today_position: 'a1' })]
    const k = todayPositionAt(cs, 'b', 0) // move b to the top
    expect(k < 'a0').toBe(true)
    const k2 = todayPositionAt(cs, 'new', 1) // between a and b
    expect(k2 > 'a0' && k2 < 'a1').toBe(true)
    expect(todayPositionAt([], 'x', 0)).toBe('a0')
  })
})

describe('capacity', () => {
  const t = (id: string, est: number, col = 'todo') => card(id, { is_today: true, estimate_min: est, column_id: col })

  it('is empty with no cards', () => {
    expect(capacity([], cols, [], now).state).toBe('empty')
  })

  it('plans within capacity', () => {
    const c = capacity([t('a', 60), t('b', 60)], cols, [], now)
    expect(c).toMatchObject({ plannedMin: 120, overMin: 0, state: 'planned' })
    expect(c.fraction).toBeCloseTo(0.5)
  })

  it('goes over when planned time exceeds available (4h05 of 4h = 5m over)', () => {
    const c = capacity([t('a', 60), t('b', 40), t('c', 45), t('d', 20), t('e', 30, 'done'), t('f', 50, 'done')], cols, [], now)
    expect(c.plannedMin).toBe(245)
    expect(c).toMatchObject({ overMin: 5, state: 'over', capacityMin: DAY_CAPACITY_MIN })
    expect(c.fraction).toBe(1)
  })

  it('is complete when every card is done, and sums logged time', () => {
    const s: TimeSession = {
      id: 's', card_id: 'a', started_at: '2026-10-14T10:00:00Z', ended_at: '2026-10-14T10:38:00Z', paused_at: null,
      paused_total_sec: 0, mode: 'timer', on_break: false, breaks_taken: 0, estimate_snapshot_min: 60,
    }
    const c = capacity([t('a', 60, 'done')], cols, [s], now)
    expect(c.state).toBe('complete')
    expect(c.doneSec).toBe(38 * 60)
  })
})

describe('suggestions and next up', () => {
  it('suggests open, estimated, unplanned cards: due soonest then shortest', () => {
    const cs = [
      card('late', { estimate_min: 10, due_date: '2026-12-01' }),
      card('soon', { estimate_min: 90, due_date: '2026-10-15' }),
      card('short', { estimate_min: 5 }),
      card('noest'),
      card('planned', { estimate_min: 5, is_today: true }),
      card('finished', { estimate_min: 5, column_id: 'done' }),
    ]
    expect(suggestions(cs, cols).map((c) => c.id)).toEqual(['soon', 'late', 'short'])
  })

  it('next up is the first card that is not done', () => {
    const today = [card('a', { column_id: 'done' }), card('b'), card('c')]
    expect(nextUp(today, cols)?.id).toBe('b')
    expect(nextUp([card('a', { column_id: 'done' })], cols)).toBeUndefined()
  })
})
