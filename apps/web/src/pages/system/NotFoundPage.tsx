import { Link, useLocation } from 'react-router-dom'
import { Compass, Home, ArrowLeft } from 'lucide-react'

/**
 * 全局 404 兜底页（P0-2）
 *
 * 背景：App.tsx 原先没有 `path="*"` catch-all，任何未匹配 URL（旧书签、已下线平台
 * 的 /shop/jd/* /shop/pdd/*、拼写错误）都会让 <Routes> 渲染 null → 整页白屏。
 * 本页挂在 Layout 内，保证未匹配时仍有侧边栏与返回入口。
 */
export function NotFoundPage() {
  const location = useLocation()

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 min-h-[60vh]">
      <div className="max-w-md w-full rounded-2xl border border-orbit-border bg-orbit-surface p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-orbit-primary/10 border border-orbit-primary/30 flex items-center justify-center text-orbit-primary-light">
          <Compass className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-widest text-orbit-primary-light bg-orbit-primary/10 border border-orbit-primary/20">
            404 · Page Not Found
          </span>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">这个页面不存在</h2>
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            地址 <code className="text-[var(--text-secondary)] break-all">{location.pathname}</code> 未匹配到任何页面。
            可能是旧链接、已下线的平台页面，或地址输入有误。
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orbit-primary hover:bg-orbit-primary-light text-white text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>回到首页</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orbit-border bg-white/5 hover:bg-white/10 text-sm text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回上一页</span>
          </button>
        </div>
      </div>
    </div>
  )
}
