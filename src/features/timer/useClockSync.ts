import { useEffect } from 'react'
import { syncClock } from './clock'

const REFRESH_MS = 5 * 60_000

/** Measure the database clock offset on mount and every few minutes . */
export function useClockSync() {
  useEffect(() => {
    void syncClock()
    const id = setInterval(() => void syncClock(), REFRESH_MS)
    return () => clearInterval(id)
  }, [])
}

