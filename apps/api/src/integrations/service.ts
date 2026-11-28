/**
 * integrations/service.ts — 连接器编排：同步目录、健康检查、调用审计
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { checkConnectorHealth, getConnector } from './connectors.js'
import { loadIntegrationCredential } from './credentials.js'
import { consumeRateLimit, recordIntegrationCall } from './call-log.js'
import type { HealthCheckResult, IntegrationCapability } from './types.js'

export interface ConnectionRow {
  id: string
  platform: string
  display_name: string
  category: string
  auth_type: string
  auth_status: string
  capability_keys: unknown
  config: Record<string, unknown>
  credential_id: string | null
  rate_limit_per_min: number
  health_status: string
  health_detail: Record<string, unknown>
  last_checked_at: string | null
  enabled: boolean
}

export interface IntegrationConnectionView {
  id: string
  platform: string
  name: string
  category: string
  authType: string
  authStatus: string
  credentialFields: string[]
  configFields: string[]
  requiredConfigFields: string[]
  credentialHint: string
  secretsConfigured: boolean
  capabilities: IntegrationCapability[]
  healthStatus: string
  healthDetail: Record<string, unknown>
  lastCheckedAt: string | null
  rateLimitPerMin: number
  config: Record<string, unknown>
  docsUrl?: string
  enabled: boolean
}

/** 首次访问时把代码里的连接器目录同步进库 */
export async function ensureConnection(
  db: DbExecutor | undefined,
  tenantId: number,
  platform: string
): Promise<ConnectionRow> {
  const connector = getConnector(platform)
  if (!connector) throw new Error(`未知连接器：${platform}`)
  const executor = db || getPool()

  const { rows } = await executor.query<ConnectionRow>(
    `INSERT INTO public.integration_connections
       (tenant_id, platform, display_name, category, auth_type, capability_keys, config)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (tenant_id, platform) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           category = EXCLUDED.category,
           auth_type = EXCLUDED.auth_type,
           capability_keys = EXCLUDED.capability_keys,
           config = CASE
             WHEN public.integration_connections.config = '{}'::jsonb THEN EXCLUDED.config
             ELSE public.integration_connections.config
           END,
           updated_at = now()
     RETURNING id, platform, display_name, category, auth_type, auth_status,
               capability_keys, config, credential_id, rate_limit_per_min,
               health_status, health_detail, last_checked_at, enabled`,
    [
      tenantId,
      connector.key,
      connector.name,
      connector.category,
      connector.authType,
      JSON.stringify(connector.capabilities()),
      JSON.stringify(connector.defaultConfig),
    ]
  )
  return rows[0]
}

export async function listConnections(
  tenantId: number,
  db?: DbExecutor
): Promise<IntegrationConnectionView[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<
    ConnectionRow & { credential_hint: string | null }
  >(
    `SELECT conn.id, conn.platform, conn.display_name, conn.category, conn.auth_type,
            conn.auth_status, conn.capability_keys, conn.config, conn.credential_id,
            conn.rate_limit_per_min, conn.health_status, conn.health_detail,
            conn.last_checked_at, conn.enabled, cred.secret_hint AS credential_hint
       FROM public.integration_connections conn
       LEFT JOIN public.integration_credentials cred ON cred.id = conn.credential_id
      WHERE conn.tenant_id = $1
      ORDER BY conn.category, conn.platform`,
    [tenantId]
  )

  return rows.map((row) => {
    const connector = getConnector(row.platform)
    const stored = Array.isArray(row.capability_keys) ? (row.capability_keys as IntegrationCapability[]) : []
    return {
      id: row.id,
      platform: row.platform,
      name: row.display_name || connector?.name || row.platform,
      category: row.category,
      authType: row.auth_type,
      authStatus: row.auth_status,
      credentialFields: connector?.credentialFields || [],
      configFields: connector?.configFields || [],
      requiredConfigFields: connector?.requiredConfigFields || [],
      credentialHint: row.credential_hint || '',
      secretsConfigured: Boolean(row.credential_id),
      capabilities: stored.length > 0 ? stored : connector?.capabilities() || [],
      healthStatus: row.health_status,
      healthDetail: (row.health_detail || {}) as Record<string, unknown>,
      lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
      rateLimitPerMin: Number(row.rate_limit_per_min) || 60,
      config: (row.config || {}) as Record<string, unknown>,
      docsUrl: connector?.docsUrl,
      enabled: row.enabled,
    }
  })
}

export interface HealthCheckOutcome extends HealthCheckResult {
  platform: string
  connectionId: string
  credentialHint: string
  secretsConfigured: boolean
  probe: boolean
}

/**
 * 执行健康检查：
 * 1. 限流（按连接每分钟）；
 * 2. 读取解密凭证（只在服务端）；
 * 3. 真实探活（可选）；
 * 4. 更新连接健康态并写入调用审计。
 */
