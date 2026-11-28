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
  /** 部署功能范围：core 时已下线模块不可见；缺省按 core 处理（fail-closed） */
  featureScope?: 'core' | 'full'
  modules: string[]
  /** 平台 code → 该平台下可用模块 */
  modulesByPlatform: Record<string, string[]>
  /** 可见平台；null = 全部 */
  platforms: string[] | null
  /** 全局停用模块（对所有角色含超管都不可见，仅超管可在模块管理页开关） */
  disabledModules?: string[]
}

export interface AuthContextValue {
  user: AuthUser | null
  roles: RoleInfo[]
  allowedModules: string[]
  /** 当前平台下实际可用模块（已按平台能力矩阵过滤） */
  platformModules: string[]
  /** 服务端解析的权限详情 */
  access: AccessInfo | null
  /** 部署功能范围：core 时隐藏已下线模块入口 */
  featureScope: 'core' | 'full'
  /** 全局停用的模块（导航与服务端访问都会排除） */
  disabledModules: string[]
  loading: boolean
  isBrandViewer: boolean
  isSuperAdmin: boolean
  /** 是否允许进入 AI 运营系统分支（超管、运营、财务、HRBP） */
  canAccessAiOps: boolean
  /** 是否允许访问财务板块（财务、controller、超管） */
  canAccessFinance: boolean
  isOpsUser: boolean
  isFinanceUser: boolean
  isHrbpUser: boolean
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
  featureScope: 'core',
  disabledModules: [],
  loading: true,
  isBrandViewer: false,
  isSuperAdmin: false,
  canAccessAiOps: false,
  canAccessFinance: false,
  isOpsUser: false,
  isFinanceUser: false,
  isHrbpUser: false,
  hasModule: () => false,
  hasAnyModule: () => false,
  hasRole: () => false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function getDefaultHomePath(user: AuthUser | null, _allowedModules: string[]): string {
  if (!user) return '/sign-in'

  // 品牌方只读视角：走品牌方专属看板
  if (user.role === 'brand_viewer' || user.userType === 'brand_viewer') {
    return '/brand-portal'
  }

  // 统一进入 AI 运营决策前台（决策点 6：今天的变化）
  return '/ai-ops/cockpit'
}
