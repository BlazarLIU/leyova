import { cn } from '@/utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean
  gradient?: boolean
  /** 品牌描边强调：用于重点数据 / AI 卡片 */
  tone?: 'default' | 'ink' | 'accent' | 'primary'
  interactive?: boolean
}

const toneMap: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'border-orbit-border bg-orbit-surface',
  ink: 'border-orbit-ink/12 bg-orbit-ink text-orbit-snow',
  accent: 'border-orbit-accent/70 bg-orbit-accent text-orbit-ink',
  primary: 'border-orbit-primary/25 bg-orbit-surface',
}

export function Card({ className, glass, gradient, tone = 'default', interactive, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        toneMap[tone],
        interactive && 'hover:border-orbit-border2 hover:bg-orbit-surface2/60 cursor-pointer',
        glass && 'glass',
        gradient && 'gradient-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  subtitle?: string
  actions?: React.ReactNode
  /** 标题前的品牌小竖条 */
  marker?: boolean
}

export function CardHeader({ title, subtitle, actions, marker = true, className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between px-5 pt-5', className)} {...props}>
      {(title || subtitle) ? (
        <div className="min-w-0">
          {title && (
            <h3 className="flex items-center gap-2 text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
              {marker && <span className="h-3 w-[3px] shrink-0 rounded-full bg-orbit-primary" />}
              {title}
            </h3>
          )}
          {subtitle && <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">{subtitle}</p>}
        </div>
      ) : children}
      {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-2 border-t border-orbit-border px-5 pb-5 pt-4', className)} {...props}>
      {children}
    </div>
  )
}
