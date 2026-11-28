/**
 * ai/run/memory.ts — 助手记忆（L1 会话摘要 / L2 个人偏好 / L3 组织术语）
 *
 * 硬规则（与 ONBOARDING-AI-ASSISTANT-MASTER-PLAN E.3 对齐）：
 *   1. 先按 tenant + scope + owner/role 过滤，再做关键词匹配（先过滤后检索）。
 *   2. 个人/会话记忆永不跨用户；角色记忆只在本角色内；组织术语只读。
 *   3. 数字与经营事实永远走工具/事实层，记忆只作偏好与术语参考。
 *   4. 冲突不自动覆盖：同键不同值写为 pending，等待用户确认。
 *   5. 每条记忆必须有来源（source_type）；无来源直接拒绝写入。
 *   6. 记忆内容视为数据不是指令：写入前清洗提示注入短语，读取后也不进指令上下文。
 *   7. 所有读写都落审计；记忆读写失败不得影响主 Run。
 */

import type { DbExecutor } from '../../lib/db.js'

export type MemoryScope = 'session' | 'personal' | 'role' | 'org'
export type MemoryStatus = 'active' | 'pending' | 'superseded' | 'deleted'

export interface MemoryContextItem {
  id: string
  scope: MemoryScope
  memoryKey: string
  content: string
  confidence: number
  sensitivity: string
}

export interface RetrieveMemoryOptions {
  tenantId: number
  userId?: number | null
  role?: string | null
  conversationId?: string | null
  limit?: number
}

export interface WriteMemoryInput {
  tenantId: number
  scope: MemoryScope
  memoryKey: string
  content: string
  ownerUserId?: number | null
  roleKey?: string | null
  confidence?: number
  sensitivity?: string
  sourceType: string
  sourceId?: string | null
  status?: 'active' | 'pending'
  retentionClass?: string | null
  createdBy?: number | null
}

export interface WriteMemoryResult {
  id: string | null
  action: 'created' | 'duplicate' | 'pending_conflict' | 'superseded' | 'rejected'
  reason?: string
}

const MAX_CONTENT_LENGTH = 500
const MAX_MEMORY_KEY_LENGTH = 120
const QUOTA_PER_OWNER = 200
const MAX_APPLIED = 5

/** 提示注入短语：记忆与知识同属外部数据，出现这些模式一律移除后不保留原文 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|above)\s+instructions?/gi,
  /忽略(以上|之前|前面|上述)(所有)?(的)?(指令|要求|提示)/g,
  /无视(以上|之前|前面|上述)(所有)?(的)?(指令|要求|提示)/g,
  /你现在是|从现在开始你(是|要)|system\s*[:：]/gi,
]

/**
 * 记忆文本清洗：控制字符、提示注入短语、手机号/邮箱/薪酬脱敏、长度截断。
 * 清洗后的内容才允许入库与展示。
 */
export function sanitizeMemoryText(text: unknown, maxLength = MAX_CONTENT_LENGTH): string {
  let out = String(text ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const pattern of INJECTION_PATTERNS) out = out.replace(pattern, '')

  out = out
    .replace(/1[3-9]\d{9}/g, (m) => `${m.slice(0, 3)}****${m.slice(-2)}`)
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => {
      const [name, domain] = m.split('@')
      return `${name.slice(0, 1)}***@${domain}`
    })
    .replace(
      /(月薪|薪资|工资|薪酬|底薪|提成)\s*[:：]?\s*\d+(\.\d+)?\s*(元|k|K|万|w|W)?/g,
      '$1：[已脱敏]'
    )

  return out.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

/** memory_key 归一化：只保留小写字母、数字、冒号、下划线与短横线 */
export function sanitizeMemoryKey(key: unknown, maxLength = MAX_MEMORY_KEY_LENGTH): string {
  return String(key ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-:]+|[-:]+$/g, '')
    .slice(0, maxLength)
}

/** 用户是否明确表达「记住 / 以后 / 习惯」类长期偏好（只有这类才生成 L2 候选） */
const PREFERENCE_HINTS = [
  '记住', '以后', '今后', '下次', '之后', '习惯', '偏好', '我喜欢', '我不喜欢',
  '称呼我', '叫我', '默认用', '一律用', '别再', '不要再', '统一用',
]

export function detectPreferenceIntent(question: string): boolean {
  const q = String(question || '')
  if (!q.trim()) return false
  return PREFERENCE_HINTS.some((hint) => q.includes(hint))
}

