export type EstimateParse = { ok: true; minutes: number | null } | { ok: false }

/** "45", "45m", "1h", "1.5h", "1h30", "1h 30m" → minutes. Empty clears the estimate. */
export function parseEstimate(input: string): EstimateParse {
  const s = input.trim().toLowerCase()
  if (s === '') return { ok: true, minutes: null }
  let m = /^(\d+)\s*(?:m|min|mins)?$/.exec(s)
  if (m) return { ok: true, minutes: Number(m[1]) }
  m = /^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?$/.exec(s)
  if (m) return { ok: true, minutes: Math.round(Number(m[1]) * 60) }
  m = /^(\d+)\s*h\s*(\d+)\s*(?:m|min|mins)?$/.exec(s)
  if (m) return { ok: true, minutes: Number(m[1]) * 60 + Number(m[2]) }
  return { ok: false }
}

export const formatEstimateInput = (minutes: number | null) => (minutes == null ? '' : `${minutes}m`)
