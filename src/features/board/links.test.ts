import { describe, expect, it } from 'vitest'
import { diffLinks, linkTargets, parseWikiLinks, refreshWikiTitles, sanitizeTitle } from './links'
import type { Card } from './types'

const card = (id: string, title: string, extra: Partial<Card> = {}): Card => ({
  id, title, body_md: '', column_id: 'a', position: 'a0', estimate_min: null, is_today: false, today_position: null, due_date: null,
  archived_at: null, created_at: '', updated_at: '', ...extra,
})
const cards = [card('1', 'Networks'), card('2', 'الشبكات'), card('3', 'Cable types'), card('4', 'Cable types')]

describe('parseWikiLinks', () => {
  it('reads titles with and without ids, Arabic included', () => {
    expect(parseWikiLinks('See [[Networks]] and [[الشبكات|2]] ok')).toEqual([
      { title: 'Networks', id: null },
      { title: 'الشبكات', id: '2' },
    ])
  })
  it('ignores links inside code', () => {
    expect(parseWikiLinks('`[[a]]` and\n```\n[[b]]\n```\n[[c]]')).toEqual([{ title: 'c', id: null }])
  })
})

describe('linkTargets', () => {
  it('resolves by id even after a rename', () => {
    expect(linkTargets('[[Old name|1]]', cards, '9')).toEqual(['1'])
  })
  it('resolves unambiguous titles and skips ambiguous or missing ones', () => {
    expect(linkTargets('[[networks]] [[Cable types]] [[Nope]]', cards, '9')).toEqual(['1'])
  })
  it('never links a card to itself, and dedupes', () => {
    expect(linkTargets('[[Networks|1]] [[Networks]] [[الشبكات|2]]', cards, '1')).toEqual(['2'])
  })
  it('ignores archived targets', () => {
    expect(linkTargets('[[X|5]]', [card('5', 'X', { archived_at: 'now' })], '9')).toEqual([])
  })
})

describe('diffLinks', () => {
  it('adds new and removes dropped links', () => {
    expect(diffLinks(['1', '2'], ['2', '3'])).toEqual({ add: ['3'], remove: ['1'] })
    expect(diffLinks([], [])).toEqual({ add: [], remove: [] })
  })
})

describe('refreshWikiTitles', () => {
  it('shows the current title and pins title-only links to ids', () => {
    const cs = [card('1', 'Networks renamed')]
    expect(refreshWikiTitles('a [[Networks|1]] b', cs)).toBe('a [[Networks renamed|1]] b')
    expect(refreshWikiTitles('a [[networks renamed]] b', cs)).toBe('a [[Networks renamed|1]] b')
  })
  it('leaves unresolved links and code untouched', () => {
    expect(refreshWikiTitles('[[Ghost]] `[[Networks|1]]`', [card('1', 'N')])).toBe('[[Ghost]] `[[Networks|1]]`')
  })
  it('sanitizes titles that would break the syntax', () => {
    expect(sanitizeTitle('a [b] | c')).toBe('a b c')
  })
})