/** 偏好归类：给出稳定的 memory_key，便于去重与冲突检测 */
export function inferPreferenceKey(question: string): string {
  const q = String(question || '')
  if (/称呼|叫我/.test(q)) return 'preference:address'
  if (/格式|表格|报表|排版|模板/.test(q)) return 'preference:output_format'
  if (/每天|每周|早上|上午|下午|时间|提醒|定时/.test(q)) return 'preference:schedule'
  if (/语气|风格|简短|详细|啰嗦|精简/.test(q)) return 'preference:tone'
  if (/指标|口径|统计|维度/.test(q)) return 'preference:metric'
  return 'preference:general'
}

/**
 * 从用户提问中提取个人偏好候选。仅当用户明确表达时才返回；返回内容仍是候选，
 * 默认以 pending 落库，等用户确认后才参与召回。
 */
export function extractPreferenceCandidate(
  question: string
): { memoryKey: string; content: string } | null {
  if (!detectPreferenceIntent(question)) return null
  const content = sanitizeMemoryText(question, 300)
  if (content.length < 4) return null
  return { memoryKey: inferPreferenceKey(question), content }
}

/** 会话摘要：只记录「问了什么 / 结论是什么」，不复制数字明细 */
export function buildSessionSummary(
  question: string,
  headline: string,
  findings: string[] = []
): string {
  const q = sanitizeMemoryText(question, 120)
  const h = sanitizeMemoryText(headline, 160)
  const top = sanitizeMemoryText(findings.slice(0, 2).join('；'), 160)
  const lines = [`问：${q}`, `结论：${h || '无结论'}`]
  if (top) lines.push(`要点：${top}`)
  return sanitizeMemoryText(lines.join('；'), 400)
}

/** 中文按二元组切分做轻量相关性打分，避免为记忆单独引入向量检索 */
function bigrams(text: string): Set<string> {
  const clean = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
  const set = new Set<string>()
  for (let i = 0; i < clean.length - 1; i += 1) set.add(clean.slice(i, i + 2))
  return set
}

export function scoreMemoryRelevance(question: string, content: string): number {
  const q = bigrams(question)
  if (q.size === 0) return 0
  const c = bigrams(content)
  if (c.size === 0) return 0
  let hit = 0
  for (const gram of q) if (c.has(gram)) hit += 1
  return hit / Math.min(q.size, 40)
}

interface MemoryRow {
  id: string
  scope: MemoryScope
  memory_key: string
  content: string
  confidence: string | number
  sensitivity: string
}

/**
 * 召回记忆：SQL 先按租户 / 可见范围 / 状态 / 有效期过滤，再在内存里做关键词打分。
 * 会话摘要只取当前会话；组织术语永不被自动写入，但可被读取。
 * 任何异常都降级为空数组，不影响主 Run。
 */
