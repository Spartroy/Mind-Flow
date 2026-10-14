import { describe, expect, it } from 'vitest'
import { cardHref, parseHash } from './router'

describe('router', () => {
  it('maps hashes to routes, defaulting to the board', () => {
    expect(parseHash('')).toEqual({ name: 'board' })
    expect(parseHash('#/today')).toEqual({ name: 'today' })
    expect(parseHash('#/map')).toEqual({ name: 'map' })
    expect(parseHash('#/card')).toEqual({ name: 'board' })
    expect(parseHash('#/nonsense')).toEqual({ name: 'board' })
    expect(parseHash('#/blitz')).toEqual({ name: 'blitz', id: null })
    expect(parseHash('#/blitz/abc')).toEqual({ name: 'blitz', id: 'abc' })
  })
  it('distinguishes side panel and full page card routes', () => {
    expect(parseHash(cardHref('abc'))).toEqual({ name: 'card', id: 'abc', page: false })
    expect(parseHash(cardHref('abc', true))).toEqual({ name: 'card', id: 'abc', page: true })
  })
})
