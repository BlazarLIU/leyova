/**
 * OpenClaw 配置读写 / 自动重启。
 *
 * 「系统配置 → AI 配置」页修改的是 OpenClaw 的真实配置文件 openclaw.json：
 * - 读：直接解析 openclaw.json 并抽取「大模型相关设置 / 会话管理相关设置」子集；
 * - 写：构造 patch 对象 → 通过官方 `openclaw config patch`（schema 校验的原子写）落盘；
 * - 重启：找到 :18789 上的 gateway 进程并 kill 后，按 openclaw-start.sh 同款参数重启。
 *
 * 涉及路径均与 openclaw-start.sh 保持一致：
 *   OPENCLAW_STATE_DIR / OPENCLAW_CONFIG_PATH / XDG_CACHE_HOME / PATH / node 二进制 / dist 入口。
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { dirname, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { env } from '../config/env.js'

// OpenClaw 安装位置（全部由环境变量驱动；未配置 OPENCLAW_HOME 时相关能力视为未启用）
const OPENCLAW_HOME = env.OPENCLAW_HOME
const NODE_BIN = env.OPENCLAW_NODE_BIN || process.execPath
const OPENCLAW_DIST = `${OPENCLAW_HOME}/node_modules/openclaw/dist/index.js`
const OPENCLAW_STATE_DIR = `${OPENCLAW_HOME}/state`
const OPENCLAW_CACHE = `${OPENCLAW_HOME}/cache`
const OPENCLAW_GATEWAY_PORT = env.OPENCLAW_GATEWAY_PORT

/** 是否已配置 OpenClaw 安装目录（未配置则配置写入/重启不可用） */
export function isOpenClawEnabled(): boolean {
  return !!OPENCLAW_HOME
}

function assertOpenClawEnabled(): void {
  if (!isOpenClawEnabled()) {
    throw new Error('OpenClaw 未启用：请先配置环境变量 OPENCLAW_HOME')
  }
}

function getConfigPath(): string {
  if (env.OPENCLAW_CONFIG_PATH) return env.OPENCLAW_CONFIG_PATH
  return OPENCLAW_HOME ? `${OPENCLAW_STATE_DIR}/openclaw.json` : ''
}

/** 校验用环境：让 openclaw CLI 指向与网关一致的配置/状态目录 */
function openClawEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    OPENCLAW_STATE_DIR,
    OPENCLAW_CONFIG_PATH: getConfigPath(),
    XDG_CACHE_HOME: OPENCLAW_CACHE,
    PATH: process.env.PATH,
  }
}

function hasConfigFile(): boolean {
  return existsSync(getConfigPath())
}

function readConfig(): Record<string, any> {
  const path = getConfigPath()
  if (!hasConfigFile()) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>
}

// ---------------------------------------------------------------------------
// 读取：抽取可编辑子集（视图）
// ---------------------------------------------------------------------------

const PROVIDER_MODEL_FIELD = 'id' // provider.models[] 中标识模型的键名

/** 由主模型引用推断 providerId（ref 格式 provider/model），失效则回退第一个 provider */
function resolveProviderId(cfg: Record<string, any>): string | null {
  const providers = cfg?.models?.providers ?? {}
  const primary = String(cfg?.agents?.defaults?.model?.primary || '').split('/')[0]
  if (primary && providers[primary]) return primary
  const keys = Object.keys(providers)
  return keys[0] ?? null
}

/** 定位 provider.models[] 中与给定 ref 匹配的模型项（忽略 provider 前缀） */
function findProviderModel(provider: any, ref: string | undefined): any | undefined {
  if (!Array.isArray(provider?.models)) return undefined
  const bare = String(ref || '').split('/').slice(1).join('/')
  return provider.models.find((m: any) => (m.id || m.name) === bare)
}

function maskSecret(v: unknown): string {
  return v ? '***' : ''
}

