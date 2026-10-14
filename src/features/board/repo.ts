import { supabase, supabaseConfigured } from '@/lib/supabase'
import { diffLinks } from './links'
import { emptyBoard, type BoardData, type BoardRepo, type CardLink } from './types'

/** user_id is filled by the database default (auth.uid()), and enforced by RLS. */
const supabaseRepo: BoardRepo = {
  async load() {
    const [columns, cards, tags, cardTags, links] = await Promise.all([
      supabase.from('columns').select('id,name,color,position'),
      supabase
        .from('cards')
        .select('id,title,body_md,column_id,position,estimate_min,is_today,due_date,archived_at,created_at,updated_at')
        .is('archived_at', null),
      supabase.from('tags').select('id,name,color_index'),
      supabase.from('card_tags').select('card_id,tag_id'),
      supabase.from('card_links').select('id,from_card_id,to_card_id,kind'),
    ])
    for (const r of [columns, cards, tags, cardTags, links]) if (r.error) throw r.error
    return {
      columns: columns.data ?? [],
      cards: cards.data ?? [],
      tags: tags.data ?? [],
      cardTags: cardTags.data ?? [],
      links: (links.data ?? []) as CardLink[],
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
  async syncWikiLinks(fromId, toIds) {
    const cur = await supabase.from('card_links').select('id,to_card_id').eq('from_card_id', fromId).eq('kind', 'wikilink')
    if (cur.error) throw cur.error
    const { add, remove } = diffLinks((cur.data ?? []).map((r) => r.to_card_id), toIds)
    const dropIds = (cur.data ?? []).filter((r) => remove.includes(r.to_card_id)).map((r) => r.id)
    if (dropIds.length) {
      const del = await supabase.from('card_links').delete().in('id', dropIds)
      if (del.error) throw del.error
    }
    if (add.length) {
      const ins = await supabase
        .from('card_links')
        .insert(add.map((to_card_id) => ({ from_card_id: fromId, to_card_id, kind: 'wikilink' })))
      if (ins.error) throw ins.error
    }
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
function rawMemoryRepo(db: BoardData): BoardRepo {
  return {
    load: async () => structuredClone(db),
    createColumn: async (c) => void db.columns.push(c),
    updateColumn: async (id, p) => void Object.assign(db.columns.find((c) => c.id === id) ?? {}, p),
    deleteColumn: async (id) => {
      db.columns = db.columns.filter((c) => c.id !== id)
      for (const c of db.cards) if (c.column_id === id) c.column_id = null
    },
    createCard: async (c) => void db.cards.push(c),
    updateCard: async (id, p) =>
      void Object.assign(db.cards.find((c) => c.id === id) ?? {}, p, { updated_at: new Date().toISOString() }),
    deleteCard: async (id) => {
      db.cards = db.cards.filter((c) => c.id !== id)
      db.cardTags = db.cardTags.filter((t) => t.card_id !== id)
      db.links = db.links.filter((l) => l.from_card_id !== id && l.to_card_id !== id)
    },
    syncWikiLinks: async (fromId, toIds) => {
      const cur = db.links.filter((l) => l.from_card_id === fromId && l.kind === 'wikilink')
      const { add, remove } = diffLinks(cur.map((l) => l.to_card_id), toIds)
      db.links = db.links.filter((l) => !(l.from_card_id === fromId && l.kind === 'wikilink' && remove.includes(l.to_card_id)))
      for (const to_card_id of add) {
        db.links.push({ id: crypto.randomUUID(), from_card_id: fromId, to_card_id, kind: 'wikilink' })
      }
    },
    createTag: async (t) => void db.tags.push(t),
    setCardTags: async (cardId, tagIds) => {
      db.cardTags = db.cardTags.filter((t) => t.card_id !== cardId)
      for (const tag_id of tagIds) db.cardTags.push({ card_id: cardId, tag_id })
    },
  }
}

/** Demo data survives reloads within the tab (sessionStorage), so dev iteration keeps its cards. */
function memoryRepo(): BoardRepo {
  const KEY = 'nf-demo-db'
  let db: BoardData = emptyBoard()
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) db = JSON.parse(raw) as BoardData
  } catch {
    /* storage unavailable: start empty */
  }
  const inner = rawMemoryRepo(db)
  const persist = () => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(db))
    } catch {
      /* ignore */
    }
  }
  const wrapped = {} as Record<string, (...a: unknown[]) => Promise<unknown>>
  for (const [name, fn] of Object.entries(inner)) {
    wrapped[name] = async (...a) => {
      const out = await (fn as (...x: unknown[]) => Promise<unknown>)(...a)
      persist()
      return out
    }
  }
  return wrapped as unknown as BoardRepo
}

export const repo: BoardRepo = supabaseConfigured ? supabaseRepo : memoryRepo()
export const isDemo = !supabaseConfigured