export async function retrieveMemories(
  question: string,
  options: RetrieveMemoryOptions,
  db: DbExecutor
): Promise<MemoryContextItem[]> {
  try {
    const params: unknown[] = [options.tenantId, options.userId ?? 0, options.role || '']
    let conversationClause = ''
    if (options.conversationId) {
      params.push(`session:${options.conversationId}`)
      conversationClause = `OR (scope = 'session' AND owner_user_id = $2 AND memory_key = $4)`
    }

    const { rows } = await db.query<MemoryRow>(
      `SELECT id, scope, memory_key, content, confidence, sensitivity
         FROM public.assistant_memory_items
        WHERE tenant_id = $1
          AND status = 'active'
          AND sensitivity = 'normal'
          AND valid_from <= now()
          AND (valid_to IS NULL OR valid_to > now())
          AND (
            (scope = 'personal' AND owner_user_id = $2)
            OR (scope = 'role' AND role_key = $3)
            OR scope = 'org'
            ${conversationClause}
          )
        ORDER BY created_at DESC
        LIMIT 200`,
      params
    )

    const scored = rows
      .map((row) => ({
        row,
        score: row.scope === 'session' ? 1 : scoreMemoryRelevance(question, row.content),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return Number(b.row.confidence || 0) - Number(a.row.confidence || 0)
      })
      .slice(0, options.limit ?? MAX_APPLIED)

    return scored.map(({ row }) => ({
      id: row.id,
      scope: row.scope,
      memoryKey: row.memory_key,
      content: sanitizeMemoryText(row.content),
      confidence: Number(row.confidence || 0),
      sensitivity: row.sensitivity,
    }))
  } catch {
    return []
  }
}

function normalizeContent(content: string): string {
  return sanitizeMemoryText(content).replace(/\s+/g, '')
}

async function writeMemoryAudit(
  db: DbExecutor,
  input: {
    tenantId: number
    memoryId?: string | null
    action: string
    actorUserId?: number | null
    detail?: Record<string, unknown>
  }
): Promise<void> {
  await db
    .query(
      `INSERT INTO public.assistant_memory_audit
         (tenant_id, memory_id, action, actor_user_id, detail)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        input.tenantId,
        input.memoryId || null,
        input.action,
        input.actorUserId ?? null,
        JSON.stringify(input.detail || {}),
      ]
    )
    .catch(() => undefined)
}

/**
 * 写入记忆。返回 action 说明结果：
 *   created / duplicate / pending_conflict（冲突待确认）/ superseded（用户确认后替代）/ rejected
 *
 * allowSupersede=true 仅用于「用户已确认」的写入口；自动候选永远不覆盖历史。
 */
export async function writeMemory(
  db: DbExecutor,
  input: WriteMemoryInput,
  options: { allowSupersede?: boolean } = {}
): Promise<WriteMemoryResult> {
  const content = sanitizeMemoryText(input.content)
  const memoryKey = sanitizeMemoryKey(input.memoryKey)
  const sourceType = String(input.sourceType || '').trim()

  const reject = async (reason: string): Promise<WriteMemoryResult> => {
    await writeMemoryAudit(db, {
      tenantId: input.tenantId,
      action: 'rejected',
      actorUserId: input.createdBy,
      detail: { reason, memoryKey, scope: input.scope },
    })
    return { id: null, action: 'rejected', reason }
  }

  if (!content) return reject('记忆内容为空')
  if (!memoryKey) return reject('memory_key 非法')
  if (!sourceType) return reject('缺少来源，拒绝写入')
  // 组织术语只允许人工策展写入，Agent 不得自动写
  if (input.scope === 'org' && !sourceType.startsWith('manual')) {
    return reject('组织术语只允许人工策展写入')
  }

  const roleKey = input.scope === 'role' ? String(input.roleKey || '') : null
  if (input.scope === 'role' && !roleKey) return reject('角色记忆缺少 role_key')
  const ownerUserId =
    input.scope === 'personal' || input.scope === 'session' ? input.ownerUserId ?? null : null

  if ((input.scope === 'personal' || input.scope === 'session') && !ownerUserId) {
    return reject('个人/会话记忆缺少归属用户')
  }

  try {
    // 配额：防灌入
    if ((input.scope === 'personal' || input.scope === 'session') && ownerUserId) {
      const quota = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM public.assistant_memory_items
          WHERE tenant_id = $1 AND scope = $2 AND owner_user_id = $3
            AND status IN ('active', 'pending')`,
        [input.tenantId, input.scope, ownerUserId]
      )
      if (Number(quota.rows[0]?.count || 0) >= QUOTA_PER_OWNER) {
        return reject('记忆条数已达上限')
      }
    }

    // 同键现有 active / pending，用于去重与冲突检测
    const existing = await db.query<{ id: string; content: string; status: MemoryStatus }>(
      `SELECT id, content, status
         FROM public.assistant_memory_items
        WHERE tenant_id = $1
          AND scope = $2
          AND COALESCE(owner_user_id, 0) = $3
          AND COALESCE(role_key, '') = $4
          AND memory_key = $5
          AND status IN ('active', 'pending')
        ORDER BY created_at DESC
        LIMIT 5`,
      [input.tenantId, input.scope, ownerUserId ?? 0, roleKey || '', memoryKey]
    )

    const normalized = normalizeContent(content)
    const active = existing.rows.find((row) => row.status === 'active')
    const duplicate = existing.rows.find(
      (row) => normalizeContent(row.content) === normalized
    )
    if (duplicate) {
      await writeMemoryAudit(db, {
        tenantId: input.tenantId,
        memoryId: duplicate.id,
        action: 'duplicate',
        actorUserId: input.createdBy,
        detail: { memoryKey, scope: input.scope },
      })
      return { id: duplicate.id, action: 'duplicate' }
    }

    const conflict = !!active && normalizeContent(active.content) !== normalized
    const allowSupersede = options.allowSupersede === true

    let status: MemoryStatus = input.status === 'active' ? 'active' : 'pending'
    // 冲突且未获用户确认：只写为 pending，不参与召回
    if (conflict && !allowSupersede) status = 'pending'
    // 角色/组织级未审核的写入一律 pending
    if (input.scope === 'role' && input.status !== 'active') status = 'pending'

    let supersedesId: string | null = null
    if (conflict && allowSupersede && active) {
      await db.query(
        `UPDATE public.assistant_memory_items
            SET status = 'superseded', valid_to = now(), updated_at = now()
          WHERE id = $1`,
        [active.id]
      )
      supersedesId = active.id
      status = 'active'
    } else if (conflict && active) {
      supersedesId = active.id
    }

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO public.assistant_memory_items
         (tenant_id, scope, owner_user_id, role_key, memory_key, content, confidence,
          sensitivity, source_type, source_id, supersedes_id, status, retention_class, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        input.tenantId,
        input.scope,
        ownerUserId,
        roleKey,
        memoryKey,
        content,
        Math.min(1, Math.max(0, input.confidence ?? 0.7)),
        input.sensitivity || 'normal',
        sourceType,
        input.sourceId || null,
        supersedesId,
        status,
        input.retentionClass || null,
        input.createdBy ?? null,
      ]
    )

    const action: WriteMemoryResult['action'] = supersedesId
      ? allowSupersede
        ? 'superseded'
        : 'pending_conflict'
      : 'created'

    await writeMemoryAudit(db, {
      tenantId: input.tenantId,
      memoryId: rows[0]?.id || null,
      action,
      actorUserId: input.createdBy,
      detail: {
        memoryKey,
        scope: input.scope,
        status,
        sourceType,
        sourceId: input.sourceId || null,
        supersedesId,
      },
    })

    return { id: rows[0]?.id || null, action }
  } catch {
    // 记忆写入是旁路能力，失败不影响主 Run；由调用方决定是否提示
    return { id: null, action: 'rejected', reason: '写入记忆失败' }
  }
}

