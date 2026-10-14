import { describe, expect, it } from 'vitest'
import { emptyBoard, type BoardData, type Card, type CardLink, type LinkKind } from '@/features/board/types'
import { buildEdges, buildGraph, cardNodeId, layoutGraph, neighbourIds, NODE_H, NODE_W } from './graph'

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id, title: id, body_md: '', column_id: 'c', position: 'a0', estimate_min: null, is_today: false, today_position: null,
  due_date: null, archived_at: null, created_at: '', updated_at: '', ...extra,
})
const link = (id: string, from: string, to: string, kind: LinkKind = 'wikilink'): CardLink => ({ id, from_card_id: from, to_card_id: to, kind })

const data = (over: Partial<BoardData> = {}): BoardData => ({
  ...emptyBoard(),
  cards: [card('a'), card('b'), card('c'), card('d'), card('lonely')],
  links: [link('l1', 'a', 'b'), link('l2', 'b', 'c', 'manual'), link('l3', 'c', 'd', 'parent')],
  tags: [{ id: 't1', name: 'Networks', color_index: 4 }],
  cardTags: [{ card_id: 'a', tag_id: 't1' }, { card_id: 'lonely', tag_id: 't1' }],
  ...over,
})

describe('edges', () => {
  it('draws one edge per pair, using the strongest kind, with every link row behind it', () => {
    const edges = buildEdges(
      [link('1', 'a', 'b'), link('2', 'b', 'a', 'manual'), link('3', 'a', 'b', 'parent'), link('4', 'x', 'y')],
      () => true,
    )
    const ab = edges.find((e) => e.id === 'a|b')!
    expect(ab.kind).toBe('parent')
    expect(ab.source).toBe(cardNodeId('a')) // parent direction preserved
    expect(ab.linkIds.sort()).toEqual(['1', '2', '3'])
    expect(edges).toHaveLength(2)
  })

  it('drops edges to cards outside the scope', () => {
    expect(buildEdges([link('1', 'a', 'b')], (id) => id === 'a')).toEqual([])
  })

  it('finds neighbours in both directions', () => {
    expect([...neighbourIds(data().links, 'b')].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('scopes', () => {
  it('"all" shows only linked cards, not every card', () => {
    const g = buildGraph(data(), { kind: 'all' })
    expect(g.nodes.map((n) => n.cardId).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(g.edges.map((e) => e.kind).sort()).toEqual(['manual', 'parent', 'wikilink'])
  })

  it('"all" also shows cards the user placed, and free nodes', () => {
    const g = buildGraph(
      data({
        mapNodes: [
          { id: 'm1', map_id: 'map', card_id: 'lonely', x: 5, y: 6, label: null },
          { id: 'm2', map_id: 'map', card_id: null, x: 9, y: 9, label: 'exam tips' },
        ],
      }),
      { kind: 'all' },
    )
    expect(g.nodes.find((n) => n.cardId === 'lonely')?.saved).toEqual({ x: 5, y: 6 })
    const free = g.nodes.find((n) => n.kind === 'free')!
    expect(free).toMatchObject({ label: 'exam tips', id: 'f:m2', mapNodeId: 'm2' })
  })

  it('neighbourhood = the card and its direct neighbours, with only their edges', () => {
    const g = buildGraph(data(), { kind: 'neighbourhood', cardId: 'b' })
    expect(g.nodes.map((n) => n.cardId).sort()).toEqual(['a', 'b', 'c'])
    expect(g.edges).toHaveLength(2)
    expect(buildGraph(data(), { kind: 'neighbourhood', cardId: 'gone' }).nodes).toEqual([])
  })

  it('by tag shows tagged cards even without links, and no free nodes', () => {
    const g = buildGraph(data({ mapNodes: [{ id: 'm2', map_id: 'map', card_id: null, x: 0, y: 0, label: 'x' }] }), { kind: 'tag', tagId: 't1' })
    expect(g.nodes.map((n) => n.cardId).sort()).toEqual(['a', 'lonely'])
    expect(g.nodes.every((n) => n.kind === 'card')).toBe(true)
    expect(g.edges).toEqual([])
  })

  it('ignores archived cards and carries the first tag colour', () => {
    const g = buildGraph(data({ cards: [card('a'), card('b'), card('c'), card('d', { archived_at: 'x' }), card('lonely')] }), { kind: 'all' })
    expect(g.nodes.map((n) => n.cardId)).not.toContain('d')
    expect(g.nodes.find((n) => n.cardId === 'a')?.tagColorIndex).toBe(4)
  })

  it('is empty when nothing is linked or placed', () => {
    expect(buildGraph(data({ links: [] }), { kind: 'all' }).nodes).toEqual([])
  })
})

describe('layout', () => {
  it('gives every node a position, with linked nodes ordered left to right and no overlaps', () => {
    const g = buildGraph(data(), { kind: 'all' })
    const pos = layoutGraph(g)
    expect(Object.keys(pos)).toHaveLength(4)
    expect(pos[cardNodeId('a')].x).toBeLessThan(pos[cardNodeId('b')].x)
    const rects = Object.values(pos)
    for (const [i, p] of rects.entries()) {
      for (const q of rects.slice(i + 1)) {
        const overlap = Math.abs(p.x - q.x) < NODE_W && Math.abs(p.y - q.y) < NODE_H
        expect(overlap).toBe(false)
      }
    }
  })

  it('keeps saved positions and re-layout can ignore them', () => {
    const g = buildGraph(data({ mapNodes: [{ id: 'm1', map_id: 'map', card_id: 'a', x: 777, y: -3, label: null }] }), { kind: 'all' })
    expect(layoutGraph(g)[cardNodeId('a')]).toEqual({ x: 777, y: -3 })
    expect(layoutGraph(g, { ignoreSaved: true })[cardNodeId('a')]).not.toEqual({ x: 777, y: -3 })
  })

  it('handles Arabic titles and a single node', () => {
    const g = buildGraph(data({ cards: [card('a', { title: 'الشبكات' }), card('b')], links: [link('1', 'a', 'b')] }), { kind: 'all' })
    expect(g.nodes.find((n) => n.cardId === 'a')?.label).toBe('الشبكات')
    expect(Object.keys(layoutGraph({ nodes: [g.nodes[0]], edges: [] }))).toHaveLength(1)
  })
})
