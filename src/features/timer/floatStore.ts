import { create } from 'zustand'

/**
 * Bridge between buttons (which have the user gesture Document PiP needs) and the host that owns
 * the PiP window. `open` must be called synchronously from a click handler.
 */
export const useFloat = create<{
  wanted: boolean
  refused: boolean
  open: (() => void) | null
  close: (() => void) | null
  set: (p: Partial<{ wanted: boolean; refused: boolean; open: (() => void) | null; close: (() => void) | null }>) => void
}>((set) => ({
  wanted: false,
  refused: false,
  open: null,
  close: null,
  set: (p) => set(p),
}))
