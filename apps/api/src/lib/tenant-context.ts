/**
 * tenant-context.ts
 *
 * 统一租户上下文断言。缺失或非法 tenant 时 fail-closed，禁止回退到租户 1。
 */

export class TenantContextError extends Error {
  readonly statusCode = 403

  constructor(message: string) {
    super(message)
    this.name = 'TenantContextError'
  }
}

export function requireTenantId(value: unknown, source = 'unknown'): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new TenantContextError(
      `[TENANT_SECURITY_FAIL_CLOSED] 缺少有效租户上下文 (${source})，拒绝执行`,
    )
  }
  return n
}

export function tenantIdOf(user: { tenantId?: number | null } | null | undefined, source = 'auth-user'): number {
  return requireTenantId(user?.tenantId, source)
}
