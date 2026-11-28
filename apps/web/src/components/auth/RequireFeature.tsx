import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, getDefaultHomePath } from '@/hooks/useAuth'

interface RequireFeatureProps {
  children: React.ReactNode
  /** 该路由依赖的部署功能范围；core 部署下会重定向回工作台 */
  feature: 'full'
}

/**
 * 部署功能范围守卫：FEATURE_SCOPE=core 时阻断已下线模块的直达访问。
 * 与后端 app.ts 的 isCoreOnly 路由注册保持一致，避免出现「页面可达但接口 404」。
 */
export function RequireFeature({ children, feature }: RequireFeatureProps) {
  const { user, allowedModules, featureScope, loading } = useAuth()

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-5 h-5 border-2 border-orbit-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (feature === 'full' && featureScope !== 'full') {
    return <Navigate to={getDefaultHomePath(user, allowedModules)} replace />
  }

  return <>{children}</>
}
