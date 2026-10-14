import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Render React children inside the PiP window. */
export function PipPortal({ win, children }: { win: Window | null; children: ReactNode }) {
  if (!win) return null
  return createPortal(children, win.document.body)
}
