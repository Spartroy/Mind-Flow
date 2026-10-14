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
  today_position: string | null
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

export type SessionMode = 'timer' | 'pomodoro' | 'writing'

/** All timestamps come from the database clock (see session_* SQL functions). */
export interface TimeSession {
  id: string
  card_id: string
  started_at: string
  ended_at: string | null
  paused_at: string | null
  paused_total_sec: number
  mode: SessionMode
  on_break: boolean
  breaks_taken: number
  estimate_snapshot_min: number | null
}

export interface MindMap {
  id: string
  name: string
  scope: string
}

/** card_id = null means a free node (a note on the map that is not a card). */
export interface MapNode {
  id: string
  map_id: string
  card_id: string | null
  x: number
  y: number
  label: string | null
}

/** Mirrors the `settings` table (one row per user). */
export interface Settings {
  locale: 'en' | 'ar'
  theme: 'system' | 'light' | 'dark'
  week_start: number // 0 = Sunday .. 6 = Saturday
  default_estimate_min: number
  pomodoro_focus_min: number
  pomodoro_break_min: number
  auto_float_timer: boolean
  overtime_message: boolean
  sound: boolean
}

export const defaultSettings: Settings = {
  locale: 'en',
  theme: 'system',
  week_start: 0,
  default_estimate_min: 25,
  pomodoro_focus_min: 25,
  pomodoro_break_min: 5,
  auto_float_timer: false,
  overtime_message: true,
  sound: false,
}

export interface BoardData {
  columns: Column[]
  cards: Card[]
  tags: Tag[]
  cardTags: CardTag[]
  links: CardLink[]
  sessions: TimeSession[]
  maps: MindMap[]
  mapNodes: MapNode[]
  settings: Settings
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
  saveSettings(patch: Partial<Settings>): Promise<void>
  /** Replace everything the user owns with a backup (merge by id; see backup.ts). */
  importAll(data: Omit<BoardData, 'settings'> & { settings?: Settings }): Promise<void>
  deleteAllCards(): Promise<void>
  createLink(l: CardLink): Promise<void>
  updateLinkKind(id: string, kind: LinkKind): Promise<void>
  deleteLink(id: string): Promise<void>
  createMap(m: MindMap): Promise<void>
  /** Insert or replace a map node by id (positions, labels). */
  upsertMapNode(n: MapNode): Promise<void>
  deleteMapNode(id: string): Promise<void>
  /** Database clock in epoch ms (client clocks are never trusted for session time). */
  serverNow(): Promise<number>
  /** Each returns the updated session, or null when nothing matched (e.g. pause when none running). */
  startSession(cardId: string, mode: SessionMode, estimateMin: number | null): Promise<TimeSession>
  pauseSession(onBreak: boolean): Promise<TimeSession | null>
  resumeSession(): Promise<TimeSession | null>
  extendSession(minutes: number): Promise<TimeSession | null>
  setSessionMode(mode: SessionMode): Promise<TimeSession | null>
  finishSession(): Promise<TimeSession | null>
}

export const emptyBoard = (): BoardData => ({ columns: [], cards: [], tags: [], cardTags: [], links: [], sessions: [], maps: [], mapNodes: [], settings: { ...defaultSettings } })
