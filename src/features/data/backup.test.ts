import { describe, expect, it } from 'vitest'
import { defaultSettings, emptyBoard, type BoardData, type Card } from '@/features/board/types'
import {
  BackupError, buildBackup, buildExportZip, cardToMarkdown, expandFiles, markdownFileName, markdownToCard, parseBackup, planImport,
} from './backup'

const card = (id: string, extra: Partial<Card> = {}): Card => ({
  id, title: id, body_md: '', column_id: 'c1', position: 'a0', estimate_min: null, is_today: false, today_position: null,
  due_date: null, archived_at: null, created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-02T08:00:00.000Z', ...extra,
})

const sample = (): BoardData => ({
  ...emptyBoard(),
  columns: [{ id: 'c1', name: 'To do', color: 'tag-1', position: 'a0' }, { id: 'c2', name: 'تم', color: 'tag-4', position: 'a1' }],
  cards: [
    card('11111111-aaaa', { title: 'الفصل الثالث: الشبكات "Networks"', body_md: '# عنوان\n\nنص مع [[Other|22222222-bbbb]]\n\n- [x] done\n- [ ] todo\n\n---\n\nمقطع بعد خط فاصل', estimate_min: 45, is_today: true, today_position: 'a0', due_date: '2026-10-16' }),
    card('22222222-bbbb', { title: 'Other', column_id: 'c2', position: 'a1', body_md: 'plain' }),
    card('33333333-cccc', { title: 'Archived one', archived_at: '2026-10-05T00:00:00Z' }),
  ],
  tags: [{ id: 't1', name: 'شبكات', color_index: 4 }, { id: 't2', name: 'Revision', color_index: 0 }],
  cardTags: [{ card_id: '11111111-aaaa', tag_id: 't1' }, { card_id: '11111111-aaaa', tag_id: 't2' }],
  links: [{ id: 'l1', from_card_id: '11111111-aaaa', to_card_id: '22222222-bbbb', kind: 'wikilink' }, { id: 'l2', from_card_id: '22222222-bbbb', to_card_id: '11111111-aaaa', kind: 'parent' }],
  sessions: [
    { id: 's1', card_id: '11111111-aaaa', started_at: '2026-10-14T09:05:00Z', ended_at: '2026-10-14T09:20:00Z', paused_at: null, paused_total_sec: 30, mode: 'timer', on_break: false, breaks_taken: 0, estimate_snapshot_min: 45 },
    { id: 's2', card_id: '22222222-bbbb', started_at: '2026-10-14T10:00:00Z', ended_at: null, paused_at: '2026-10-14T10:10:00Z', paused_total_sec: 0, mode: 'pomodoro', on_break: true, breaks_taken: 1, estimate_snapshot_min: null },
  ],
  maps: [{ id: 'm1', name: 'Map', scope: 'all' }],
  mapNodes: [{ id: 'n1', map_id: 'm1', card_id: '11111111-aaaa', x: 10.5, y: -3, label: null }, { id: 'n2', map_id: 'm1', card_id: null, x: 1, y: 2, label: 'exam tips ملاحظة' }],
  settings: { ...defaultSettings, locale: 'ar', pomodoro_focus_min: 50 },
})

const NOW = new Date('2026-10-14T12:00:00Z')

describe('JSON backup: no loss', () => {
  it('round-trips every table through the zip', () => {
    const data = sample()
    const files = expandFiles([{ name: 'neuroflow.zip', bytes: buildExportZip(data, NOW) }])
    const plan = planImport(files, emptyBoard())
    expect(plan.kind).toBe('backup')
    const b = plan.backup
    expect(b.columns).toEqual(data.columns)
    expect(b.cards).toEqual(data.cards) // including the archived card and the Arabic body
    expect(b.tags).toEqual(data.tags)
    expect(b.cardTags).toEqual(data.cardTags)
    expect(b.links).toEqual(data.links)
    expect(b.maps).toEqual(data.maps)
    expect(b.mapNodes).toEqual(data.mapNodes)
    expect(b.settings).toEqual(data.settings)
    expect(b.sessions[0]).toEqual(data.sessions[0])
  })

  it('closes a session that was still running so only one can ever be running', () => {
    const b = parseBackup(JSON.stringify(buildBackup(sample(), NOW)))
    const s2 = b.sessions.find((s) => s.id === 's2')!
    expect(s2.ended_at).toBe(NOW.toISOString())
    expect(s2.paused_at).toBeNull()
    expect(s2.paused_total_sec).toBe(7200 - 600) // 10:10 to 12:00 paused
    expect(b.sessions.filter((s) => s.ended_at === null)).toHaveLength(0)
  })

  it('rejects bad files with a readable message', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"other"}')).toThrow(/not a NeuroFlow backup/)
    expect(() => parseBackup(JSON.stringify({ app: 'neuroflow', version: 99 }))).toThrow(/newer version/)
    expect(() => parseBackup(JSON.stringify({ app: 'neuroflow', version: 1, columns: [] }))).toThrow(/missing "cards"/)
    expect(() => expandFiles([{ name: 'x.zip', bytes: new Uint8Array([1, 2, 3]) }])).toThrow(/not a valid zip/)
  })
})

