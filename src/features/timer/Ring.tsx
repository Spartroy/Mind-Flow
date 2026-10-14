import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Progress ring. `fraction` 0..1; `tone` picks the arc colour (coral is for overtime only). */
export function Ring({
  fraction, tone = 'primary', size = 280, stroke = 20, children, className,
}: { fraction: number; tone?: 'primary' | 'coral' | 'sun'; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraction))
  const color = tone === 'coral' ? 'var(--coral)' : tone === 'sun' ? 'var(--sun)' : 'var(--primary)'
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 rtl:scale-x-[-1]" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - f)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
