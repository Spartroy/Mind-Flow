import { create } from 'zustand'

export type BoardView = 'board' | 'blitz' | 'plan'
const KEY = 'nf-board-view'
const VIEWS: BoardView[] = ['board', 'blitz', 'plan']

const read = (): BoardView => {
  try {
    const v = localStorage.getItem(KEY) as BoardView | null
    return v && VIEWS.includes(v) ? v : 'board'
  } catch {
    return 'board'
  }
}

/** Which board layout is showing: plain Board, Blitz (today lane + play buttons) or Plan (queue panel). */
export const useBoardView = create<{ view: BoardView; setView: (v: BoardView) => void }>((set) => ({
  view: read(),
  setView: (view) => {
    try {
      localStorage.setItem(KEY, view)
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
    set({ view })
  },
}))
