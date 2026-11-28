/**
 * integrations/call-log.ts — 外部调用审计、脱敏与限流
 *
 * 所有进出外部系统的调用都必须落 integration_call_logs：
 * 只记录脱敏后的摘要，密钥/token 永远不进入日志。
 */

import { getPool, type DbExecutor } from '../lib/db.js'

export type IntegrationCallStatus = 'success' | 'error' | 'rate_limited' | 'skipped'

export interface IntegrationCallLogInput {
  tenantId: number
  connectionId?: string | null
  platform: string
  operation: string
  method?: string
  requestSummary?: unknown
  responseSummary?: unknown
  status: IntegrationCallStatus
  httpStatus?: number | null
  errorCode?: string | null
  latencyMs?: number
  retryCount?: number
  actorUserId?: number | null
  db?: DbExecutor
}

const SENSITIVE_KEY = /(secret|token|password|passwd|api[_-]?key|apikey|authorization|cookie|session|signature|sign)/i

function redactString(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1***')
    .replace(/((?:access_token|refresh_token|client_secret|api_key|apikey|password|sign)=)[^&\s,]+/gi, '$1***')
}

function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value
  if (depth > 4) return '[truncated]'
  if (typeof value === 'string') return redactString(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactValue(item, depth + 1))
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? '***' : redactValue(item, depth + 1)
    }
    return output
  }
  return String(value)
}

/**
 * 生成脱敏摘要：
 * - 对象按键名脱敏（secret/token/apiKey 等）；
 * - 文本中的 Bearer / query token 打码；
 * - 最长 500 字符，防止日志表膨胀。
 */
export function sanitizeIntegrationSummary(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return ''
  let text: string
  if (typeof value === 'string') {
    text = redactString(value)
  } else {
    try {
      text = JSON.stringify(redactValue(value))
    } catch {
      text = '[unserializable]'
    }
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export async function recordIntegrationCall(input: IntegrationCallLogInput): Promise<void> {
  const db = input.db || getPool()
  await db.query(
    `INSERT INTO public.integration_call_logs
       (tenant_id, connection_id, platform, operation, method, request_summary, response_summary,
        status, http_status, error_code, latency_ms, retry_count, actor_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      input.tenantId,
      input.connectionId || null,
      String(input.platform).slice(0, 64),
      String(input.operation).slice(0, 100),
      String(input.method || 'INTERNAL').slice(0, 8).toUpperCase(),
      sanitizeIntegrationSummary(input.requestSummary),
      sanitizeIntegrationSummary(input.responseSummary),
      input.status,
      input.httpStatus ?? null,
      input.errorCode ? String(input.errorCode).slice(0, 64) : null,
      Math.max(0, Math.round(input.latencyMs || 0)),
      Math.max(0, Math.round(input.retryCount || 0)),
      input.actorUserId ?? null,
    ]
  )
}

// ── 内存令牌桶限流（单实例；多实例可平滑替换为 Redis）──
interface Bucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitVerdict {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

export function consumeRateLimit(key: string, perMinute: number, now = Date.now()): RateLimitVerdict {
  const capacity = Math.max(1, Math.floor(perMinute) || 1)
  const bucket = buckets.get(key) || { tokens: capacity, updatedAt: now }
  const elapsed = Math.max(0, now - bucket.updatedAt)
  bucket.tokens = Math.min(capacity, bucket.tokens + (elapsed / 60_000) * capacity)
  bucket.updatedAt = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    buckets.set(key, bucket)
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 }
  }

  buckets.set(key, bucket)
  const retryAfterMs = Math.ceil(((1 - bucket.tokens) / capacity) * 60_000)
  return { allowed: false, remaining: 0, retryAfterMs }
}

export function resetRateLimits(): void {
  buckets.clear()
}

/**
 * 带退避的重试封装：只对可恢复错误重试，最终失败原样抛出。
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    retries?: number
    baseDelayMs?: number
    shouldRetry?: (error: unknown, attempt: number) => boolean
  } = {}
): Promise<{ value: T; attempts: number }> {
  const retries = Math.max(0, options.retries ?? 1)
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 200)
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const value = await operation(attempt)
      return { value, attempts: attempt + 1 }
    } catch (err) {
      lastError = err
      const retryable = options.shouldRetry ? options.shouldRetry(err, attempt) : true
      if (attempt >= retries || !retryable) break
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)))
    }
  }

  throw lastError
}
