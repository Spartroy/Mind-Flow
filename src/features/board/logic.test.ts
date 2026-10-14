import { describe, expect, it } from 'vitest'
import { filterCards, keyAfter, normalize, planKeyboardMove, planMove, sorted, emptyFilter } from './logic'
import type { Card, Column } from './types'

const card = (id: string, column_id: string | null, position: string, extra: Partial<Card> = {}): Card => ({
  id, title: id, body_md: '', column_id, position, estimate_min: null, is_today: false, today_position: null, due_date: null,
  archived_at: null, created_at: '', updated_at: '', ...extra,
})
const col = (id: string, position: string): Column => ({ id, name: id, color: 'tag-5', position })

const order = (cards: Card[], columnId: string) =>
  sorted(cards.filter((c) => c.column_id === columnId)).map((c) => c.id)

describe('fractional ordering', () => {
  it('keyAfter always sorts last', () => {
    let cards: Card[] = []
    for (let i = 0; i < 50; i++) cards = [...cards, card(`c${i}`, 'a', keyAfter(cards))]
    expect(order(cards, 'a')).toEqual(cards.map((c) => c.id))
  })

  it('moving touches only the moved card and keeps the requested order', () => {
    let cards = [card('1', 'a', 'a0'), card('2', 'a', 'a1'), card('3', 'a', 'a2')]
    const before = JSON.stringify(cards.slice(0, 2))
    const patch = planMove(cards, '3', 'a', 1)
    cards = cards.map((c) => (c.id === '3' ? { ...c, ...patch } : c))
    expect(order(cards, 'a')).toEqual(['1', '3', '2'])
    expect(JSON.stringify(cards.filter((c) => c.id !== '3').sort((x, y) => +x.id - +y.id))).toContain(before.slice(1, -1))
  })

  it('survives 200 repeated inserts at the same spot', () => {
    let cards = [card('first', 'a', 'a0'), card('last', 'a', 'a1')]
    for (let i = 0; i < 200; i++) {
      const id = `n${i}`
      cards = [...cards, card(id, 'a', planMove([...cards], id, 'a', 1).position)]
    }
    const ids = order(cards, 'a')
    expect(ids[0]).toBe('first')
    expect(ids.at(-1)).toBe('last')
    expect(ids[1]).toBe('n199')
    expect(new Set(cards.map((c) => c.position)).size).toBe(cards.length)
  })

  it('moves across columns, including into an empty column', () => {
    const cards = [card('1', 'a', 'a0'), card('2', 'b', 'a0')]
    expect(planMove(cards, '1', 'b', 0).position < 'a0').toBe(true)
    expect(planMove(cards, '1', 'b', 1).position > 'a0').toBe(true)
    expect(planMove(cards, '2', 'c', 0).column_id).toBe('c')
  })
})

describe('keyboard move', () => {
  const columns = [col('a', 'a0'), col('b', 'a1')]
  const cards = [card('1', 'a', 'a0'), card('2', 'a', 'a1'), card('3', 'b', 'a0')]

  it('reorders within a column', () => {
    const p = planKeyboardMove(cards, columns, '1', 'down')!
    expect(p.column_id).toBe('a')
    const moved = cards.map((c) => (c.id === '1' ? { ...c, ...p } : c))
    expect(order(moved, 'a')).toEqual(['2', '1'])
    expect(planKeyboardMove(cards, columns, '1', 'up')).toBeNull()
  })

  it('moves to the next and previous column, and stops at the edges', () => {
    expect(planKeyboardMove(cards, columns, '1', 'next')!.column_id).toBe('b')
    expect(planKeyboardMove(cards, columns, '3', 'prev')!.column_id).toBe('a')
    expect(planKeyboardMove(cards, columns, '3', 'next')).toBeNull()
    expect(planKeyboardMove(cards, columns, '1', 'prev')).toBeNull()
  })
})

describe('search and filter', () => {
  const cards = [
    card('أحمد', 'a', 'a0', { body_md: 'درس الشبكات' }),
    card('Network basics', 'a', 'a1', { is_today: true }),
    card('Other', 'a', 'a2'),
  ]
  const tags = [{ card_id: 'Network basics', tag_id: 't1' }]

  it('folds Arabic variants and diacritics', () => {
    expect(normalize('أَحْمَد')).toBe(normalize('احمد'))
    expect(filterCards(cards, [], { ...emptyFilter, query: 'احمد' }).map((c) => c.id)).toEqual(['أحمد'])
    expect(filterCards(cards, [], { ...emptyFilter, query: 'الشبكات' })).toHaveLength(1)
  })

  it('matches English case-insensitively and combines filters', () => {
    expect(filterCards(cards, tags, { ...emptyFilter, query: 'NETWORK' })).toHaveLength(1)
    expect(filterCards(cards, tags, { ...emptyFilter, tagIds: ['t1'] }).map((c) => c.id)).toEqual(['Network basics'])
    expect(filterCards(cards, tags, { ...emptyFilter, todayOnly: true, tagIds: ['nope'] })).toHaveLength(0)
  })
})
