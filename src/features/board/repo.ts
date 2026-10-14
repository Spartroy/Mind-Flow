import { supabase, supabaseConfigured } from '@/lib/supabase'
import { emptyBoard, type BoardData, type BoardRepo } from './types'

/** user_id is filled by the database default (auth.uid()), and enforced by RLS. */
const supabaseRepo: BoardRepo = {
  async load() {
    const [columns, cards, tags, cardTags, links] = await Promise.all([
      supabase.from('columns').select('id,name,color,position'),
      supabase
        .from('cards')
        .select('id,title,body_md,column_id,position,estimate_min,is_today,due_date,archived_at')
        .is('archived_at', null),
      supabase.from('tags').select('id,name,color_index'),
      supabase.from('card_tags').select('card_id,tag_id'),
      supabase.from('card_links').select('from_card_id,to_card_id'),
    ])
    for (const r of [columns, cards, tags, cardTags, links]) if (r.error) throw r.error
    const linkCounts: Record<string, number> = {}
    for (const l of links.data ?? []) {
      linkCounts[l.from_card_id] = (linkCounts[l.from_card_id] ?? 0) + 1
      linkCounts[l.to_card_id] = (linkCounts[l.to_card_id] ?? 0) + 1
    }
    return {
      columns: columns.data ?? [],
      cards: cards.data ?? [],
      tags: tags.data ?? [],
      cardTags: cardTags.data ?? [],
      linkCounts,
    }
  },
  async createColumn(c) {
    const { error } = await supabase.from('columns').insert(c)
    if (error) throw error
  },
  async updateColumn(id, patch) {
    const { error } = await supabase.from('columns').update(patch).eq('id', id)
    if (error) throw error
  },
  async deleteColumn(id) {
    const { error } = await supabase.from('columns').delete().eq('id', id)
    if (error) throw error
  },
  async createCard(c) {
    const { error } = await supabase.from('cards').insert(c)
    if (error) throw error
  },
  async updateCard(id, patch) {
    const { error } = await supabase.from('cards').update(patch).eq('id', id)
    if (error) throw error
  },
  async deleteCard(id) {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) throw error
  },
  async createTag(t) {
    const { error } = await supabase.from('tags').insert(t)
    if (error) throw error
  },
  async setCardTags(cardId, tagIds) {
    const del = await supabase.from('card_tags').delete().eq('card_id', cardId)
    if (del.error) throw del.error
    if (tagIds.length) {
      const ins = await supabase.from('card_tags').insert(tagIds.map((tag_id) => ({ card_id: cardId, tag_id })))
      if (ins.error) throw ins.error
    }
  },
}

/** Demo mode (no Supabase configured): nothing is persisted across reloads. */
function memoryRepo(): BoardRepo {
  const db: BoardData = emptyBoard()
  return {
    load: async () => structuredClone(db),
    createColumn: async (c) => void db.columns.push(c),
    updateColumn: async (id, p) => void Object.assign(db.columns.find((c) => c.id === id) ?? {}, p),
    deleteColumn: async (id) => {
      db.columns = db.columns.filter((c) => c.id !== id)
      for (const c of db.cards) if (c.column_id === id) c.column_id = null
    },
    createCard: async (c) => void db.cards.push(c),
    updateCard: async (id, p) => void Object.assign(db.cards.find((c) => c.id === id) ?? {}, p),
    deleteCard: async (id) => {
      db.cards = db.cards.filter((c) => c.id !== id)
      db.cardTags = db.cardTags.filter((t) => t.card_id !== id)
    },
    createTag: async (t) => void db.tags.push(t),
    setCardTags: async (cardId, tagIds) => {
      db.cardTags = db.cardTags.filter((t) => t.card_id !== cardId)
      for (const tag_id of tagIds) db.cardTags.push({ card_id: cardId, tag_id })
    },
  }
}

export const repo: BoardRepo = supabaseConfigured ? supabaseRepo : memoryRepo()
export const isDemo = !supabaseConfigured
