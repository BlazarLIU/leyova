import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '@/services/api'

/**
 * 首次部署守卫：系统未初始化时，任何业务页面与登录页都重定向到 /setup。
 * 接口异常时放行，避免后端短暂不可用导致前端完全无法打开。
 */
export function RequireInitialized({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'setup'>('loading')

  useEffect(() => {
    api
      .get<{ initialized: boolean }>('/v1/setup/status')
      .then((s) => setState(s?.initialized ? 'ready' : 'setup'))
      .catch(() => setState('ready'))
  }, [])

  if (state === 'loading') return null
  if (state === 'setup') return <Navigate to="/setup" replace />
  return <>{children}</>
}
