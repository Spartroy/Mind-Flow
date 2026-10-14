import { create } from 'zustand'

const KEY = 'nf-recent-cards'
const MAX = 8

const read = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

/** Most recently opened card ids, newest first; kept on this device. */
export const useRecents = create<{ ids: string[]; push: (id: string) => void }>((set, get) => ({
  ids: read(),
  push: (id) => {
    const ids = [id, ...get().ids.filter((x) => x !== id)].slice(0, MAX)
    try {
      localStorage.setItem(KEY, JSON.stringify(ids))
    } catch {
      /* not persisted */
    }
    set({ ids })
  },
}))

export const usePalette = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
