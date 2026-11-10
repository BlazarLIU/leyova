import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, Sun, Moon, X, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/utils/cn'
import { useSidebar } from '@/hooks/useSidebar'
import { useTheme } from '@/hooks/useTheme'
import { api } from '@/services/api'
import { PlatformShopSelector } from '@/components/common/PlatformShopSelector'
import { GlobalSearch } from '@/components/common/GlobalSearch'
import { WorkModeSwitcher } from '@/components/common/WorkModeSwitcher'

const routeLabels: Record<string, string> = {
  '/overview/home': '首页',
  '/overview/cockpit': '经营驾驶舱',
  '/overview/live-monitor': '实时监控',
  '/overview/sessions': '场次管理',
  '/overview/analytics': '数据分析',
  '/ai/chat': 'AI 分析助手',
  '/data/management': '数据管理',
  '/data/upload': '数据上传',
  '/data/quality': '数据质量',
  '/bi/dashboard': 'BI仪表盘',
  '/bi/roi': 'ROI看板',
  '/bi/refund-analysis': '退款分析',
  '/bi/anomaly-detection': '异常检测',
  '/anchors/list': '主播列表',
  '/anchors/profile': '主播档案',
  '/anchors/training': '训练管理',
  '/anchors/scripts': '话术模板',
  '/ops/capabilities': '能力看板',
  '/ops/script-library': '话术库',
  '/ops/issue-library': '问题库',
  '/ops/goal-tracking': '目标达成',
  '/ops/room-health': '直播间健康度',
  '/ops/session-products': '场次排品',
  '/system/config': '系统配置',
  '/system/alerts': '异常中心',
  '/system/tasks': '改进任务',
  '/system/promotions': '活动管理',
  '/system/competitors': '竞品观察',
  '/system/multi-room': '多直播间总览',
}

type Notification = { id: string; text: string; time: string; unread: boolean }

export function Topbar({ user }: { user?: { username: string; realName: string; role: string } }) {
  const { toggle: toggleSidebar } = useSidebar()
  const { theme, toggle: toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLogout, setShowLogout] = useState(false)
  const userAreaRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(n => n.unread).length

  const searchableRoutes = Object.entries(routeLabels).map(([path, label]) => ({ path, label }))

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

  const pageTitle = routeLabels[location.pathname] ?? '首页'

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
        <span className="text-slate-200 font-medium">{pageTitle}</span>
      </div>

      {/* 3 种展示模式快速切换器：代运营 MCN / 品牌自播 (全渠道) / 全功能总览 */}
      <div className="ml-2 hidden sm:block">
        <WorkModeSwitcher />
      </div>

      {/* Platform & Shop Quick Selector */}
      <div className="ml-2 hidden sm:block">
        <PlatformShopSelector />
      </div>

      {/* Global Command/Search Palette */}
      <div className="ml-2 hidden md:block">
        <GlobalSearch />
      </div>

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
                      {[
                        { label: '首页', path: '/overview/home' },
                        { label: 'AI 分析助手', path: '/ai/chat' },
                        { label: '主播列表', path: '/anchors/list' },
                        { label: '系统配置', path: '/system/config' },
                      ].map(item => (
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