/**
 * platform-scope.ts — 平台可见范围收窄工具
 *
 * 数据库约 190 张表未启用 RLS，且应用连接用户是表 owner，
 * 未 FORCE 的 RLS 表会被绕过。因此路由 SQL 必须显式按用户可见平台过滤。
 */

/**
 * 计算本次请求实际生效的平台范围。
 * 返回 null 表示不过滤；返回数组表示必须限定在这些平台内；空数组表示无权访问任何平台。
 */
export function effectivePlatforms(
  requested: string | null | undefined,
  allowed: string[] | null,
): string[] | null {
  const req = typeof requested === 'string' ? requested.trim().toLowerCase() : ''
  if (!req) return allowed
  if (allowed === null) return [req]
  return allowed.includes(req) ? [req] : []
}
