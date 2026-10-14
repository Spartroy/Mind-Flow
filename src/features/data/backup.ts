import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { keyAfter, sorted } from '@/features/board/logic'
import { linkTargets } from '@/features/board/links'
import type { BoardData, Card, CardLink, Column, Settings, Tag, TimeSession } from '@/features/board/types'
import { defaultSettings } from '@/features/board/types'

export const BACKUP_VERSION = 1

/** Everything the user owns, as plain JSON. Round-trips without loss. */
export interface Backup {
  app: 'neuroflow'
  version: number
  exportedAt: string
  columns: BoardData['columns']
  cards: BoardData['cards']
  tags: BoardData['tags']
  cardTags: BoardData['cardTags']
  links: BoardData['links']
  sessions: BoardData['sessions']
  maps: BoardData['maps']
  mapNodes: BoardData['mapNodes']
  settings: Settings
}

export function buildBackup(data: BoardData, now = new Date()): Backup {
  return {
    app: 'neuroflow', version: BACKUP_VERSION, exportedAt: now.toISOString(),
    columns: data.columns, cards: data.cards, tags: data.tags, cardTags: data.cardTags, links: data.links,
    sessions: data.sessions, maps: data.maps, mapNodes: data.mapNodes, settings: data.settings,
  }
}

// ---------------------------------------------------------------- JSON backup

const ARRAYS = ['columns', 'cards', 'tags', 'cardTags', 'links', 'sessions', 'maps', 'mapNodes'] as const

export class BackupError extends Error {}

/** Parse and validate a backup. Throws BackupError with a message fit to show the user. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('This file is not valid JSON.')
  }
  const b = raw as Partial<Backup> | null
  if (!b || typeof b !== 'object' || b.app !== 'neuroflow') throw new BackupError('This is not a NeuroFlow backup.')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) throw new BackupError('This backup was made by a newer version of NeuroFlow.')
  for (const k of ARRAYS) if (!Array.isArray(b[k])) throw new BackupError(`The backup is missing "${k}".`)
  for (const card of b.cards as Card[]) {
    if (typeof card.id !== 'string' || typeof card.title !== 'string') throw new BackupError('A card in the backup is malformed.')
  }
  const exportedAt = typeof b.exportedAt === 'string' ? b.exportedAt : new Date().toISOString()
  // Only one session may be running per user: close any that were open when the backup was made.
  const sessions = (b.sessions as TimeSession[]).map((s) =>
    s.ended_at === null
      ? {
          ...s,
          ended_at: exportedAt < s.started_at ? s.started_at : exportedAt,
          paused_total_sec: s.paused_total_sec + (s.paused_at ? Math.max(0, Math.round((Date.parse(exportedAt) - Date.parse(s.paused_at)) / 1000)) : 0),
          paused_at: null,
          on_break: false,
        }
      : s,
  )
  return { ...(b as Backup), exportedAt, sessions, settings: { ...defaultSettings, ...(b.settings ?? {}) } }
}

// ---------------------------------------------------------------- Markdown cards

const q = (v: unknown) => JSON.stringify(v)

export interface CardMeta {
  id?: string
  title?: string
  column?: string
  tags?: string[]
  estimate_min?: number | null
  today?: boolean
  due?: string | null
  created?: string
  updated?: string
}

/** One card as a Markdown file: a small frontmatter block, then the note exactly as stored. */
export function cardToMarkdown(card: Card, columnName: string | undefined, tagNames: string[]): string {
  const lines = ['---', `id: ${q(card.id)}`, `title: ${q(card.title)}`]
  if (columnName) lines.push(`column: ${q(columnName)}`)
  if (tagNames.length) lines.push(`tags: ${q(tagNames)}`)
  if (card.estimate_min !== null) lines.push(`estimate_min: ${card.estimate_min}`)
  if (card.is_today) lines.push('today: true')
  if (card.due_date) lines.push(`due: ${q(card.due_date)}`)
  if (card.created_at) lines.push(`created: ${q(card.created_at)}`)
  if (card.updated_at) lines.push(`updated: ${q(card.updated_at)}`)
  lines.push('---', '')
  return lines.join('\n') + '\n' + card.body_md
}

