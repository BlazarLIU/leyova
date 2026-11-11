import type { FastifyRequest } from 'fastify'
import type { Pool, PoolClient } from 'pg'

export type DbExecutor = Pool | PoolClient

export interface AuditLogEntry {
  actorUserId?: number | null
  action: string
  resourceType: string
  resourceId?: string | number | null
  beforeData?: unknown
  afterData?: unknown
  request?: FastifyRequest
  ipAddress?: string | null
  userAgent?: string | null
}

function toJsonParam(value: unknown): string | null {
  if (value === undefined || value === null) return null
  try {
    return JSON.stringify(value)
  } catch {
    return JSON.stringify({ error: 'unserializable_audit_payload' })
  }
}

/**
 * 写入审计日志到 public.audit_logs。
 * 既可传入全局 Pool，也可传入 withRlsContext 内的事务 PoolClient。
 */
export async function writeAuditLog(executor: DbExecutor, entry: AuditLogEntry): Promise<void> {
  const req = entry.request
  const reqUser = req ? (req as any).user : undefined
  const actorUserId = entry.actorUserId ?? reqUser?.id ?? null

  const forwarded = req?.headers?.['x-forwarded-for']
  const rawIp =
    entry.ipAddress ??
    (Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
    req?.ip ??
    null

  const rawUa = entry.userAgent ?? (typeof req?.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null)

  await executor.query(
    `INSERT INTO public.audit_logs
      (actor_user_id, action, resource_type, resource_id, before_data, after_data, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      actorUserId,
      String(entry.action).slice(0, 100),
      String(entry.resourceType).slice(0, 50),
      entry.resourceId !== undefined && entry.resourceId !== null ? String(entry.resourceId).slice(0, 100) : null,
      toJsonParam(entry.beforeData),
      toJsonParam(entry.afterData),
      rawIp ? String(rawIp).slice(0, 45) : null,
      rawUa ?? null,
    ]
  )
}
