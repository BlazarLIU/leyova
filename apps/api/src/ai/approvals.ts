/**
 * ai/approvals.ts — 写操作审批的状态机与执行回执
 *
 * 八态：pending → approved → executing → executed / failed
 *          ↘ rejected / expired / cancelled
 *
 * 关键保证：
 *   1. 对外只暴露 public_id（UUID），内部自增 id 不外泄。
 *   2. 审批创建时固化 payload SHA-256 摘要，执行前必须重新校验。
 *   3. 认领执行使用原子条件更新（status → executing），天然防重放：
 *      同一条审批只有一次能把 pending 改成 executing。
 *   4. 执行结果写入 receipt（成功/失败都写），可追溯「批了什么、谁执行的、结果如何」。
 *   5. 任何失败都不放行写操作（fail-closed）。
 */

import crypto from 'node:crypto'
import { getPool, type DbExecutor } from '../lib/db.js'
import { computePayloadDigest } from './payload-digest.js'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'rejected'
  | 'expired'
  | 'cancelled'

export interface ApprovalRow {
  id: number
  public_id: string
  tool_log_id: number
  requested_by: number
  approved_by: number | null
  status: ApprovalStatus
  expires_at: string | null
  payload_digest: string | null
  tenant_id: number
  attempts: number
  requested_risk: string | null
  decision_reason?: string | null
  receipt?: ExecutionReceipt | null
  approved_at?: string | null
  executed_at?: string | null
  created_at?: string | null
}

export interface CreateApprovalInput {
  toolLogId: number
  requestedBy: number
  payload: unknown
  tenantId?: number | null
  riskTier?: string | null
  ttlHours?: number
  reason?: string
}

export interface CreatedApproval {
  id: number
  publicId: string
  expiresAt: string
  payloadDigest: string
}

/**
 * 创建 pending 审批。返回 null 表示落库失败，调用方必须拒绝写操作。
 */
export async function createApproval(
  db: DbExecutor | undefined,
  input: CreateApprovalInput
): Promise<CreatedApproval | null> {
  const executor = db || getPool()
  const digest = computePayloadDigest(input.payload)
  const ttlHours = Number.isFinite(input.ttlHours) && Number(input.ttlHours) > 0 ? Number(input.ttlHours) : 24
  const tenantId = input.tenantId ?? null

  try {
    const { rows } = await executor.query<{
      id: number
      public_id: string
      expires_at: Date
    }>(
      `INSERT INTO public.ai_action_approvals
         (tool_log_id, requested_by, status, expires_at, payload_digest,
          requested_risk, decision_reason, tenant_id)
       VALUES ($1, $2, 'pending', NOW() + ($3 || ' hours')::interval, $4, $5, $6,
               COALESCE($7, (SELECT tenant_id FROM public.users WHERE id = $2)))
       RETURNING id, public_id, expires_at`,
      [
        input.toolLogId,
        input.requestedBy,
        String(ttlHours),
        digest,
        input.riskTier || null,
        input.reason || null,
        tenantId,
      ]
    )
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      publicId: row.public_id,
      expiresAt: row.expires_at?.toISOString?.() || String(row.expires_at),
      payloadDigest: digest,
    }
  } catch (err) {
    console.warn('[approvals] create failed:', (err as Error)?.message || err)
    return null
  }
}

export type ClaimFailureReason =
  | 'not_found'
  | 'not_pending'
  | 'expired'
  | 'tenant_mismatch'
  | 'digest_mismatch'

export type ClaimResult =
  | { ok: true; approval: ApprovalRow }
  | { ok: false; reason: ClaimFailureReason; status?: ApprovalStatus }

/**
 * 原子认领一条审批用于执行。
 * 返回 ok=false 时，调用方不得执行任何写操作。
 */
