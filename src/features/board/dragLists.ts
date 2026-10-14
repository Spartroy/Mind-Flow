import { cardsIn, sorted } from './logic'
import type { Card, Column } from './types'

/** Card ids per column, in display order. Lives in memory only while a drag is in progress. */
export type Lists = Record<string, string[]>

export function buildLists(cards: Card[], columns: Column[]): Lists {
  const out: Lists = {}
  for (const col of sorted(columns)) out[col.id] = cardsIn(cards, col.id).map((c) => c.id)
  return out
}

export const findContainer = (lists: Lists, id: string): string | undefined =>
  Object.keys(lists).find((k) => lists[k].includes(id))

/**
 * Where the dragged card currently sits if dropped now. `overId` is the card under the pointer
 * (or null when over an empty part of the column); `below` says the pointer is past its middle.
 * Called on every drag-over so cards slide apart live, across columns.
 */
export function moveInLists(lists: Lists, activeId: string, targetColumn: string, overId: string | null, below: boolean): Lists {
  const from = findContainer(lists, activeId)
  if (!from || !lists[targetColumn] || overId === activeId) return lists // hovering itself: stay put
  const without = lists[targetColumn].filter((id) => id !== activeId)
  let index = without.length // default: end of the column
  if (overId && overId !== activeId) {
    const i = without.indexOf(overId)
    if (i >= 0) index = i + (below ? 1 : 0)
  }
  const target = [...without.slice(0, index), activeId, ...without.slice(index)]
  if (from === targetColumn && target.join() === lists[from].join()) return lists // nothing changed
  return { ...lists, [from]: lists[from].filter((id) => id !== activeId), [targetColumn]: target }
}

/** Final column and index (among that column's other cards) after the drop. */
export function committed(lists: Lists, activeId: string): { columnId: string; index: number } | null {
  const columnId = findContainer(lists, activeId)
  return columnId ? { columnId, index: lists[columnId].indexOf(activeId) } : null
}
