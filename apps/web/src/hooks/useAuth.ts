import { createContext, useContext } from 'react'
import type { RoleInfo } from '@/types'

export interface AuthUser {
  id: number
  username: string
  realName: string
  role: string
  userType?: string
  tenantId?: number
  anchorId?: number
}

/** 服务端解析后的完整权限（S2；S3 起取消工作模式，仅保留全功能） */
export interface AccessInfo {
  dataScope: 'self' | 'team' | 'org' | 'all'
  modules: string[]
  /** 平台 code → 该平台下可用模块 */
  modulesByPlatform: Record<string, string[]>
  /** 可见平台；null = 全部 */
  platforms: string[] | null
}

export interface AuthContextValue {
  user: AuthUser | null
  roles: RoleInfo[]
  allowedModules: string[]
  /** 当前平台下实际可用模块（已按平台能力矩阵过滤） */
  platformModules: string[]
  /** 服务端解析的权限详情 */
  access: AccessInfo | null
  loading: boolean
  isBrandViewer: boolean
  isSuperAdmin: boolean
  hasModule: (moduleCode?: string) => boolean
  hasAnyModule: (moduleCodes: string[]) => boolean
  hasRole: (allowedRoles: string[]) => boolean
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  roles: [],
  allowedModules: [],
  platformModules: [],
  access: null,
  loading: true,
  isBrandViewer: false,
  isSuperAdmin: false,
  hasModule: () => false,
  hasAnyModule: () => false,
  hasRole: () => false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function getDefaultHomePath(user: AuthUser | null, allowedModules: string[]): string {
  if (!user) return '/sign-in'

  // 品牌方只读视角：走品牌方专属看板
  // （P1-B16：此前返回 /brand-portal，但该路由不存在 → 白屏。现统一到 /omnichannel/dashboard 的只读视图）
  if (user.role === 'brand_viewer' || user.userType === 'brand_viewer') {
    return '/omnichannel/dashboard'
  }

  // 管理/运营：回总览
  if (user.role === 'super_admin' || allowedModules.includes('overview')) {
    return '/overview/home'
  }

  // 主播/中控（personal_achievement 是他们的核心模块）
  // P1-B17：此前落到 /live/attendance（考勤表），主播每天最该看的是「我今天播什么」
  if (allowedModules.includes('personal_achievement')) {
    return '/anchors/my-schedule'
  }

  // 其余基层（只有登记权限）
  if (allowedModules.includes('live_registration')) {
    return '/live/registration'
  }

  if (allowedModules.includes('ai')) {
    return '/ai/chat'
  }

  return '/overview/home'
}
