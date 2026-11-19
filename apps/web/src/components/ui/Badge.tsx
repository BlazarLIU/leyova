import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

/**
 * Badge — 语义标签。默认使用方形微圆角（4px），避免全站胶囊化。
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.02em]',
  {
    variants: {
      variant: {
        success: 'border-orbit-success/25 bg-orbit-success/10 text-[#15803D] dark:text-emerald-400',
        warning: 'border-orbit-warning/30 bg-orbit-warning/12 text-[#A16207] dark:text-amber-400',
        danger:  'border-orbit-danger/25 bg-orbit-danger/10 text-[#B91C1C] dark:text-red-400',
        info:    'border-orbit-info/25 bg-orbit-info/10 text-[#1D4ED8] dark:text-blue-400',
        primary: 'border-orbit-primary/25 bg-orbit-primary/10 text-orbit-primary dark:text-orbit-primary-light',
        accent:  'border-orbit-accent-deep/40 bg-orbit-accent/35 text-[#14532D] dark:bg-orbit-accent/18 dark:text-orbit-accent',
        neutral: 'border-orbit-border bg-orbit-surface2 text-[var(--text-muted)]',
        ink:     'border-orbit-ink bg-orbit-ink text-orbit-snow',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 flex-shrink-0 rounded-full',
            {
              success: 'bg-orbit-success',
              warning: 'bg-orbit-warning',
              danger: 'bg-orbit-danger',
              info: 'bg-orbit-info',
              primary: 'bg-orbit-primary',
              accent: 'bg-orbit-accent-deep',
              neutral: 'bg-[var(--text-subtle)]',
              ink: 'bg-orbit-accent',
            }[variant ?? 'neutral']
          )}
        />
      )}
      {children}
    </span>
  )
}
