import { cn } from '@/utils/cn'

/**
 * Leyova 品牌标识
 *
 * 素材全部来自官方 Logo 文件，仅在深/浅色主题间切换不同官方版本：
 *  - 浅色：官方字标（墨黑文字 + 橙/绿图形）
 *  - 深色：官方反白字标（同一图形，文字转雪白）
 *
 * 通过纯 CSS（dark:hidden / hidden dark:block）做切换，避免 JS 测量与首屏闪烁。
 */
export type BrandLogoVariant = 'full' | 'mark'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  /** mark 的图标边长；full 模式下为字标高度（px） */
  size?: number
  /** 强制使用深底反白版本（用于始终深色的橙红/墨黑版块） */
  inverted?: boolean
  className?: string
}

export function BrandLogo({ variant = 'full', size = 28, inverted = false, className }: BrandLogoProps) {
  if (variant === 'mark') {
    return (
      <span
        className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        <img
          src={inverted ? '/brand/mark-dark.png' : '/brand/mark-light.png'}
          alt="Leyova"
          width={size}
          height={size}
          className={cn('h-full w-full object-contain', !inverted && 'dark:hidden')}
        />
        {!inverted && (
          <img
            src="/brand/mark-dark.png"
            alt="Leyova"
            width={size}
            height={size}
            className="hidden h-full w-full object-contain dark:block"
          />
        )}
      </span>
    )
  }

  if (inverted) {
    return (
      <span className={cn('inline-flex items-center', className)} style={{ gap: Math.round(size * 0.3) }}>
        <img
          src="/brand/mark-dark.png"
          alt="Leyova"
          className="object-contain"
          style={{ height: size, width: size }}
        />
        <span
          className="font-extrabold leading-none tracking-[-0.04em] text-white"
          style={{ fontSize: Math.round(size * 0.78) }}
        >
          Leyova
        </span>
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center', className)}>
      {/* 浅色：官方完整字标 */}
      <img
        src="/brand/leyova-primary-logo.png"
        alt="Leyova"
        className="w-auto object-contain dark:hidden"
        style={{ height: size }}
      />
      {/* 深色：官方反白字标 */}
      <img
        src="/brand/leyova-primary-logo-dark.png"
        alt="Leyova"
        className="hidden w-auto object-contain dark:block"
        style={{ height: size }}
      />
    </span>
  )
}
