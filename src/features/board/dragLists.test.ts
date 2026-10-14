import { describe, expect, it } from 'vitest'
import { buildLists, committed, findContainer, moveInLists } from './dragLists'
import type { Card, Column } from './types'

const col = (id: string, position: string): Column => ({ id, name: id, color: 'tag-1', position })
const card = (id: string, column_id: string, position: string, extra: Partial<Card> = {}): Card => ({
  id, title: id, body_md: '', column_id, position, estimate_min: null, is_today: false, today_position: null, due_date: null,
  archived_at: null, created_at: '', updated_at: '', ...extra,
})
const columns = [col('a', 'a0'), col('b', 'a1')]
const cards = [card('1', 'a', 'a0'), card('2', 'a', 'a1'), card('3', 'a', 'a2'), card('x', 'b', 'a0'), card('gone', 'b', 'a1', { archived_at: 'now' })]

describe('live drag lists', () => {
  const lists = buildLists(cards, columns)

  it('builds ordered lists per column, skipping archived cards', () => {
    expect(lists).toEqual({ a: ['1', '2', '3'], b: ['x'] })
    expect(findContainer(lists, 'x')).toBe('b')
    expect(findContainer(lists, 'nope')).toBeUndefined()
  })

  it('reorders within a column: above or below the card under the pointer', () => {
    expect(moveInLists(lists, '3', 'a', '1', false).a).toEqual(['3', '1', '2'])
    expect(moveInLists(lists, '1', 'a', '2', true).a).toEqual(['2', '1', '3'])
  })

  it('moves across columns, landing before/after the hovered card or at the end', () => {
    expect(moveInLists(lists, '2', 'b', 'x', false)).toEqual({ a: ['1', '3'], b: ['2', 'x'] })
    expect(moveInLists(lists, '2', 'b', 'x', true)).toEqual({ a: ['1', '3'], b: ['x', '2'] })
    expect(moveInLists(lists, '2', 'b', null, false)).toEqual({ a: ['1', '3'], b: ['x', '2'] })
  })

  it('drops into an empty column', () => {
    const empty = { a: ['1'], b: [] as string[] }
    expect(moveInLists(empty, '1', 'b', null, false)).toEqual({ a: [], b: ['1'] })
  })

  it('returns the same object when nothing changes (so drag-over does not re-render)', () => {
    expect(moveInLists(lists, '2', 'a', '2', false)).toBe(lists)
    expect(moveInLists(lists, '1', 'a', '2', false)).toBe(lists)
  })

  it('keeps every card exactly once through a long drag path', () => {
    let l = lists
    for (const [t, o, below] of [['b', 'x', false], ['a', '1', true], ['b', null, false], ['a', '3', false]] as const) {
      l = moveInLists(l, '2', t, o, below)
    }
    expect(Object.values(l).flat().sort()).toEqual(['1', '2', '3', 'x'])
  })

  it('reports the committed column and index', () => {
    const next = moveInLists(lists, '2', 'b', 'x', true)
    expect(committed(next, '2')).toEqual({ columnId: 'b', index: 1 })
    expect(committed(lists, 'nope')).toBeNull()
  })
})
