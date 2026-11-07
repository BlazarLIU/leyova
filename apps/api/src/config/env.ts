import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8788),
  HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5513'),
  SESSION_COOKIE_NAME: z.string().default('leyova_session'),
  SESSION_SECRET: z.string().min(16).default('dev-session-secret-please-change'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_NAME: z.string().default('leyova'),
  DB_PASSWORD: z.string().default(''),
  // 可选：直接给连接串（存在时优先于 DB_* 组合）
  DATABASE_URL: z.string().optional(),
  // 管理员创建账号时未填密码则使用该值；留空则由调用方显式指定
  DEFAULT_USER_PASSWORD: z.string().optional(),

  // ── AI Integration ──
  // Master switch: when false, /api/v1/ai/chat uses the rule-based fallback only.
  AI_ENABLED: z.coerce.boolean().default(false),
  // DeerFlow (Super Agent) — LangGraph-compatible Gateway endpoint (fallback /
  // rollback path; OpenClaw 为主底座，DeerFlow 仅在 OpenClaw 不可用时兜底).
  DEERFLOW_API_BASE: z.string().url().default('http://localhost:2026/api/langgraph'),
  // DeerFlow 服务间认证头 X-DeerFlow-Internal-Token 的值
  DEERFLOW_INTERNAL_TOKEN: z.string().default(''),
  DEERFLOW_MODEL: z.string().default('deepseek-ai/DeepSeek-V4-Flash'),
  // 非流式超时（毫秒）；运行时仍可经 system_config 表 deerflow_timeout_ms 单独调整
  DEERFLOW_TIMEOUT_MS: z.coerce.number().int().positive().default(900000),
  // OpenClaw (Agent Runtime, 主引擎) — OpenAI-compatible Gateway endpoint.
  OPENCLAW_API_BASE: z.string().url().default('http://127.0.0.1:18789/v1'),
  OPENCLAW_API_KEY: z.string().default(''),
  OPENCLAW_MODEL: z.string().default('openclaw/default'),
  OPENCLAW_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  // OpenClaw 配置文件路径（AI 配置页写入目标）；留空则取 <OPENCLAW_HOME>/state/openclaw.json
  OPENCLAW_CONFIG_PATH: z.string().default(''),
  // OpenClaw 安装目录；未配置时「AI 配置写入 / 重启」能力视为未启用
  OPENCLAW_HOME: z.string().default(''),
  // 运行 OpenClaw 的 node 二进制；留空则使用当前进程的 process.execPath
  OPENCLAW_NODE_BIN: z.string().default(''),
  // OpenClaw 网关端口（重启时按此端口 pkill）
  OPENCLAW_GATEWAY_PORT: z.coerce.number().int().positive().default(18789),
  // AnythingLLM (knowledge / RAG)
  ANYTHINGLLM_API_BASE: z.string().url().default('http://localhost:3001/api'),
  ANYTHINGLLM_API_KEY: z.string().default(''),
  // OpenViking (Context / Memory)
  OPENVIKING_API_BASE: z.string().url().default('http://localhost:1933'),
  OPENVIKING_API_KEY: z.string().default(''),
  // ── MCP Server（供 DeerFlow 兜底链路调用）──
  // Bearer token：DeerFlow extensions_config 中 headers 引用同值
  LEYOVA_MCP_TOKEN: z.string().default('dev-leyova-mcp-token'),
  // 默认映射的用户（X-Leyova-User-Id 头缺省时使用）
  LEYOVA_MCP_DEFAULT_USER_ID: z.coerce.number().int().positive().default(1),
  // MCP Server 监听端口
  MCP_PORT: z.coerce.number().int().positive().default(9101),

  // ── 日志 / 定时 ──
  LOG_LEVEL: z.string().default('info'),
  LOG_ROOT: z.string().default(''),
  CRON_AI_MODEL: z.string().default(''),
})

const parsed = envSchema.parse(process.env)

// 生产环境下强制要求显式配置会话密钥与 MCP token
if (parsed.NODE_ENV === 'production') {
  const checkEnv = envSchema
    .extend({
      SESSION_SECRET: z.string().min(16),
      LEYOVA_MCP_TOKEN: z.string().min(1),
    })
    .refine((v) => v.SESSION_SECRET !== 'dev-session-secret-please-change', {
      message: '生产环境必须设置 SESSION_SECRET（不能使用开发默认值）',
    })
    .refine((v) => v.LEYOVA_MCP_TOKEN !== 'dev-leyova-mcp-token', {
      message: '生产环境必须设置 LEYOVA_MCP_TOKEN（不能使用开发默认值）',
    })
  checkEnv.parse(parsed)
}

export const env = parsed
