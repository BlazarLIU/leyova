import { BrandLogo } from '@/components/brand/BrandLogo'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-2">
      <div className="flex flex-col items-center justify-between gap-1 text-[11px] text-[var(--text-subtle)] sm:flex-row">
        <p className="flex items-center gap-1.5">
          <BrandLogo variant="mark" size={12} />
          <span>© {currentYear} Leyova · 全渠道电商数字化运营中枢</span>
        </p>
        <p className="hidden sm:block">AGPL-3.0 License</p>
      </div>
    </footer>
  )
}
