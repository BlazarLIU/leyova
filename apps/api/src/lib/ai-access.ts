import type { AuthUser } from './guard.js'

/** 可查看全部用户 AI 会话 / 消息的系统管理员角色 */
export const ADMIN_ROLE = 'super_admin'

export function isAdminRole(role: string): boolean {
  return role === ADMIN_ROLE
}

/**
 * 根据当前用户角色构造「AI 会话列表」查询语句。
 * - 系统管理员：不过滤 user_id（可见全部用户），并关联出会话拥有人姓名。
 * - 普通用户：严格按 user_id 过滤，仅见本人会话。
 */
export function buildSessionsQuery(
  isAdmin: boolean,
  userId: number
): { text: string; params: unknown[] } {
  if (isAdmin) {
    return {
      text: `SELECT c.id, c.title, c.model_name, c.status,
                    c.created_at, c.updated_at, u.real_name AS owner_name
             FROM ai_conversations c
             LEFT JOIN users u ON u.id = c.user_id
             WHERE c.status != 'deleted'
             ORDER BY c.updated_at DESC LIMIT 200`,
      params: [],
    }
  }
  return {
    text: `SELECT id, title, model_name, status, created_at, updated_at
           FROM ai_conversations
           WHERE user_id = $1 AND status != 'deleted'
           ORDER BY updated_at DESC LIMIT 50`,
    params: [userId],
  }
}

/**
 * AI 会话归属校验。
 * - 系统管理员：直接放行，可查看 / 删除任意用户会话。
 * - 普通用户：会话必须归属自己，否则返回 { ok: false }。
 */
export async function assertConversationOwnership(
  pool: any,
  conversationId: string,
  user: AuthUser
): Promise<{ ok: boolean }> {
  if (isAdminRole(user.role)) return { ok: true }
  try {
    const { rows } = await pool.query(
      `SELECT user_id FROM ai_conversations WHERE id = $1`,
      [conversationId]
    )
    if (rows.length === 0) return { ok: false }
    if (rows[0].user_id !== user.id) return { ok: false }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** AI 写操作审批 / 拒绝动作判定结果 */
export type ApprovalAction =
  | { kind: 'not_found' }
  | { kind: 'not_pending'; status: string }
  | { kind: 'expired' }
  | { kind: 'execute' }

/**
 * 审批动作判定：不存在 / 不在 pending / 已过期 / 可执行。
 * - 越权（查他人日志导致查不到该行）映射为 not_found，对应原 404「审批请求不存在」。
 * - 非 pending（含重复审批）映射为 not_pending。
 * - expired 由 expires_at + 注入的 now（默认当前时间，可固定时间测试）判定。
 * 仅适用于 approve 分支（reject 分支无过期处理，用 resolveRejectAction）。
 */
export function resolveApprovalAction(
  row: null | undefined | { approval_status: string; expires_at: string | null },
  now: Date = new Date()
): ApprovalAction {
  if (!row) return { kind: 'not_found' }
  if (row.approval_status !== 'pending') return { kind: 'not_pending', status: row.approval_status }
  if (row.expires_at && new Date(row.expires_at) < now) return { kind: 'expired' }
  return { kind: 'execute' }
}

/**
 * 拒绝动作判定（reject 分支保持原语义：仅不存在 / 非 pending，无过期分支）。
 */
export function resolveRejectAction(
  row: null | undefined | { approval_status: string }
): ApprovalAction {
  if (!row) return { kind: 'not_found' }
  if (row.approval_status !== 'pending') return { kind: 'not_pending', status: row.approval_status }
  return { kind: 'execute' }
}
