import { Route, Navigate } from 'react-router-dom'
import { RequireAccess } from '@/components/auth/RequireAccess'
import { NAV_MANIFEST } from '@/data/route-manifest'

/**
 * classic-routes.tsx — 由 route-manifest 渲染经典业务路由（P1 收尾）
 *
 * route-manifest.ts 同时承载「导航 + 路由规格」，菜单与路由同源：
 *   - Sidebar / Topbar 读 NAV_MANIFEST 生成菜单与面包屑；
 *   - 本文件读 NAV_MANIFEST 生成 <Route>。
 *
 * 权限语义提醒：RequireAccess 对 module 与 anyModules 是 AND 关系，
 * 因此有 anyModules 的条目只传 anyModules（module 仅供导航过滤）。
 */
export const CLASSIC_ROUTES = NAV_MANIFEST.map((r) => {
  if (r.redirect) {
    return <Route key={r.href} path={r.href} element={<Navigate to={r.redirect} replace />} />
  }
  const Comp = r.component
  if (!Comp) return null
  const hasAny = Boolean(r.anyModules && r.anyModules.length > 0)
  return (
    <Route
      key={r.href}
      path={r.href}
      element={
        <RequireAccess
          module={hasAny ? undefined : r.module}
          anyModules={r.anyModules}
          roles={r.roles}
        >
          <Comp {...(r.props ?? {})} />
        </RequireAccess>
      }
    />
  )
})