/** Parse a Markdown card. Files without frontmatter work too: the title comes from the first heading or the file name. */
export function markdownToCard(text: string, fileName = ''): { meta: CardMeta; body: string } {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  const meta: CardMeta = {}
  let body = src
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src)
  if (m) {
    body = src.slice(m[0].length).replace(/^\n/, '')
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i < 0) continue
      const key = line.slice(0, i).trim()
      const raw = line.slice(i + 1).trim()
      let value: unknown
      try {
        value = JSON.parse(raw)
      } catch {
        value = raw // hand-written `title: Plain text`
      }
      if (key === 'id' && typeof value === 'string') meta.id = value
      if (key === 'title' && typeof value === 'string') meta.title = value
      if (key === 'column' && typeof value === 'string') meta.column = value
      if (key === 'tags') meta.tags = Array.isArray(value) ? value.map(String) : String(value).split(',').map((t) => t.trim()).filter(Boolean)
      if (key === 'estimate_min') meta.estimate_min = typeof value === 'number' ? value : Number(value) || null
      if (key === 'today') meta.today = value === true || value === 'true'
      if (key === 'due' && typeof value === 'string') meta.due = value || null
      if (key === 'created' && typeof value === 'string') meta.created = value
      if (key === 'updated' && typeof value === 'string') meta.updated = value
    }
  }
  if (!meta.title) {
    const h = /^#\s+(.+)$/m.exec(body)
    meta.title = h ? h[1].trim() : fileName.replace(/\.md$/i, '').replace(/-[0-9a-f]{8}$/i, '').replace(/[-_]+/g, ' ').trim()
  }
  return { meta, body }
}

/** Safe, readable, unique file name; keeps Arabic and other letters. */
export function markdownFileName(card: Pick<Card, 'id' | 'title'>): string {
  const slug = card.title
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'untitled'}-${card.id.slice(0, 8)}.md`
}

// ---------------------------------------------------------------- ZIP

/** `backup.json` plus `cards/*.md`: open it as a folder of Markdown notes, or import the whole thing back. */
export function buildExportZip(data: BoardData, now = new Date()): Uint8Array {
  const files: Record<string, Uint8Array> = { 'backup.json': strToU8(JSON.stringify(buildBackup(data, now), null, 2)) }
  const colName = new Map(data.columns.map((c) => [c.id, c.name]))
  const tagName = new Map(data.tags.map((t) => [t.id, t.name]))
  const used = new Set<string>()
  for (const card of data.cards.filter((c) => !c.archived_at)) {
    const tags = data.cardTags.filter((x) => x.card_id === card.id).flatMap((x) => tagName.get(x.tag_id) ?? [])
    let name = markdownFileName(card)
    for (let n = 2; used.has(name); n++) name = name.replace(/\.md$/, `-${n}.md`)
    used.add(name)
    files[`cards/${name}`] = strToU8(cardToMarkdown(card, colName.get(card.column_id ?? ''), tags))
  }
  return zipSync(files, { level: 6 })
}

export interface InFile {
  name: string
  bytes: Uint8Array
}

/** Flatten picked files: zips are opened, everything else passes through. */
export function expandFiles(files: InFile[]): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = []
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      let entries: Record<string, Uint8Array>
      try {
        entries = unzipSync(f.bytes)
      } catch {
        throw new BackupError(`${f.name} is not a valid zip file.`)
      }
      for (const [path, bytes] of Object.entries(entries)) {
        if (/\.(json|md)$/i.test(path) && !path.endsWith('/')) out.push({ name: path, text: strFromU8(bytes) })
      }
    } else if (/\.(json|md)$/i.test(f.name)) {
      out.push({ name: f.name, text: strFromU8(f.bytes) })
    }
  }
  return out
}

// ---------------------------------------------------------------- Markdown import plan

export type ImportPlan =
  | { kind: 'backup'; backup: Backup; summary: { cards: number; columns: number; sessions: number; exportedAt: string } }
  | { kind: 'markdown'; backup: Omit<Backup, 'settings'> & { settings?: Settings }; summary: { created: number; updated: number; columns: number } }

const newId = () => crypto.randomUUID()