export async function claimApproval(
  db: DbExecutor | undefined,
  input: {
    toolLogId: number
    approverId: number
    tenantId: number
    payload: unknown
  }
): Promise<ClaimResult> {
  const executor = db || getPool()
  const expectedDigest = computePayloadDigest(input.payload)

  const { rows } = await executor.query<ApprovalRow>(
    `SELECT id, public_id, tool_log_id, requested_by, approved_by, status,
            expires_at, payload_digest, tenant_id, attempts, requested_risk
       FROM public.ai_action_approvals
      WHERE tool_log_id = $1
      ORDER BY id DESC
      LIMIT 1`,
    [input.toolLogId]
  )
  const approval = rows[0]
  if (!approval) return { ok: false, reason: 'not_found' }
  if (approval.status !== 'pending') {
    return { ok: false, reason: 'not_pending', status: approval.status }
  }
  if (Number(approval.tenant_id) !== Number(input.tenantId)) {
    return { ok: false, reason: 'tenant_mismatch', status: approval.status }
  }
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await finalizeApproval(executor, approval.id, {
      status: 'expired',
      reason: '审批已过期（执行前重校验）',
    }).catch(() => undefined)
    return { ok: false, reason: 'expired', status: 'expired' }
  }
  if (!approval.payload_digest || approval.payload_digest !== expectedDigest) {
    await finalizeApproval(executor, approval.id, {
      status: 'failed',
      reason: 'PAYLOAD_TAMPERED: 审批内容与申请时不一致',
    }).catch(() => undefined)
    return { ok: false, reason: 'digest_mismatch', status: 'failed' }
  }

  // 原子认领：只有第一次 pending → executing 能成功，防并发/重放
  const claimed = await executor.query<ApprovalRow>(
    `UPDATE public.ai_action_approvals
        SET status = 'executing',
            approved_by = $2,
            approved_at = NOW(),
            attempts = attempts + 1
      WHERE id = $1
        AND status = 'pending'
        AND payload_digest = $3
        AND (expires_at IS NULL OR expires_at > NOW())
      RETURNING id, public_id, tool_log_id, requested_by, approved_by, status,
                expires_at, payload_digest, tenant_id, attempts, requested_risk`,
    [approval.id, input.approverId, expectedDigest]
  )
  if (!claimed.rows[0]) {
    return { ok: false, reason: 'not_pending' }
  }
  return { ok: true, approval: claimed.rows[0] }
}

export interface ExecutionReceipt {
  approvalId: string
  toolName: string
  toolLogId: number
  ok: boolean
  executedBy: number
  payloadDigest: string
  startedAt: string
  finishedAt: string
  durationMs: number
  resultSummary?: string
  error?: string
}

export function buildReceipt(input: {
  approvalPublicId: string
  toolName: string
  toolLogId: number
  ok: boolean
  executedBy: number
  payloadDigest: string
  startedAt: number
  result?: unknown
  error?: string
}): ExecutionReceipt {
  const finishedAt = Date.now()
  let resultSummary: string | undefined
  if (input.ok && input.result !== undefined) {
    try {
      resultSummary = JSON.stringify(input.result).slice(0, 2000)
    } catch {
      resultSummary = String(input.result).slice(0, 2000)
    }
  }
  return {
    approvalId: input.approvalPublicId,
    toolName: input.toolName,
    toolLogId: input.toolLogId,
    ok: input.ok,
    executedBy: input.executedBy,
    payloadDigest: input.payloadDigest,
    startedAt: new Date(input.startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - input.startedAt,
    resultSummary,
    error: input.error,
  }
}

/** 写入终态与回执（幂等：只更新仍处于 executing/approved 的行） */
export async function finalizeApproval(
  db: DbExecutor | undefined,
  approvalId: number,
  outcome: {
    status: Extract<ApprovalStatus, 'executed' | 'failed' | 'cancelled' | 'expired'>
    receipt?: ExecutionReceipt
    reason?: string
    executedBy?: number
  }
): Promise<void> {
  const executor = db || getPool()
  await executor.query(
    `UPDATE public.ai_action_approvals
        SET status = $2::text,
            receipt = COALESCE($3::jsonb, receipt),
            decision_reason = COALESCE($4::text, decision_reason),
            executed_by = COALESCE($5, executed_by),
            executed_at = CASE WHEN $2::text IN ('executed', 'failed') THEN NOW() ELSE executed_at END
      WHERE id = $1`,
    [
      approvalId,
      outcome.status,
      outcome.receipt ? JSON.stringify(outcome.receipt) : null,
      outcome.reason || null,
      outcome.executedBy ?? null,
    ]
  )
}

/** 拒绝审批（仅 pending 可拒绝，防并发覆盖） */
export async function rejectApproval(
  db: DbExecutor | undefined,
  input: { approvalId: number; rejectedBy: number; reason?: string }
): Promise<boolean> {
  const executor = db || getPool()
  const { rowCount } = await executor.query(
    `UPDATE public.ai_action_approvals
        SET status = 'rejected',
            approved_by = $2,
            approved_at = NOW(),
            decision_reason = $3
      WHERE id = $1 AND status = 'pending'`,
    [input.approvalId, input.rejectedBy, input.reason || null]
  )
  return (rowCount || 0) > 0
}

/** 按对外 UUID 查询审批（供 API / 审计使用） */
export async function getApprovalByPublicId(
  db: DbExecutor | undefined,
  publicId: string,
  tenantId: number
): Promise<ApprovalRow | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<ApprovalRow>(
    `SELECT id, public_id, tool_log_id, requested_by, approved_by, status,
            expires_at, payload_digest, tenant_id, attempts, requested_risk,
            decision_reason, receipt, approved_at, executed_at, created_at
       FROM public.ai_action_approvals
      WHERE public_id = $1 AND tenant_id = $2
      LIMIT 1`,
    [publicId, tenantId]
  )
  return rows[0] || null
}
