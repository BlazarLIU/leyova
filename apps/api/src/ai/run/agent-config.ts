/**
 * ai/run/agent-config.ts — Agent 即配置
 *
 * 一个 Agent = system_prompt + 工具白名单 + 风险上限 + 输出契约。
 * 工具授权采用 fail-closed：
 *   - 白名单非空时，工具必须显式在名单内；
 *   - 工具风险等级映射为 R0/R2/R3，高于 risk_ceiling 一律拒绝。
 */

import { getPool, type DbExecutor } from '../../lib/db.js'
import type { RiskLevel } from '../tool-registry.js'

export type RiskCeiling = 'R0' | 'R1' | 'R2' | 'R3'

export interface AgentConfig {
  agentKey: string
  name: string
  description: string
  systemPrompt: string
  toolAllowlist: string[]
  riskCeiling: RiskCeiling
  outputContract: Record<string, unknown>
  isEnabled: boolean
}

interface AgentRow {
  agent_key: string
  name: string
  description: string
  system_prompt: string
  tool_allowlist: string[]
  risk_ceiling: string
  output_contract: Record<string, unknown>
  is_enabled: boolean
}

const AGENT_KEY_RE = /^[a-z][a-z0-9_]{1,63}$/
const RISK_CEILINGS: RiskCeiling[] = ['R0', 'R1', 'R2', 'R3']

function mapRow(row: AgentRow): AgentConfig {
  return {
    agentKey: row.agent_key,
    name: row.name,
    description: row.description,
    systemPrompt: row.system_prompt,
    toolAllowlist: Array.isArray(row.tool_allowlist) ? row.tool_allowlist : [],
    riskCeiling: (RISK_CEILINGS.includes(row.risk_ceiling as RiskCeiling)
      ? row.risk_ceiling
      : 'R2') as RiskCeiling,
    outputContract: row.output_contract || {},
    isEnabled: Boolean(row.is_enabled),
  }
}

/** 工具风险等级 → R 分级 */
export function riskTierOf(level: RiskLevel): RiskCeiling {
  switch (level) {
    case 'read_only':
      return 'R0'
    case 'write_with_approval':
      return 'R2'
    case 'admin_only':
      return 'R3'
    default:
      return 'R3'
  }
}

function tierValue(tier: RiskCeiling): number {
  return Number(tier.slice(1))
}

export function validateAgentKey(agentKey: string): string {
  const key = String(agentKey || '').trim()
  if (!AGENT_KEY_RE.test(key)) {
    throw new Error('agentKey 必须为 2-64 位小写字母、数字或下划线，且以字母开头')
  }
  return key
}

export async function listAgentConfigs(db?: DbExecutor, tenantId = 1): Promise<AgentConfig[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<AgentRow>(
    `SELECT agent_key, name, description, system_prompt, tool_allowlist,
            risk_ceiling, output_contract, is_enabled
       FROM public.agent_configs
      WHERE tenant_id = $1
      ORDER BY id ASC`,
    [tenantId]
  )
  return rows.map(mapRow)
}

export async function getAgentConfig(
  db: DbExecutor | undefined,
  agentKey: string,
  tenantId = 1
): Promise<AgentConfig | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<AgentRow>(
    `SELECT agent_key, name, description, system_prompt, tool_allowlist,
            risk_ceiling, output_contract, is_enabled
       FROM public.agent_configs
      WHERE tenant_id = $1 AND agent_key = $2
      LIMIT 1`,
    [tenantId, agentKey]
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export interface AgentConfigInput {
  agentKey: string
  name: string
  description?: string
  systemPrompt?: string
  toolAllowlist?: string[]
  riskCeiling?: string
  outputContract?: Record<string, unknown>
  isEnabled?: boolean
}

export async function upsertAgentConfig(
  db: DbExecutor | undefined,
  input: AgentConfigInput,
  tenantId = 1
): Promise<AgentConfig> {
  const executor = db || getPool()
  const agentKey = validateAgentKey(input.agentKey)
  const riskCeiling = String(input.riskCeiling || 'R2').toUpperCase() as RiskCeiling
  if (!RISK_CEILINGS.includes(riskCeiling)) {
    throw new Error('riskCeiling 只能是 R0 / R1 / R2 / R3')
  }
  const name = String(input.name || '').trim()
  if (!name) throw new Error('Agent 名称不能为空')

  const { rows } = await executor.query<AgentRow>(
    `INSERT INTO public.agent_configs
       (tenant_id, agent_key, name, description, system_prompt, tool_allowlist,
        risk_ceiling, output_contract, is_enabled)
     VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8::jsonb, $9)
     ON CONFLICT (tenant_id, agent_key) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       system_prompt = EXCLUDED.system_prompt,
       tool_allowlist = EXCLUDED.tool_allowlist,
       risk_ceiling = EXCLUDED.risk_ceiling,
       output_contract = EXCLUDED.output_contract,
       is_enabled = EXCLUDED.is_enabled,
       updated_at = now()
     RETURNING agent_key, name, description, system_prompt, tool_allowlist,
               risk_ceiling, output_contract, is_enabled`,
    [
      tenantId,
      agentKey,
      name,
      String(input.description || ''),
      String(input.systemPrompt || ''),
      Array.isArray(input.toolAllowlist) ? input.toolAllowlist.map(String) : [],
      riskCeiling,
      JSON.stringify(input.outputContract || {}),
      input.isEnabled !== false,
    ]
  )
  return mapRow(rows[0])
}

export async function deleteAgentConfig(
  db: DbExecutor | undefined,
  agentKey: string,
  tenantId = 1
): Promise<boolean> {
  const executor = db || getPool()
  const { rowCount } = await executor.query(
    `DELETE FROM public.agent_configs WHERE tenant_id = $1 AND agent_key = $2`,
    [tenantId, agentKey]
  )
  return (rowCount || 0) > 0
}

/**
 * 工具授权校验（fail-closed）。
 * 白名单为空表示「只允许只读工具」，避免默认授权写操作。
 */
export function checkToolAllowed(
  agent: AgentConfig | null,
  tool: { name: string; riskLevel: RiskLevel }
): { allowed: boolean; reason?: string } {
  const ceiling = agent?.riskCeiling || 'R2'
  const tier = riskTierOf(tool.riskLevel)
  if (tierValue(tier) > tierValue(ceiling)) {
    return { allowed: false, reason: `工具风险等级 ${tier} 超过 Agent 上限 ${ceiling}` }
  }
  const allowlist = agent?.toolAllowlist || []
  if (allowlist.length === 0) {
    return tool.riskLevel === 'read_only'
      ? { allowed: true }
      : { allowed: false, reason: 'Agent 未配置写工具白名单（fail-closed）' }
  }
  if (!allowlist.includes(tool.name)) {
    return { allowed: false, reason: `工具 ${tool.name} 不在 Agent 白名单内` }
  }
  return { allowed: true }
}
