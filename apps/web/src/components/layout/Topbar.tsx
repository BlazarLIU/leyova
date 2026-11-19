import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, Sun, Moon, X, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { useSidebar } from '@/hooks/useSidebar'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/services/api'
import { PlatformShopSelector } from '@/components/common/PlatformShopSelector'
import { GlobalSearch } from '@/components/common/GlobalSearch'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { AiOpsSessionSelector } from '@/components/layout/AiOpsSessionSelector'
import { NAV_MANIFEST } from '@/data/route-manifest'

const NAV_LABELS: Record<string, string> = Object.fromEntries(
  NAV_MANIFEST.map((e) => [e.href, e.label]),
)

/** 非导航路由（品牌门户 / 合规变更详情 / AI 运营分支）的补充标题 */
const EXTRA_ROUTE_LABELS: Record<string, string> = {
  '/ai/chat': 'AI 助手',
  '/brand-portal': '品牌方只读看板',
  '/compliance/changes': '合规变更评估',
  '/ai-ops/cockpit': '今日作战单 · AI 作战台',
  '/ai-ops/workbench': '经营诊断工作台',
  '/ai-ops/chat': 'AI助手',
  '/ai-ops/inbox': '待办审批中心',
  '/ai-ops/alerts': '实时告警流',
  '/ai-ops/session/planning': '货盘排品编辑',
  '/ai-ops/session/prompter': '提词卡与指令',
  '/ai-ops/session/live-watch': '盯盘驾驶舱',
  '/ai-ops/session/review': '单场五段复盘',
  '/ai-ops/review/overview': '复盘总览矩阵',
  '/ai-ops/review/products': '商品表现分析',
  '/ai-ops/review/short-videos': '短视频引流复盘',
  '/ai-ops/review/channels': '渠道流量复盘',
  '/ai-ops/review/funnel': '全链路转化漏斗',
  '/ai-ops/session/actions': '改进闭环追踪',
  '/ai-ops/assortment/selection': 'AI 全品类选品',
  '/ai-ops/assortment/structure': '货盘结构分析',
  '/ai-ops/assortment/prices': '价格与渠道价目',
  '/ai-ops/content/clips': '内容排产与切片',
  '/ai-ops/media/campaigns': '投放协同与熔断',
  '/ai-ops/finance/pnl': '利润与单位经济 P&L (财务专区)',
  '/ai-ops/finance/settle': '结算对账分录 (财务专区)',
  '/ai-ops/hrbp/workspace': 'HRBP 效能总览',
  '/ai-ops/people/performance': '主播效能排行',
  '/ai-ops/people/schedule-recommend': 'AI 智能排班推荐',
  '/ai-ops/governance/metrics': '22+5 指标注册字典',
  '/ai-ops/governance/cases': 'Decision Case 决策流',
  '/ai-ops/governance/knowledge': '知识库与模型中心',
}

const routeLabels: Record<string, string> = { ...NAV_LABELS, ...EXTRA_ROUTE_LABELS }

type Notification = { id: string; text: string; time: string; unread: boolean }

const NAV_MODULES: Record<string, string> = Object.fromEntries(
  NAV_MANIFEST.filter((e) => e.module).map((e) => [e.href, e.module as string]),
)

/** 非导航路由的补充模块要求 */
const EXTRA_ROUTE_MODULES: Record<string, string> = {
  '/ai/chat': 'ai',
  '/compliance/changes': 'compliance',
}

const ROUTE_MODULE_REQUIREMENTS: Record<string, string> = {
  ...NAV_MODULES,
  ...EXTRA_ROUTE_MODULES,
}

