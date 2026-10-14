import { normalize } from './logic'
import type { Card } from './types'

export interface ParsedLink {
  title: string
  id: string | null
}

const WIKILINK = /\[\[([^\][|\n]+?)(?:\|([^\][\n]+?))?\]\]/g

/** Code is literal: `[[x]]` inside a code span or fence is not a link. */
const stripCode = (md: string) => md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')

export function parseWikiLinks(md: string): ParsedLink[] {
  const out: ParsedLink[] = []
  for (const m of stripCode(md).matchAll(WIKILINK)) {
    out.push({ title: m[1].trim(), id: m[2]?.trim() || null })
  }
  return out
}

/** Titles go inside `[[...|id]]`, so brackets and pipes cannot appear in them. */
export const sanitizeTitle = (t: string) => t.replace(/[[\]|]/g, '').replace(/\s+/g, ' ').trim()

export const wikiLinkText = (card: Pick<Card, 'id' | 'title'>) => `[[${sanitizeTitle(card.title) || 'Untitled'}|${card.id}]]`

/** Resolve by id first (rename-safe), then by an unambiguous exact title. */
function resolve(link: ParsedLink, cards: Card[]): Card | undefined {
  if (link.id) {
    const byId = cards.find((c) => c.id === link.id)
    if (byId) return byId
  }
  const key = normalize(link.title)
  const matches = cards.filter((c) => normalize(sanitizeTitle(c.title)) === key)
  return matches.length === 1 ? matches[0] : undefined
}

/** The set of card ids a body links to (never itself). */
export function linkTargets(md: string, cards: Card[], selfId: string): string[] {
  const live = cards.filter((c) => !c.archived_at)
  const ids = new Set<string>()
  for (const l of parseWikiLinks(md)) {
    const target = resolve(l, live)
    if (target && target.id !== selfId) ids.add(target.id)
  }
  return [...ids]
}

export function diffLinks(existing: string[], desired: string[]) {
  const have = new Set(existing)
  const want = new Set(desired)
  return {
    add: desired.filter((id) => !have.has(id)),
    remove: existing.filter((id) => !want.has(id)),
  }
}

/**
 * Bring link text up to date: show the target's current title after a rename, and pin
 * title-only links to the card id. Text inside code is left alone.
 */
export function refreshWikiTitles(md: string, cards: Card[]): string {
  const live = cards.filter((c) => !c.archived_at)
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part
      return part.replace(WIKILINK, (whole, title: string, id?: string) => {
        const target = resolve({ title: title.trim(), id: id?.trim() || null }, live)
        return target ? wikiLinkText(target) : whole
      })
    })
    .join('')
}
