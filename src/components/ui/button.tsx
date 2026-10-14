import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-control border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        // "Raised" primary: darker 3px bottom edge, as in the design system.
        primary:
          'border-primary bg-primary text-primary-fg shadow-[0_3px_0_var(--primary-edge)] hover:bg-primary-hover active:translate-y-px active:shadow-[0_2px_0_var(--primary-edge)]',
        outline: 'border-border bg-surface text-fg hover:bg-surface-muted',
        ghost: 'border-transparent bg-transparent text-primary hover:bg-surface-muted',
        danger: 'border-coral bg-coral-soft text-coral hover:brightness-95',
        sun: 'border-sun bg-sun-soft text-fg hover:brightness-95',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant }), className)} {...props} />
}
