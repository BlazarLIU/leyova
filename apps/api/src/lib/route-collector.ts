/**
 * route-collector.ts — 运行时路由清单收集器（P2-4 OpenAPI 自动生成）
 *
 * 背景：原 `src/openapi.ts` 是手写的 641 行规格，实测与代码双向漂移：
 *   - 文档缺 199 条真实接口（代码有、文档无）
 *   - 文档多 55 条不存在的接口（文档有、代码无）
 *   根因是路由清单在两处各维护一份。
 *
 * 本收集器在应用构建时通过 Fastify `onRoute` 钩子捕获**全部真实注册路由**，
 * 作为 OpenAPI 生成的唯一事实源。schema 若路由未提供，则按通用响应兜底（不臆造字段）。
 */
import type { FastifyInstance, RouteOptions } from 'fastify'

export interface CollectedRoute {
  method: string
  /** Fastify 原始路径（:id 形式） */
  url: string
  /** OpenAPI 路径（{id} 形式） */
  openapiPath: string
  /** 路由声明的 tags（若提供） */
  tags?: string[]
  /** 路由是否声明了 JSON schema */
  hasSchema: boolean
}

/** `/api/v1/sessions/:id/staff` → `/api/v1/sessions/{id}/staff` */
export function toOpenApiPath(url: string): string {
  return url.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

export class RouteCollector {
  private routes: CollectedRoute[] = []
  private seen = new Set<string>()

  attach(app: FastifyInstance): void {
    app.addHook('onRoute', (routeOptions: RouteOptions) => {
      const url = typeof routeOptions.url === 'string' ? routeOptions.url : String(routeOptions.url ?? '')
      // 跳过 swagger UI / 静态资源路由
      if (!url.startsWith('/api/')) return

      const rawMethod = routeOptions.method
      const methods = Array.isArray(rawMethod) ? rawMethod : [rawMethod]
      for (const method of methods) {
        if (!method) continue
        const m = String(method).toUpperCase()
        if (m === 'HEAD' || m === 'OPTIONS') continue
        const key = `${m} ${url}`
        if (this.seen.has(key)) continue
        this.seen.add(key)
        this.routes.push({
          method: m,
          url,
          openapiPath: toOpenApiPath(url),
          tags: (routeOptions as any).tags,
          hasSchema: Boolean((routeOptions as any).schema),
        })
      }
    })
  }

  list(): CollectedRoute[] {
    return [...this.routes].sort((a, b) =>
      a.openapiPath === b.openapiPath ? a.method.localeCompare(b.method) : a.openapiPath.localeCompare(b.openapiPath),
    )
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** 由 buildApp 在启动时注入，供 OpenAPI 生成与路由治理检查使用 */
    __routeCollector: RouteCollector
  }
}
