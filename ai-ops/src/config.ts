/**
 * config.ts — 配置分层：环境变量（非密）/ DB（可热更）/ 默认值
 * 禁止把密钥写进代码；缺必填项时启动即失败。
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`缺少必填环境变量 ${name}`)
  return v
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  isProd: optional('NODE_ENV', 'development') === 'production',
  databaseUrl: required('DATABASE_URL'),
  host: optional('AI_OPS_HOST', '0.0.0.0'),
  port: Number(optional('AI_OPS_PORT', '8790')),
  sessionSecret: required('SESSION_SECRET'),
  sessionDays: Number(optional('SESSION_DAYS', '7')),
  smsProvider: optional('SMS_PROVIDER', 'dev'), // dev = 打印到日志
  ai: {
    mode: optional('AI_MODE', 'none') as 'api' | 'gateway' | 'none',
    baseUrl: optional('AI_PROVIDER_BASE_URL', ''),
    apiKey: optional('AI_PROVIDER_API_KEY', ''),
    model: optional('AI_MODEL_DEFAULT', 'deepseek-chat'),
    maxTokens: Number(optional('AI_MAX_TOKENS_PER_RUN', '60000')),
  },
  storage: {
    driver: optional('STORAGE_DRIVER', 'local') as 'local' | 's3',
    localDir: optional('STORAGE_LOCAL_DIR', './data/files'),
  },
  logLevel: optional('LOG_LEVEL', 'info'),
} as const

export type Config = typeof config
