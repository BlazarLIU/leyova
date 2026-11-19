import * as LabelPrimitive from '@radix-ui/react-label'
import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Label> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Label
      ref={ref}
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)] select-none',
        className
      )}
      {...props}
    />
  )
)

Label.displayName = LabelPrimitive.Label.displayName