export function Topbar({ user }: { user?: { username: string; realName: string; role: string } }) {
  const { toggle: toggleSidebar } = useSidebar()
  const { theme, toggle: toggleTheme } = useTheme()
  const { isBrandViewer, hasModule } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLogout, setShowLogout] = useState(false)
  const userAreaRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(n => n.unread).length

  const searchableRoutes = Object.entries(routeLabels)
    .filter(([path]) => {
      if (isBrandViewer) return path === '/brand-portal'
      const reqMod = ROUTE_MODULE_REQUIREMENTS[path]
      return reqMod ? hasModule(reqMod) : path === '/brand-portal' && hasModule('agency')
    })
    .map(([path, label]) => ({ path, label }))

  const filteredResults = searchQuery.trim()
    ? searchableRoutes.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  useEffect(() => {
    api.get<any[]>('/api/system/alerts')
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data.map((item: any) => ({
            id: String(item.id),
            text: item.title || item.description || '',
            time: item.event_time || item.created_at || '',
            unread: item.status === 'pending' || item.status === 'new',
          })).slice(0, 10))
        }
      })
      .catch(() => { /* 静默失败 */ })
  }, [])

  const pageTitle = routeLabels[location.pathname] ?? '主页'

  // 点击外部关闭退出菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userAreaRef.current && !userAreaRef.current.contains(e.target as Node)) {
        setShowLogout(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch { /* ignore */ }
    navigate('/sign-in')
  }

  return (
    <header className="relative z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4">
      {/* Left: hamburger + breadcrumb */}
      <button
        onClick={toggleSidebar}
        className="rounded-[9px] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <BrandLogo variant="mark" size={20} className="hidden sm:inline-flex" />
        <span className="hidden text-[var(--text-subtle)] sm:inline">/</span>
        {location.pathname.startsWith('/ai-ops') && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-orbit-accent-deep/40 bg-orbit-accent/30 px-1.5 py-0.5 text-[10.5px] font-bold text-orbit-ink dark:bg-orbit-accent/15 dark:text-orbit-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-orbit-accent-deep" />
              AI 运营
            </span>
            <span className="text-[var(--text-subtle)]">/</span>
          </>
        )}
        <span className="truncate font-semibold tracking-tight text-[var(--text-primary)]">{pageTitle}</span>
      </div>

      {/* AI Ops Session Selector (when on /ai-ops) */}
      {location.pathname.startsWith('/ai-ops') && (
        <div className="ml-2 hidden sm:block">
          <AiOpsSessionSelector />
        </div>
      )}

      {/* Platform & Shop Quick Selector */}
      <div className="ml-2 hidden sm:block">
        <PlatformShopSelector />
      </div>

      {/* Global Command/Search Palette — 40px 胶囊，位于中部 */}
      {!isBrandViewer && (
        <div className="ml-1 hidden flex-1 md:flex md:max-w-[420px]">
          <GlobalSearch />
        </div>
      )}

      {/* Right: actions */}
      <div className="ml-auto flex items-center gap-0.5">
        {/* Search */}
        <button
          onClick={() => { setShowSearch(true); setSearchQuery('') }}
          className="rounded-[7px] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
        >
          <Search className="h-[17px] w-[17px]" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(o => !o)}
            className="relative rounded-[7px] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
          >
            <Bell className="h-[17px] w-[17px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-[6px] w-[6px] rounded-full bg-orbit-primary ring-2 ring-orbit-surface" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-orbit-border bg-orbit-surface shadow-[0_18px_50px_-20px_rgba(23,23,23,0.35)]"
                >
                  <div className="flex items-center justify-between border-b border-orbit-border px-4 py-3">
                    <p className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">通知</p>
                    <span className="rounded-[4px] bg-orbit-primary/10 px-1.5 py-0.5 text-[10.5px] font-bold text-orbit-primary dark:text-orbit-primary-light">
                      {unreadCount} 条未读
                    </span>
                  </div>
                  <div className="divide-y divide-orbit-border">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--hover-bg3)]',
                          n.unread && 'bg-orbit-primary/[0.04]'
                        )}
                      >
                        <div className={cn(
                          'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                          n.unread ? 'bg-orbit-primary' : 'bg-orbit-border2'
                        )} />
                        <div className="min-w-0">
                          <p className="truncate text-[12.5px] text-[var(--text-secondary)]">{n.text}</p>
                          <p className="mt-0.5 text-[10.5px] text-[var(--text-subtle)]">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-orbit-border px-4 py-2.5">
                    <button className="text-[11.5px] font-semibold text-orbit-primary hover:underline dark:text-orbit-primary-light">
                      全部标记为已读
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-[7px] p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]"
        >
          {theme === 'dark' ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
        </button>

        {/* User avatar with logout */}
        <div className="relative" ref={userAreaRef}>
          <div
            className="ml-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px] bg-orbit-primary text-[11.5px] font-extrabold text-white transition-transform hover:scale-[1.04]"
            onClick={() => setShowLogout(v => !v)}
          >
            {user?.realName?.trim().charAt(0) || user?.username?.charAt(0) || '用'}
          </div>
          <AnimatePresence>
            {showLogout && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-36"
              >
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-[8px] border border-orbit-border bg-orbit-surface px-3 py-2 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:border-orbit-danger/35 hover:text-orbit-danger"
                >
                  <LogOut className="h-4 w-4" />
                  <span>退出</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-orbit-ink/45 px-4 pt-24 backdrop-blur-[2px]"
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl overflow-hidden rounded-xl border border-orbit-border bg-orbit-surface shadow-[0_24px_70px_-24px_rgba(23,23,23,0.4)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-orbit-border px-4 py-3.5">
                <Search className="h-[18px] w-[18px] flex-shrink-0 text-[var(--text-subtle)]" />
                <input
                  autoFocus
                  type="text"
                  placeholder="搜索页面、数据、功能..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && filteredResults.length > 0) {
                      navigate(filteredResults[0].path)
                      setShowSearch(false)
                      setSearchQuery('')
                    }
                  }}
                  className="flex-1 bg-transparent text-[13.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-subtle)]"
                />
                <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-[var(--text-subtle)] hover:text-[var(--text-primary)]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto px-3 py-3">
                {searchQuery.trim() ? (
                  filteredResults.length > 0 ? (
                    <div className="space-y-0.5">
                      <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">搜索结果</p>
                      {filteredResults.map(item => (
                        <div
                          key={item.path}
                          onClick={() => { navigate(item.path); setShowSearch(false); setSearchQuery('') }}
                          className="flex cursor-pointer items-center gap-3 rounded-[7px] px-3 py-2.5 transition-colors hover:bg-[var(--hover-bg)]"
                        >
                          <span className="text-[13px] text-[var(--text-secondary)]">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">未找到匹配结果</p>
                  )
                ) : (
                  <>
                    <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">快捷入口</p>
                    <div className="space-y-0.5">
                      {searchableRoutes.slice(0, 5).map(item => (
                        <div
                          key={item.path}
                          onClick={() => { navigate(item.path); setShowSearch(false); setSearchQuery('') }}
                          className="flex cursor-pointer items-center gap-3 rounded-[7px] px-3 py-2.5 transition-colors hover:bg-[var(--hover-bg)]"
                        >
                          <span className="text-[13px] text-[var(--text-secondary)]">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}