import { useEffect, useState } from 'react'
import { lastPipError, PipPortal, pipSupported, usePip } from './pip'

const KEY = 'nf-pip-spike'
type Saved = { startedAt: number; pausedAt: number | null; pausedTotal: number } | null
const load = (): Saved => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved
  } catch {
    return null
  }
}
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Dev-only (#/spike-pip): exercises the Document PiP timer and its recovery cases by hand. */
export function PipSpikePage() {
  const [t, setT] = useState<Saved>(load)
  const [now, setNow] = useState(() => Date.now())
  const [log, setLog] = useState<string[]>([])
  const pip = usePip()
  const note = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${m}`, ...l].slice(0, 12))

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(t))
  }, [t])
  useEffect(() => {
    note(`page loaded; pip window present: ${pip.win !== null}; supported: ${pipSupported()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // elapsed is derived from timestamps, never counted by ticks
  const elapsed = t ? ((t.pausedAt ?? now) - t.startedAt - t.pausedTotal) / 1000 : 0
  const paused = t?.pausedAt != null

  const view = (
    <div style={{ font: '600 14px Inter Variable, sans-serif', padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
      <strong style={{ fontSize: 40, fontVariantNumeric: 'tabular-nums' }} data-testid="pip-time">{fmt(elapsed)}</strong>
      <button type="button" onClick={() => toggle()}>{paused ? 'Resume' : 'Pause'}</button>
    </div>
  )

  function start() {
    setT({ startedAt: Date.now(), pausedAt: null, pausedTotal: 0 })
    note('started')
  }
  function toggle() {
    setT((s) => {
      if (!s) return s
      return s.pausedAt == null
        ? { ...s, pausedAt: Date.now() }
        : { ...s, pausedTotal: s.pausedTotal + (Date.now() - s.pausedAt), pausedAt: null }
    })
  }
  async function openPip() {
    const w = await pip.open({ width: 300, height: 130 })
    note(w ? 'PiP opened' : `PiP refused: ${lastPipError}`)
    w?.addEventListener('pagehide', () => note('PiP closed (timer keeps running in the page)'))
  }

  return (
    <main className="mx-auto max-w-lg space-y-3 p-6">
      <h1 className="text-xl font-bold">PiP timer spike</h1>
      <p>Supported: <b>{String(pipSupported())}</b> · PiP open: <b>{String(pip.win !== null)}</b></p>
      <p className="text-5xl font-extrabold tabular" data-testid="main-time">{fmt(elapsed)}</p>
      <div className="flex gap-2">
        <button type="button" onClick={start} className="rounded-control border-[1.5px] border-border px-3 py-1">Start</button>
        <button type="button" onClick={toggle} className="rounded-control border-[1.5px] border-border px-3 py-1">{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" onClick={() => void openPip()} className="rounded-control border-[1.5px] border-border px-3 py-1">Open floating timer</button>
        <button type="button" onClick={pip.close} className="rounded-control border-[1.5px] border-border px-3 py-1">Close it</button>
      </div>
      <ul className="text-xs text-muted">{log.map((l) => <li key={l}>{l}</li>)}</ul>
      <PipPortal win={pip.win}>{view}</PipPortal>
    </main>
  )
}
