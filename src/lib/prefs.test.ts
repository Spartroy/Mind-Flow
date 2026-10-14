import { describe, expect, it } from 'vitest'
import { applyToDocument, resolveTheme } from './prefs'

describe('theme and direction', () => {
  it('follows the system theme by default and honours overrides', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('flips <html dir> for Arabic and sets the theme class', () => {
    applyToDocument('dark', 'ar', false)
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    applyToDocument('light', 'en', true)
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
