import { create } from 'zustand'
import { emptyFilter, type Filter } from './logic'

/** Board filter lives in a store so the sidebar's tag list can drive it. */
export const useFilter = create<{ filter: Filter; setFilter: (f: Filter) => void }>((set) => ({
  filter: emptyFilter,
  setFilter: (filter) => set({ filter }),
}))
