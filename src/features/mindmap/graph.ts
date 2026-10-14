import dagre from '@dagrejs/dagre'
import type { BoardData, Card, CardLink, LinkKind, MapNode } from '@/features/board/types'

export type Scope = { kind: 'all' } | { kind: 'neighbourhood'; cardId: string } | { kind: 'tag'; tagId: string }

export interface GNode {
  id: string // 'c:<cardId>' or 'f:<mapNodeId>'
  kind: 'card' | 'free'
  cardId: string | null
  label: string
  tagColorIndex: number | null
  /** Saved position, if the user has placed it. */
  saved: { x: number; y: number } | null
  mapNodeId: string | null
}

export interface GEdge {
  id: string // 'a|b' with ids sorted
  source: string
  target: string
  kind: LinkKind
  /** The card_links rows behind this edge (a pair can have several, e.g. both directions). */
  linkIds: string[]
}

export const cardNodeId = (cardId: string) => `c:${cardId}`
export const freeNodeId = (mapNodeId: string) => `f:${mapNodeId}`

/** Display priority when two cards are linked in more than one way. */
const RANK: Record<LinkKind, number> = { parent: 3, manual: 2, wikilink: 1 }

/**
 * One edge per pair of cards, drawn as its strongest kind (parent > manual > [[link]]).
 * A parent edge keeps its direction (source = parent); the others use a stable order.
 */
export function buildEdges(links: CardLink[], include: (cardId: string) => boolean): GEdge[] {
  const byPair = new Map<string, GEdge>()
  for (const l of links) {
    if (!include(l.from_card_id) || !include(l.to_card_id)) continue
    const key = [l.from_card_id, l.to_card_id].sort().join('|')
    const cur = byPair.get(key)
    if (!cur) {
      byPair.set(key, { id: key, source: cardNodeId(l.from_card_id), target: cardNodeId(l.to_card_id), kind: l.kind, linkIds: [l.id] })
    } else {
      cur.linkIds.push(l.id)
      if (RANK[l.kind] > RANK[cur.kind]) {
        cur.kind = l.kind
        cur.source = cardNodeId(l.from_card_id)
        cur.target = cardNodeId(l.to_card_id)
      }
    }
  }
  return [...byPair.values()]
}

export function neighbourIds(links: CardLink[], cardId: string): Set<string> {
  const out = new Set<string>([cardId])
  for (const l of links) {
    if (l.from_card_id === cardId) out.add(l.to_card_id)
    if (l.to_card_id === cardId) out.add(l.from_card_id)
  }
  return out
}

export interface Graph {
  nodes: GNode[]
  edges: GEdge[]
}

export function buildGraph(data: BoardData, scope: Scope): Graph {
  const live = data.cards.filter((c) => !c.archived_at)
  const liveIds = new Set(live.map((c) => c.id))
  const links = data.links.filter((l) => liveIds.has(l.from_card_id) && liveIds.has(l.to_card_id))

  let cardIds: Set<string>
  if (scope.kind === 'neighbourhood') {
    cardIds = neighbourIds(links, scope.cardId)
    if (!liveIds.has(scope.cardId)) cardIds = new Set()
  } else if (scope.kind === 'tag') {
    const tagged = new Set(data.cardTags.filter((x) => x.tag_id === scope.tagId).map((x) => x.card_id))
    cardIds = new Set(live.filter((c) => tagged.has(c.id)).map((c) => c.id))
  } else {
    // "All" shows cards that take part in a link: a map of every unlinked card would just be noise.
    cardIds = new Set(links.flatMap((l) => [l.from_card_id, l.to_card_id]))
    // ...plus any card the user has dragged onto the map.
    for (const n of data.mapNodes) if (n.card_id && liveIds.has(n.card_id)) cardIds.add(n.card_id)
  }

  const savedByCard = new Map(data.mapNodes.filter((n) => n.card_id).map((n) => [n.card_id!, n]))
  const nodes: GNode[] = live
    .filter((c) => cardIds.has(c.id))
    .map((c: Card) => {
      const firstTag = data.cardTags.find((x) => x.card_id === c.id)
      const tag = firstTag && data.tags.find((t) => t.id === firstTag.tag_id)
      const saved = savedByCard.get(c.id)
      return {
        id: cardNodeId(c.id), kind: 'card' as const, cardId: c.id, label: c.title,
        tagColorIndex: tag ? tag.color_index : null,
        saved: saved ? { x: saved.x, y: saved.y } : null,
        mapNodeId: saved?.id ?? null,
      }
    })

  // Free nodes belong to the map, not to a scope that filters cards.
  if (scope.kind === 'all') {
    for (const n of data.mapNodes.filter((m: MapNode) => m.card_id === null)) {
      nodes.push({ id: freeNodeId(n.id), kind: 'free', cardId: null, label: n.label ?? '', tagColorIndex: null, saved: { x: n.x, y: n.y }, mapNodeId: n.id })
    }
  }

  return { nodes, edges: buildEdges(links, (id) => cardIds.has(id)) }
}

export const NODE_W = 200
export const NODE_H = 48

/** Left-to-right layered layout. Nodes the user has placed keep their saved position. */
export function layoutGraph(graph: Graph, opts: { ignoreSaved?: boolean } = {}): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of graph.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H })
  for (const e of graph.edges) g.setEdge(e.source, e.target)
  dagre.layout(g)
  const out: Record<string, { x: number; y: number }> = {}
  let freeY = 0
  for (const n of graph.nodes) {
    if (n.saved && !opts.ignoreSaved) {
      out[n.id] = n.saved
      continue
    }
    const p = g.node(n.id)
    if (p && n.kind === 'card') {
      out[n.id] = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }
    } else {
      out[n.id] = { x: 0, y: -(NODE_H + 24) * ++freeY } // unplaced free nodes stack above the map
    }
  }
  return out
}
