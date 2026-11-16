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

  // ── AI Integration (OpenAI-compatible v2 provider) ──
  // Master switch: when false, AI queries run on deterministic rule/schema-mapper engine.
  AI_ENABLED: z.coerce.boolean().default(false),
  LLM_API_BASE: z.string().url().default('http://127.0.0.1:11434/v1'),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('deepseek-chat'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  // AnythingLLM (knowledge / RAG)
  ANYTHINGLLM_API_BASE: z.string().url().default('http://localhost:3001/api'),
  ANYTHINGLLM_API_KEY: z.string().default(''),
  // OpenViking (Context / Memory)
  OPENVIKING_API_BASE: z.string().url().default('http://localhost:1933'),
  OPENVIKING_API_KEY: z.string().default(''),
  // ── MCP Server（标准 Model Context Protocol 出口）──
  // Bearer token：供外部客户端请求头 Authorization: Bearer 认证
  LEYOVA_MCP_TOKEN: z.string().default('dev-leyova-mcp-token'),
  // HMAC 签名密钥（用于签名/校验 X-Leyova-User-Sig；未设时回退使用 LEYOVA_MCP_TOKEN）
  LEYOVA_MCP_SIGNING_SECRET: z.string().default(''),
  // 是否强制要求 X-Leyova-User-Sig HMAC 校验（生产建议开启）
  LEYOVA_MCP_REQUIRE_SIG: z.coerce.boolean().default(false),
  // 可选：显式配置的默认用户 ID（不再静默回退 super_admin 1）
  LEYOVA_MCP_DEFAULT_USER_ID: z.coerce.number().int().positive().optional(),
  // MCP Server 监听端口
  MCP_PORT: z.coerce.number().int().positive().default(9101),

  // ---- 会话与加密密钥 ----
  API_ENCRYPTION_KEY: z.string().default(''),
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
    .refine(
      (v) =>
        v.SESSION_SECRET !== 'dev-session-secret-please-change' &&
        v.SESSION_SECRET !== 'leyova-local-session-secret-change-in-prod',
      {
        message: '生产环境必须设置强随机 SESSION_SECRET（不能使用开发或示例默认值）',
      }
    )
    .refine(
      (v) =>
        v.LEYOVA_MCP_TOKEN !== 'dev-leyova-mcp-token' &&
        v.LEYOVA_MCP_TOKEN !== 'leyova-local-mcp-token-change-in-prod' &&
        v.LEYOVA_MCP_TOKEN !== 'change-me',
      {
        message: '生产环境必须设置强随机 LEYOVA_MCP_TOKEN（不能使用开发或示例默认值）',
      }
    )
    .refine(
      (v) =>
        v.API_ENCRYPTION_KEY.length >= 32 &&
        v.API_ENCRYPTION_KEY !== 'leyova-data-governance-secret-key-32chars!!' &&
        v.API_ENCRYPTION_KEY !== 'replace-with-strong-random-64-char-encryption-key' &&
        v.API_ENCRYPTION_KEY !== 'change-me',
      {
        message: '生产环境必须设置至少 32 字符的强随机 API_ENCRYPTION_KEY（用于 AES-256-GCM 开放平台凭据加密）',
      }
    )
  checkEnv.parse(parsed)
}

export const env = parsed
