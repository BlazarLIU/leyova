/**
 * integrations/types.ts — 外部系统连接器契约
 *
 * 所有连接器统一暴露 capabilities() 与 healthCheck 语义：
 *   - 配置不完整时返回 unconfigured，而不是抛错；
 *   - 只有 probe=true 时才发起真实外网请求；
 *   - 写能力必须标注风险等级，供上层「先 diff 再人工确认」使用。
 */

export type IntegrationCategory = 'platform' | 'advertising' | 'llm' | 'collaboration'
export type IntegrationAuthType = 'app_secret' | 'oauth2' | 'api_key' | 'webhook'
export type HealthStatus = 'healthy' | 'degraded' | 'unconfigured' | 'down' | 'unknown'

export interface IntegrationCapability {
  key: string
  name: string
  description: string
  /** R0 只读 / R1 低风险写 / R2 中风险写 / R3 高风险写 */
  risk: 'R0' | 'R1' | 'R2' | 'R3'
  write: boolean
}

export interface ConnectorProbeResult {
  ok: boolean
  status?: number
  errorCode?: string
  message?: string
}

export interface HealthCheckContext {
  tenantId: number
  /** 非敏感配置：baseUrl / model 等 */
  config: Record<string, unknown>
  /** 已解密凭证，仅服务端内存可见 */
  secrets: Record<string, string> | null
  /** false 时只做配置完整性校验，不发起外网请求 */
  probe: boolean
  timeoutMs?: number
}

export interface HealthCheckResult {
  status: HealthStatus
  detail: string
  latencyMs: number
  checkedAt: string
  missingFields: string[]
  httpStatus?: number
  errorCode?: string
}

export interface ConnectorCallContext extends HealthCheckContext {
  /** 能力键，例如 ad.budget.update */
  operation: string
  params: Record<string, unknown>
}

export interface ConnectorCallResult extends ConnectorProbeResult {
  data?: unknown
}

export interface IntegrationConnector {
  key: string
  name: string
  category: IntegrationCategory
  authType: IntegrationAuthType
  /** 必填凭证字段，用于完整性校验，绝不回显值 */
  credentialFields: string[]
  /** 必填非敏感配置字段（如 baseUrl / model），缺失时同样判定为未配置 */
  requiredConfigFields?: string[]
  /** 允许写入的非敏感配置键，防止任意字段落库 */
  configFields?: string[]
  /** 非敏感默认配置（baseUrl、model 等） */
  defaultConfig: Record<string, string>
  docsUrl?: string
  capabilities(): IntegrationCapability[]
  /** OAuth 授权入口；缺凭证时返回配置指引，不强制走完整 OAuth 流程 */
  authorize?(ctx: HealthCheckContext): Promise<ConnectorProbeResult>
  /** 刷新 access_token */
  refresh?(ctx: HealthCheckContext): Promise<ConnectorProbeResult>
  /** 真实探活；未实现时 healthCheck 只做配置校验 */
  probe?(ctx: HealthCheckContext): Promise<ConnectorProbeResult>
  /** 业务调用；写操作必须先沙箱 diff 再人工确认，禁止直接透传执行 */
  call?(ctx: ConnectorCallContext): Promise<ConnectorCallResult>
}