/** 返回展示给前端的 OpenClaw 配置视图（apiKey 掩码） */
export function getOpenClawConfigView(): Record<string, any> {
  if (!isOpenClawEnabled()) return { enabled: false }
  const cfg = readConfig()
  const providers = cfg.models?.providers ?? {}
  const providerId = resolveProviderId(cfg)
  const provider = providerId ? providers[providerId] : null
  const defaults = cfg.agents?.defaults ?? {}
  const primary = String(defaults.model?.primary || '')
  const primaryModelMeta = provider ? findProviderModel(provider, primary) : undefined
  const compaction = defaults.compaction ?? {}

  return {
    modelsMode: cfg.models?.mode ?? 'merge',
    providerId,
    provider: {
      baseUrl: provider?.baseUrl ?? '',
      apiKey: maskSecret(provider?.apiKey),
    },
    primaryModel: primary,
    allowList: Array.isArray(defaults.modelPolicy?.allow) ? defaults.modelPolicy.allow : [],
    primaryModelMeta: {
      reasoning: primaryModelMeta?.reasoning ?? false,
      maxTokens: primaryModelMeta?.maxTokens ?? provider?.maxTokens ?? 4096,
      contextWindow: primaryModelMeta?.contextWindow ?? 128000,
    },
    session: {
      dmScope: cfg.session?.dmScope ?? 'main',
      maxConcurrent: defaults.maxConcurrent ?? 8,
      subagentsMaxConcurrent: defaults.subagents?.maxConcurrent ?? 4,
      compactionEnabled: compaction.enabled ?? true,
      compactionMode: compaction.mode ?? 'safeguard',
      contextInjection: defaults.contextInjection ?? 'always',
      workspace: String(defaults.workspace ?? `${OPENCLAW_STATE_DIR}/workspace`),
    },
    defaultTimeoutSec: Math.round(env.OPENCLAW_TIMEOUT_MS / 1000),
  }
}

// ---------------------------------------------------------------------------
// 写入：读现有配置 → 在内存中应用可编辑键 → 备份 + 原子替换 → schema 校验
// （失败则回滚备份，旧配置保持不变；避免 patch 数组整体替换损坏模型目录）
// ---------------------------------------------------------------------------

/** 把编辑器提交的配置应用进 openclaw.json 对象（在内存中直接修改） */
function applyEdits(cfg: Record<string, any>, input: Record<string, any>): void {
  // models.mode
  if (input.modelsMode) {
    cfg.models = cfg.models ?? {}
    cfg.models.mode = input.modelsMode
  }

  // 提供商 baseUrl / apiKey / 模型 meta
  const providerId = input.providerId
  const p = input.provider || {}
  const meta = input.primaryModelMeta
  if (providerId) {
    cfg.models = cfg.models ?? {}
    cfg.models.providers = cfg.models.providers ?? {}
    if (p.baseUrl || (p.apiKey && p.apiKey !== '***') || (input.primaryModel && (meta?.reasoning !== undefined || meta?.maxTokens))) {
      const prov = cfg.models.providers[providerId] ?? {}
      if (p.baseUrl) prov.baseUrl = p.baseUrl
      if (p.apiKey && p.apiKey !== '***') prov.apiKey = p.apiKey
      if (input.primaryModel && meta) {
        const bare = String(input.primaryModel).split('/').slice(1).join('/')
        const models = Array.isArray(prov.models) ? prov.models : []
        let entry = models.find((m: any) => (m.id || m.name) === bare)
        if (!entry) { entry = { id: bare }; models.push(entry) }
        if (meta.reasoning !== undefined) entry.reasoning = !!meta.reasoning
        if (meta.maxTokens) entry.maxTokens = Number(meta.maxTokens)
        prov.models = models
      }
      cfg.models.providers[providerId] = prov
    }
  }

  // agents.defaults
  cfg.agents = cfg.agents ?? {}
  cfg.agents.defaults = cfg.agents.defaults ?? {}
  const d = cfg.agents.defaults
  if (input.primaryModel) {
    d.model = { ...(d.model ?? {}), primary: input.primaryModel }
  }
  if (Array.isArray(input.allowList)) {
    d.modelPolicy = { ...(d.modelPolicy ?? {}), allow: input.allowList }
  }

  const s = input.session || {}
  if (s.maxConcurrent) d.maxConcurrent = Number(s.maxConcurrent)
  if (s.subagentsMaxConcurrent) {
    d.subagents = { ...(d.subagents ?? {}), maxConcurrent: Number(s.subagentsMaxConcurrent) }
  }
  const c = { ...(d.compaction ?? {}) }
  if (s.compactionEnabled !== undefined) c.enabled = !!s.compactionEnabled
  if (s.compactionMode) c.mode = s.compactionMode
  if (Object.keys(c).length) d.compaction = c
  if (s.contextInjection) d.contextInjection = s.contextInjection
  if (s.workspace) d.workspace = s.workspace

  // session.dmScope
  if (s.dmScope) {
    cfg.session = cfg.session ?? {}
    cfg.session.dmScope = s.dmScope
  }
}

