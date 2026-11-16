/**
 * AI 作用域与对话类型 — 独立于任何具体 AI 运行时（OpenClaw / DeerFlow 已于 2026-11-15 移除）。
 *
 * 这些类型原先定义在 `lib/ai-gateway.ts`，因 gateway 已下线而单独抽出，
 * 供 MCP Server、工具注册表、OpenViking 客户端与 cron 复用，避免类型定义随运行时一起消失。
 */

/** AI 调用作用域：当前用户 + 其可见的数据范围（直播间/角色/组织） */
export interface AiScopeContext {
  userId: number
  username: string
  role: string
  scopeType: 'user' | 'room' | 'role' | 'org'
  scopeId: string
  roomScope: number[]
  openvikingAccount?: string
  openvikingUser?: string
  /** 私有层知识库 workspace */
  anythingllmWorkspace?: string
  /** 角色层知识库 workspace */
  knowledgeRoleWorkspace?: string
  /** 公共层知识库 workspace */
  knowledgePublicWorkspace?: string
  /** 合规风控摘要（最新未读或高危变更提示） */
  complianceDigest?: string
}

/** 单轮对话消息 */
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}
