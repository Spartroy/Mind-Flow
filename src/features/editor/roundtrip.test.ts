import { Editor } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { DirAuto } from './dirAuto'
import { WikiLink } from './wikiLink'
import { SPIKE_SAMPLE } from './SpikePage'

const make = (md: string) =>
  new Editor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), Markdown, DirAuto, WikiLink],
    content: md,
    contentType: 'markdown',
  })

const roundTrip = (md: string) => {
  const e = make(md)
  const out = e.getMarkdown()
  e.destroy()
  return out
}

describe('Markdown round-trip (Arabic + English)', () => {
  it('is stable: a second pass changes nothing', () => {
    const once = roundTrip(SPIKE_SAMPLE)
    expect(roundTrip(once)).toBe(once)
  })

  it('preserves Arabic text, mixed paragraphs, and numbers exactly', () => {
    const out = roundTrip(SPIKE_SAMPLE)
    for (const s of [
      '# درس الشبكات Networks',
      'Start in English then عربي في المنتصف، then back (اختبار الترقيم).',
      'اقتباس: "Quote" مع أرقام 123 و 4.5',
      '`inline code` داخل جملة عربية.',
    ]) {
      expect(out).toContain(s)
    }
  })

  it('keeps [[wikilinks]] unescaped so link parsing can read them', () => {
    expect(roundTrip('- [[Card title]] رابط\n')).toContain('[[Card title]] رابط')
    expect(roundTrip('See [[Title|0b1c2d3e]] now')).toContain('[[Title|0b1c2d3e]]')
  })

  it('keeps list kinds and task state', () => {
    const out = roundTrip(SPIKE_SAMPLE)
    expect(out).toContain('- نقطة عربية first')
    expect(out).toContain('1. الخطوة الأولى')
    expect(out).toContain('- [ ] مهمة غير منجزة')
    expect(out).toContain('- [x] Done task تم')
  })

  it('renders dir="auto" on text blocks only, never on containers', () => {
    const e = make(SPIKE_SAMPLE)
    const html = e.getHTML()
    expect(html).toMatch(/<p dir="auto">/)
    expect(html).toMatch(/<h1 dir="auto">/)
    expect(html).not.toMatch(/<(ul|ol|li|blockquote)[^>]*dir=/)
    e.destroy()
  })
})
