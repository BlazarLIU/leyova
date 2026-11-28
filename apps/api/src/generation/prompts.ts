/**
 * generation/prompts.ts — PromptOps 模板与版本
 *
 * 约束：
 *   1. 版本不可变：修改正文必须新增版本，数据库触发器二次兜底；
 *   2. 灰度：canary_version + canary_ratio 决定实际使用版本，失败可一键回滚；
 *   3. 渲染只做变量替换，不做表达式求值，避免模板注入执行。
 */

import { getPool, type DbExecutor } from '../lib/db.js'

export interface PromptVariable {
  name: string
  required?: boolean
  description?: string
}

export interface PromptTemplateView {
  id: string
  key: string
  name: string
  scene: string
  platform: string
  category: string
  description: string
  variables: PromptVariable[]
  activeVersion: number
  canaryVersion: number | null
  canaryRatio: number
  status: string
  updatedAt: string
}

export interface PromptVersionView {
  id: string
  templateId: string
  version: number
  systemPrompt: string
  userTemplate: string
  outputSchema: string
  notes: string
  createdAt: string
}

interface TemplateRow {
  id: string
  key: string
  name: string
  scene: string
  platform: string
  category: string
  description: string
  variables_schema: PromptVariable[]
  active_version: number
  canary_version: number | null
  canary_ratio: number
  status: string
  updated_at: string
}

