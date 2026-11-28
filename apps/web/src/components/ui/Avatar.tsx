import { cn } from '@/utils/cn'

const sizeClasses = {
  xs:  'w-6 h-6 text-[10px]',
  sm:  'w-7 h-7 text-xs',
  md:  'w-8 h-8 text-xs',
  lg:  'w-10 h-10 text-sm',
  xl:  'w-12 h-12 text-sm',
  '2xl': 'w-16 h-16 text-lg',
}

/* 品牌头像色板：按首字母散列，深底配雪白字、亮底配墨色字 */
const tones = [
  'bg-orbit-ink text-orbit-snow',
  'bg-orbit-primary text-orbit-snow',
  'bg-orbit-primary-dark text-orbit-snow',
  'bg-orbit-info text-orbit-snow',
  'bg-orbit-success text-orbit-ink',
  'bg-orbit-accent text-orbit-ink',
  'bg-orbit-warning text-orbit-ink',
]

function getTone(initials: string) {
  const first = (initials?.[0] ?? 'A').toUpperCase()
  return tones[(first.codePointAt(0) ?? 65) % tones.length]
}

export interface AvatarProps {
  src?: string
  alt?: string
  initials?: string
  size?: keyof typeof sizeClasses
  className?: string
  online?: boolean
}

export function Avatar({ src, alt, initials = '?', size = 'md', className, online }: AvatarProps) {
  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cn('rounded-full object-cover ring-2 ring-orbit-border', sizeClasses[size])}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full font-semibold ring-2 ring-orbit-border',
            sizeClasses[size],
            getTone(initials)
          )}
        >
          {initials.slice(0, 2).toUpperCase()}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-orbit-surface',
            online ? 'bg-orbit-success' : 'bg-[var(--text-subtle)]'
          )}
        />
      )}
    </div>
  )
}

export function AvatarGroup({ avatars, max = 4 }: { avatars: { initials: string; src?: string }[]; max?: number }) {
  const visible = avatars.slice(0, max)
  const overflow = avatars.length - max

  return (
    <div className="flex -space-x-2">
      {visible.map((a, i) => (
        <Avatar key={i} initials={a.initials} src={a.src} size="sm" className="ring-2 ring-orbit-surface" />
      ))}
      {overflow > 0 && (
        <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border border-orbit-border bg-orbit-surface3 text-[10px] font-medium text-[var(--text-muted)]">
          +{overflow}
        </div>
      )}
    </div>
  )
}
