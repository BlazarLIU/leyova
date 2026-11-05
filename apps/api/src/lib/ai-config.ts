// 运行时 AI 配置：从 system_config 表读取 AI 引擎与 DeerFlow 连接参数，
// 覆盖 env 默认值（system_config 优先）。带 TTL 缓存，避免每次请求查库。
//
// 键（由「系统配置 → AI 配置」页面写入）：
//   ai_engine          auto | deerflow | openclaw（默认 openclaw：OpenClaw 主底座 + DeerFlow 兜底；
//                      2026-09-01 由 DeerFlow 优先切换为 OpenClaw 优先）
//   deerflow_api_base  DeerFlow Gateway 入口（如 http://localhost:2026/api/langgraph，兜底用）
//   deerflow_model     DeerFlow 使用的模型名（经 run context 白名单键 model_name 注入，兜底用）
//   deerflow_timeout_ms 请求超时（毫秒，兜底用）
import { getPool } from './db.js'
import { env } from '../config/env.js'

export type AiEngineMode = 'auto' | 'deerflow' | 'openclaw'

export interface AiRuntimeConfig {
  engine: AiEngineMode
  deerflowApiBase: string
  deerflowModel: string
  deerflowTimeoutMs: number
}

const CACHE_TTL_MS = 10_000

let cache: { snapshot: AiRuntimeConfig; ts: number } | null = null

function envDefaults(): AiRuntimeConfig {
  return {
    engine: 'openclaw',
    deerflowApiBase: env.DEERFLOW_API_BASE,
    deerflowModel: env.DEERFLOW_MODEL,
    deerflowTimeoutMs: env.DEERFLOW_TIMEOUT_MS,
  }
}

function normalizeEngine(v: string | undefined): AiEngineMode {
  if (v === 'deerflow' || v === 'openclaw') return v
  return 'auto'
}

async function loadFromDb(): Promise<AiRuntimeConfig> {
  const cfg = envDefaults()
  try {
    const { rows } = await getPool().query<{ config_key: string; config_value: string }>(
      `SELECT config_key, config_value FROM system_config
       WHERE config_key IN ('ai_engine', 'deerflow_api_base', 'deerflow_model', 'deerflow_timeout_ms')`
    )
    for (const r of rows) {
      switch (r.config_key) {
        case 'ai_engine':
          cfg.engine = normalizeEngine(r.config_value)
          break
        case 'deerflow_api_base':
          if (r.config_value.trim()) cfg.deerflowApiBase = r.config_value.trim()
          break
        case 'deerflow_model':
          if (r.config_value.trim()) cfg.deerflowModel = r.config_value.trim()
          break
        case 'deerflow_timeout_ms': {
          const ms = Number(r.config_value)
          if (Number.isFinite(ms) && ms > 0) cfg.deerflowTimeoutMs = ms
          break
        }
      }
    }
  } catch (err) {
    // 表不可用（如未迁移）时静默降级为 env 默认
    console.warn('[ai-config] read system_config failed, using env defaults:', (err as Error).message)
  }
  cache = { snapshot: cfg, ts: Date.now() }
  return cfg
}

/** 同步快照（可能命中 TTL 缓存；并发请求间一致，避免抖动） */
export function aiRuntimeSnapshot(): AiRuntimeConfig {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.snapshot
  return envDefaults()
}

/** 刷新（异步，供请求侧取最新配置；缓存新鲜时直接返回，避免每请求查库） */
export async function refreshAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.snapshot
  return loadFromDb()
}