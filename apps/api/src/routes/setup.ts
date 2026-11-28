/**
 * setup.ts — 首次部署初始化路由（W1）
 *
 * 设计要点：
 * - 除 /status 外，所有写接口都要求一次性安装凭证 X-Leyova-Setup-Token。
 * - 初始化完成后安装入口永久关闭（completed/locked）。
 * - 应用配置在单事务内完成；失败整单回滚。
 * - 不返回、不回显安装凭证与任何密钥。
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getPool } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { encryptCredential } from '../modules/data-governance/security.js'
import {
  buildProfile,
  composePlan,
  missingProfileFields,
  recommend,
  type BusinessProfile,
} from '../services/setup-planner.js'
import {
  ensureInstallToken,
  readSetupState,
  readSetupTokenHeader,
  validatePasswordPolicy,
  verifyInstallToken,
} from '../services/setup.js'

const CONFIG_WHITELIST = new Set([
  'site_name',
  'timezone',
  'date_format',
  'logo_url',
  'items_per_page',
  'session_timeout',
])

const tenantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  siteName: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(50).optional(),
  logoUrl: z.string().trim().max(500).optional(),
})

const adminSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/, '用户名仅允许字母、数字、下划线、点和横线'),
  password: z.string().min(1).max(128),
  realName: z.string().trim().min(1).max(50).optional(),
})

const planSchema = z.object({
  tenant: tenantSchema,
  modules: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
  platforms: z
    .array(z.enum(['douyin', 'kuaishou', 'wechat']))
    .max(10)
    .optional(),
  config: z.record(z.string().max(100), z.string().max(500)).optional(),
  business: z
    .object({
      industry: z.string().max(50).optional(),
      mode: z.string().max(50).optional(),
      shopCount: z.number().int().min(0).max(10000).optional(),
      roomCount: z.number().int().min(0).max(10000).optional(),
      teamSize: z.number().int().min(0).max(100000).optional(),
      targetGmv: z.number().min(0).optional(),
    })
    .partial()
    .optional(),
  setupSource: z.enum(['manual', 'ai']).optional(),
  aiProfile: z.record(z.string(), z.unknown()).optional(),
})

type SetupPlan = z.infer<typeof planSchema>

const businessProfileSchema = z.object({
  entityType: z.enum(['brand_self', 'mcn', 'agency', 'individual']).optional(),
  platforms: z
    .array(z.enum(['douyin', 'kuaishou', 'wechat']))
    .max(10)
    .optional(),
  channel: z.enum(['live', 'short_video', 'both']).optional(),
  teamSize: z.number().int().min(1).max(100000).optional(),
  targetGmvBand: z.enum(['under_100w', '100w_500w', '500w_3000w', 'above_3000w']).optional(),
  category: z.string().trim().max(50).optional(),
  painPoints: z.array(z.string().trim().max(50)).max(20).optional(),
  needsCrossBorder: z.boolean().optional(),
})

const modelTestSchema = z.object({
  baseUrl: z.string().url().max(500),
  apiKey: z.string().max(500).optional(),
  modelName: z.string().trim().min(1, '请填写模型名称').max(100),
})

async function requireToken(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const pool = getPool()
  // 允许客户端直接调用写接口：先按 env 或随机生成同步凭证，再做校验
  await ensureInstallToken(pool)
  const verdict = await verifyInstallToken(pool, readSetupTokenHeader(request.headers))
  if (!verdict.ok) {
    sendError(reply, 403, verdict.reason || '安装凭证校验失败')
    return false
  }
  return true
}

const ENTITY_LABEL: Record<string, string> = {
  brand_self: '品牌自播',
  mcn: 'MCN 机构',
  agency: '代运营服务商',
  individual: '个人/小团队',
}

/** 规则解释文案：把推荐结果翻译成运营能读懂的理由 */
function buildNarrative(
  profile: BusinessProfile,
  rec: { modules: string[]; platforms: string[]; notes: string[] }
): string {
  const entity = ENTITY_LABEL[profile.entityType] || profile.entityType
  const parts = [
    `判断你属于「${entity}」，主要渠道为${
      profile.channel === 'live' ? '直播' : profile.channel === 'short_video' ? '短视频' : '直播 + 短视频'
    }，团队约 ${profile.teamSize} 人。`,
    `建议启用 ${rec.modules.length} 个模块、${rec.platforms.length} 个平台，优先保证「目标—场次—复盘—动作」闭环。`,
  ]
  if (profile.painPoints.length) {
    parts.push(`已针对痛点（${profile.painPoints.join('、')}）追加对应模块。`)
  }
  if (rec.notes.length) parts.push(...rec.notes)
  parts.push('以上为规则推荐结果，可在应用前手动增删；所有推荐项均可在系统设置中调整。')
  return parts.join('')
}