describe('Markdown cards', () => {
  it('round-trips a card including quotes, Arabic, a horizontal rule and task items', () => {
    const data = sample()
    const c = data.cards[0]
    const md = cardToMarkdown(c, 'To do', ['شبكات', 'Revision'])
    const { meta, body } = markdownToCard(md)
    expect(body).toBe(c.body_md)
    expect(meta).toMatchObject({ id: c.id, title: c.title, column: 'To do', tags: ['شبكات', 'Revision'], estimate_min: 45, today: true, due: '2026-10-16' })
  })

  it('reads plain files without frontmatter: title from the first heading or the file name', () => {
    expect(markdownToCard('# My note\n\ntext').meta.title).toBe('My note')
    expect(markdownToCard('just text', 'Week plan-1a2b3c4d.md').meta.title).toBe('Week plan')
    expect(markdownToCard('---\ntitle: Hand written\ntags: a, b\n---\nbody').meta).toMatchObject({ title: 'Hand written', tags: ['a', 'b'] })
  })

  it('handles Windows line endings and a BOM', () => {
    const { meta, body } = markdownToCard('﻿---\r\ntitle: "x"\r\n---\r\nline1\r\nline2')
    expect(meta.title).toBe('x')
    expect(body).toBe('line1\nline2')
  })

  it('makes safe, unique, readable file names (Arabic kept)', () => {
    expect(markdownFileName({ id: 'abcdef123456', title: 'الشبكات: ملاحظات/اليوم?' })).toBe('الشبكات-ملاحظات-اليوم-abcdef12.md')
    expect(markdownFileName({ id: 'abcdef123456', title: '???' })).toBe('untitled-abcdef12.md')
    expect(markdownFileName({ id: 'abcdef123456', title: 'x'.repeat(200) }).length).toBeLessThan(80)
  })

  it('the zip has a backup and one .md per live card (not archived)', () => {
    const files = expandFiles([{ name: 'a.zip', bytes: buildExportZip(sample(), NOW) }])
    expect(files.filter((f) => f.name.endsWith('.md'))).toHaveLength(2)
    expect(files.some((f) => f.name === 'backup.json')).toBe(true)
  })
})

describe('Markdown import', () => {
  const mdFiles = () => expandFiles([{ name: 'a.zip', bytes: buildExportZip(sample(), NOW) }]).filter((f) => f.name.endsWith('.md'))

  it('recreates cards, columns, tags and links from the folder alone', () => {
    const plan = planImport(mdFiles(), emptyBoard())
    expect(plan.kind).toBe('markdown')
    const b = plan.backup
    expect(plan.summary).toMatchObject({ created: 2, updated: 0 })
    const main = b.cards.find((c) => c.title.startsWith('الفصل'))!
    expect(main).toMatchObject({ body_md: sample().cards[0].body_md, estimate_min: 45, is_today: true, due_date: '2026-10-16' })
    expect(b.columns.map((c) => c.name).sort()).toEqual(['To do', 'تم'])
    expect(b.cardTags.filter((x) => x.card_id === main.id)).toHaveLength(2)
    expect(b.tags.map((t) => t.name).sort()).toEqual(['Revision', 'شبكات'])
    expect(b.links).toHaveLength(1) // [[Other|id]] resolved by id, wikilink rebuilt
    expect(b.links[0].to_card_id).toBe('22222222-bbbb')
  })

  it('updates cards with a matching id instead of duplicating them, and reuses existing columns and tags', () => {
    const data = sample()
    const edited = mdFiles().map((f) => (f.text.includes('title: "Other"') ? { ...f, text: f.text.replace('plain', 'changed body') } : f))
    const plan = planImport(edited, data)
    expect(plan.summary).toMatchObject({ created: 0, updated: 2, columns: 0 })
    expect(plan.backup.cards.find((c) => c.id === '22222222-bbbb')?.body_md).toBe('changed body')
    expect(plan.backup.columns).toEqual([]) // nothing new to create
    expect(plan.backup.tags).toEqual([])
    expect(plan.backup.links).toEqual([]) // the link already exists
  })

  it('imports loose notes into the first column', () => {
    const data = sample()
    const plan = planImport([{ name: 'notes/Idea.md', text: '# Idea\n\nlink to [[Other]]' }], data)
    const c = plan.backup.cards[0]
    expect(c.column_id).toBe('c1')
    expect(c.title).toBe('Idea')
    expect(plan.backup.links[0]).toMatchObject({ from_card_id: c.id, to_card_id: '22222222-bbbb' })
  })

  it('says so when there is nothing to import', () => {
    expect(() => planImport([{ name: 'readme.txt', text: 'x' }], emptyBoard())).toThrow(/No backup.json or Markdown/)
  })
})
