import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  hint?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefix, suffix, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]"
          >
            {label}
          </label>
        )}
        <div className={cn(
          'flex h-10 items-center gap-2 rounded-[8px] border bg-orbit-surface px-3 text-sm transition-colors',
          'border-orbit-border hover:border-orbit-border2',
          'focus-within:border-orbit-primary focus-within:ring-2 focus-within:ring-orbit-primary/15',
          error && 'border-orbit-danger focus-within:border-orbit-danger focus-within:ring-orbit-danger/15',
          props.disabled && 'cursor-not-allowed opacity-50',
        )}>
          {prefix && <span className="flex-shrink-0 text-[var(--text-subtle)]">{prefix}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'min-w-0 flex-1 bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-subtle)]',
              props.disabled && 'cursor-not-allowed',
              className
            )}
            {...props}
          />
          {suffix && <span className="flex-shrink-0 text-[var(--text-subtle)]">{suffix}</span>}
        </div>
        {(error || hint) && (
          <p className={cn('mt-1.5 text-[11.5px]', error ? 'text-orbit-danger' : 'text-[var(--text-muted)]')}>
            {error ?? hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