/** 校验模型地址：只允许 http/https，禁止内嵌账号密码 */
function safeModelUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.username || url.password) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export async function setupRoutes(app: FastifyInstance) {
  // ── 状态检测（公开） ──
  app.get('/api/v1/setup/status', async (_request, reply) => {
    const pool = getPool()
    await ensureInstallToken(pool)
    const state = await readSetupState(pool)
    return sendOk(reply, {
      initialized: state.status === 'completed' || state.status === 'locked',
      status: state.status,
      setupSource: state.setupSource,
      healthScore: state.healthScore,
      completedAt: state.completedAt,
      installTokenRequired: state.status !== 'completed' && state.status !== 'locked',
      installTokenExpiresAt: state.tokenExpiresAt,
      aiAvailable: process.env.AI_ENABLED === 'true',
    })
  })

  // ── 租户与站点信息 ──
  app.post('/api/v1/setup/tenant', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = tenantSchema.safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    const { name, siteName, timezone, logoUrl } = parsed.data
    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO public.tenants (id, name, slug, plan, status, logo_url)
         VALUES (1, $1, 'default', 'private', 'active', $2)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               logo_url = COALESCE(EXCLUDED.logo_url, public.tenants.logo_url),
               status = 'active',
               updated_at = NOW()`,
        [name, logoUrl ?? null]
      )

      const configs: Array<[string, string, string]> = []
      if (siteName) configs.push(['site_name', siteName, 'string'])
      if (timezone) configs.push(['timezone', timezone, 'string'])
      if (logoUrl) configs.push(['logo_url', logoUrl, 'string'])
      for (const [key, value, type] of configs) {
        await client.query(
          `INSERT INTO public.system_config (config_key, config_value, config_type)
           VALUES ($1, $2, $3)
           ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
          [key, value, type]
        )
      }

      await client.query(
        `UPDATE public.instance_setup
            SET status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
                updated_at = NOW()
          WHERE id = 1`
      )
      await writeAuditLog(client, {
        action: 'setup.tenant',
        resourceType: 'instance_setup',
        resourceId: 1,
        afterData: { name, siteName, timezone, logoUrl: logoUrl ? '[set]' : null },
        request,
      })
      await client.query('COMMIT')
      return sendOk(reply, { name })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      request.log.error({ err }, '[setup] tenant failed')
      return sendError(reply, 500, '保存租户信息失败')
    } finally {
      client.release()
    }
  })

  // ── 创建首个超级管理员（成功后永久关闭） ──
  app.post('/api/v1/setup/admin', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = adminSchema.safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    const passwordError = validatePasswordPolicy(parsed.data.password)
    if (passwordError) return sendError(reply, 400, passwordError)

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const lock = await client.query(`SELECT status FROM public.instance_setup WHERE id = 1 FOR UPDATE`)
      if (!lock.rows[0] || ['completed', 'locked'].includes(lock.rows[0].status)) {
        await client.query('ROLLBACK')
        return sendError(reply, 403, '系统已完成初始化，安装入口已关闭')
      }

      const existing = await client.query(
        `SELECT 1 FROM public.users WHERE role = 'super_admin' LIMIT 1`
      )
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK')
        return sendError(reply, 409, '已存在超级管理员，不能重复创建')
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 10)
      const { rows } = await client.query(
        `INSERT INTO public.users
           (username, password_hash, real_name, role, user_type, data_scope, status, tenant_id, must_change_password)
         VALUES ($1, $2, $3, 'super_admin', 'agency_staff', 'all', 1, 1, false)
         RETURNING id, username`,
        [parsed.data.username, passwordHash, parsed.data.realName || '系统管理员']
      )

      await client.query(
        `UPDATE public.instance_setup
            SET status = 'in_progress', updated_at = NOW()
          WHERE id = 1`
      )
      await writeAuditLog(client, {
        actorUserId: rows[0].id,
        action: 'setup.create_super_admin',
        resourceType: 'users',
        resourceId: rows[0].id,
        afterData: { username: rows[0].username, role: 'super_admin' },
        request,
      })
      await client.query('COMMIT')
      return sendOk(reply, { id: rows[0].id, username: rows[0].username })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      request.log.error({ err }, '[setup] admin failed')
      return sendError(reply, 500, '创建超级管理员失败')
    } finally {
      client.release()
    }
  })

  // ── 方案校验（不落库） ──
  app.post('/api/v1/setup/plan/validate', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = planSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendError(reply, 400, '方案校验失败', JSON.stringify(parsed.error.flatten()))
    }

    const pool = getPool()
    const warnings: string[] = []
    if (parsed.data.modules) {
      const { rows } = await pool.query(
        `SELECT code FROM public.system_modules WHERE code = ANY($1::text[])`,
        [parsed.data.modules]
      )
      const known = new Set(rows.map((r) => r.code))
      const unknown = parsed.data.modules.filter((m) => !known.has(m))
      if (unknown.length) warnings.push(`未知模块将被忽略：${unknown.join(', ')}`)
    }

    return sendOk(reply, { valid: true, warnings, plan: parsed.data })
  })

  // ── 应用初始化方案（事务 + 快照 + 审计） ──
  app.post('/api/v1/setup/apply', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = planSchema.safeParse(request.body)
    if (!parsed.success) {
      return sendError(reply, 400, '方案校验失败', JSON.stringify(parsed.error.flatten()))
    }
    const plan: SetupPlan = parsed.data

    const pool = getPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const lock = await client.query(
        `SELECT status FROM public.instance_setup WHERE id = 1 FOR UPDATE`
      )
      if (!lock.rows[0] || ['completed', 'locked'].includes(lock.rows[0].status)) {
        await client.query('ROLLBACK')
        return sendError(reply, 403, '系统已完成初始化，安装入口已关闭')
      }

      const admin = await client.query(
        `SELECT id FROM public.users WHERE role = 'super_admin' LIMIT 1`
      )
      if (admin.rows.length === 0) {
        await client.query('ROLLBACK')
        return sendError(reply, 409, '请先创建超级管理员')
      }

      // 1) 租户与站点
      await client.query(
        `INSERT INTO public.tenants (id, name, slug, plan, status, logo_url)
         VALUES (1, $1, 'default', 'private', 'active', $2)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               logo_url = COALESCE(EXCLUDED.logo_url, public.tenants.logo_url),
               status = 'active',
               updated_at = NOW()`,
        [plan.tenant.name, plan.tenant.logoUrl ?? null]
      )

      const configEntries: Array<[string, string]> = [
        ['site_name', plan.tenant.siteName || plan.tenant.name],
      ]
      if (plan.tenant.timezone) configEntries.push(['timezone', plan.tenant.timezone])
      if (plan.tenant.logoUrl) configEntries.push(['logo_url', plan.tenant.logoUrl])
      for (const [key, value] of Object.entries(plan.config || {})) {
        if (CONFIG_WHITELIST.has(key)) configEntries.push([key, value])
      }
      for (const [key, value] of configEntries) {
        await client.query(
          `INSERT INTO public.system_config (config_key, config_value, config_type)
           VALUES ($1, $2, 'string')
           ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
          [key, value]
        )
      }

      // 2) 模块：核心强制开启，非核心按选择开关
      if (plan.modules) {
        await client.query(
          `UPDATE public.system_modules
              SET is_enabled = (is_core OR code = ANY($1::text[]))
            WHERE is_core = true OR code = ANY($1::text[])`,
          [plan.modules]
        )
        await client.query(
          `UPDATE public.system_modules
              SET is_enabled = false
            WHERE is_core = false AND NOT (code = ANY($1::text[]))`,
          [plan.modules]
        )
      }

      // 3) 平台开关
      if (plan.platforms) {
        await client.query(
          `UPDATE public.system_platform_configs
              SET is_enabled = (platform_code = ANY($1::text[])),
                  updated_at = NOW()`,
          [plan.platforms]
        )
      }

      // 4) 完成初始化，清空安装凭证
      await client.query(
        `UPDATE public.instance_setup
            SET status = 'completed',
                setup_source = $2,
                plan_snapshot = $1::jsonb,
                ai_profile = $3::jsonb,
                install_token_hash = NULL,
                install_token_expires_at = NULL,
                completed_at = NOW(),
                updated_at = NOW()
          WHERE id = 1`,
        [
          JSON.stringify(plan),
          plan.setupSource || 'manual',
          plan.aiProfile ? JSON.stringify(plan.aiProfile) : null,
        ]
      )

      await writeAuditLog(client, {
        actorUserId: admin.rows[0].id,
        action: 'setup.apply',
        resourceType: 'instance_setup',
        resourceId: 1,
        afterData: plan,
        request,
      })
      await client.query('COMMIT')

      const state = await readSetupState(pool)
      return sendOk(reply, { status: state.status, completedAt: state.completedAt })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      request.log.error({ err }, '[setup] apply failed')
      return sendError(reply, 500, '应用初始化方案失败，已回滚')
    } finally {
      client.release()
    }
  })

  // ── 可配置模块清单（公开，不含敏感信息） ──
  app.get('/api/v1/setup/modules', async (_request, reply) => {
    const { rows } = await getPool().query(
      `SELECT code, name, is_core, is_enabled
         FROM public.system_modules
        ORDER BY is_core DESC, code`
    )
    return sendOk(reply, rows)
  })

  // ── 平台清单（公开） ──
  app.get('/api/v1/setup/platforms', async (_request, reply) => {
    const { rows } = await getPool().query(
      `SELECT platform_code, platform_name, is_enabled
         FROM public.system_platform_configs
        ORDER BY sort_order, platform_code`
    )
    return sendOk(reply, rows)
  })

  // ── AI 配置顾问：画像归一化 ──
  app.post('/api/v1/setup/ai/profile', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = z.object({ answers: businessProfileSchema }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, '画像参数不合法')

    const profile = buildProfile(parsed.data.answers)
    const missing = missingProfileFields(parsed.data.answers)
    return sendOk(reply, { profile, missingFields: missing })
  })

  // ── AI 配置顾问：模块与平台推荐（规则驱动，可解释） ──
  app.post('/api/v1/setup/ai/recommend', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = z.object({ answers: businessProfileSchema }).safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, '画像参数不合法')

    const profile = buildProfile(parsed.data.answers)
    const recommendation = recommend(profile)
    return sendOk(reply, {
      profile,
      recommendation,
      missingFields: missingProfileFields(parsed.data.answers),
      narrative: buildNarrative(profile, recommendation),
    })
  })

  // ── AI 配置顾问：生成可直接应用的方案 ──
  app.post('/api/v1/setup/ai/plan', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = z
      .object({ tenant: tenantSchema, answers: businessProfileSchema })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, '方案参数不合法')

    const profile = buildProfile(parsed.data.answers)
    const recommendation = recommend(profile)
    const plan = composePlan(parsed.data.tenant, profile, recommendation)
    const valid = planSchema.safeParse(plan)
    if (!valid.success) {
      return sendError(reply, 400, '生成的方案未通过校验', JSON.stringify(valid.error.flatten()))
    }
    return sendOk(reply, {
      plan,
      recommendation,
      missingFields: missingProfileFields(parsed.data.answers),
      narrative: buildNarrative(profile, recommendation),
    })
  })

  // ── 模型连接测试（不落库，不记录密钥） ──
  app.post('/api/v1/setup/ai/models/test', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = modelTestSchema.safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    const url = safeModelUrl(parsed.data.baseUrl)
    if (!url) return sendError(reply, 400, '模型地址必须是 http/https，且不能包含账号密码')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const start = Date.now()
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(parsed.data.apiKey ? { Authorization: `Bearer ${parsed.data.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: parsed.data.modelName,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          stream: false,
        }),
        signal: controller.signal,
      })
      const text = await res.text().catch(() => '')
      return sendOk(reply, {
        ok: res.ok,
        status: res.status,
        latencyMs: Date.now() - start,
        error: res.ok ? undefined : text.slice(0, 300),
      })
    } catch (err) {
      return sendOk(reply, {
        ok: false,
        latencyMs: Date.now() - start,
        error: (err as Error)?.name === 'AbortError' ? '连接超时（15s）' : (err as Error)?.message,
      })
    } finally {
      clearTimeout(timer)
    }
  })

  // ── 保存模型 Provider（密钥 AES-256-GCM 加密） ──
  app.post('/api/v1/setup/ai/models', async (request, reply) => {
    if (!(await requireToken(request, reply))) return
    const parsed = modelTestSchema
      .extend({
        provider: z.string().trim().max(50).default('openai_compatible'),
        profile: z.string().trim().max(50).default('fast-chat'),
      })
      .safeParse(request.body)
    if (!parsed.success) return sendError(reply, 400, parsed.error.issues[0]?.message || '参数不合法')

    const url = safeModelUrl(parsed.data.baseUrl)
    if (!url) return sendError(reply, 400, '模型地址必须是 http/https，且不能包含账号密码')

    const client = await getPool().connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `UPDATE public.ai_model_providers
            SET is_default = false, updated_at = NOW()
          WHERE tenant_id = 1 AND profile = $1`,
        [parsed.data.profile]
      )
      const encKey = parsed.data.apiKey ? encryptCredential(parsed.data.apiKey) : null
      const { rows } = await client.query(
        `INSERT INTO public.ai_model_providers
           (tenant_id, profile, provider, base_url, model_name, api_key_enc, enabled, is_default)
         VALUES (1, $1, $2, $3, $4, $5, true, true)
         RETURNING id`,
        [
          parsed.data.profile,
          parsed.data.provider,
          url,
          parsed.data.modelName,
          encKey,
        ]
      )
      await client.query(
        `INSERT INTO public.llm_provider_config
           (id, enabled, protocol, api_base, api_key_enc, model, updated_at)
         VALUES (1, true, 'openai', $1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE
           SET enabled = true,
               protocol = 'openai',
               api_base = EXCLUDED.api_base,
               api_key_enc = CASE WHEN $2 <> '' THEN $2 ELSE public.llm_provider_config.api_key_enc END,
               model = EXCLUDED.model,
               updated_at = NOW()`,
        [url, encKey ?? '', parsed.data.modelName]
      )
      await writeAuditLog(client, {
        action: 'setup.model_provider.create',
        resourceType: 'ai_model_providers',
        resourceId: rows[0].id,
        afterData: { provider: parsed.data.provider, baseUrl: url, modelName: parsed.data.modelName },
        request,
      })
      await client.query('COMMIT')
      return sendOk(reply, {
        id: rows[0].id,
      })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      request.log.error({ err }, '[setup] save model provider failed')
      return sendError(reply, 500, '保存模型配置失败')
    } finally {
      client.release()
    }
  })

  // ── 初始化后健康检查（需登录） ──
  app.get('/api/v1/setup/health', async (request, reply) => {
    if (!request.user) return sendError(reply, 401, '未登录')
    const pool = getPool()
    const state = await readSetupState(pool)
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM public.system_modules WHERE is_enabled) AS modules_enabled,
         (SELECT count(*)::int FROM public.system_platform_configs WHERE is_enabled) AS platforms_enabled,
         (SELECT count(*)::int FROM public.dim_shop) AS shops,
         (SELECT count(*)::int FROM public.tenants) AS tenants`
    )
    const metrics = rows[0] || {}
    const checks = [
      { key: 'initialized', ok: state.status === 'completed', weight: 30 },
      { key: 'platform_enabled', ok: Number(metrics.platforms_enabled) > 0, weight: 20 },
      { key: 'shop_created', ok: Number(metrics.shops) > 0, weight: 20 },
      { key: 'module_enabled', ok: Number(metrics.modules_enabled) > 0, weight: 15 },
      { key: 'ai_configured', ok: process.env.AI_ENABLED === 'true', weight: 15 },
    ]
    const score = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0)
    await pool.query(`UPDATE public.instance_setup SET health_score = $1 WHERE id = 1`, [score])
    return sendOk(reply, { score, checks, metrics, status: state.status })
  })
}
