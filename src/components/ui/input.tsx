import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, dir = 'auto', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      dir={dir}
      className={cn(
        'w-full rounded-input border-[1.5px] border-border bg-surface px-3 py-2 text-start text-sm text-fg placeholder:text-muted',
        className,
      )}
      {...props}
    />
  )
}
