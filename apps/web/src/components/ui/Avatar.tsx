import { cn } from '@/utils/cn'

const sizeClasses = {
  xs:  'w-6 h-6 text-[10px]',
  sm:  'w-7 h-7 text-xs',
  md:  'w-8 h-8 text-xs',
  lg:  'w-10 h-10 text-sm',
  xl:  'w-12 h-12 text-sm',
  '2xl': 'w-16 h-16 text-lg',
}

const colorMap: Record<string, string> = {
  A: 'bg-orbit-ink',
  B: 'bg-orbit-primary',
  C: 'bg-[#2F6B33]',
  D: 'bg-[#0F7A2E]',
  E: 'bg-orbit-primary-dark',
  F: 'bg-[#5A2E28]',
  G: 'bg-[#8A5518]',
  H: 'bg-[#3A3A37]',
  I: 'bg-[#1F4D3A]',
  J: 'bg-[#0F7A2E]',
  K: 'bg-[#4A4A45]',
  L: 'bg-[#7A2C1C]',
  M: 'bg-[#7A5A12]',
  N: 'bg-[#2C5A4A]',
  O: 'bg-orbit-primary',
  P: 'bg-[#33332F]',
  Q: 'bg-[#24504A]',
  R: 'bg-[#7A2C1C]',
  S: 'bg-[#2A4A5A]',
  T: 'bg-[#2F6B33]',
  U: 'bg-[#3A3A37]',
  V: 'bg-[#0F7A2E]',
  W: 'bg-[#4A3A52]',
  X: 'bg-[#3A3A37]',
  Y: 'bg-[#8A5518]',
  Z: 'bg-[#4A4A45]',
}

function getGradient(initials: string) {
  const first = (initials?.[0] ?? 'A').toUpperCase()
  return colorMap[first] ?? 'bg-orbit-ink'
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
            'flex items-center justify-center rounded-full font-semibold text-orbit-snow ring-2 ring-orbit-border',
            sizeClasses[size],
            getGradient(initials)
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
