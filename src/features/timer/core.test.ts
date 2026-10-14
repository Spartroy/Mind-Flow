import { describe, expect, it } from 'vitest'
import type { TimeSession } from '@/features/board/types'
import {
  breakRemainingSec, clockOffset, elapsedSec, formatClock, formatDuration, isPaused, isRunning, loggedSec, pomodoro, progress,
} from './core'
import * as ops from './sessionOps'

const T0 = Date.parse('2026-10-14T09:00:00Z')
const at = (sec: number) => T0 + sec * 1000

const base = (over: Partial<TimeSession> = {}): TimeSession => ({
  id: 's1', card_id: 'c1', started_at: new Date(T0).toISOString(), ended_at: null, paused_at: null, paused_total_sec: 0,
  mode: 'timer', on_break: false, breaks_taken: 0, estimate_snapshot_min: 45, ...over,
})

describe('elapsed time (derived from timestamps only)', () => {
  it('counts running time as now - started', () => {
    expect(elapsedSec(base(), at(1662))).toBe(1662) // 27:42
  })

  it('stops while paused and ignores how long the pause lasts', () => {
    const s = base({ paused_at: new Date(at(600)).toISOString() })
    expect(elapsedSec(s, at(600))).toBe(600)
    expect(elapsedSec(s, at(99999))).toBe(600)
  })

  it('subtracts earlier pauses after resume: now - started - paused_total', () => {
    expect(elapsedSec(base({ paused_total_sec: 120 }), at(1000))).toBe(880)
  })

  it('uses ended_at for finished sessions', () => {
    const s = base({ ended_at: new Date(at(2400)).toISOString(), paused_total_sec: 60 })
    expect(elapsedSec(s, at(10_000_000))).toBe(2340)
  })

  it('survives a long sleep: the laptop closed for 2 hours still reads correctly', () => {
    expect(elapsedSec(base(), at(2 * 3600 + 30))).toBe(7230)
  })

  it('never goes negative (clock skew before start)', () => {
    expect(elapsedSec(base(), at(-5))).toBe(0)
  })

  it('classifies state', () => {
    expect(isRunning(base())).toBe(true)
    expect(isPaused(base({ paused_at: new Date(T0).toISOString() }))).toBe(true)
    expect(isRunning(base({ ended_at: new Date(T0).toISOString() }))).toBe(false)
  })
})

describe('pause and resume through the session ops', () => {
  it('pause then resume leaves total = running time only', () => {
    let s = ops.start([], 'c1', 'timer', 45, at(0), 'x').sessions
    s = ops.pause(s, false, at(600)).sessions // worked 10 min
    s = ops.resume(s, at(900)).sessions // 5 min paused
    expect(s[0].paused_total_sec).toBe(300)
    expect(elapsedSec(s[0], at(1500))).toBe(1200) // 25 min wall - 5 min paused
  })

  it('finishing while paused folds the pause in', () => {
    let s = ops.start([], 'c1', 'timer', 45, at(0), 'x').sessions
    s = ops.pause(s, false, at(600)).sessions
    const done = ops.finish(s, at(1000)).row!
    expect(done.paused_total_sec).toBe(400)
    expect(elapsedSec(done, at(5000))).toBe(600)
  })

  it('starting another session finishes the running one: one running at a time', () => {
    let s = ops.start([], 'c1', 'timer', 45, at(0), 'a').sessions
    s = ops.start(s, 'c2', 'timer', null, at(300), 'b').sessions
    expect(s.filter((x) => x.ended_at === null)).toHaveLength(1)
    expect(elapsedSec(s[0], at(9999))).toBe(300)
  })

  it('pause when already paused, and resume when running, are no-ops', () => {
    let s = ops.start([], 'c1', 'timer', 45, at(0), 'a').sessions
    expect(ops.resume(s, at(10)).row).toBeNull()
    s = ops.pause(s, false, at(10)).sessions
    expect(ops.pause(s, false, at(20)).row).toBeNull()
  })

  it('+10 min raises the estimate', () => {
    const s = ops.start([], 'c1', 'timer', 45, at(0), 'a').sessions
    expect(ops.extend(s, 10).row!.estimate_snapshot_min).toBe(55)
  })
})

describe('logged time on a card', () => {
  it('sums every session, including the running one', () => {
    const done = base({ id: 'a', ended_at: new Date(at(600)).toISOString() })
    const live = base({ id: 'b', started_at: new Date(at(1000)).toISOString() })
    const other = base({ id: 'c', card_id: 'c2' })
    expect(loggedSec([done, live, other], 'c1', at(1300))).toBe(900)
  })
})

describe('progress and overtime', () => {
  it('counts down toward the estimate, then up past it', () => {
    expect(progress(1662, 45)).toMatchObject({ overtime: false, seconds: 1038 })
    expect(progress(2700 + 258, 45)).toEqual({ fraction: 1, overtime: true, seconds: 258 }) // +04:18
  })
  it('has no countdown without an estimate', () => {
    expect(progress(300, null)).toEqual({ fraction: 0, overtime: false, seconds: 300 })
  })
})

describe('formatting', () => {
  it('formats clocks and durations', () => {
    expect(formatClock(1662)).toBe('27:42')
    expect(formatClock(3909)).toBe('1:05:09')
    expect(formatClock(-3)).toBe('00:00')
    expect(formatDuration(245)).toBe('4h 05m')
    expect(formatDuration(38)).toBe('38m')
    expect(formatDuration(120)).toBe('2h')
  })
})

describe('server clock offset', () => {
  it('uses the midpoint of the round trip', () => {
    // device clock is 5 s behind the server; request took 200 ms
    expect(clockOffset(10_000 + 5_000 + 100, 10_000, 10_200)).toBe(5000)
  })
})

describe('Pomodoro', () => {
  it('knows when a focus block is over and a break is due', () => {
    const s = base({ mode: 'pomodoro' })
    expect(pomodoro(s, 1000, 25)).toMatchObject({ block: 1, blockRemainingSec: 500, breakDue: false })
    expect(pomodoro(s, 1500, 25).breakDue).toBe(true)
  })

  it('moves to block 2 after a break is recorded, with the break not counted as work', () => {
    let s = ops.start([], 'c1', 'pomodoro', 25, at(0), 'x').sessions
    s = ops.pause(s, true, at(1500)).sessions // break starts at exactly 25:00
    expect(s[0].breaks_taken).toBe(1)
    expect(s[0].on_break).toBe(true)
    expect(breakRemainingSec(s[0], 5, 0, at(1500 + 120))).toBe(180)
    expect(breakRemainingSec(s[0], 5, 120, at(1500 + 120))).toBe(300) // +2 min
    expect(breakRemainingSec(s[0], 5, 0, at(1500 + 400))).toBeLessThan(0) // over
    s = ops.resume(s, at(1500 + 300)).sessions
    expect(elapsedSec(s[0], at(1500 + 300 + 60))).toBe(1560) // 25:00 + 1:00, break excluded
    expect(pomodoro(s[0], 1560, 25)).toMatchObject({ block: 2, breakDue: false })
    expect(pomodoro(s[0], 3000, 25).breakDue).toBe(true)
  })

  it('does not report a break due for non-Pomodoro sessions or while paused', () => {
    expect(pomodoro(base(), 99999, 25).breakDue).toBe(false)
    expect(pomodoro(base({ mode: 'pomodoro', paused_at: new Date(T0).toISOString() }), 99999, 25).breakDue).toBe(false)
  })
})