export async function runHealthCheck(input: {
  tenantId: number
  platform: string
  probe: boolean
  actorUserId?: number | null
  timeoutMs?: number
  db?: DbExecutor
}): Promise<HealthCheckOutcome> {
  const db = input.db || getPool()
  const connection = await ensureConnection(db, input.tenantId, input.platform)
  const credential = await loadIntegrationCredential(db, input.tenantId, input.platform)

  const verdict = consumeRateLimit(`health:${connection.id}`, connection.rate_limit_per_min)
  if (!verdict.allowed) {
    const detail = `健康检查触发限流，请 ${Math.ceil(verdict.retryAfterMs / 1000)}s 后重试`
    await recordIntegrationCall({
      db,
      tenantId: input.tenantId,
      connectionId: connection.id,
      platform: connection.platform,
      operation: 'health_check',
      method: 'INTERNAL',
      requestSummary: { probe: input.probe },
      responseSummary: { status: 'rate_limited', retryAfterMs: verdict.retryAfterMs },
      status: 'rate_limited',
      errorCode: 'RATE_LIMITED',
      actorUserId: input.actorUserId,
    })
    return {
      platform: connection.platform,
      connectionId: connection.id,
      credentialHint: credential?.hint || '',
      secretsConfigured: Boolean(credential),
      probe: input.probe,
      status: 'degraded',
      detail,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      missingFields: [],
      errorCode: 'RATE_LIMITED',
    }
  }

  const connector = getConnector(connection.platform)!
  const health = await checkConnectorHealth(connector, {
    tenantId: input.tenantId,
    config: { ...connector.defaultConfig, ...(connection.config || {}) },
    secrets: credential?.secrets || null,
    probe: input.probe,
    timeoutMs: input.timeoutMs,
  })

  const authStatus = credential ? 'configured' : 'unconfigured'
  await db.query(
    `UPDATE public.integration_connections
        SET health_status = $3,
            health_detail = $4::jsonb,
            auth_status = $5,
            last_checked_at = now(),
            updated_at = now()
      WHERE tenant_id = $1 AND platform = $2`,
    [
      input.tenantId,
      connection.platform,
      health.status,
      JSON.stringify({
        detail: health.detail,
        latencyMs: health.latencyMs,
        httpStatus: health.httpStatus,
        errorCode: health.errorCode,
        missingFields: health.missingFields,
      }),
      authStatus,
    ]
  )

  const callStatus =
    health.status === 'healthy'
      ? 'success'
      : health.status === 'unconfigured' || health.status === 'unknown'
        ? 'skipped'
        : 'error'

  await recordIntegrationCall({
    db,
    tenantId: input.tenantId,
    connectionId: connection.id,
    platform: connection.platform,
    operation: 'health_check',
    method: 'INTERNAL',
    requestSummary: { probe: input.probe, authStatus },
    responseSummary: { status: health.status, detail: health.detail },
    status: callStatus,
    httpStatus: health.httpStatus,
    errorCode: health.errorCode,
    latencyMs: health.latencyMs,
    actorUserId: input.actorUserId,
  })

  return {
    platform: connection.platform,
    connectionId: connection.id,
    credentialHint: credential?.hint || '',
    secretsConfigured: Boolean(credential),
    probe: input.probe,
    ...health,
    status: health.status,
    detail: health.detail,
    latencyMs: health.latencyMs,
    checkedAt: health.checkedAt,
    missingFields: health.missingFields,
  }
}

export interface CallLogView {
  id: string
  platform: string
  operation: string
  method: string
  requestSummary: string
  responseSummary: string
  status: string
  httpStatus: number | null
  errorCode: string | null
  latencyMs: number
  retryCount: number
  createdAt: string
}

export async function listCallLogs(
  tenantId: number,
  options: { platform?: string; limit?: number } = {},
  db?: DbExecutor
): Promise<CallLogView[]> {
  const executor = db || getPool()
  const limit = Math.min(200, Math.max(1, options.limit || 50))
  const params: unknown[] = [tenantId]
  let where = 'tenant_id = $1'
  if (options.platform) {
    params.push(options.platform)
    where += ` AND platform = $${params.length}`
  }
  params.push(limit)
  const { rows } = await executor.query<{
    id: string
    platform: string
    operation: string
    method: string
    request_summary: string
    response_summary: string
    status: string
    http_status: number | null
    error_code: string | null
    latency_ms: number
    retry_count: number
    created_at: string
  }>(
    `SELECT id, platform, operation, method, request_summary, response_summary,
            status, http_status, error_code, latency_ms, retry_count, created_at
       FROM public.integration_call_logs
      WHERE ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}`,
    params
  )
  return rows.map((row) => ({
    id: String(row.id),
    platform: row.platform,
    operation: row.operation,
    method: row.method,
    requestSummary: row.request_summary,
    responseSummary: row.response_summary,
    status: row.status,
    httpStatus: row.http_status,
    errorCode: row.error_code,
    latencyMs: Number(row.latency_ms) || 0,
    retryCount: Number(row.retry_count) || 0,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}
