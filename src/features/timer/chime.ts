/** A soft two-note chime for session and break ends. Silent when the browser has no audio or blocks it. */
export function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const start = ctx.currentTime
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start + i * 0.16)
      gain.gain.exponentialRampToValueAtTime(0.12, start + i * 0.16 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.16 + 0.45)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + i * 0.16)
      osc.stop(start + i * 0.16 + 0.5)
    })
    setTimeout(() => void ctx.close(), 1200)
  } catch {
    /* audio is optional */
  }
}
