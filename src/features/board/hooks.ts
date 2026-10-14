import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { linkTargets } from './links'
import { keyAfter, planMove, sorted } from './logic'
import { repo } from './repo'
import { doneColumn, todayPositionAt } from '@/features/today/logic'
import * as ops from '@/features/timer/sessionOps'
import { defaultSettings, type BoardData, type Card, type CardLink, type Column, type LinkKind, type MapNode, type MindMap, type SessionMode, type Settings, type Tag, type TimeSession } from './types'

const KEY = ['board'] as const

export const useBoard = () => useQuery({ queryKey: KEY, queryFn: () => repo.load() })

/**
 * Every action updates the cache first (optimistic), then writes; on failure the
 * cache is reloaded from the server and the error is rethrown to the caller.
 */
export function useBoardActions() {
  const qc = useQueryClient()

  const run = useCallback(
    async (patch: (d: BoardData) => BoardData, write: () => Promise<void>) => {
      qc.setQueryData<BoardData>(KEY, (d) => (d ? patch(d) : d))
      try {
        await write()
      } catch (e) {
        await qc.invalidateQueries({ queryKey: KEY })
        throw e
      }
    },
    [qc],
  )

  const addColumn = (name: string, color = 'tag-5') => {
    const cols = qc.getQueryData<BoardData>(KEY)?.columns ?? []
    const c: Column = { id: crypto.randomUUID(), name, color, position: keyAfter(cols) }
    return run((d) => ({ ...d, columns: [...d.columns, c] }), () => repo.createColumn(c))
  }

  const addStarterColumns = async (names: string[]) => {
    for (const [i, name] of names.entries()) {
      const color = ['tag-6', 'tag-2', 'tag-4'][i] ?? 'tag-5'
      await addColumn(name, color)
    }
  }

  const updateColumn = (id: string, patch: Partial<Omit<Column, 'id'>>) =>
    run((d) => ({ ...d, columns: d.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), () =>
      repo.updateColumn(id, patch),
    )

  /** Cards in the column move to `moveTo`; refuses if cards would be orphaned. */
  const deleteColumn = async (id: string, moveTo: string | null) => {
    const d = qc.getQueryData<BoardData>(KEY)
    const inCol = d?.cards.filter((c) => c.column_id === id) ?? []
    if (inCol.length && !moveTo) throw new Error('Column has cards and no destination column')
    for (const c of inCol) {
      // Re-read each time so every moved card lands after the previous one.
      const fresh = qc.getQueryData<BoardData>(KEY)!.cards
      await updateCard(c.id, planMove(fresh, c.id, moveTo!, Number.MAX_SAFE_INTEGER))
    }
    await run((x) => ({ ...x, columns: x.columns.filter((c) => c.id !== id) }), () => repo.deleteColumn(id))
  }

  const addCard = (title: string, columnId: string) => {
    const cards = (qc.getQueryData<BoardData>(KEY)?.cards ?? []).filter((c) => c.column_id === columnId)
    const card: Card = {
      id: crypto.randomUUID(), title, body_md: '', column_id: columnId, position: keyAfter(cards),
      estimate_min: null, is_today: false, today_position: null, due_date: null, archived_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    // id is known immediately so callers can navigate before the write finishes.
    return { id: card.id, done: run((d) => ({ ...d, cards: [...d.cards, card] }), () => repo.createCard(card)) }
  }

  const updateCard = (id: string, patch: Partial<Omit<Card, 'id'>>) =>
    run((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c)) }), () =>
      repo.updateCard(id, patch),
    )

  const deleteCard = (id: string) =>
    run(
      (d) => ({
        ...d,
        cards: d.cards.filter((c) => c.id !== id),
        cardTags: d.cardTags.filter((t) => t.card_id !== id),
        links: d.links.filter((l) => l.from_card_id !== id && l.to_card_id !== id),
      }),
      () => repo.deleteCard(id),
    )

  const moveCard = (cardId: string, columnId: string, index: number) => {
    const d = qc.getQueryData<BoardData>(KEY)
    if (!d) return Promise.resolve()
    return updateCard(cardId, planMove(d.cards, cardId, columnId, index))
  }

  const createTag = async (name: string): Promise<Tag> => {
    const tags = qc.getQueryData<BoardData>(KEY)?.tags ?? []
    const tag: Tag = { id: crypto.randomUUID(), name, color_index: tags.length % 8 }
    await run((d) => ({ ...d, tags: [...d.tags, tag] }), () => repo.createTag(tag))
    return tag
  }

  /** Save the note and keep wikilink rows in step with its text (one optimistic update). */
  const saveBody = async (cardId: string, body_md: string) => {
    const d = qc.getQueryData<BoardData>(KEY)
    if (!d) return
    const targets = linkTargets(body_md, d.cards, cardId)
    const isMine = (l: CardLink) => l.from_card_id === cardId && l.kind === 'wikilink'
    const next = targets.map(
      (to) =>
        d.links.find((l) => isMine(l) && l.to_card_id === to) ??
        ({ id: crypto.randomUUID(), from_card_id: cardId, to_card_id: to, kind: 'wikilink' } as CardLink),
    )
    await run(
      (x) => ({
        ...x,
        links: [...x.links.filter((l) => !isMine(l)), ...next],
        cards: x.cards.map((c) => (c.id === cardId ? { ...c, body_md, updated_at: new Date().toISOString() } : c)),
      }),
      async () => {
        await repo.updateCard(cardId, { body_md })
        await repo.syncWikiLinks(cardId, targets)
      },
    )
  }

  const updateSettings = (patch: Partial<Settings>) =>
    run((d) => ({ ...d, settings: { ...d.settings, ...patch } }), () => repo.saveSettings(patch))

  /** Import a backup, then reload everything from the store. */
  const importBackup = async (b: Parameters<typeof repo.importAll>[0]) => {
    await repo.importAll(b)
    await qc.invalidateQueries({ queryKey: KEY })
  }
  const deleteAllCards = async () => {
    await repo.deleteAllCards()
    await qc.invalidateQueries({ queryKey: KEY })
  }

  // ---- links and the mind map
  /** Manual or parent link between two cards (text links come from the note, see saveBody). */
  const addLink = (from: string, to: string, kind: LinkKind = 'manual') => {
    // Same pair and same kind (either direction) already exists: nothing to add. Also absorbs a doubled gesture.
    const dup = qc
      .getQueryData<BoardData>(KEY)
      ?.links.some((l) => l.kind === kind && ((l.from_card_id === from && l.to_card_id === to) || (l.from_card_id === to && l.to_card_id === from)))
    if (dup || from === to) return Promise.resolve()
    const link: CardLink = { id: crypto.randomUUID(), from_card_id: from, to_card_id: to, kind }
    return run((d) => ({ ...d, links: [...d.links, link] }), () => repo.createLink(link))
  }
  const setLinkKind = (ids: string[], kind: LinkKind) =>
    run((d) => ({ ...d, links: d.links.map((l) => (ids.includes(l.id) ? { ...l, kind } : l)) }), async () => {
      for (const id of ids) await repo.updateLinkKind(id, kind)
    })
  const removeLinks = (ids: string[]) =>
    run((d) => ({ ...d, links: d.links.filter((l) => !ids.includes(l.id)) }), async () => {
      for (const id of ids) await repo.deleteLink(id)
    })

  /** The user's single map, created the first time something is placed on it. */
  const ensureMap = async (): Promise<MindMap> => {
    const existing = qc.getQueryData<BoardData>(KEY)?.maps[0]
    if (existing) return existing
    const map: MindMap = { id: crypto.randomUUID(), name: 'Map', scope: 'all' }
    await run((d) => ({ ...d, maps: [...d.maps, map] }), () => repo.createMap(map))
    return map
  }
  const saveMapNode = async (n: Omit<MapNode, 'map_id' | 'id'> & { id?: string }) => {
    const map = await ensureMap()
    const d = qc.getQueryData<BoardData>(KEY)
    const existing = d?.mapNodes.find((m) => (n.card_id ? m.card_id === n.card_id : m.id === n.id))
    const node: MapNode = { ...n, id: existing?.id ?? n.id ?? crypto.randomUUID(), map_id: map.id }
    await run(
      (x) => ({ ...x, mapNodes: [...x.mapNodes.filter((m) => m.id !== node.id), node] }),
      () => repo.upsertMapNode(node),
    )
    return node
  }
  const removeMapNode = (id: string) =>
    run((d) => ({ ...d, mapNodes: d.mapNodes.filter((n) => n.id !== id) }), () => repo.deleteMapNode(id))

  // ---- Today
  const setToday = (id: string, on: boolean) => {
    const d = qc.getQueryData<BoardData>(KEY)
    const today_position = on && d ? todayPositionAt(d.cards, id, Number.MAX_SAFE_INTEGER) : null
    return updateCard(id, { is_today: on, today_position })
  }
  const moveToday = (id: string, index: number) => {
    const d = qc.getQueryData<BoardData>(KEY)
    if (!d) return Promise.resolve()
    return updateCard(id, { today_position: todayPositionAt(d.cards, id, index) })
  }
  /** Checking a card moves it to the last column; unchecking returns it to the first. */
  const setDone = (id: string, done: boolean) => {
    const d = qc.getQueryData<BoardData>(KEY)
    const cols = sorted(d?.columns ?? [])
    const target = done ? doneColumn(cols) : cols[0]
    return target ? moveCard(id, target.id, Number.MAX_SAFE_INTEGER) : Promise.resolve()
  }

  // ---- focus sessions. Times are written by the database clock, so these wait for the server
  // instead of guessing optimistically.
  const putSession = (row: TimeSession | null) => {
    if (!row) return void qc.invalidateQueries({ queryKey: KEY }) // nothing matched: resync
    qc.setQueryData<BoardData>(KEY, (d) => (d ? { ...d, sessions: d.sessions.map((s) => (s.id === row.id ? row : s)) } : d))
  }

  const startSession = async (cardId: string, mode: SessionMode = 'timer') => {
    const card = qc.getQueryData<BoardData>(KEY)?.cards.find((c) => c.id === cardId)
    const fallback = qc.getQueryData<BoardData>(KEY)?.settings.default_estimate_min ?? null
    const row = await repo.startSession(cardId, mode, card?.estimate_min ?? fallback)
    qc.setQueryData<BoardData>(KEY, (d) => {
      if (!d) return d
      // The server finished any other running session at this instant; mirror that locally.
      const others = ops.finish(d.sessions.filter((s) => s.id !== row.id), Date.parse(row.started_at)).sessions
      return { ...d, sessions: [...others, row] }
    })
    return row
  }
  const pauseSession = async (onBreak = false) => putSession(await repo.pauseSession(onBreak))
  const resumeSession = async () => putSession(await repo.resumeSession())
  const extendSession = async (minutes: number) => putSession(await repo.extendSession(minutes))
  const setSessionMode = async (mode: SessionMode) => putSession(await repo.setSessionMode(mode))
  const finishSession = async () => {
    const row = await repo.finishSession()
    putSession(row)
    return row
  }

  const setCardTags = (cardId: string, tagIds: string[]) =>
    run(
      (d) => ({
        ...d,
        cardTags: [...d.cardTags.filter((t) => t.card_id !== cardId), ...tagIds.map((tag_id) => ({ card_id: cardId, tag_id }))],
      }),
      () => repo.setCardTags(cardId, tagIds),
    )

  return { addColumn, addStarterColumns, updateColumn, deleteColumn, addCard, updateCard, deleteCard, moveCard, createTag, setCardTags, saveBody, snapshot: () => qc.getQueryData<BoardData>(KEY), updateSettings, importBackup, deleteAllCards, addLink, setLinkKind, removeLinks, saveMapNode, removeMapNode, setToday, moveToday, setDone, startSession, pauseSession, resumeSession, extendSession, finishSession, setSessionMode }
}

export const useSettings = () => useBoard().data?.settings ?? defaultSettings

export const orderedColumns = (d: BoardData) => sorted(d.columns)
