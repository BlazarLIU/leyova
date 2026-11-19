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
    <header className="h-16 border-b border-orbit-border bg-orbit-surface/80 backdrop-blur-xl flex items-center px-6 gap-4 flex-shrink-0 relative z-30">
      {/* Left: hamburger + page title */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2 text-sm">
        <img src="/orbit-icon.svg" alt="logo" className="h-4 w-auto object-contain dark:invert dark:brightness-[0.85]" />
        <span className="text-slate-600">/</span>
        {location.pathname.startsWith('/ai-ops') && (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              AI 运营
            </span>
            <span className="text-slate-600">/</span>
          </>
        )}
        <span className="text-slate-200 font-medium">{pageTitle}</span>
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

      {/* Global Command/Search Palette */}
      {!isBrandViewer && (
        <div className="ml-2 hidden md:block">
          <GlobalSearch />
        </div>
      )}

      {/* Right: actions */}
      <div className="ml-auto flex items-center gap-1">
        {/* Search */}
        <button
          onClick={() => { setShowSearch(true); setSearchQuery('') }}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <Search className="w-4.5 h-4.5" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(o => !o)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors relative"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orbit-accent rounded-full ring-2 ring-orbit-surface" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-orbit-surface2 border border-orbit-border rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-orbit-border">
                    <p className="text-sm font-semibold text-slate-200">通知</p>
                    <span className="text-xs bg-orbit-primary/20 text-orbit-primary-light px-2 py-0.5 rounded-full font-medium">
                      {unreadCount} 条未读
                    </span>
                  </div>
                  <div className="divide-y divide-orbit-border">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-colors',
                          n.unread && 'bg-orbit-primary/5'
                        )}
                      >
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          n.unread ? 'bg-orbit-accent' : 'bg-orbit-border2'
                        )} />
                        <div>
                          <p className="text-sm text-slate-200">{n.text}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-orbit-border">
                    <button className="text-xs text-orbit-primary-light hover:text-orbit-accent transition-colors">
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
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>

        {/* User avatar with logout */}
        <div className="relative" ref={userAreaRef}>
          <div
            className="ml-2 w-8 h-8 rounded-full bg-gradient-to-br from-orbit-primary to-orbit-accent flex items-center justify-center text-white text-xs font-bold cursor-pointer"
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
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors bg-orbit-surface border border-orbit-border"
                >
                  <LogOut className="w-4 h-4" />
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24 px-4"
            onClick={() => setShowSearch(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-orbit-surface2 border border-orbit-border rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-orbit-border">
                <Search className="w-5 h-5 text-slate-500 flex-shrink-0" />
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
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 outline-none text-sm"
                />
                <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3 max-h-80 overflow-y-auto">
                {searchQuery.trim() ? (
                  filteredResults.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-600 uppercase tracking-wider font-medium mb-3">搜索结果</p>
                      {filteredResults.map(item => (
                        <div
                          key={item.path}
                          onClick={() => { navigate(item.path); setShowSearch(false); setSearchQuery('') }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <span className="text-sm text-slate-300">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">未找到匹配结果</p>
                  )
                ) : (
                  <>
                    <p className="text-xs text-slate-600 uppercase tracking-wider font-medium mb-3">快捷入口</p>
                    <div className="space-y-1">
                      {searchableRoutes.slice(0, 5).map(item => (
                        <div
                          key={item.path}
                          onClick={() => { navigate(item.path); setShowSearch(false); setSearchQuery('') }}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <span className="text-sm text-slate-300">{item.label}</span>
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