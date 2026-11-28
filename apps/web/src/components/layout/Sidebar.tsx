import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, LogOut, Eye } from 'lucide-react'
import { cn } from '@/utils/cn'
import { buildAiOpsNavigation } from '@/data/ai-ops-navigation'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { useSidebar } from '@/hooks/useSidebar'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/services/api'
import type { NavItem, NavSection } from '@/types'

function LeyovaLogo({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate('/')}
      className={cn(
        'flex h-16 cursor-pointer items-center transition-colors hover:bg-[var(--hover-bg3)]',
        collapsed ? 'justify-center px-2' : 'px-4'
      )}
    >
      {collapsed ? (
        <BrandLogo variant="mark" size={30} />
      ) : (
        <BrandLogo variant="full" size={26} />
      )}
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
            'group flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-medium transition-colors duration-150',
            isChildActive
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
          )}
        >
          {item.icon && (
            <item.icon
              className={cn(
                'h-[17px] w-[17px] flex-shrink-0 transition-colors',
                isChildActive ? 'text-orbit-primary' : 'text-[var(--text-subtle)] group-hover:text-[var(--text-primary)]'
              )}
            />
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 truncate text-left"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {!collapsed && (
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-subtle)]" />
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
              <div className="ml-[19px] mt-0.5 space-y-0.5 border-l border-[var(--border)] pb-1 pl-2.5">
                {item.children!.map(child => (
                  <NavLink
                    key={child.href}
                    to={child.href}
                    onClick={onNavClick}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-[7px] px-2 py-[7px] text-[12.5px] transition-colors',
                        isActive
                          ? 'bg-orbit-primary/[0.08] font-semibold text-orbit-primary dark:bg-orbit-primary/15 dark:text-orbit-primary-light'
                          : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg3)] hover:text-[var(--text-primary)]'
                      )
                    }
                  >
                    <ChevronRight className="h-3 w-3 opacity-40" />
                    {child.label}
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
          'group relative flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] transition-colors duration-150',
          active
            ? 'bg-orbit-primary font-semibold text-white shadow-[0_6px_18px_-10px_rgba(244,41,2,0.9)]'
            : 'font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)]'
        )
      }}
    >
      {({ isActive: routerActive }) => {
        const active = routerActive || isActive
        return (
          <>
            {item.icon && (
              <item.icon
                className={cn(
                  'h-[17px] w-[17px] flex-shrink-0 transition-colors',
                  active
                    ? 'text-white'
                    : 'text-[var(--text-subtle)] group-hover:text-[var(--text-primary)]'
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
          </>
        )
      }}
    </NavLink>
  )
}

const roleLabels: Record<string, string> = {
  super_admin: '系统管理员',
  ops_director: '运营总监',
  ops_staff: '运营专员',
  ad_buyer: '投放专员',
  controller: '现场中控',
  hrbp: 'HRBP',
  brand_viewer: '品牌方代表',
}

export function Sidebar({ user }: { user?: { username: string; realName: string; role: string } }) {
  const { collapsed, isMobile, mobileOpen, closeMobile } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    user: authUser,
    allowedModules,
    platformModules,
    loading: authLoading,
    isBrandViewer,
    isSuperAdmin,
    canAccessFinance,
    isHrbpUser,
  } = useAuth()

  // 导航分组折叠管理：支持点击标题展开/收起，当前激活项所在分组常开
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const toggleSection = (title: string, defaultCollapsed = false) => {
    setCollapsedSections(prev => {
      const isCurrentlyCollapsed = prev[title] !== undefined ? prev[title] : defaultCollapsed
      return { ...prev, [title]: !isCurrentlyCollapsed }
    })
  }

  const onNavClick = () => {
    if (isMobile) closeMobile()
  }

  const effectiveUser = user || authUser
  const userRole = effectiveUser?.role || ''
  const [showLogout, setShowLogout] = useState(false)
  const userAreaRef = useRef<HTMLDivElement>(null)

  const displayName = effectiveUser?.realName || effectiveUser?.username || '未命名'
  const avatarLetter = displayName.trim().charAt(0) || '用'
  const roleLabel = roleLabels[userRole] || userRole || ''

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

  const getVisibleNavigation = (role: string): NavSection[] => {
    if (authLoading || !role) return []

    // 品牌方只读代表：仅允许查看品牌方专属履约看板，彻底隔离代运营及后台菜单
    if (isBrandViewer) {
      return [
        {
          title: '品牌方门户',
          items: [
            { label: '品牌方只读看板', icon: Eye, href: '/brand-portal' },
          ],
        },
      ]
    }

    // 统一收敛为三前台+管理区导航（支持财务细分权限隔离）
    return buildAiOpsNavigation({
      isFinanceUser: canAccessFinance,
      isHrbpUser,
      isSuperAdmin,
      modules: platformModules.length > 0 ? platformModules : allowedModules,
    })
  }

  // 路由变化时，如果激活项位于某个折叠分组，自动展开该分组以确保当前页面可见
  useEffect(() => {
    const nav = getVisibleNavigation(userRole)
    const activeSection = nav.find(section =>
      section.items.some(
        item => item.href === location.pathname || item.children?.some(c => c.href === location.pathname)
      )
    )
    if (activeSection) {
      setCollapsedSections(prev => {
        const isCurrentlyCollapsed = prev[activeSection.title] !== undefined
          ? prev[activeSection.title]
          : Boolean(activeSection.defaultCollapsed)
        if (isCurrentlyCollapsed) {
          return { ...prev, [activeSection.title]: false }
        }
        return prev
      })
    }
  }, [location.pathname, userRole, authLoading, platformModules, allowedModules])

  return (
    <motion.aside
      animate={{
        width: isMobile ? 220 : (collapsed ? 72 : 220),
        x: isMobile && !mobileOpen ? '-100%' : 0,
      }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)]"
    >
      <LeyovaLogo collapsed={collapsed && !isMobile} />

      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2.5 py-3">
        {getVisibleNavigation(userRole).map(section => {
          const isItemActive = section.items.some(
            item => item.href === location.pathname || item.children?.some(c => c.href === location.pathname)
          )
          const isCollapsed = collapsedSections[section.title] !== undefined
            ? collapsedSections[section.title]
            : Boolean(section.defaultCollapsed && !isItemActive)

          return (
            <div key={section.title} className="transition-all duration-200">
              <AnimatePresence>
                {(!collapsed || isMobile) && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title, section.defaultCollapsed)}
                    className="mb-1.5 flex w-full items-center justify-between px-2.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--text-subtle)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                  >
                    <span>{section.title}</span>
                    <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </motion.div>
                  </button>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {(!isCollapsed || (collapsed && !isMobile)) && (
                  <motion.div
                    initial={collapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {section.items.map(item => (
                      <NavItemLink
                        key={item.label}
                        item={item}
                        collapsed={collapsed && !isMobile}
                        onNavClick={onNavClick}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </nav>

      <div className="relative border-t border-[var(--border)] p-2.5" ref={userAreaRef}>
        <div
          className={cn(
            'flex cursor-pointer items-center gap-2.5 rounded-[10px] p-1.5 transition-colors hover:bg-[var(--hover-bg)]',
            collapsed && !isMobile && 'justify-center'
          )}
          onClick={() => setShowLogout(v => !v)}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-orbit-primary text-xs font-extrabold text-white">
            {avatarLetter}
          </div>
          <AnimatePresence>
            {(!collapsed || isMobile) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{displayName}</p>
                <p className="truncate text-[10.5px] text-[var(--text-muted)]">{roleLabel}</p>
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
              className="absolute bottom-full left-2.5 right-2.5 mb-1"
            >
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:border-orbit-danger/40 hover:text-orbit-danger"
              >
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}
