import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { repo } from '@/features/board/repo'
import { clockOffset } from './core'

/** Difference between the database clock and this device (ms). 0 until measured / in demo mode. */
export const useClock = create<{ offsetMs: number; setOffset: (n: number) => void }>((set) => ({
  offsetMs: 0,
  setOffset: (offsetMs) => set({ offsetMs }),
}))

/** Measure the offset with one round trip. Safe to call repeatedly; failures keep the last value. */
export async function syncClock() {
  try {
    const sent = Date.now()
    const server = await repo.serverNow()
    const received = Date.now()
    useClock.getState().setOffset(clockOffset(server, sent, received))
  } catch {
    /* keep the previous offset */
  }
}

/** Server-adjusted "now" in epoch ms. Display only: elapsed time itself comes from timestamps. */
export function useNow(intervalMs = 1000): number {
  const offset = useClock((s) => s.offsetMs)
  const offsetRef = useRef(offset)
  const [now, setNow] = useState(() => Date.now() + offset)

  useEffect(() => {
    offsetRef.current = offset
    setNow(Date.now() + offset)
  }, [offset])

  useEffect(() => {
    const tick = () => setNow(Date.now() + offsetRef.current)
    const id = setInterval(tick, intervalMs)
    // A sleeping laptop or background tab throttles timers: re-read the clock the moment we are visible again.
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [intervalMs])

  return now
}