function mapTemplate(row: TemplateRow): PromptTemplateView {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    scene: row.scene,
    platform: row.platform,
    category: row.category,
    description: row.description,
    variables: Array.isArray(row.variables_schema) ? row.variables_schema : [],
    activeVersion: Number(row.active_version) || 0,
    canaryVersion: row.canary_version === null ? null : Number(row.canary_version),
    canaryRatio: Number(row.canary_ratio) || 0,
    status: row.status,
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

const TEMPLATE_COLUMNS = `id, key, name, scene, platform, category, description,
  variables_schema, active_version, canary_version, canary_ratio, status, updated_at`

export async function listTemplates(tenantId: number, db?: DbExecutor): Promise<PromptTemplateView[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<TemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM public.prompt_templates
      WHERE tenant_id = $1 ORDER BY scene, key`,
    [tenantId]
  )
  return rows.map(mapTemplate)
}

export async function getTemplate(
  tenantId: number,
  key: string,
  db?: DbExecutor
): Promise<PromptTemplateView | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<TemplateRow>(
    `SELECT ${TEMPLATE_COLUMNS} FROM public.prompt_templates
      WHERE tenant_id = $1 AND key = $2 LIMIT 1`,
    [tenantId, key]
  )
  return rows[0] ? mapTemplate(rows[0]) : null
}

export async function listVersions(
  tenantId: number,
  templateKey: string,
  db?: DbExecutor
): Promise<PromptVersionView[]> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT p.id, p.template_id, p.version, p.system_prompt, p.user_template,
            p.output_schema, p.notes, p.created_at
       FROM public.prompt_versions p
       JOIN public.prompt_templates t ON t.id = p.template_id
      WHERE t.tenant_id = $1 AND t.key = $2
      ORDER BY p.version DESC`,
    [tenantId, templateKey]
  )
  return rows.map((row) => ({
    id: row.id,
    templateId: row.template_id,
    version: Number(row.version),
    systemPrompt: row.system_prompt,
    userTemplate: row.user_template,
    outputSchema: row.output_schema,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

export async function getVersion(
  tenantId: number,
  templateKey: string,
  version: number,
  db?: DbExecutor
): Promise<PromptVersionView | null> {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT p.id, p.template_id, p.version, p.system_prompt, p.user_template,
            p.output_schema, p.notes, p.created_at
       FROM public.prompt_versions p
       JOIN public.prompt_templates t ON t.id = p.template_id
      WHERE t.tenant_id = $1 AND t.key = $2 AND p.version = $3
      LIMIT 1`,
    [tenantId, templateKey, version]
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    templateId: row.template_id,
    version: Number(row.version),
    systemPrompt: row.system_prompt,
    userTemplate: row.user_template,
    outputSchema: row.output_schema,
    notes: row.notes,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export interface CreateTemplateInput {
  tenantId: number
  key: string
  name: string
  scene: string
  platform?: string
  category?: string
  description?: string
  variables?: PromptVariable[]
  systemPrompt: string
  userTemplate: string
  outputSchema?: string
  userId?: number | null
  db?: DbExecutor
}

/** 新建模板并落 v1 */
export async function createTemplate(input: CreateTemplateInput): Promise<PromptTemplateView> {
  const executor = input.db || getPool()
  const { rows } = await executor.query<TemplateRow>(
    `INSERT INTO public.prompt_templates
       (tenant_id, key, name, scene, platform, category, description, variables_schema, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING ${TEMPLATE_COLUMNS}`,
    [
      input.tenantId,
      input.key,
      input.name,
      input.scene,
      input.platform || 'all',
      input.category || 'all',
      input.description || '',
      JSON.stringify(input.variables || []),
      input.userId ?? null,
    ]
  )
  const template = rows[0]

  await executor.query(
    `INSERT INTO public.prompt_versions
       (tenant_id, template_id, version, system_prompt, user_template, output_schema, notes, created_by)
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7)`,
    [
      input.tenantId,
      template.id,
      input.systemPrompt,
      input.userTemplate,
      input.outputSchema || '',
      '初始版本',
      input.userId ?? null,
    ]
  )
  await executor.query(
    `UPDATE public.prompt_templates SET active_version = 1, updated_at = now() WHERE id = $1`,
    [template.id]
  )

  return mapTemplate({ ...template, active_version: 1 })
}

export interface AddVersionInput {
  tenantId: number
  templateKey: string
  systemPrompt: string
  userTemplate: string
  outputSchema?: string
  notes?: string
  userId?: number | null
  /** 是否直接设为生效版本（默认 false，先进灰度） */
  activate?: boolean
  db?: DbExecutor
}

/** 新增版本（不可变），可选择立即生效 */
export async function addVersion(input: AddVersionInput): Promise<{ version: number; activeVersion: number }> {
  const executor = input.db || getPool()
  const template = await getTemplate(input.tenantId, input.templateKey, executor)
  if (!template) throw new Error(`提示词模板不存在：${input.templateKey}`)

  const { rows } = await executor.query<{ version: number }>(
    `SELECT coalesce(max(version), 0) + 1 AS version
       FROM public.prompt_versions WHERE template_id = $1`,
    [template.id]
  )
  const version = Number(rows[0]?.version) || 1

  await executor.query(
    `INSERT INTO public.prompt_versions
       (tenant_id, template_id, version, system_prompt, user_template, output_schema, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.tenantId,
      template.id,
      version,
      input.systemPrompt,
      input.userTemplate,
      input.outputSchema || '',
      String(input.notes || '').slice(0, 500),
      input.userId ?? null,
    ]
  )

  let activeVersion = template.activeVersion
  if (input.activate) {
    await executor.query(
      `UPDATE public.prompt_templates
          SET active_version = $2, canary_version = NULL, canary_ratio = 0, updated_at = now()
        WHERE id = $1`,
      [template.id, version]
    )
    activeVersion = version
  } else {
    await executor.query(
      `UPDATE public.prompt_templates SET updated_at = now() WHERE id = $1`,
      [template.id]
    )
  }

  return { version, activeVersion }
}

export interface GrayInput {
  tenantId: number
  templateKey: string
  version: number
  ratio: number
  db?: DbExecutor
}

export interface RollbackInput {
  tenantId: number
  templateKey: string
  version: number
  db?: DbExecutor
}

/** 设置灰度：version 出现在比例内才使用 */
export async function setCanary(input: GrayInput): Promise<PromptTemplateView | null> {
  const executor = input.db || getPool()
  const template = await getTemplate(input.tenantId, input.templateKey, executor)
  if (!template) return null
  const version = await getVersion(input.tenantId, input.templateKey, input.version, executor)
  if (!version) throw new Error(`版本不存在：v${input.version}`)

  const ratio = Math.min(100, Math.max(0, Math.round(input.ratio)))
  const { rows } = await executor.query<TemplateRow>(
    `UPDATE public.prompt_templates
        SET canary_version = CASE WHEN $2::int = 0 THEN NULL ELSE $3::int END,
            canary_ratio = $2::int,
            updated_at = now()
      WHERE tenant_id = $1 AND key = $4
      RETURNING ${TEMPLATE_COLUMNS}`,
    [input.tenantId, ratio, input.version, input.templateKey]
  )
  return rows[0] ? mapTemplate(rows[0]) : null
}

/** 回滚：把指定历史版本设为生效版本，并清空灰度 */
export async function rollback(input: RollbackInput): Promise<PromptTemplateView | null> {
  const executor = input.db || getPool()
  const version = await getVersion(input.tenantId, input.templateKey, input.version, executor)
  if (!version) throw new Error(`版本不存在：v${input.version}`)

  const { rows } = await executor.query<TemplateRow>(
    `UPDATE public.prompt_templates
        SET active_version = $2, canary_version = NULL, canary_ratio = 0, updated_at = now()
      WHERE tenant_id = $1 AND key = $3
      RETURNING ${TEMPLATE_COLUMNS}`,
    [input.tenantId, input.version, input.templateKey]
  )
  return rows[0] ? mapTemplate(rows[0]) : null
}

/**
 * 稳定哈希到 [0,100)：FNV-1a + 终混洗。
 * 直接用「累加取模」会让 SPU-1、SPU-2… 这类相邻业务键落在连续区间，
 * 导致灰度分配出现整批命中或整批不命中，必须做雪崩混洗。
 */
export function bucketOf(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  // 32 位终混洗（murmur3 finalizer 变体）
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b) >>> 0
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0
  hash ^= hash >>> 16
  // JS 的 ^= 会产生有符号 32 位整数，必须再归一化，否则取模出现负桶
  hash = hash >>> 0
  return hash % 100
}

/**
 * 选择实际使用版本：
 *   canary_ratio > 0 且命中比例 → canary_version，否则 active_version。
 * 使用确定性哈希（按业务键）保证同一商品稳定命中同一版本，便于对比效果。
 */
export function pickVersion(
  template: PromptTemplateView,
  seed: string
): { version: number; isCanary: boolean } {
  if (template.canaryVersion && template.canaryRatio > 0) {
    if (bucketOf(seed) < template.canaryRatio) {
      return { version: template.canaryVersion, isCanary: true }
    }
  }
  return { version: template.activeVersion, isCanary: false }
}

/**
 * 模板渲染：只替换 {{name}} 变量，未提供的变量替换为空串。
 * 不做任何表达式求值；非法占位符（含点号、括号等）一并清空，
 * 避免把模板语法泄漏进提示词。
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return String(template || '').replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_match, rawName: string) => {
    const name = String(rawName).trim()
    if (!/^[a-zA-Z0-9_]+$/.test(name)) return ''
    const value = variables[name]
    if (value === undefined || value === null) return ''
    if (Array.isArray(value)) return value.map((item) => String(item)).join('\n')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

/** 校验必填变量，返回缺失列表 */
export function missingVariables(template: PromptTemplateView, variables: Record<string, unknown>): string[] {
  return template.variables
    .filter((item) => item.required)
    .filter((item) => {
      const value = variables[item.name]
      return value === undefined || value === null || String(value).trim() === ''
    })
    .map((item) => item.name)
}