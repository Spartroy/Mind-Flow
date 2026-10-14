import { act, render, renderHook, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { TimerMini } from './TimerMini'
import { lastPipError, pipSupported, usePip } from './usePip'

type PipApi = { window: Window | null; requestWindow: (o?: unknown) => Promise<Window> }
const setApi = (api: PipApi | undefined) => {
  if (api) Object.defineProperty(window, 'documentPictureInPicture', { value: api, configurable: true })
  else delete (window as unknown as Record<string, unknown>).documentPictureInPicture
}
afterEach(() => setApi(undefined))

describe('Document PiP (feature-detected, never user-agent sniffed)', () => {
  it('reports unsupported when the API is absent and open() resolves to null', async () => {
    setApi(undefined)
    expect(pipSupported()).toBe(false)
    const { result } = renderHook(() => usePip())
    let w: Window | null = {} as Window
    await act(async () => {
      w = await result.current.open({ width: 300, height: 130 })
    })
    expect(w).toBeNull()
  })

  it('falls back when the API exists but the browser refuses the window (seen in the embedded Chromium)', async () => {
    setApi({ window: null, requestWindow: () => Promise.reject(new DOMException('Internal error: no window', 'InvalidStateError')) })
    expect(pipSupported()).toBe(true)
    const { result } = renderHook(() => usePip())
    let w: Window | null = {} as Window
    await act(async () => {
      w = await result.current.open({ width: 300, height: 130 })
    })
    expect(w).toBeNull()
    expect(lastPipError).toContain('InvalidStateError')
    expect(result.current.win).toBeNull()
  })

  it('opens a window, copies styles and theme, and clears state when the window is closed', async () => {
    const pipDoc = document.implementation.createHTMLDocument('pip')
    const listeners: Record<string, () => void> = {}
    const fakeWin = {
      document: pipDoc,
      addEventListener: (type: string, fn: () => void) => void (listeners[type] = fn),
      close: vi.fn(),
    } as unknown as Window
    const api: PipApi = { window: null, requestWindow: vi.fn(async () => (api.window = fakeWin)) }
    setApi(api)
    document.documentElement.className = 'dark'
    const { result } = renderHook(() => usePip())
    await act(async () => {
      await result.current.open({ width: 300, height: 130 })
    })
    expect(api.requestWindow).toHaveBeenCalledWith({ width: 300, height: 130 })
    expect(result.current.win).toBe(fakeWin)
    expect(pipDoc.documentElement.className).toBe('dark')
    // The user closes the floating window: the page just notes it, nothing else breaks.
    act(() => {
      api.window = null
      listeners.pagehide()
    })
    expect(result.current.win).toBeNull()
  })
})

describe('TimerMini', () => {
  const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
  const noop = () => {}

  it('shows the clock, and a + sign with coral styling when over the estimate', () => {
    wrap(<TimerMini title="تحضير Networks" seconds={258} overtime paused={false} fraction={1} onToggle={noop} onFinish={noop} />)
    const clock = screen.getByText('+04:18')
    expect(clock.className).toContain('text-coral')
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
  })

  it('offers resume when paused, and a compact micro layout', () => {
    wrap(<TimerMini title="x" seconds={1662} overtime={false} paused fraction={0.5} compact onToggle={noop} onFinish={noop} />)
    expect(screen.getByText('27:42')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finish/i })).toBeNull()
  })
})
