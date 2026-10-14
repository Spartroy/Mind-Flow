import { create } from 'zustand'
import type { TimeSession } from '@/features/board/types'

/** The session that was just finished: the finish dialog shows while this is set. */
export const useFinished = create<{ finished: TimeSession | null; set: (s: TimeSession | null) => void }>((set) => ({
  finished: null,
  set: (finished) => set({ finished }),
}))
