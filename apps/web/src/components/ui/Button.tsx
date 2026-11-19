import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Leyova Button
 * - primary   : Orange Red 实心，唯一的主行动色
 * - secondary : 石墨底 + 细边框
 * - outline   : 细边框幽灵按钮
 * - ghost     : 无边框文字按钮
 * - accent    : Yellow Punk，仅用于 AI / 增长类动作
 * - destructive: 危险操作
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold transition-all duration-150 select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-orbit-bg',
    'disabled:pointer-events-none disabled:opacity-40',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-orbit-primary text-white hover:bg-orbit-primary-dark active:translate-y-[1px]',
        secondary:
          'bg-orbit-surface3 text-[var(--text-primary)] border border-orbit-border hover:border-orbit-border2 hover:bg-orbit-surface2 active:translate-y-[1px]',
        ghost:
          'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)]',
        outline:
          'border border-orbit-border text-[var(--text-secondary)] hover:border-orbit-primary/45 hover:text-orbit-primary bg-transparent',
        destructive:
          'bg-orbit-danger/10 text-orbit-danger border border-orbit-danger/25 hover:bg-orbit-danger/16',
        accent:
          'bg-orbit-accent text-orbit-ink hover:bg-orbit-accent-light active:translate-y-[1px]',
      },
      size: {
        xs: 'h-7 px-2.5 text-[11px]',
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-[13px]',
        lg: 'h-10 px-5 text-sm',
        xl: 'h-12 px-7 text-[15px]',
        icon: 'h-9 w-9',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, icon, iconPosition = 'left', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {!loading && icon && iconPosition === 'left' && (
          <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === 'right' && (
          <span className="w-4 h-4 flex items-center justify-center">{icon}</span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
