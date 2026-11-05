import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react'
import { cn } from '@/utils/cn'
import { navigation } from '@/data/navigation'
import { useSidebar } from '@/hooks/useSidebar'
import { api } from '@/services/api'
import type { NavItem, RoleInfo } from '@/types'

function YonsoboLogo({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate('/')}
      className={cn(
        "flex items-center justify-center border-b border-orbit-border h-16 cursor-pointer hover:bg-white/[0.02] transition-colors",
        collapsed ? "px-2" : "px-4"
      )}
    >
      <img src="/orbit-icon.svg" alt="logo" className={cn("object-contain dark:invert dark:brightness-[0.85]", collapsed ? "w-7 h-7" : "h-9")} />
    </div>
  )
}

function NavItemLink({
  item,
  collapsed,
  onNavClick,
}: {
  item: NavItem
  collapsed: boolean
  onNavClick: () => void
}) {
  const location = useLocation()
  const [open, setOpen] = useState(() =>
    item.children?.some(c => location.pathname === c.href) ?? false
  )
  const hasChildren = item.children && item.children.length > 0
  const isActive = item.href ? location.pathname === item.href : false
  const isChildActive = item.children?.some(c => location.pathname === c.href) ?? false

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
            isChildActive
              ? 'text-slate-100 bg-orbit-primary/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          )}
        >
          {item.icon && (
            <item.icon
              className={cn(
                'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                isChildActive ? 'text-orbit-primary-light' : 'text-slate-500 group-hover:text-slate-300'
              )}
            />
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 text-left truncate"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && (
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </motion.div>
          )}
        </button>

        <AnimatePresence>
          {open && !collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-6 mt-1 border-l border-orbit-border pl-3 space-y-0.5">
                {item.children!.map(child => (
                  <NavLink
                    key={child.href}
                    to={child.href}
                    onClick={onNavClick}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                        isActive
                          ? 'text-orbit-primary-light font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      )
                    }
                  >
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    {child.label}
                    {child.badge && (
                      <span className="ml-auto text-[10px] font-semibold bg-orbit-primary/20 text-orbit-primary-light px-1.5 py-0.5 rounded-full">
                        {child.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <NavLink
      to={item.href!}
      onClick={onNavClick}
      className={({ isActive: routerActive }) => {
        const active = routerActive || isActive
        return cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative',
          active
            ? 'text-slate-100 bg-orbit-primary/15 shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )
      }}
    >
      {({ isActive: routerActive }) => {
        const active = routerActive || isActive
        return (
          <>
            {active && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orbit-primary rounded-r-full"
              />
            )}
            {item.icon && (
              <item.icon
                className={cn(
                  'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                  active ? 'text-orbit-primary-light' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
            )}
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {!collapsed && item.badge && (
              <span className="ml-auto text-[10px] font-bold bg-orbit-accent/20 text-orbit-accent-light px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </>
        )
      }}
    </NavLink>
  )
}

const roleLabels: Record<string, string> = {
  super_admin: '系统管理员',
  ops_director: '运营总监',
  ops_staff: '运营',
  controller: '中控',
}

export function Sidebar({ user }: { user?: { username: string; realName: string; role: string } }) {
  const { collapsed, isMobile, mobileOpen, closeMobile } = useSidebar()
  const navigate = useNavigate()

  const onNavClick = () => {
    if (isMobile) closeMobile()
  }

  const [userRole, setUserRole] = useState<string>(user?.role || 'super_admin')
  const [userModules, setUserModules] = useState<string[]>([])
  const [showLogout, setShowLogout] = useState(false)
  const userAreaRef = useRef<HTMLDivElement>(null)

  const displayName = user?.realName || user?.username || '未命名'
  const avatarLetter = displayName.trim().charAt(0) || '用'
  const roleLabel = roleLabels[user?.role || ''] || user?.role || ''

  useEffect(() => {
    if (user?.role) {
      setUserRole(user.role)
    }
  }, [user?.role])

  // 当 userRole 变化时，重新获取模块权限
  useEffect(() => {
    api.get<RoleInfo[]>('/system/roles')
      .then((roles) => {
        const found = roles.find(r => r.code === userRole)
        setUserModules(found ? found.modules : [])
      })
      .catch(() => {})
  }, [userRole])

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

  const canSee = (m?: string) =>
    // 未标注模块 → 默认可见（向后兼容）
    !m ||
    // 模块列表为空（数据未加载完） → 默认可见
    userModules.length === 0 ||
    // 有该模块权限 → 可见
    userModules.includes(m)

  const getVisibleNavigation = (role: string) => {
    let sections = navigation
    // controller → 不显示「系统」分组
    if (role === 'controller') {
      sections = sections.filter(section => section.title !== '系统')
    }
    if (role === 'controller') {
      // controller：严格两段式过滤（子级 module 优先，回退到父级 module）
      return sections.map(section => ({
        ...section,
        items: section.items.map(item => {
          if (!item.children?.length) {
            return canSee(item.module) ? item : null
          }
          // 折叠组：过滤 children，子集为空则整个分组不显示
          const children = item.children.filter(child => canSee(child.module || item.module))
          if (children.length === 0) return null
          return { ...item, children }
        }).filter((item): item is NonNullable<typeof item> => item !== null),
      })).filter(section => section.items.length > 0)
    }
    // 其他角色：沿用现有单级过滤逻辑，行为不回退
    return sections.map(section => ({
      ...section,
      items: section.items.filter(item => {
        // 如果没有指定 module，默认可见（向后兼容）
        if (!item.module) return true
        // 如果用户模块列表为空（例如数据还没加载完），默认可见
        if (userModules.length === 0) return true
        // 检查用户是否有该模块权限
        return userModules.includes(item.module)
      }),
    })).filter(section => section.items.length > 0) // 移除没有可见导航项的分组
  }

  return (
    <motion.aside
      animate={{
        width: isMobile ? 200 : (collapsed ? 72 : 200),
        x: isMobile && !mobileOpen ? '-100%' : 0,
      }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-orbit-surface border-r border-orbit-border flex flex-col z-40 overflow-hidden"
    >
      <YonsoboLogo collapsed={collapsed && !isMobile} />

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-6">
        {getVisibleNavigation(userRole).map(section => (
          <div key={section.title}>
            <AnimatePresence>
              {(!collapsed || isMobile) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-2"
                >
                  {section.title}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItemLink
                  key={item.label}
                  item={item}
                  collapsed={collapsed && !isMobile}
                  onNavClick={onNavClick}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-orbit-border p-3 relative" ref={userAreaRef}>
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors',
            collapsed && !isMobile && 'justify-center'
          )}
          onClick={() => setShowLogout(v => !v)}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orbit-primary to-orbit-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {avatarLetter}
          </div>
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-slate-200 truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {showLogout && (!collapsed || isMobile) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-3 right-3 mb-1"
            >
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>退出</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}