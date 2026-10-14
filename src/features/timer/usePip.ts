import { useCallback, useEffect, useState } from 'react'

/** Minimal typing for the Document Picture-in-Picture API (Chromium only). */
interface DocumentPiP {
  window: Window | null
  requestWindow(options?: { width?: number; height?: number; disallowReturnToOpener?: boolean }): Promise<Window>
}
const api = (): DocumentPiP | undefined =>
  typeof window !== 'undefined' && 'documentPictureInPicture' in window
    ? (window as unknown as { documentPictureInPicture: DocumentPiP }).documentPictureInPicture
    : undefined

/** Feature detection only, never user-agent sniffing. */
export const pipSupported = () => api() !== undefined

/** Copy the app's styles into the PiP document (it starts empty). */
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules, (r) => r.cssText).join('\n')
      const style = target.createElement('style')
      style.textContent = css
      target.head.append(style)
    } catch {
      // Cross-origin sheet: link it instead.
      if (sheet.href) {
        const link = target.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        target.head.append(link)
      }
    }
  }
  const html = document.documentElement
  target.documentElement.className = html.className
  target.documentElement.lang = html.lang
  target.documentElement.dir = html.dir
}

/** Why the last open() failed (for diagnostics and the fallback message). */
export let lastPipError: string | null = null

export interface PipState {
  win: Window | null
  /** Must be called from a user gesture (click / key). Resolves to null if unsupported or refused. */
  open: (size: { width: number; height: number }) => Promise<Window | null>
  close: () => void
}

/**
 * Owns at most one PiP window. Closing it (by the user, a refresh, or navigation) is a normal
 * event: the timer lives in the main page, so nothing is lost.
 */
export function usePip(): PipState {
  const [win, setWin] = useState<Window | null>(() => api()?.window ?? null)

  const open = useCallback(async (size: { width: number; height: number }) => {
    const pip = api()
    if (!pip) return null
    try {
      const w = pip.window ?? (await pip.requestWindow(size))
      if (w !== pip.window || !w.document.head.querySelector('style, link')) copyStyles(w.document)
      w.addEventListener('pagehide', () => setWin(null), { once: true })
      setWin(w)
      return w
    } catch (e) {
      lastPipError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      return null // refused: no user gesture, blocked by the browser, or already closing
    }
  }, [])

  const close = useCallback(() => {
    api()?.window?.close()
    setWin(null)
  }, [])

  // Keep the PiP window's theme and direction in step with the main page.
  useEffect(() => {
    if (!win) return
    const sync = () => {
      const html = document.documentElement
      win.document.documentElement.className = html.className
      win.document.documentElement.lang = html.lang
      win.document.documentElement.dir = html.dir
    }
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'lang', 'dir'] })
    return () => obs.disconnect()
  }, [win])

  return { win, open, close }
}

