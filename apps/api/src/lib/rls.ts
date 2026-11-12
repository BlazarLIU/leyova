import type { FastifyRequest } from 'fastify'
import type { Pool, PoolClient } from 'pg'
import { getPool } from './db.js'
import { getUserAllowedPlatforms, type AuthUser } from './guard.js'

export interface ResolvedRlsScope {
  userId: number | null
  role: string
  userType: string
  tenantId: number
  anchorId: number | null
  brandClientId: number | null
  canViewCost: boolean
  canViewAnchors: boolean
  allowedProjectIds: number[]
  allowedPlatforms: string[] | null // null = wildcard '*'
}

function isFastifyRequest(input: unknown): input is FastifyRequest {
  return Boolean(input && typeof input === 'object' && 'headers' in input && 'url' in input)
}

function extractUser(requestOrUser?: FastifyRequest | AuthUser | null): AuthUser | null {
  if (!requestOrUser) return null
  if (isFastifyRequest(requestOrUser)) {
    return ((requestOrUser as any).user as AuthUser | undefined) ?? null
  }
  return requestOrUser as AuthUser
}

/**
 * 解析当前用户的多租户、平台、品牌客户/项目及主播行级安全作用域。
 * Fail-closed：未登录或身份无效时返回零权限上下文。
 */