/** 用户可查看到自己的记忆：个人/会话 + 本角色 + 组织术语 */
export async function listVisibleMemories(
  db: DbExecutor,
  options: {
    tenantId: number
    userId: number
    role: string
    scope?: string
    keyword?: string
    limit?: number
  }
): Promise<Array<Record<string, unknown>>> {
  const params: unknown[] = [options.tenantId, options.userId, options.role]
  let filters = ''
  if (options.scope && ['personal', 'session', 'role', 'org'].includes(options.scope)) {
    params.push(options.scope)
    filters += ` AND scope = $${params.length}`
  }
  if (options.keyword) {
    params.push(`%${String(options.keyword).slice(0, 60)}%`)
    filters += ` AND (content ILIKE $${params.length} OR memory_key ILIKE $${params.length})`
  }
  params.push(Math.min(200, Math.max(1, options.limit ?? 50)))

  const { rows } = await db.query(
    `SELECT id, scope, memory_key, content, confidence, sensitivity, status,
            source_type, source_id, retention_class, valid_to, created_at
       FROM public.assistant_memory_items
      WHERE tenant_id = $1
        AND status IN ('active', 'pending')
        AND (
          (scope IN ('personal', 'session') AND owner_user_id = $2)
          OR (scope = 'role' AND role_key = $3)
          OR scope = 'org'
        )
        ${filters}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  )
  return rows as Array<Record<string, unknown>>
}

/** 用户删除自己的记忆（软删除 + 审计），仅限个人/会话归属 */
export async function deleteOwnMemory(
  db: DbExecutor,
  options: { tenantId: number; userId: number; memoryId: string }
): Promise<boolean> {
  const { rows } = await db.query<{ id: string; memory_key: string; scope: string }>(
    `UPDATE public.assistant_memory_items
        SET status = 'deleted', valid_to = now(), updated_at = now()
      WHERE id = $1
        AND tenant_id = $2
        AND scope IN ('personal', 'session')
        AND owner_user_id = $3
        AND status IN ('active', 'pending')
      RETURNING id, memory_key, scope`,
    [options.memoryId, options.tenantId, options.userId]
  )
  if (!rows[0]) return false
  await writeMemoryAudit(db, {
    tenantId: options.tenantId,
    memoryId: rows[0].id,
    action: 'deleted',
    actorUserId: options.userId,
    detail: { memoryKey: rows[0].memory_key, scope: rows[0].scope },
  })
  return true
}

/** 角色/组织记忆审核队列：默认只看待确认，可按状态与范围过滤 */
export async function listReviewMemories(
  db: DbExecutor,
  options: { tenantId: number; status?: string; scope?: string }
): Promise<Array<Record<string, unknown>>> {
  const params: unknown[] = [options.tenantId]
  let filters = ` AND scope IN ('role', 'org')`
  if (options.scope === 'role' || options.scope === 'org') {
    params.push(options.scope)
    filters += ` AND scope = $${params.length}`
  }
  if (options.status === 'pending' || options.status === 'active') {
    params.push(options.status)
    filters += ` AND status = $${params.length}`
  } else {
    filters += ` AND status IN ('pending', 'active')`
  }

  const { rows } = await db.query(
    `SELECT id, scope, role_key, memory_key, content, confidence, sensitivity, status,
            source_type, source_id, created_at
       FROM public.assistant_memory_items
      WHERE tenant_id = $1
        ${filters}
      ORDER BY (status = 'pending') DESC, created_at DESC
      LIMIT 200`,
    params
  )
  return rows as Array<Record<string, unknown>>
}

/**
 * 审核通过：pending → active。
 * 若同键已有 active，先把旧的置为 superseded，再启用本条（不会出现双 active）。
 */
export async function approveMemory(
  db: DbExecutor,
  options: { tenantId: number; memoryId: string; actorUserId?: number | null }
): Promise<boolean> {
  const { rows } = await db.query<{
    id: string
    scope: string
    role_key: string | null
    owner_user_id: number | null
    memory_key: string
  }>(
    `SELECT id, scope, role_key, owner_user_id, memory_key
       FROM public.assistant_memory_items
      WHERE id = $1 AND tenant_id = $2
        AND scope IN ('role', 'org') AND status = 'pending'
      LIMIT 1`,
    [options.memoryId, options.tenantId]
  )
  const item = rows[0]
  if (!item) return false

  const existing = await db.query<{ id: string }>(
    `SELECT id
       FROM public.assistant_memory_items
      WHERE tenant_id = $1
        AND scope = $2
        AND COALESCE(owner_user_id, 0) = COALESCE($3, 0)
        AND COALESCE(role_key, '') = $4
        AND memory_key = $5
        AND status = 'active'
      LIMIT 1`,
    [options.tenantId, item.scope, item.owner_user_id, item.role_key || '', item.memory_key]
  )

  const previousId = existing.rows[0]?.id || null
  if (previousId) {
    await db.query(
      `UPDATE public.assistant_memory_items
          SET status = 'superseded', valid_to = now(), updated_at = now()
        WHERE id = $1`,
      [previousId]
    )
  }
  await db.query(
    `UPDATE public.assistant_memory_items
        SET status = 'active', supersedes_id = $2, updated_at = now()
      WHERE id = $1`,
    [item.id, previousId]
  )
  await writeMemoryAudit(db, {
    tenantId: options.tenantId,
    memoryId: item.id,
    action: 'approved',
    actorUserId: options.actorUserId,
    detail: { memoryKey: item.memory_key, scope: item.scope, supersedesId: previousId },
  })
  return true
}

/** 审核驳回：pending → deleted，保留审计痕迹 */
export async function rejectMemory(
  db: DbExecutor,
  options: { tenantId: number; memoryId: string; actorUserId?: number | null; reason?: string }
): Promise<boolean> {
  const { rows } = await db.query<{ id: string; scope: string; memory_key: string }>(
    `UPDATE public.assistant_memory_items
        SET status = 'deleted', valid_to = now(), updated_at = now()
      WHERE id = $1 AND tenant_id = $2
        AND scope IN ('role', 'org') AND status = 'pending'
      RETURNING id, scope, memory_key`,
    [options.memoryId, options.tenantId]
  )
  if (!rows[0]) return false
  await writeMemoryAudit(db, {
    tenantId: options.tenantId,
    memoryId: rows[0].id,
    action: 'rejected',
    actorUserId: options.actorUserId,
    detail: {
      memoryKey: rows[0].memory_key,
      scope: rows[0].scope,
      reason: options.reason || '审核驳回',
    },
  })
  return true
}

const SCOPE_LABELS: Record<MemoryScope, string> = {
  session: '会话',
  personal: '个人偏好',
  role: '角色',
  org: '组织术语',
}

/** 在回答中展示已应用记忆；明确标注其仅作偏好参考，不参与数据结论 */
export function appendMemorySection(
  markdown: string,
  memories: MemoryContextItem[]
): string {
  if (memories.length === 0) return markdown
  const lines: string[] = ['', '#### 🧠 已应用记忆']
  for (const item of memories) {
    lines.push(`- [${SCOPE_LABELS[item.scope]}] ${item.content}`)
  }
  lines.push('> 记忆仅作偏好与术语参考，数据结论一律以工具取数与事实层为准。')
  return `${markdown.trimEnd()}\n${lines.join('\n')}\n`
}