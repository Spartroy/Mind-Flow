import { supabase, supabaseConfigured } from '@/lib/supabase'
import * as ops from '@/features/timer/sessionOps'
import { diffLinks } from './links'
import { emptyBoard, type BoardData, type BoardRepo, defaultSettings, type CardLink, type MapNode, type MindMap, type Settings, type TimeSession } from './types'

const SETTINGS_COLS = 'locale,theme,week_start,default_estimate_min,pomodoro_focus_min,pomodoro_break_min,auto_float_timer,overtime_message,sound'
const SESSION_COLS = 'id,card_id,started_at,ended_at,paused_at,paused_total_sec,mode,on_break,breaks_taken,estimate_snapshot_min'

/** Session rpc results: a composite with no matching row comes back as null or an all-null object. */
const asSession = (data: unknown): TimeSession | null => {
  const row = data as TimeSession | null
  return row && row.id ? row : null
}

/** user_id is filled by the database default (auth.uid()), and enforced by RLS. */
const supabaseRepo: BoardRepo = {
  async load() {
    const [columns, cards, tags, cardTags, links, sessions, maps, mapNodes, settings] = await Promise.all([
      supabase.from('columns').select('id,name,color,position'),
      supabase
        .from('cards')
        .select('id,title,body_md,column_id,position,estimate_min,is_today,today_position,due_date,archived_at,created_at,updated_at')
        .is('archived_at', null),
      supabase.from('tags').select('id,name,color_index'),
      supabase.from('card_tags').select('card_id,tag_id'),
      supabase.from('card_links').select('id,from_card_id,to_card_id,kind'),
      supabase.from('time_sessions').select(SESSION_COLS).order('started_at'),
      supabase.from('mind_maps').select('id,name,scope'),
      supabase.from('map_nodes').select('id,map_id,card_id,x,y,label'),
      supabase.from('settings').select(SETTINGS_COLS).maybeSingle(),
    ])
    for (const r of [columns, cards, tags, cardTags, links, sessions, maps, mapNodes, settings]) if (r.error) throw r.error
    return {
      columns: columns.data ?? [],
      cards: cards.data ?? [],
      tags: tags.data ?? [],
      cardTags: cardTags.data ?? [],
      links: (links.data ?? []) as CardLink[],
      sessions: (sessions.data ?? []) as TimeSession[],
      maps: (maps.data ?? []) as MindMap[],
      mapNodes: (mapNodes.data ?? []) as MapNode[],
      settings: { ...defaultSettings, ...((settings.data ?? {}) as Partial<Settings>) },
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
  async saveSettings(patch) {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError || !data.user) throw authError ?? new Error('Not signed in')
    const { error } = await supabase.from('settings').upsert({ user_id: data.user.id, ...patch })
    if (error) throw error
  },
  async importAll(b) {
    // Parents before children so every foreign key resolves; merge by id.
    const put = async (table: string, rows: unknown[]) => {
      if (!rows.length) return
      const { error } = await supabase.from(table).upsert(rows as never[])
      if (error) throw new Error(`${table}: ${error.message}`)
    }
    await put('columns', b.columns)
    await put('tags', b.tags)
    await put('cards', b.cards)
    await put('card_tags', b.cardTags)
    await put('card_links', b.links)
    await put('time_sessions', b.sessions)
    await put('mind_maps', b.maps)
    await put('map_nodes', b.mapNodes)
    if (b.settings) await supabaseRepo.saveSettings(b.settings)
  },
  async deleteAllCards() {
    // Links, tags, sessions and map placements go with the cards (ON DELETE CASCADE).
    const { error } = await supabase.from('cards').delete().not('id', 'is', null)
    if (error) throw error
  },
  async createLink(l) {
    const { error } = await supabase.from('card_links').insert(l)
    if (error) throw error
  },
  async updateLinkKind(id, kind) {
    const { error } = await supabase.from('card_links').update({ kind }).eq('id', id)
    if (error) throw error
  },
  async deleteLink(id) {
    const { error } = await supabase.from('card_links').delete().eq('id', id)
    if (error) throw error
  },
  async createMap(m) {
    const { error } = await supabase.from('mind_maps').insert(m)
    if (error) throw error
  },
  async upsertMapNode(n) {
    const { error } = await supabase.from('map_nodes').upsert(n)
    if (error) throw error
  },
  async deleteMapNode(id) {
    const { error } = await supabase.from('map_nodes').delete().eq('id', id)
    if (error) throw error
  },
  async serverNow() {
    const { data, error } = await supabase.rpc('server_now')
    if (error) throw error
    return Date.parse(data as string)
  },
  async startSession(cardId, mode, estimateMin) {
    const { data, error } = await supabase.rpc('session_start', { p_card: cardId, p_mode: mode, p_estimate: estimateMin })
    if (error) throw error
    const row = asSession(data)
    if (!row) throw new Error('Session did not start')
    return row
  },
  async pauseSession(onBreak) {
    const { data, error } = await supabase.rpc('session_pause', { p_break: onBreak })
    if (error) throw error
    return asSession(data)
  },
  async resumeSession() {
    const { data, error } = await supabase.rpc('session_resume')
    if (error) throw error
    return asSession(data)
  },
  async extendSession(minutes) {
    const { data, error } = await supabase.rpc('session_extend', { p_minutes: minutes })
    if (error) throw error
    return asSession(data)
  },
  async setSessionMode(mode) {
    const { data, error } = await supabase.rpc('session_set_mode', { p_mode: mode })
    if (error) throw error
    return asSession(data)
  },
  async finishSession() {
    const { data, error } = await supabase.rpc('session_finish')
    if (error) throw error
    return asSession(data)
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
      db.sessions = db.sessions.filter((s) => s.card_id !== id)
      db.mapNodes = db.mapNodes.filter((n) => n.card_id !== id)
    },
    saveSettings: async (patch) => void (db.settings = { ...db.settings, ...patch }),
    importAll: async (b) => {
      const merge = <T extends { id: string }>(cur: T[], add: T[]) => [...cur.filter((x) => !add.some((y) => y.id === x.id)), ...add]
      db.columns = merge(db.columns, b.columns)
      db.tags = merge(db.tags, b.tags)
      db.cards = merge(db.cards, b.cards)
      const tagKey = (x: { card_id: string; tag_id: string }) => x.card_id + '|' + x.tag_id
      db.cardTags = [...db.cardTags.filter((x) => !b.cardTags.some((y) => tagKey(y) === tagKey(x))), ...b.cardTags]
      db.links = merge(db.links, b.links)
      db.sessions = merge(db.sessions, b.sessions)
      db.maps = merge(db.maps, b.maps)
      db.mapNodes = merge(db.mapNodes, b.mapNodes)
      if (b.settings) db.settings = { ...db.settings, ...b.settings }
    },
    deleteAllCards: async () => {
      db.cards = []
      db.cardTags = []
      db.links = []
      db.sessions = []
      db.mapNodes = []
    },
    createLink: async (l) => void db.links.push(l),
    updateLinkKind: async (id, kind) => void Object.assign(db.links.find((l) => l.id === id) ?? {}, { kind }),
    deleteLink: async (id) => void (db.links = db.links.filter((l) => l.id !== id)),
    createMap: async (m) => void db.maps.push(m),
    upsertMapNode: async (n) => {
      const i = db.mapNodes.findIndex((x) => x.id === n.id)
      if (i >= 0) db.mapNodes[i] = n
      else db.mapNodes.push(n)
    },
    deleteMapNode: async (id) => void (db.mapNodes = db.mapNodes.filter((n) => n.id !== id)),
    serverNow: async () => Date.now(),
    startSession: async (cardId, mode, estimateMin) => {
      const est = estimateMin ?? db.cards.find((c) => c.id === cardId)?.estimate_min ?? null
      const r = ops.start(db.sessions, cardId, mode, est, Date.now(), crypto.randomUUID())
      db.sessions = r.sessions
      return r.row!
    },
    pauseSession: async (onBreak) => {
      const r = ops.pause(db.sessions, onBreak, Date.now())
      db.sessions = r.sessions
      return r.row
    },
    resumeSession: async () => {
      const r = ops.resume(db.sessions, Date.now())
      db.sessions = r.sessions
      return r.row
    },
    extendSession: async (minutes) => {
      const r = ops.extend(db.sessions, minutes)
      db.sessions = r.sessions
      return r.row
    },
    setSessionMode: async (mode) => {
      const r = ops.setMode(db.sessions, mode)
      db.sessions = r.sessions
      return r.row
    },
    finishSession: async () => {
      const r = ops.finish(db.sessions, Date.now())
      db.sessions = r.sessions
      return r.row
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
    if (raw) db = { ...emptyBoard(), ...(JSON.parse(raw) as BoardData) }
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
