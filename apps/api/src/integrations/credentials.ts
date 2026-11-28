/**
 * integrations/credentials.ts — 连接器凭证的加密存取
 *
 * 约定：
 *   - 整包 JSON 使用 AES-256-GCM 加密后落库；
 *   - 查询接口只返回 secret_hint（掩码），永不返回密文或明文；
 *   - 轮换时 key_version 自增，保留审计可追溯性。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import {
  decryptCredential,
  encryptCredential,
  maskCredential,
} from '../modules/data-governance/security.js'

export interface StoredCredential {
  credentialId: string
  secrets: Record<string, string>
  hint: string
  keyVersion: number
}

function normalizeSecrets(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(input || {})) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) output[key] = trimmed
  }
  return output
}

/** 生成掩码提示：取第一个非空值做前后各 4 位脱敏 */
export function buildSecretHint(secrets: Record<string, string>, credentialFields: string[] = []): string {
  const order = credentialFields.length > 0 ? credentialFields : Object.keys(secrets)
  for (const field of order) {
    const value = secrets[field]
    if (value) return maskCredential(value)
  }
  return ''
}

export function encryptSecretBundle(secrets: Record<string, string>): string {
  return encryptCredential(JSON.stringify(secrets))
}

export function decryptSecretBundle(secretEnc: string | null | undefined): Record<string, string> {
  if (!secretEnc) return {}
  const raw = decryptCredential(secretEnc)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return normalizeSecrets(parsed as Record<string, unknown>)
  } catch {
    return {}
  }
}

export interface SaveCredentialInput {
  tenantId: number
  platform: string
  secrets: Record<string, unknown>
  userId?: number | null
  credentialFields?: string[]
  /** 非敏感配置补丁（baseUrl / model 等），合并进 integration_connections.config */
  configPatch?: Record<string, string>
  db?: DbExecutor
}

export interface SaveCredentialResult {
  credentialId: string
  hint: string
  keyVersion: number
  fields: string[]
}

/** 写入/轮换凭证，并把连接状态更新为 configured（不校验完整性，由上层负责） */
export async function saveIntegrationCredential(input: SaveCredentialInput): Promise<SaveCredentialResult> {
  const db = input.db || getPool()
  const secrets = normalizeSecrets(input.secrets)
  if (Object.keys(secrets).length === 0) throw new Error('凭证内容不能为空')

  const secretEnc = encryptSecretBundle(secrets)
  const hint = buildSecretHint(secrets, input.credentialFields)
  const fields = Object.keys(secrets)

  const { rows } = await db.query<{ id: string; key_version: number; secret_hint: string }>(
    `INSERT INTO public.integration_credentials
       (tenant_id, platform, label, secret_enc, secret_hint, key_version, status, created_by, rotated_at)
     VALUES ($1, $2, 'default', $3, $4, 1, 'active', $5, now())
     ON CONFLICT (tenant_id, platform, label) DO UPDATE
       SET secret_enc = EXCLUDED.secret_enc,
           secret_hint = EXCLUDED.secret_hint,
           key_version = public.integration_credentials.key_version + 1,
           status = 'active',
           created_by = COALESCE(EXCLUDED.created_by, public.integration_credentials.created_by),
           rotated_at = now(),
           updated_at = now()
     RETURNING id, key_version, secret_hint`,
    [input.tenantId, input.platform, secretEnc, hint, input.userId ?? null]
  )
  const row = rows[0]
  if (!row) throw new Error('凭证写入失败')

  await db.query(
    `UPDATE public.integration_connections
        SET credential_id = $3,
            auth_status = 'configured',
            health_status = 'unknown',
            health_detail = '{}'::jsonb,
            config = CASE WHEN $4::jsonb IS NULL THEN config ELSE config || $4::jsonb END,
            updated_at = now()
      WHERE tenant_id = $1 AND platform = $2`,
    [
      input.tenantId,
      input.platform,
      row.id,
      input.configPatch ? JSON.stringify(input.configPatch) : null,
    ]
  )

  return {
    credentialId: row.id,
    hint: row.secret_hint || hint,
    keyVersion: Number(row.key_version) || 1,
    fields,
  }
}

/** 仅更新非敏感连接配置（当密钥已存在且无需轮换时使用） */
export async function updateIntegrationConfig(input: {
  tenantId: number
  platform: string
  configPatch: Record<string, string>
  db?: DbExecutor
}): Promise<void> {
  const db = input.db || getPool()
  await db.query(
    `UPDATE public.integration_connections
        SET config = config || $3::jsonb,
            updated_at = now()
      WHERE tenant_id = $1 AND platform = $2`,
    [input.tenantId, input.platform, JSON.stringify(input.configPatch)]
  )
}

/** 服务端解析凭证；未配置返回 null */
export async function loadIntegrationCredential(
  db: DbExecutor | undefined,
  tenantId: number,
  platform: string
): Promise<StoredCredential | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<{
    id: string
    secret_enc: string
    secret_hint: string
    key_version: number
    credential_id: string | null
  }>(
    `SELECT c.id, c.secret_enc, c.secret_hint, c.key_version, conn.credential_id
       FROM public.integration_connections conn
       LEFT JOIN public.integration_credentials c
         ON c.id = conn.credential_id AND c.status = 'active'
      WHERE conn.tenant_id = $1 AND conn.platform = $2
      LIMIT 1`,
    [tenantId, platform]
  )
  const row = rows[0]
  if (!row || !row.id || !row.secret_enc) return null
  return {
    credentialId: row.id,
    secrets: decryptSecretBundle(row.secret_enc),
    hint: row.secret_hint || '',
    keyVersion: Number(row.key_version) || 1,
  }
}

/** 删除连接上的凭证引用（密文行保留为 disabled，避免历史审计断链） */
export async function revokeIntegrationCredential(
  db: DbExecutor | undefined,
  tenantId: number,
  platform: string
): Promise<boolean> {
  const executor = db || getPool()
  const { rows } = await executor.query<{ credential_id: string | null }>(
    `SELECT credential_id FROM public.integration_connections
      WHERE tenant_id = $1 AND platform = $2`,
    [tenantId, platform]
  )
  const credentialId = rows[0]?.credential_id
  if (!credentialId) return false

  await executor.query(
    `UPDATE public.integration_credentials SET status = 'disabled', updated_at = now() WHERE id = $1`,
    [credentialId]
  )
  await executor.query(
    `UPDATE public.integration_connections
        SET credential_id = NULL, auth_status = 'unconfigured', health_status = 'unknown',
            health_detail = '{}'::jsonb, updated_at = now()
      WHERE tenant_id = $1 AND platform = $2`,
    [tenantId, platform]
  )
  return true
}