export async function resolveUserRlsScope(
  pool: Pool,
  user: AuthUser | null | undefined
): Promise<ResolvedRlsScope> {
  if (!user || !user.id) {
    return {
      userId: null,
      role: '',
      userType: '',
      tenantId: 0,
      anchorId: null,
      brandClientId: null,
      canViewCost: false,
      canViewAnchors: false,
      allowedProjectIds: [],
      allowedPlatforms: [],
    }
  }

  const tenantId = Number(user.tenantId || 1)
  const userType = user.userType || 'agency_staff'

  let brandClientId: number | null = null
  let canViewCost = ['super_admin', 'admin', 'finance'].includes(user.role) && userType !== 'brand_viewer'
  let canViewAnchors = userType !== 'brand_viewer'
  let allowedProjectIds: number[] = []

  if (userType === 'brand_viewer') {
    const bvpRes = await pool.query<{
      client_id: number | null
      project_ids: number[] | null
      can_view_cost: boolean
      can_view_anchors: boolean
    }>(
      `SELECT client_id, project_ids, can_view_cost, can_view_anchors
       FROM public.brand_viewer_permissions
       WHERE user_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [user.id, tenantId]
    )
    const bvp = bvpRes.rows[0]
    brandClientId = bvp?.client_id ?? null
    canViewCost = Boolean(bvp?.can_view_cost)
    canViewAnchors = Boolean(bvp?.can_view_anchors)
    allowedProjectIds = Array.isArray(bvp?.project_ids)
      ? bvp.project_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
      : []
  }

  const allowedSet = await getUserAllowedPlatforms(pool, user)
  const allowedPlatforms = allowedSet === null ? null : Array.from(allowedSet)

  return {
    userId: user.id,
    role: user.role,
    userType,
    tenantId,
    anchorId: user.anchorId ? Number(user.anchorId) : null,
    brandClientId,
    canViewCost,
    canViewAnchors,
    allowedProjectIds,
    allowedPlatforms,
  }
}

/**
 * 在 PostgreSQL 事务内降权为非超管应用角色 leyova_app 并注入行级安全上下文 GUCs，
 * 由 PostgreSQL RLS 策略强制隔离租户、平台、品牌项目及主播数据。
 */
export async function withRlsContext<T>(
  requestOrUser: FastifyRequest | AuthUser | null | undefined,
  fn: (client: PoolClient, scope: ResolvedRlsScope) => Promise<T>,
  pool: Pool = getPool()
): Promise<T> {
  const user = extractUser(requestOrUser)
  const scope = await resolveUserRlsScope(pool, user)
  const client = await pool.connect()

  await client.query('BEGIN')
  try {
    await client.query('SET LOCAL ROLE leyova_app')
    await client.query(
      `SELECT
        set_config('app.user_id', $1, true),
        set_config('app.user_role', $2, true),
        set_config('app.user_type', $3, true),
        set_config('app.tenant_id', $4, true),
        set_config('app.anchor_id', $5, true),
        set_config('app.brand_client_id', $6, true),
        set_config('app.can_view_cost', $7, true),
        set_config('app.can_view_anchors', $8, true),
        set_config('app.allowed_project_ids', $9, true),
        set_config('app.allowed_platforms', $10, true)`,
      [
        scope.userId ? String(scope.userId) : '',
        scope.role,
        scope.userType,
        String(scope.tenantId),
        scope.anchorId ? String(scope.anchorId) : '',
        scope.brandClientId ? String(scope.brandClientId) : '',
        scope.canViewCost ? 'true' : 'false',
        scope.canViewAnchors ? 'true' : 'false',
        scope.allowedProjectIds.join(','),
        scope.allowedPlatforms === null ? '*' : scope.allowedPlatforms.join(','),
      ]
    )

    const result = await fn(client, scope)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failure
    }
    throw err
  } finally {
    client.release()
  }
}

async function applyRlsConfig(
  client: PoolClient,
  scope: ResolvedRlsScope,
  localOnly: boolean
): Promise<void> {
  await client.query(localOnly ? 'SET LOCAL ROLE leyova_app' : 'SET ROLE leyova_app')
  await client.query(
    `SELECT
      set_config('app.user_id', $1, $11),
      set_config('app.user_role', $2, $11),
      set_config('app.user_type', $3, $11),
      set_config('app.tenant_id', $4, $11),
      set_config('app.anchor_id', $5, $11),
      set_config('app.brand_client_id', $6, $11),
      set_config('app.can_view_cost', $7, $11),
      set_config('app.can_view_anchors', $8, $11),
      set_config('app.allowed_project_ids', $9, $11),
      set_config('app.allowed_platforms', $10, $11)`,
    [
      scope.userId ? String(scope.userId) : '',
      scope.role,
      scope.userType,
      String(scope.tenantId),
      scope.anchorId ? String(scope.anchorId) : '',
      scope.brandClientId ? String(scope.brandClientId) : '',
      scope.canViewCost ? 'true' : 'false',
      scope.canViewAnchors ? 'true' : 'false',
      scope.allowedProjectIds.join(','),
      scope.allowedPlatforms === null ? '*' : scope.allowedPlatforms.join(','),
      localOnly,
    ]
  )
}

/**
 * 为内部自行管理 Pool.connect() 事务的多阶段服务（如 data-governance）提供
 * 强制注入 PostgreSQL RLS 角色与会话上下文的 Pool 代理。
 */
export async function withRlsPool<T>(
  requestOrUser: FastifyRequest | AuthUser | null | undefined,
  fn: (scopedPool: Pool, scope: ResolvedRlsScope) => Promise<T>,
  pool: Pool = getPool()
): Promise<T> {
  const user = extractUser(requestOrUser)
  const scope = await resolveUserRlsScope(pool, user)
  const cleanups: Promise<void>[] = []

  const scopedPool = new Proxy(pool, {
    get(target, prop, receiver) {
      if (prop === 'query') {
        return (...args: any[]) =>
          withRlsContext(requestOrUser, (client) => (client.query as any)(...args), pool)
      }
      if (prop === 'connect') {
        return async () => {
          const client = await target.connect()
          const originalRelease = client.release.bind(client)
          let released = false
          try {
            await applyRlsConfig(client, scope, false)
          } catch (err) {
            await client.query('RESET ALL').catch(() => {})
            originalRelease()
            throw err
          }
          client.release = (destroyOrErr?: boolean | Error) => {
            if (released) return
            released = true
            const cleanup = client
              .query('ROLLBACK')
              .catch(() => {})
              .then(() => client.query('RESET ALL'))
              .catch(() => {})
              .then(() => {
                originalRelease(destroyOrErr)
              })
            cleanups.push(cleanup)
          }
          return client
        }
      }
      const val = Reflect.get(target, prop, receiver)
      return typeof val === 'function' ? val.bind(target) : val
    },
  })

  try {
    return await fn(scopedPool, scope)
  } finally {
    if (cleanups.length > 0) {
      await Promise.allSettled(cleanups)
    }
  }
}

