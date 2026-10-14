import { cn } from '@/lib/utils'

/** On/off toggle (role=switch) following the design's pill switch. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full border-[1.5px] transition-colors', checked ? 'border-primary bg-primary' : 'border-border bg-surface-muted')}
    >
      <span
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-surface shadow transition-[inset-inline-start] duration-150',
          checked ? 'start-[1.5rem]' : 'start-0.5',
        )}
      />
    </button>
  )
}
