import { describe, expect, it } from 'vitest'
import { formatEstimateInput, parseEstimate } from './estimate'

describe('parseEstimate', () => {
  it('reads minutes and hours', () => {
    const mins = (s: string) => (parseEstimate(s) as { minutes: number | null }).minutes
    expect(mins('45')).toBe(45)
    expect(mins('45m')).toBe(45)
    expect(mins(' 45 min ')).toBe(45)
    expect(mins('1h')).toBe(60)
    expect(mins('1.5h')).toBe(90)
    expect(mins('1h30')).toBe(90)
    expect(mins('1h 30m')).toBe(90)
    expect(mins('')).toBeNull()
  })
  it('rejects anything else', () => {
    for (const bad of ['abc', '45 mn', '-5', '1:30', '٤٥']) expect(parseEstimate(bad).ok).toBe(false)
  })
  it('round-trips through the input format', () => {
    expect(formatEstimateInput(45)).toBe('45m')
    expect(formatEstimateInput(null)).toBe('')
  })
})
