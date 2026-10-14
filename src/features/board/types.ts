export interface Column {
  id: string
  name: string
  color: string // token name, e.g. 'tag-5'
  position: string
}

export interface Card {
  id: string
  title: string
  body_md: string
  column_id: string | null
  position: string
  estimate_min: number | null
  is_today: boolean
  due_date: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  color_index: number // 0..7
}

export interface CardTag {
  card_id: string
  tag_id: string
}

export type LinkKind = 'wikilink' | 'manual' | 'parent'

export interface CardLink {
  id: string
  from_card_id: string
  to_card_id: string
  kind: LinkKind
}

export interface BoardData {
  columns: Column[]
  cards: Card[]
  tags: Tag[]
  cardTags: CardTag[]
  links: CardLink[]
}

/** Storage boundary. Supabase in production, in-memory when Supabase is not configured. */
export interface BoardRepo {
  load(): Promise<BoardData>
  createColumn(c: Column): Promise<void>
  updateColumn(id: string, patch: Partial<Omit<Column, 'id'>>): Promise<void>
  deleteColumn(id: string): Promise<void>
  createCard(c: Card): Promise<void>
  updateCard(id: string, patch: Partial<Omit<Card, 'id'>>): Promise<void>
  deleteCard(id: string): Promise<void>
  createTag(t: Tag): Promise<void>
  setCardTags(cardId: string, tagIds: string[]): Promise<void>
  /** Make the wikilink rows from this card equal exactly toIds. */
  syncWikiLinks(fromId: string, toIds: string[]): Promise<void>
}

export const emptyBoard = (): BoardData => ({ columns: [], cards: [], tags: [], cardTags: [], links: [] })
