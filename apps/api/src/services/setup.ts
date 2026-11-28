import { createHash, randomBytes } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { env } from '../config/env.js'

export const SETUP_TOKEN_HEADER = 'x-leyova-setup-token'
export const SETUP_TOKEN_TTL_HOURS = 24

export type SetupStatus = 'pending' | 'in_progress' | 'completed' | 'locked'

export interface SetupState {
  status: SetupStatus
  setupSource: 'manual' | 'ai' | null
  healthScore: number | null
  completedAt: string | null
  hasInstallToken: boolean
  tokenExpiresAt: string | null
}

type Executor = Pool | PoolClient

export function hashSetupToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function readSetupState(db: Executor): Promise<SetupState> {
  const { rows } = await db.query(
    `SELECT status, setup_source, health_score, completed_at,
            install_token_hash IS NOT NULL AS has_token,
            install_token_expires_at
       FROM public.instance_setup WHERE id = 1`
  )
  const row = rows[0] ?? {}
  return {
    status: (row.status as SetupStatus) ?? 'pending',
    setupSource: (row.setup_source as 'manual' | 'ai' | null) ?? null,
    healthScore: row.health_score ?? null,
    completedAt: row.completed_at ?? null,
    hasInstallToken: Boolean(row.has_token),
    tokenExpiresAt: row.install_token_expires_at ?? null,
  }
}

/**
 * 确保存在一次性安装凭证。
 * - 优先使用 LEYOVA_SETUP_TOKEN 环境变量（不在日志中输出明文）。
 * - 否则生成随机 token，写入哈希，并在服务端日志打印一次。
 */
export async function ensureInstallToken(db: Executor): Promise<void> {
  const { rows } = await db.query(
    `SELECT status, install_token_hash, install_token_expires_at
       FROM public.instance_setup WHERE id = 1`
  )
  const row = rows[0]
  if (!row || row.status === 'completed' || row.status === 'locked') return

  const envToken = env.LEYOVA_SETUP_TOKEN
  if (envToken) {
    await db.query(
      `UPDATE public.instance_setup
          SET install_token_hash = $1,
              install_token_expires_at = NOW() + ($2 || ' hours')::interval,
              updated_at = NOW()
        WHERE id = 1`,
      [hashSetupToken(envToken), String(SETUP_TOKEN_TTL_HOURS)]
    )
    return
  }

  const stillValid =
    row.install_token_hash &&
    row.install_token_expires_at &&
    new Date(row.install_token_expires_at).getTime() > Date.now()
  if (stillValid) return

  const token = randomBytes(24).toString('base64url')
  await db.query(
    `UPDATE public.instance_setup
        SET install_token_hash = $1,
            install_token_expires_at = NOW() + ($2 || ' hours')::interval,
            updated_at = NOW()
      WHERE id = 1`,
    [hashSetupToken(token), String(SETUP_TOKEN_TTL_HOURS)]
  )

  // 仅打印到服务端控制台；生产环境建议改用 LEYOVA_SETUP_TOKEN
  console.log('\n============================================================')
  console.log(' Leyova 首次安装凭证（24 小时有效，仅本次显示）')
  console.log(`   ${token}`)
  console.log(' 请求头：X-Leyova-Setup-Token: <token>')
  console.log('============================================================\n')
}

export async function verifyInstallToken(
  db: Executor,
  raw: string | undefined
): Promise<{ ok: boolean; reason?: string }> {
  if (!raw) return { ok: false, reason: '缺少安装凭证（X-Leyova-Setup-Token）' }

  const { rows } = await db.query(
    `SELECT status, install_token_hash, install_token_expires_at
       FROM public.instance_setup WHERE id = 1`
  )
  const row = rows[0]
  if (!row) return { ok: false, reason: '初始化状态不存在' }
  if (row.status === 'completed' || row.status === 'locked') {
    return { ok: false, reason: '系统已完成初始化，安装入口已关闭' }
  }
  if (!row.install_token_hash) return { ok: false, reason: '安装凭证未生成' }
  if (
    row.install_token_expires_at &&
    new Date(row.install_token_expires_at).getTime() <= Date.now()
  ) {
    return { ok: false, reason: '安装凭证已过期' }
  }
  if (hashSetupToken(raw) !== row.install_token_hash) {
    return { ok: false, reason: '安装凭证无效' }
  }
  return { ok: true }
}

/** 密码策略：≥12 位，含大小写、数字、符号 */
export function validatePasswordPolicy(password: string): string | null {
  if (typeof password !== 'string' || password.length < 12) return '密码至少 12 位'
  if (!/[a-z]/.test(password)) return '密码需包含小写字母'
  if (!/[A-Z]/.test(password)) return '密码需包含大写字母'
  if (!/[0-9]/.test(password)) return '密码需包含数字'
  if (!/[^A-Za-z0-9]/.test(password)) return '密码需包含特殊符号'
  return null
}

export function readSetupTokenHeader(headers: Record<string, unknown>): string | undefined {
  const raw = headers[SETUP_TOKEN_HEADER]
  return Array.isArray(raw) ? (raw[0] as string | undefined) : (raw as string | undefined)
}
