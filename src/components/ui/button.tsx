import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-control border-[1.5px] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg border-primary hover:bg-primary-hover',
        outline: 'bg-surface text-fg border-border hover:bg-surface-muted',
        ghost: 'bg-transparent text-fg border-transparent hover:bg-surface-muted',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant }), className)} {...props} />
}