/**
 * Turn picked files into one import. A `backup.json` wins (it restores everything); otherwise every
 * Markdown file becomes a card: matched by id when it has one, created otherwise. Missing columns
 * and tags are created by name. Note links in the imported text are rebuilt afterwards.
 */
export function planImport(files: { name: string; text: string }[], data: BoardData): ImportPlan {
  const json = files.find((f) => /(^|\/)backup\.json$/i.test(f.name)) ?? files.find((f) => /\.json$/i.test(f.name))
  if (json) {
    const backup = parseBackup(json.text)
    return { kind: 'backup', backup, summary: { cards: backup.cards.length, columns: backup.columns.length, sessions: backup.sessions.length, exportedAt: backup.exportedAt } }
  }
  const mds = files.filter((f) => /\.md$/i.test(f.name))
  if (!mds.length) throw new BackupError('No backup.json or Markdown files found.')

  const columns: Column[] = [...data.columns]
  const tags: Tag[] = [...data.tags]
  const cards: Card[] = []
  const cardTags: BoardData['cardTags'] = []
  const existingById = new Map(data.cards.map((c) => [c.id, c]))
  const now = new Date().toISOString()
  let created = 0
  let updated = 0

  const columnFor = (name: string | undefined): Column => {
    const wanted = name?.trim()
    const hit = wanted ? columns.find((c) => c.name.toLowerCase() === wanted.toLowerCase()) : undefined
    if (hit) return hit
    if (!wanted && columns.length) return sorted(columns)[0]
    const col: Column = { id: newId(), name: wanted || 'Imported', color: `tag-${(columns.length % 8) + 1}`, position: keyAfter(columns) }
    columns.push(col)
    return col
  }
  const tagFor = (name: string): Tag => {
    const hit = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (hit) return hit
    const tag: Tag = { id: newId(), name, color_index: tags.length % 8 }
    tags.push(tag)
    return tag
  }

  for (const f of mds) {
    const { meta, body } = markdownToCard(f.text, f.name.split('/').pop())
    const old = meta.id ? existingById.get(meta.id) : undefined
    const col = meta.column || !old ? columnFor(meta.column) : undefined
    const columnId = col?.id ?? old?.column_id ?? columnFor(undefined).id
    const inCol = [...data.cards, ...cards].filter((c) => c.column_id === columnId)
    const card: Card = {
      id: old?.id ?? meta.id ?? newId(),
      title: meta.title ?? '',
      body_md: body,
      column_id: columnId,
      position: old && old.column_id === columnId ? old.position : keyAfter(inCol),
      estimate_min: meta.estimate_min ?? old?.estimate_min ?? null,
      is_today: meta.today ?? old?.is_today ?? false,
      today_position: old?.today_position ?? null,
      due_date: meta.due ?? old?.due_date ?? null,
      archived_at: old?.archived_at ?? null,
      created_at: meta.created ?? old?.created_at ?? now,
      updated_at: now,
    }
    if (old) updated++
    else created++
    cards.push(card)
    for (const name of meta.tags ?? []) cardTags.push({ card_id: card.id, tag_id: tagFor(name).id })
  }

  // Rebuild text links among everything that will exist after the import.
  const everything = [...data.cards.filter((c) => !cards.some((x) => x.id === c.id)), ...cards]
  const links: CardLink[] = []
  for (const card of cards) {
    for (const to of linkTargets(card.body_md, everything, card.id)) {
      const dup = data.links.some((l) => l.kind === 'wikilink' && l.from_card_id === card.id && l.to_card_id === to)
      if (!dup) links.push({ id: newId(), from_card_id: card.id, to_card_id: to, kind: 'wikilink' })
    }
  }

  return {
    kind: 'markdown',
    backup: {
      app: 'neuroflow', version: BACKUP_VERSION, exportedAt: now,
      columns: columns.filter((c) => !data.columns.some((d) => d.id === c.id)),
      cards,
      tags: tags.filter((t) => !data.tags.some((d) => d.id === t.id)),
      cardTags,
      links,
      sessions: [], maps: [], mapNodes: [],
    },
    summary: { created, updated, columns: columns.length - data.columns.length },
  }
}
