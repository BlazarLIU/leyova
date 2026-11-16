import * as LabelPrimitive from '@radix-ui/react-label'
import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Label> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Label
      ref={ref}
      className={cn(
        'text-xs font-medium text-slate-300 select-none',
        className
      )}
      {...props}
    />
  )
)

Label.displayName = LabelPrimitive.Label.displayName