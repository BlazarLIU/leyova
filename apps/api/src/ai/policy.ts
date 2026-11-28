/**
 * ai/policy.ts — 工具治理策略引擎（R0-R4）
 *
 * 统一回答一个问题：这个工具在当前租户下应该「自动执行 / 人工审批 / 直接拒绝」。
 *
 * 分级：
 *   R0 只读           → 自动执行
 *   R1 内部草稿       → 自动执行 + 审计
 *   R2 内部写         → 默认人工确认
 *   R3 管理 / 高风险  → 人工确认（且受角色限制）
 *   R4 资金 / 密钥    → 永久拒绝（任何配置都不能放行）
 *
 * 策略来源优先级：
 *   1. R4 静态守卫（最高，不可覆盖）
 *   2. ai_tool_policy 精确工具行
 *   3. ai_tool_policy 通配行 `*`
 *   4. 工具注册表 riskLevel 默认映射
 *
 * fail-closed：任何读取策略失败都回落到「写操作需审批」，绝不放行。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import type { RiskLevel } from './tool-registry.js'

export type RiskTier = 'R0' | 'R1' | 'R2' | 'R3' | 'R4'
export type PolicyEffect = 'allow' | 'require_approval' | 'deny'

export interface ToolDescriptor {
  name: string
  riskLevel: RiskLevel
}

export interface PolicyRow {
  tool_name: string
  risk_tier: string
  effect: string
  required_permission: string | null
  max_calls_per_run: number | null
  is_enabled: boolean
}

export interface PolicyDecision {
  effect: PolicyEffect
  tier: RiskTier
  reason: string
  /** registry = 工具注册表默认；policy = 策略表；r4_guard = 资金/密钥硬拦截 */
  source: 'registry' | 'policy' | 'r4_guard'
  requiredPermission?: string
  maxCallsPerRun?: number
}

const TIERS: RiskTier[] = ['R0', 'R1', 'R2', 'R3', 'R4']

/** R4 硬拦截：资金 / 支付 / 密钥类工具永远不能由 Agent 自动执行 */
const R4_PATTERNS: RegExp[] = [
  /(^|_)payment($|_)/,
  /(^|_)payout($|_)/,
  /(^|_)refund_execute($|_)/,
  /(^|_)transfer($|_)/,
  /(^|_)secret($|_)/,
  /(^|_)api_key($|_)/,
  /(^|_)credential($|_)/,
  /(^|_)withdraw($|_)/,
]

/** 工具风险等级 → R 分级 */
export function tierFromRiskLevel(level: RiskLevel): RiskTier {
  switch (level) {
    case 'read_only':
      return 'R0'
    case 'write_with_approval':
      return 'R2'
    case 'admin_only':
      return 'R3'
    default:
      return 'R4'
  }
}

export function tierValue(tier: RiskTier): number {
  return Number(tier.slice(1))
}

export function normalizeTier(value: unknown, fallback: RiskTier): RiskTier {
  const t = String(value || '').toUpperCase() as RiskTier
  return TIERS.includes(t) ? t : fallback
}

export function isR4ToolName(toolName: string): boolean {
  const name = String(toolName || '').toLowerCase()
  return R4_PATTERNS.some((re) => re.test(name))
}

/**
 * 纯函数决策（便于单测）：不访问数据库，只根据已取到的策略行计算。
 */
export function decideToolPolicy(
  tool: ToolDescriptor,
  row?: PolicyRow | null
): PolicyDecision {
  const baseTier = tierFromRiskLevel(tool.riskLevel)

  if (isR4ToolName(tool.name)) {
    return {
      effect: 'deny',
      tier: 'R4',
      reason: `工具 ${tool.name} 属于资金/密钥类（R4），禁止 Agent 执行`,
      source: 'r4_guard',
    }
  }

  if (row && row.is_enabled) {
    const tier = normalizeTier(row.risk_tier, baseTier)
    const effect = String(row.effect || 'inherit')
    const extra = {
      requiredPermission: row.required_permission || undefined,
      maxCallsPerRun: row.max_calls_per_run ?? undefined,
    }

    if (tierValue(tier) >= 4) {
      return { effect: 'deny', tier, reason: `策略将 ${tool.name} 标记为 R4，禁止执行`, source: 'policy' }
    }
    if (effect === 'deny') {
      return { effect: 'deny', tier, reason: `策略禁止工具 ${tool.name}`, source: 'policy' }
    }
    if (effect === 'require_approval') {
      return { effect: 'require_approval', tier, reason: `策略要求 ${tool.name} 人工确认`, source: 'policy', ...extra }
    }
    if (effect === 'allow') {
      // 只有 R0/R1 才能真正免审批；写操作即便配置 allow 也必须人工确认（fail-closed）
      if (tierValue(tier) <= 1) {
        return { effect: 'allow', tier, reason: `策略允许 ${tool.name} 自动执行（${tier}）`, source: 'policy', ...extra }
      }
      return {
        effect: 'require_approval',
        tier,
        reason: `策略允许 ${tool.name}，但 ${tier} 写操作仍需人工确认（fail-closed）`,
        source: 'policy',
        ...extra,
      }
    }
    // inherit：按工具注册表风险等级走默认判断（策略行仅用于覆盖 effect / 权限）
    return defaultDecision(tool, baseTier, 'policy', extra)
  }

  return defaultDecision(tool, baseTier, 'registry')
}

function defaultDecision(
  tool: ToolDescriptor,
  tier: RiskTier,
  source: 'registry' | 'policy',
  extra: { requiredPermission?: string; maxCallsPerRun?: number } = {}
): PolicyDecision {
  const reason = `按 ${tier} 默认策略处理 ${tool.name}`
  if (tierValue(tier) === 0 || tierValue(tier) === 1) {
    return { effect: 'allow', tier, reason, source, ...extra }
  }
  if (tierValue(tier) >= 4) {
    return { effect: 'deny', tier, reason, source, ...extra }
  }
  return { effect: 'require_approval', tier, reason, source, ...extra }
}

/**
 * 从数据库解析生效策略。读取失败时返回保守默认（写操作需审批），不抛错阻断主链路。
 */
export async function resolveToolPolicy(
  db: DbExecutor | undefined,
  tenantId: number,
  tool: ToolDescriptor
): Promise<PolicyDecision> {
  if (isR4ToolName(tool.name)) {
    return decideToolPolicy(tool, null)
  }

  try {
    const executor = db || getPool()
    const { rows } = await executor.query<PolicyRow>(
      `SELECT tool_name, risk_tier, effect, required_permission, max_calls_per_run, is_enabled
         FROM public.ai_tool_policy
        WHERE tenant_id = $1
          AND tool_name IN ($2, '*')
        ORDER BY (tool_name = $2) DESC
        LIMIT 1`,
      [tenantId, tool.name]
    )
    return decideToolPolicy(tool, rows[0] || null)
  } catch (err) {
    console.warn('[policy] resolve failed, fallback to registry defaults:', (err as Error)?.message || err)
    return decideToolPolicy(tool, null)
  }
}
