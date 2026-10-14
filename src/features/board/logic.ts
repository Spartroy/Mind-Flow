import { generateKeyBetween } from 'fractional-indexing'
import type { Card, CardTag, Column } from './types'

/** Fractional-index keys compare as plain code-unit strings (never localeCompare). */
export const byPosition = <T extends { position: string }>(a: T, b: T) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0

export const sorted = <T extends { position: string }>(xs: T[]) => [...xs].sort(byPosition)

/** Key that sorts after every existing key (append). */
export const keyAfter = (xs: { position: string }[]) => {
  const last = sorted(xs).at(-1)
  return generateKeyBetween(last?.position ?? null, null)
}

export const cardsIn = (cards: Card[], columnId: string) =>
  sorted(cards.filter((c) => c.column_id === columnId && !c.archived_at))

export interface MovePatch {
  column_id: string
  position: string
}

/**
 * Where a card lands when dropped at `index` among the target column's other cards.
 * Only the moved card is touched: no re-numbering.
 */
export function planMove(cards: Card[], cardId: string, columnId: string, index: number): MovePatch {
  const siblings = cardsIn(cards, columnId).filter((c) => c.id !== cardId)
  const i = Math.max(0, Math.min(index, siblings.length))
  const before = siblings[i - 1]?.position ?? null
  const after = siblings[i]?.position ?? null
  return { column_id: columnId, position: generateKeyBetween(before, after) }
}

export type MoveDir = 'up' | 'down' | 'prev' | 'next'

/** Keyboard alternative to dragging. 'prev'/'next' are by column order, not screen side. */
export function planKeyboardMove(
  cards: Card[],
  columns: Column[],
  cardId: string,
  dir: MoveDir,
): (MovePatch & { index: number }) | null {
  const card = cards.find((c) => c.id === cardId)
  if (!card?.column_id) return null
  const cols = sorted(columns)
  const colIdx = cols.findIndex((c) => c.id === card.column_id)
  const col = cardsIn(cards, card.column_id)
  const idx = col.findIndex((c) => c.id === cardId)
  let target: { columnId: string; index: number } | null = null
  if (dir === 'up' && idx > 0) target = { columnId: card.column_id, index: idx - 1 }
  if (dir === 'down' && idx < col.length - 1) target = { columnId: card.column_id, index: idx + 1 }
  if (dir === 'prev' && colIdx > 0) {
    target = { columnId: cols[colIdx - 1].id, index: Math.min(idx, cardsIn(cards, cols[colIdx - 1].id).length) }
  }
  if (dir === 'next' && colIdx < cols.length - 1) {
    target = { columnId: cols[colIdx + 1].id, index: Math.min(idx, cardsIn(cards, cols[colIdx + 1].id).length) }
  }
  if (!target) return null
  return { ...planMove(cards, cardId, target.columnId, target.index), index: target.index }
}

// ---------------------------------------------------------------- search / filter

/** Fold Arabic variants so that e.g. أحمد / احمد and diacritics all match. */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
}

export interface Filter {
  query: string
  tagIds: string[]
  todayOnly: boolean
}

export const emptyFilter: Filter = { query: '', tagIds: [], todayOnly: false }
export const isFiltering = (f: Filter) => f.query.trim() !== '' || f.tagIds.length > 0 || f.todayOnly

export function filterCards(cards: Card[], cardTags: CardTag[], f: Filter): Card[] {
  const q = normalize(f.query.trim())
  const tagsByCard = new Map<string, Set<string>>()
  for (const ct of cardTags) {
    if (!tagsByCard.has(ct.card_id)) tagsByCard.set(ct.card_id, new Set())
    tagsByCard.get(ct.card_id)!.add(ct.tag_id)
  }
  return cards.filter((c) => {
    if (f.todayOnly && !c.is_today) return false
    if (f.tagIds.length && !f.tagIds.every((t) => tagsByCard.get(c.id)?.has(t))) return false
    if (q && !normalize(c.title + ' ' + c.body_md).includes(q)) return false
    return true
  })
}

export const formatMinutes = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`)
