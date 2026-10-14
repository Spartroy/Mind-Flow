import { describe, expect, it } from 'vitest'
import { parseChecklist, plainText, toggleChecklistItem } from './checklist'

const md = ['# Plan', '- [x] Draw the four topologies', '- [ ] قارن بين bus و star', '- plain bullet', '  - [ ] nested [[Cable|abc]]', '```', '- [ ] not a task', '```'].join('\n')

describe('checklist', () => {
  it('finds task items with their state, Arabic included, skipping code fences', () => {
    const items = parseChecklist(md)
    expect(items.map((i) => [i.line, i.checked, i.text])).toEqual([
      [1, true, 'Draw the four topologies'],
      [2, false, 'قارن بين bus و star'],
      [4, false, 'nested Cable'],
    ])
  })

  it('toggles exactly one line and round-trips', () => {
    const once = toggleChecklistItem(md, 2)
    expect(once.split('\n')[2]).toBe('- [x] قارن بين bus و star')
    expect(once.split('\n').filter((_, i) => i !== 2)).toEqual(md.split('\n').filter((_, i) => i !== 2))
    expect(toggleChecklistItem(once, 2)).toBe(md)
  })

  it('ignores lines that are not task items', () => {
    expect(toggleChecklistItem(md, 3)).toBe(md)
    expect(toggleChecklistItem(md, 99)).toBe(md)
    expect(toggleChecklistItem(md, 6)).toBe(md) // inside a fence is still "- [ ]" text, but not listed
  })

  it('strips light markdown for display', () => {
    expect(plainText('**bold** and `code` [x](http://a)')).toBe('bold and code x')
  })
})
