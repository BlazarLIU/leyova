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

export interface AuthContextValue {
  user: AuthUser | null
  roles: RoleInfo[]
  allowedModules: string[]
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
  if (user.role === 'brand_viewer' || user.userType === 'brand_viewer') {
    return '/brand-portal'
  }
  if (user.role === 'super_admin' || allowedModules.includes('overview')) {
    return '/overview/home'
  }
  if (allowedModules.includes('personal_achievement')) {
    return '/live/attendance'
  }
  if (allowedModules.includes('live_registration')) {
    return '/live/registration'
  }
  if (allowedModules.includes('ai')) {
    return '/ai/chat'
  }
  return '/overview/home'
}
