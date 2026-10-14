import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useBoard } from '@/features/board/hooks'
import { useNow } from '@/features/timer/clock'
import { formatClock, formatDuration } from '@/features/timer/core'
import { navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import {
  estimateRows, focusByBucket, kpis, rangeFor, sessionLog, sessionsIn, shiftRange, startOfDay, timeByTag, WITHIN_MIN,
  type Range, type RangeKind,
} from './logic'

const mins = (sec: number) => Math.round(sec / 60)

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const { data } = useBoard()
  const now = useNow(60_000)
  const [kind, setKind] = useState<RangeKind>('week')
  const [offset, setOffset] = useState(0)
  const weekStart = data?.settings.week_start ?? 0

  const range = useMemo(() => {
    const base = rangeFor(kind, new Date(now), weekStart)
    return offset ? shiftRange(base, offset, weekStart) : base
  }, [kind, offset, weekStart, now])
  const prev = useMemo(() => shiftRange(range, -1, weekStart), [range, weekStart])

  if (!data) return null
  const sessions = sessionsIn(data.sessions, range)
  const k = kpis(data, range, prev, now)
  const perBucket = focusByBucket(data.sessions, range, now)
  const shares = timeByTag(data, range, now)
  const rows = estimateRows(data, range, now)
  const log = sessionLog(data, range, now)

  const fmtDate = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(i18n.language, o).format(d)
  const lastDay = new Date(range.end.getTime() - 1)
  const rangeLabel =
    kind === 'day' ? fmtDate(range.start, { weekday: 'long', day: 'numeric', month: 'long' })
    : kind === 'week' ? `${fmtDate(range.start, { day: 'numeric', month: 'short' })} – ${fmtDate(lastDay, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmtDate(range.start, { month: 'long', year: 'numeric' })

  const delta = Math.round((k.focusSec - k.prevFocusSec) / 60)
  const dayWord = (d: Date) => {
    const diff = Math.round((startOfDay(new Date(now)).getTime() - startOfDay(d).getTime()) / 86_400_000)
    return diff === 0 ? t('reports.today') : diff === 1 ? t('reports.yesterday') : fmtDate(d, { weekday: 'short' })
  }
  const clock = (iso: string) => fmtDate(new Date(iso), { hour: '2-digit', minute: '2-digit', hour12: false })

  const tile = 'rounded-card border-[1.5px] border-border bg-surface p-5 shadow-[var(--shadow-raised)]'
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6 pb-28">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold">{t('nav.reports')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t('reports.range')} className="flex rounded-control border-[1.5px] border-border bg-surface-muted p-1">
              {(['day', 'week', 'month'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={kind === r}
                  onClick={() => {
                    setKind(r)
                    setOffset(0)
                  }}
                  className={cn('rounded-[10px] px-4 py-1.5 text-sm font-bold', kind === r ? 'bg-primary text-primary-fg' : 'text-fg-2')}
                >
                  {t(`reports.${r}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-control border-[1.5px] border-border bg-surface">
              <button type="button" aria-label={t('reports.previous')} onClick={() => setOffset((o) => o - 1)} className="grid size-9 place-items-center rounded-s-control hover:bg-surface-muted">
                <ChevronLeft size={16} strokeWidth={2} aria-hidden className="rtl:rotate-180" />
              </button>
              <button type="button" onClick={() => setOffset(0)} title={t('reports.thisPeriod')} className="px-2 text-sm font-bold tabular" aria-live="polite">{rangeLabel}</button>
              <button type="button" aria-label={t('reports.next')} disabled={offset >= 0} onClick={() => setOffset((o) => o + 1)} className="grid size-9 place-items-center rounded-e-control hover:bg-surface-muted disabled:opacity-40">
                <ChevronRight size={16} strokeWidth={2} aria-hidden className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </header>

        {sessions.length === 0 ? (
          <section className="grid place-items-center rounded-card border-[1.5px] border-dashed border-border px-6 py-20 text-center">
            <svg width="130" height="100" viewBox="0 0 130 100" aria-hidden>
              <rect x="6" y="48" width="26" height="40" rx="9" fill="var(--tag-5)" />
              <rect x="38" y="30" width="26" height="58" rx="9" fill="var(--sun)" />
              <rect x="70" y="8" width="26" height="80" rx="9" fill="var(--primary)" />
              <rect x="102" y="38" width="22" height="50" rx="9" fill="var(--tag-2)" />
            </svg>
            <h2 className="mt-4 text-xl font-extrabold">{t('reports.emptyTitle')}</h2>
            <p className="mt-1 max-w-md text-sm text-fg-2" dir="auto">{t('reports.emptyBody')}</p>
            <Button className="mt-4" onClick={() => navigate('#/today')}>{t('reports.startFirst')}</Button>
          </section>
        ) : (
          <>
            <section aria-label={t('reports.kpis')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={tile}>
                <p className="text-sm font-semibold text-fg-2">{t('reports.focusTime')}</p>
                <p className="mt-1 text-3xl font-extrabold tabular">{formatDuration(mins(k.focusSec))}</p>
                <p className={cn('mt-1 text-xs font-bold', delta >= 0 ? 'text-success' : 'text-coral')}>
                  {delta === 0 ? t('reports.sameAsLast', { period: t(`reports.last_${kind}`) }) : `${delta > 0 ? '+' : '−'}${formatDuration(Math.abs(delta))} ${t('reports.vs', { period: t(`reports.last_${kind}`) })}`}
                </p>
              </div>
              <div className={tile}>
                <p className="text-sm font-semibold text-fg-2">{t('reports.finished')}</p>
                <p className="mt-1 text-3xl font-extrabold tabular">{k.finished}</p>
                <p className="mt-1 text-xs font-bold text-success">{t('reports.perDay', { n: k.perDay.toFixed(1) })}</p>
              </div>
              <div className={tile}>
                <p className="text-sm font-semibold text-fg-2">{t('reports.accuracy')}</p>
                <p className="mt-1 text-3xl font-extrabold tabular">{k.accuracy ? `${k.accuracy.pct}%` : '—'}</p>
                <p className="mt-1 text-xs font-bold text-success">
                  {k.accuracy ? t('reports.within', { min: WITHIN_MIN, within: k.accuracy.within, of: k.accuracy.of }) : t('reports.noEstimates')}
                </p>
              </div>
              <div className={tile}>
                <p className="text-sm font-semibold text-fg-2">{t('reports.overEstimate')}</p>
                <p className="mt-1 text-3xl font-extrabold tabular">{t('reports.cardsCount', { count: k.over.count })}</p>
                <p className={cn('mt-1 text-xs font-bold', k.over.count ? 'text-coral' : 'text-success')} dir="auto">
                  {k.over.count ? (k.over.topTag ? t('reports.tagRunsLong', { tag: k.over.topTag }) : t('reports.runLong')) : t('reports.onTrack')}
                </p>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <section className={tile}>
                <h2 className="text-lg font-extrabold">{t('reports.perDayTitle')}</h2>
                <BarChart range={range} values={perBucket} labelFor={(d) => (range.kind === 'day' ? String(d.getHours()) : range.kind === 'week' ? fmtDate(d, { weekday: 'short' }) : String(d.getDate()))} />
              </section>
              <section className={tile}>
                <h2 className="text-lg font-extrabold">{t('reports.byTag')}</h2>
                <Donut shares={shares} total={mins(k.focusSec)} />
              </section>
            </div>

            <section className={tile}>
              <h2 className="text-lg font-extrabold">{t('reports.estVsActual')}</h2>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted" dir="auto">{t('reports.noEstimates')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="mt-3 w-full text-sm">
                    <thead>
                      <tr className="border-b-[1.5px] border-border text-xs text-muted">
                        <th scope="col" className="py-2 text-start font-bold">{t('reports.card')}</th>
                        <th scope="col" className="py-2 text-start font-bold">{t('reports.estimate')}</th>
                        <th scope="col" className="py-2 text-start font-bold">{t('reports.actual')}</th>
                        <th scope="col" className="py-2 text-end font-bold">{t('reports.difference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.card.id} className="border-b-[1.5px] border-border last:border-b-0">
                          <td dir="auto" className="py-3 pe-3 text-start font-semibold">{r.card.title || t('nav.untitled')}</td>
                          <td className="py-3 text-fg-2 tabular">{r.estimateMin}m</td>
                          <td className="py-3 text-fg-2 tabular">{r.actualMin}m</td>
                          <td className="py-3 text-end">
                            <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-bold tabular', r.long ? 'bg-coral-soft text-coral' : 'bg-success-soft text-success')}>
                              {r.diffMin > 0 ? '+' : r.diffMin < 0 ? '−' : ''}{Math.abs(r.diffMin)}m
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={tile}>
              <h2 className="text-lg font-extrabold">{t('reports.sessionLog')}</h2>
              <ul className="mt-3">
                {log.map(({ session, card, sec }) => (
                  <li key={session.id} className="flex items-baseline gap-4 border-b-[1.5px] border-border py-3 text-sm last:border-b-0">
                    <span className="w-36 shrink-0 text-xs text-muted tabular">{dayWord(new Date(session.started_at))}, {clock(session.started_at)}</span>
                    <span dir="auto" className="min-w-0 flex-1 truncate text-start font-semibold">{card?.title || t('nav.untitled')}</span>
                    <span className="font-bold tabular">{formatClock(sec)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function BarChart({ range, values, labelFor }: { range: Range; values: number[]; labelFor: (d: Date) => string }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...values)
  const dense = values.length > 12
  return (
    <div className="mt-4">
      <div className="flex h-52 items-end gap-1.5 border-b-[1.5px] border-border" role="img" aria-label={t('reports.perDayTitle')}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            {!dense && v > 0 && <span className="text-[11px] font-bold text-fg-2 tabular">{(v / 3600).toFixed(1)}h</span>}
            <div
              className="w-full max-w-12 rounded-t-[8px] bg-primary"
              style={{ height: `${(v / max) * 82}%`, minHeight: v > 0 ? 4 : 0 }}
              title={`${labelFor(range.buckets[i])}: ${formatDuration(mins(v))}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[11px] text-muted">
        {values.map((_, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center">{dense && i % 2 === 1 ? '' : labelFor(range.buckets[i])}</span>
        ))}
      </div>
      {/* the same data as text, for screen readers */}
      <table className="sr-only">
        <tbody>
          {values.map((v, i) => (
            <tr key={i}><th scope="row">{labelFor(range.buckets[i])}</th><td>{formatDuration(mins(v))}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Donut({ shares, total }: { shares: ReturnType<typeof timeByTag>; total: number }) {
  const { t } = useTranslation()
  const R = 54
  const C = 2 * Math.PI * R
  const shown = shares.slice(0, 6)
  const rest = shares.slice(6)
  const items = rest.length ? [...shown, { key: 'rest', name: t('reports.other'), colorIndex: null, sec: rest.reduce((n, s) => n + s.sec, 0), pct: rest.reduce((n, s) => n + s.pct, 0) }] : shown
  const color = (i: number | null, key: string) => (key === 'none' || key === 'rest' || i === null ? 'var(--text-muted)' : `var(--tag-${(i % 8) + 1})`)
  const offsets = items.map((_, i) => items.slice(0, i).reduce((n, s) => n + (s.pct / 100) * C, 0))
  return (
    <div className="mt-4 flex flex-wrap items-center gap-6">
      <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={t('reports.byTag')}>
        <g transform="rotate(-90 75 75)">
          {items.map((s, i) => (
            <circle key={s.key} cx="75" cy="75" r={R} fill="none" stroke={color(s.colorIndex, s.key)} strokeWidth="24" strokeDasharray={`${Math.max(0, (s.pct / 100) * C - 1.5)} ${C}`} strokeDashoffset={-offsets[i]} />
          ))}
        </g>
        <text x="75" y="81" textAnchor="middle" className="fill-current text-[18px] font-extrabold" style={{ fill: 'var(--text)' }}>{formatDuration(total)}</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {items.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-3 shrink-0 rounded-[4px]" style={{ background: color(s.colorIndex, s.key) }} aria-hidden />
            <span dir="auto" className="min-w-0 flex-1 truncate text-start font-semibold">{s.name ?? t('reports.untagged')}</span>
            <span className="font-bold tabular">{Math.round(s.pct)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