/**
 * 写 openclaw.json：合并可编辑键 → 备份 → 原子替换 → `openclaw config validate` 校验。
 * 校验失败则回滚备份并抛错。
 */
export function patchOpenClawConfig(input: Record<string, any>): void {
  assertOpenClawEnabled()
  const configPath = getConfigPath()
  mkdirSync(dirname(configPath), { recursive: true })

  const cfg = readConfig()
  applyEdits(cfg, input)

  // 备份旧配置
  const bak = hasConfigFile() ? `${configPath}.bak.update-${Date.now()}` : null
  if (bak) copyFileSync(configPath, bak)

  // 原子替换（temp 文件 + rename，OpenClaw config-io watcher 可识别）
  const tmp = `${dirname(configPath)}/.openclaw-config-${process.pid}.json`
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n')
  renameSync(tmp, configPath)

  // schema 校验；失败则回滚备份
  try {
    execFileSync(
      NODE_BIN,
      [OPENCLAW_DIST, 'config', 'validate'],
      { cwd: OPENCLAW_HOME, env: openClawEnv(), stdio: ['ignore', 'pipe', 'pipe'] }
    )
  } catch (err) {
    try {
      if (bak) {
        copyFileSync(bak, configPath)
      } else {
        rmSync(configPath, { force: true })
      }
    } catch { /* ignore rollback error */ }
    const msg = (err as Error & { stderr?: Buffer })?.stderr?.toString?.() || (err as Error).message
    throw new Error(`OpenClaw 配置写入失败（schema 校验未通过）：${msg}`)
  }
}

// ---------------------------------------------------------------------------
// 重启 OpenClaw 网关
// ---------------------------------------------------------------------------

export function restartOpenClaw(): { killed: boolean; started: boolean } {
  assertOpenClawEnabled()
  let killed = false
  try {
    execFileSync('bash', ['-c', `pkill -f "openclaw/dist/index.js gateway --port ${OPENCLAW_GATEWAY_PORT}" || true`], { env: openClawEnv() })
    killed = true
  } catch {
    // pkill 无匹配或不可用都视为"无残留进程"，继续启动
  }

  const script = [
    `cd ${OPENCLAW_HOME}`,
    `mkdir -p logs`,
    `nohup ${NODE_BIN} ${OPENCLAW_DIST} gateway --port ${OPENCLAW_GATEWAY_PORT} >> logs/openclaw.log 2>&1 &`,
  ].join('\n')
  let started = false
  try {
    execFileSync('bash', ['-c', script], { env: openClawEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
    started = true
  } catch (err) {
    const msg = (err as Error & { stderr?: Buffer })?.stderr?.toString?.() || (err as Error).message
    throw new Error(`OpenClaw 重启失败：${msg}`)
  }
  return { killed, started }
}

/** CLI 路径（供日志/诊断） */
export function openClawConfigPath(): string {
  return getConfigPath()
}
