/**
 * routes/director.ts — F.2 编导 AI 工作台
 *
 * 五区能力：
 *   今日选题（机会分排序）/ 脚本工坊（版本 + 合规）/ 素材参考 / 发布日历 / 数据回看
 *
 * 防幻觉约定：
 *   - 事实只来自 dim_product / video_metrics / seasonal_calendar；
 *   - 缺失数据显式返回 missing，不猜；
 *   - 机会分由 director/scoring.ts 确定性计算，LLM 只写描述；
 *   - 脚本入库前过违禁词，未过保留 failed 状态且不允许 approve。
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth } from '../lib/guard.js'
import { tenantIdOf } from '../lib/tenant-context.js'
import { resolveAccess } from '../lib/access-resolver.js'
import { effectivePlatforms } from '../lib/platform-scope.js'
import { scanBannedWords } from '../knowledge/service.js'
import {
  computeOpportunityScore,
  normalizeDemand,
  normalizeFeasibility,
  normalizeHistory,
  normalizeMargin,
  normalizeSeason,
} from '../director/scoring.js'

const CONTENT_ROLES = ['super_admin', 'ops_director', 'ops_staff']

/** 写操作校验：请求传入的平台必须在用户可见范围内 */
async function isPlatformAllowed(user: any, platformCode: string | null | undefined): Promise<boolean> {
  if (!platformCode) return true
  const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
  const eff = effectivePlatforms(platformCode, access.platforms === null ? null : Array.from(access.platforms))
  return eff === null || eff.length > 0
}

const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(80).optional(),
  platformCode: z.string().max(32).optional(),
  source: z.enum(['manual', 'seasonal', 'product', 'history', 'ai']).optional(),
  productIds: z.array(z.number().int().positive()).max(20).optional(),
  reason: z.string().max(2000).optional(),
  aiDescription: z.string().max(4000).optional(),
})

const scoreIdeaSchema = z.object({
  days: z.number().int().min(7).max(180).optional(),
  templateCategory: z.string().max(40).optional(),
})

const updateIdeaSchema = z.object({
  status: z.enum(['candidate', 'shortlisted', 'briefed', 'rejected', 'published']).optional(),
  reason: z.string().max(2000).optional(),
})

const createBriefSchema = z.object({
  ideaId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  objective: z.string().max(200).optional(),
  audience: z.string().max(1000).optional(),
  keyPoints: z.array(z.string().max(300)).max(20).optional(),
  constraints: z.string().max(2000).optional(),
  platformCode: z.string().max(32).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const createScriptSchema = z.object({
  variant: z.string().max(8).optional(),
  title: z.string().max(200).optional(),
  hook: z.string().max(500).optional(),
  body: z.array(z.string().max(1000)).max(30).optional(),
  proof: z.string().max(2000).optional(),
  cta: z.string().max(300).optional(),
})

const updateScriptSchema = z.object({
  status: z.enum(['draft', 'reviewing', 'approved', 'rejected']).optional(),
})

const calendarQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const createCalendarSchema = z.object({
  eventCode: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  eventType: z.enum(['festival', 'platform_promo', 'category_season']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  platformCode: z.string().max(32).optional(),
  categories: z.array(z.string().max(40)).max(20).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
})

const metricsLinkSchema = z.object({
  scriptVersionId: z.string().uuid().optional(),
  ideaId: z.string().uuid().optional(),
  videoId: z.string().min(1).max(100),
  platformCode: z.string().min(1).max(32),
  bizDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metrics: z.record(z.string(), z.unknown()).optional(),
})

function isContentRole(role: string): boolean {
  return CONTENT_ROLES.includes(role)
}

function mapIdea(row: any) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    platformCode: row.platform_code,
    source: row.source,
    productIds: row.product_ids || [],
    opportunityScore: row.opportunity_score == null ? null : Number(row.opportunity_score),
    scoreDetail: row.score_detail || {},
    missingItems: row.missing_items || [],
    reason: row.reason,
    aiDescription: row.ai_description,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function computeIdeaScore(
  request: FastifyRequest,
  tenantId: number,
  idea: any,
  options: { days?: number; templateCategory?: string }
) {
  const days = options.days || 30
  const platform = idea.platform_code || null
  const category = idea.category && idea.category !== '通用' ? idea.category : null
  const productIds = Array.isArray(idea.product_ids) ? idea.product_ids.map(Number) : []

  const { rows: videoRows } = await withRlsContext(request, (client) =>
    client.query<any>(
      `SELECT count(*) AS sample,
              COALESCE(avg(plays), 0) AS avg_plays,
              COALESCE(avg(CASE WHEN plays > 0
                THEN (likes + comments + shares + collects)::numeric / plays * 100 ELSE 0 END), 0) AS avg_eng,
              COALESCE(avg(attributed_gmv), 0) AS avg_gmv
         FROM public.video_metrics
        WHERE biz_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
          AND ($2::varchar IS NULL OR platform_code = $2)
          AND ($3::varchar IS NULL OR title ILIKE '%' || $3 || '%')`,
      [days, platform, category]
    )
  )
  const video = videoRows[0]
  const sample = Number(video?.sample) || 0
  const demand = sample >= 3 ? normalizeDemand(Number(video.avg_plays)) : null
  const history = sample >= 3 ? normalizeHistory(Number(video.avg_eng)) : null

  let margin: number | null = null
  let marginDetail = '无商品事实'
  let productCount = 0
  if (productIds.length > 0) {
    const { productRows, stockRows } = await withRlsContext(request, async (client) => {
      const pRes = await client.query<any>(
        `SELECT count(*) AS cnt,
                avg(CASE WHEN retail_price > 0 THEN (retail_price - unit_cost) / retail_price END) AS margin_rate
           FROM public.dim_product
          WHERE id = ANY($1::bigint[])`,
        [productIds]
      )
      const sRes = await client.query<any>(
        `SELECT COALESCE(sum(s.available_qty), 0) AS qty,
                COALESCE(sum(p.safety_stock), 0) AS safety
           FROM public.fact_inventory_stock s
           JOIN public.dim_product p ON p.id = s.product_id
          WHERE s.product_id = ANY($1::bigint[])`,
        [productIds]
      )
      return { productRows: pRes.rows, stockRows: sRes.rows }
    })
    const product = productRows[0]
    productCount = Number(product?.cnt) || 0
    let stockDays: number | null = null
    const stock = stockRows[0]
    const qty = Number(stock?.qty) || 0
    const safety = Number(stock?.safety) || 0
    if (safety > 0) stockDays = Math.round((qty / safety) * 14)
    margin = normalizeMargin(product?.margin_rate == null ? null : Number(product.margin_rate), stockDays)
    marginDetail = `毛利率 ${product?.margin_rate == null ? '数据不足' : `${(Number(product.margin_rate) * 100).toFixed(1)}%`}；库存周转约 ${stockDays ?? '数据不足'} 天（安全库存按 14 天估）`
  }

  const { rows: seasonRows } = await withRlsContext(request, (client) => client.query<any>(
    `SELECT id, name, categories, importance, start_date, end_date,
            (start_date - CURRENT_DATE) AS days_to_start
       FROM public.seasonal_calendar
      WHERE tenant_id = $1
        AND end_date >= CURRENT_DATE
        AND start_date <= CURRENT_DATE + INTERVAL '60 days'
      ORDER BY importance DESC, start_date ASC`,
    [tenantId]
  ))
  const matchedSeason = seasonRows.find((row) => {
    const categories = Array.isArray(row.categories) ? row.categories.map(String) : []
    if (categories.length === 0) return true
    if (categories.includes('全品类')) return true
    return category ? categories.includes(category) : false
  })
  const season = matchedSeason
    ? normalizeSeason(Number(matchedSeason.importance), Number(matchedSeason.days_to_start))
    : null

  const { templateRows, assetRows } = await withRlsContext(request, async (client) => {
    const tRes = await client.query<{ cnt: string }>(
      `SELECT count(*) AS cnt FROM public.video_templates
        WHERE tenant_id = $1 AND status = 'active'
          AND ($2::varchar IS NULL OR category = $2)`,
      [tenantId, options.templateCategory || null]
    )
    const aRes = await client.query<{ cnt: string }>(
      `SELECT count(*) AS cnt FROM public.media_assets WHERE tenant_id = $1`,
      [tenantId]
    )
    return { templateRows: tRes.rows, assetRows: aRes.rows }
  })
  const hasTemplate = Number(templateRows[0]?.cnt) > 0
  const hasProduct = productCount > 0
  const feasibility = normalizeFeasibility({
    hasProduct,
    hasTemplate,
    assetCount: Number(assetRows[0]?.cnt) || 0,
  })

  const result = computeOpportunityScore({ demand, history, margin, season, feasibility })
  return {
    ...result,
    inputs: {
      sampleSize: sample,
      avgPlays: Number(video?.avg_plays) || 0,
      avgEngagementRate: Number(video?.avg_eng) || 0,
      avgGmv: Number(video?.avg_gmv) || 0,
      seasonName: matchedSeason?.name || null,
      marginDetail,
      hasTemplate,
      assetCount: Number(assetRows[0]?.cnt) || 0,
      days,
    },
  }
}

export async function directorRoutes(app: FastifyInstance) {
  // ── 选题列表 ──
  app.get('/api/v1/director/ideas', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const params: unknown[] = [tenantIdOf(user)]
    let where = 'tenant_id = $1'
    if (query.status) {
      params.push(String(query.status))
      where += ` AND status = $${params.length}`
    }
    const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
    const eff = effectivePlatforms(query.platformCode, access.platforms === null ? null : Array.from(access.platforms))
    if (eff !== null) {
      params.push(eff)
      where += ` AND platform_code = ANY($${params.length}::text[])`
    }
    params.push(Math.min(100, Math.max(1, Number(query.limit) || 30)))
    const { rows } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT * FROM public.content_ideas
        WHERE ${where}
        ORDER BY opportunity_score DESC NULLS LAST, created_at DESC
        LIMIT $${params.length}`,
      params
    ))
    return sendOk(reply, { items: rows.map(mapIdea) })
  })

  // ── 新建选题 ──
  app.post('/api/v1/director/ideas', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权创建选题')

    const parsed = createIdeaSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    if (!(await isPlatformAllowed(user, data.platformCode))) return sendError(reply, 403, '无权访问该平台数据')
    const tenantId = tenantIdOf(user)
    const { rows } = await withRlsContext(request, (client) => client.query<{ id: string }>(
      `INSERT INTO public.content_ideas
         (tenant_id, title, category, platform_code, source, product_ids, reason, ai_description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
       RETURNING id`,
      [
        tenantId,
        data.title,
        data.category || '通用',
        data.platformCode || null,
        data.source || (data.productIds?.length ? 'product' : 'manual'),
        JSON.stringify(data.productIds || []),
        data.reason || '',
        data.aiDescription || '',
        user.id,
      ]
    ))
    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'director.idea.create',
        resourceType: 'content_ideas',
        resourceId: rows[0].id,
        afterData: { title: data.title, category: data.category },
      })
    )
    return sendOk(reply, { id: rows[0].id })
  })

  // ── 计算并落库机会分 ──
  app.post('/api/v1/director/ideas/:id/score', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权评分')
    const { id } = request.params as { id: string }
    const parsed = scoreIdeaSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const tenantId = tenantIdOf(user)

    const { rows } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT * FROM public.content_ideas WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id]
    ))
    const idea = rows[0]
    if (!idea) return sendError(reply, 404, '选题不存在')

    const result = await computeIdeaScore(request, tenantId, idea, parsed.data)
    await withRlsContext(request, async (client) => {
      await client.query(
        `UPDATE public.content_ideas
            SET opportunity_score = $2, score_detail = $3::jsonb, missing_items = $4::jsonb, updated_at = now()
          WHERE tenant_id = $1 AND id = $5`,
        [
          tenantId,
          result.score,
          JSON.stringify({ factors: result.factors, note: result.note, inputs: result.inputs, recommendation: result.recommendation }),
          JSON.stringify(result.missing),
          id,
        ]
      )
      await client.query(
        `INSERT INTO public.topic_performance
           (tenant_id, idea_id, category, platform_code, window_start, window_end, sample_size,
            avg_plays, avg_engagement_rate, avg_gmv, score, detail)
         VALUES ($1, $2, $3, $4, CURRENT_DATE - ($5::int * INTERVAL '1 day'), CURRENT_DATE,
                 $6, $7, $8, $9, $10, $11::jsonb)`,
        [
          tenantId,
          id,
          idea.category,
          idea.platform_code,
          result.inputs.days,
          result.inputs.sampleSize,
          result.inputs.avgPlays,
          result.inputs.avgEngagementRate,
          result.inputs.avgGmv,
          result.score,
          JSON.stringify({ missing: result.missing, note: result.note }),
        ]
      )
    })

    return sendOk(reply, {
      ideaId: id,
      score: result.score,
      recommendation: result.recommendation,
      factors: result.factors,
      missing: result.missing,
      note: result.note,
      inputs: result.inputs,
    })
  })

  // ── 更新选题状态 ──
  app.patch('/api/v1/director/ideas/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权修改选题')
    const { id } = request.params as { id: string }
    const parsed = updateIdeaSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const sets: string[] = ['updated_at = now()']
    const params: unknown[] = [tenantIdOf(user), id]
    if (parsed.data.status !== undefined) {
      params.push(parsed.data.status)
      sets.push(`status = $${params.length}`)
    }
    if (parsed.data.reason !== undefined) {
      params.push(parsed.data.reason)
      sets.push(`reason = $${params.length}`)
    }
    const { rowCount } = await withRlsContext(request, (client) => client.query(
      `UPDATE public.content_ideas SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2`,
      params
    ))
    if (!rowCount) return sendError(reply, 404, '选题不存在')
    return sendOk(reply, { id, updated: true })
  })

  // ── 简报列表 / 详情 ──
  app.get('/api/v1/director/briefs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const params: unknown[] = [tenantIdOf(user)]
    let where = 'b.tenant_id = $1'
    if (query.status) {
      params.push(String(query.status))
      where += ` AND b.status = $${params.length}`
    }
    const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
    const eff = effectivePlatforms(query.platformCode, access.platforms === null ? null : Array.from(access.platforms))
    if (eff !== null) {
      params.push(eff)
      where += ` AND b.platform_code = ANY($${params.length}::text[])`
    }
    params.push(Math.min(100, Math.max(1, Number(query.limit) || 30)))
    const { rows } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT b.*, i.title AS idea_title, i.opportunity_score,
              (SELECT count(*) FROM public.script_versions s WHERE s.brief_id = b.id) AS script_count
         FROM public.content_briefs b
         LEFT JOIN public.content_ideas i ON i.id = b.idea_id
        WHERE ${where}
        ORDER BY b.created_at DESC
        LIMIT $${params.length}`,
      params
    ))
    return sendOk(reply, {
      items: rows.map((row) => ({
        id: row.id,
        ideaId: row.idea_id,
        ideaTitle: row.idea_title,
        opportunityScore: row.opportunity_score == null ? null : Number(row.opportunity_score),
        title: row.title,
        objective: row.objective,
        audience: row.audience,
        keyPoints: row.key_points || [],
        constraints: row.constraints,
        platformCode: row.platform_code,
        dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
        status: row.status,
        aiGenerated: Boolean(row.ai_generated),
        scriptCount: Number(row.script_count) || 0,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    })
  })

  // ── 新建简报（商品事实来自商品库）──
  app.post('/api/v1/director/briefs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权创建简报')
    const parsed = createBriefSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    const tenantId = tenantIdOf(user)

    let keyPoints = data.keyPoints || []
    let idea: any = null
    if (data.ideaId) {
      const { rows } = await withRlsContext(request, (client) => client.query<any>(
        `SELECT * FROM public.content_ideas WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, data.ideaId]
      ))
      idea = rows[0]
      if (!idea) return sendError(reply, 404, '选题不存在')
      const productIds = Array.isArray(idea.product_ids) ? idea.product_ids.map(Number) : []
      if (keyPoints.length === 0 && productIds.length > 0) {
        const { rows: products } = await withRlsContext(request, (client) =>
          client.query<any>(
            `SELECT product_name, category, retail_price FROM public.dim_product WHERE id = ANY($1::bigint[])`,
            [productIds]
          )
        )
        keyPoints = products.map((product) =>
          `${product.product_name}（${product.category}，¥${Number(product.retail_price).toFixed(2)}）`
        )
      }
    }

    const briefPlatform = data.platformCode || idea?.platform_code || null
    if (!(await isPlatformAllowed(user, briefPlatform))) return sendError(reply, 403, '无权访问该平台数据')

    const { rows } = await withRlsContext(request, async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO public.content_briefs
           (tenant_id, idea_id, title, objective, audience, key_points, constraints, platform_code,
            due_date, status, ai_generated, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::date, 'draft', $10, $11)
         RETURNING id`,
        [
          tenantId,
          data.ideaId || null,
          data.title,
          data.objective || '',
          data.audience || '',
          JSON.stringify(keyPoints),
          data.constraints || '',
          data.platformCode || idea?.platform_code || null,
          data.dueDate || null,
          false,
          user.id,
        ]
      )
      if (data.ideaId) {
        await client.query(
          `UPDATE public.content_ideas SET status = 'briefed', updated_at = now()
            WHERE tenant_id = $1 AND id = $2 AND status IN ('candidate', 'shortlisted')`,
          [tenantId, data.ideaId]
        )
      }
      return inserted
    })
    return sendOk(reply, { id: rows[0].id, keyPoints })
  })

  app.get('/api/v1/director/briefs/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const tenantId = tenantIdOf(user)
    const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
    const eff = effectivePlatforms(undefined, access.platforms === null ? null : Array.from(access.platforms))
    const { rows } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT * FROM public.content_briefs WHERE tenant_id = $1 AND id = $2
        ${eff !== null ? 'AND platform_code = ANY($3::text[])' : ''} LIMIT 1`,
      eff !== null ? [tenantId, id, eff] : [tenantId, id]
    ))
    const brief = rows[0]
    if (!brief) return sendError(reply, 404, '简报不存在')
    const { rows: scripts } = await withRlsContext(request, (client) =>
      client.query<any>(
        `SELECT * FROM public.script_versions WHERE tenant_id = $1 AND brief_id = $2 ORDER BY version DESC, variant`,
        [tenantId, id]
      )
    )
    return sendOk(reply, {
      id: brief.id,
      ideaId: brief.idea_id,
      title: brief.title,
      objective: brief.objective,
      audience: brief.audience,
      keyPoints: brief.key_points || [],
      constraints: brief.constraints,
      platformCode: brief.platform_code,
      dueDate: brief.due_date ? String(brief.due_date).slice(0, 10) : null,
      status: brief.status,
      scripts: scripts.map((script) => ({
        id: script.id,
        version: Number(script.version),
        variant: script.variant,
        title: script.title,
        hook: script.hook,
        body: script.body || [],
        proof: script.proof,
        cta: script.cta,
        wordsCount: Number(script.words_count),
        complianceStatus: script.compliance_status,
        status: script.status,
        createdAt: new Date(script.created_at).toISOString(),
      })),
    })
  })

  // ── 新建脚本版本（入库前过违禁词）──
  app.post('/api/v1/director/briefs/:id/scripts', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权创建脚本')
    const { id } = request.params as { id: string }
    const parsed = createScriptSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    const tenantId = tenantIdOf(user)

    const { rows } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT * FROM public.content_briefs WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, id]
    ))
    const brief = rows[0]
    if (!brief) return sendError(reply, 404, '简报不存在')

    const hook = data.hook || (Array.isArray(brief.key_points) && brief.key_points[0] ? String(brief.key_points[0]) : '')
    const body = data.body && data.body.length > 0
      ? data.body
      : (Array.isArray(brief.key_points) ? brief.key_points.map(String) : [])
    const text = [hook, ...body, data.proof || '', data.cta || ''].join('\n')
    const scan = await scanBannedWords({ tenantId, text })
    const complianceStatus = scan.blocked ? 'failed' : 'passed'

    const insertRows = await withRlsContext(request, async (client) => {
      const { rows: versionRows } = await client.query<{ next: string }>(
        `SELECT COALESCE(max(version), 0) + 1 AS next FROM public.script_versions WHERE tenant_id = $1 AND brief_id = $2`,
        [tenantId, id]
      )
      const version = Number(versionRows[0].next)
      const wordsCount = text.replace(/\s/g, '').length

      const { rows: inserted } = await client.query<{ id: string }>(
        `INSERT INTO public.script_versions
           (tenant_id, brief_id, idea_id, version, variant, title, hook, body, proof, cta,
            words_count, compliance_status, compliance_detail, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13::jsonb, 'draft', $14)
         RETURNING id`,
        [
          tenantId,
          id,
          brief.idea_id,
          version,
          data.variant || 'A',
          data.title || brief.title,
          hook,
          JSON.stringify(body),
          data.proof || '',
          data.cta || '',
          wordsCount,
          complianceStatus,
          JSON.stringify({ blocked: scan.blocked, hits: scan.matched, ruleCount: scan.ruleCount }),
          user.id,
        ]
      )
      return { id: inserted[0].id, version }
    })
    return sendOk(reply, {
      id: insertRows.id,
      version: insertRows.version,
      complianceStatus,
      compliance: { blocked: scan.blocked, hits: scan.matched, ruleCount: scan.ruleCount },
    })
  })

  // ── 脚本详情 / 审核 ──
  app.get('/api/v1/director/scripts/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const { id } = request.params as { id: string }
    const tenantId = tenantIdOf(user)
    const { script, storyboards } = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT * FROM public.script_versions WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, id]
      )
      if (!rows[0]) return { script: null, storyboards: [] }
      const { rows: sb } = await client.query<any>(
        `SELECT * FROM public.storyboards WHERE tenant_id = $1 AND script_version_id = $2 ORDER BY seq ASC`,
        [tenantId, id]
      )
      return { script: rows[0], storyboards: sb }
    })
    if (!script) return sendError(reply, 404, '脚本不存在')
    return sendOk(reply, {
      id: script.id,
      briefId: script.brief_id,
      ideaId: script.idea_id,
      version: Number(script.version),
      variant: script.variant,
      title: script.title,
      hook: script.hook,
      body: script.body || [],
      proof: script.proof,
      cta: script.cta,
      wordsCount: Number(script.words_count),
      complianceStatus: script.compliance_status,
      complianceDetail: script.compliance_detail || {},
      status: script.status,
      storyboards: storyboards.map((item: any) => ({
        id: item.id,
        seq: Number(item.seq),
        shotSize: item.shot_size,
        scene: item.scene,
        subtitleText: item.subtitle_text,
        durationSec: Number(item.duration_sec),
        camera: item.camera,
      })),
    })
  })

  app.patch('/api/v1/director/scripts/:id', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权审核脚本')
    const { id } = request.params as { id: string }
    const parsed = updateScriptSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const tenantId = tenantIdOf(user)

    const updated = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT compliance_status FROM public.script_versions WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, id]
      )
      if (!rows[0]) return { notFound: true }
      if (rows[0].compliance_status === 'failed' && parsed.data.status === 'approved') {
        return { complianceFailed: true }
      }
      if (parsed.data.status) {
        await client.query(
          `UPDATE public.script_versions SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
          [tenantId, id, parsed.data.status]
        )
      }
      return { ok: true }
    })
    if (updated.notFound) return sendError(reply, 404, '脚本不存在')
    if (updated.complianceFailed) return sendError(reply, 400, '脚本未通过违禁词检查，不能审核通过')
    return sendOk(reply, { id, updated: true })
  })

  // ── 生成分镜（脚本结构化，不调用 LLM）──
  app.post('/api/v1/director/scripts/:id/storyboard', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权生成分镜')
    const { id } = request.params as { id: string }
    const tenantId = tenantIdOf(user)

    const script = await withRlsContext(request, async (client) => {
      const { rows } = await client.query<any>(
        `SELECT * FROM public.script_versions WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, id]
      )
      return rows[0]
    })
    if (!script) return sendError(reply, 404, '脚本不存在')

    const beats: Array<{ scene: string; shotSize: string; duration: number }> = []
    if (script.hook) beats.push({ scene: `钩子：${script.hook}`, shotSize: '特写', duration: 4 })
    const body: string[] = Array.isArray(script.body) ? script.body.map(String) : []
    body.forEach((item) => beats.push({ scene: item, shotSize: '中景', duration: 6 }))
    if (script.proof) beats.push({ scene: `证明：${script.proof}`, shotSize: '近景', duration: 5 })
    if (script.cta) beats.push({ scene: `行动号召：${script.cta}`, shotSize: '特写', duration: 4 })
    if (beats.length === 0) beats.push({ scene: '主镜头', shotSize: '中景', duration: 6 })

    try {
      await withRlsContext(request, async (client) => {
        await client.query(
          `DELETE FROM public.storyboards WHERE tenant_id = $1 AND script_version_id = $2`,
          [tenantId, id]
        )
        for (const [index, beat] of beats.entries()) {
          await client.query(
            `INSERT INTO public.storyboards
               (tenant_id, script_version_id, seq, shot_size, scene, subtitle_text, duration_sec, camera)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenantId, id, index, beat.shotSize, beat.scene, beat.scene.slice(0, 40), beat.duration, '固定机位']
          )
        }
      })
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '生成分镜失败')
    }
    return sendOk(reply, {
      scriptVersionId: id,
      shots: beats.map((beat, index) => ({ seq: index, ...beat })),
      totalDurationSec: beats.reduce((sum, beat) => sum + beat.duration, 0),
    })
  })

  // ── 发布日历 ──
  app.get('/api/v1/director/calendar', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const parsed = calendarQuerySchema.safeParse(request.query || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
    const eff = effectivePlatforms(undefined, access.platforms === null ? null : Array.from(access.platforms))
    const params: unknown[] = [tenantIdOf(user), parsed.data.from || null, parsed.data.to || null]
    if (eff !== null) params.push(eff)
    const { rows } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT * FROM public.seasonal_calendar
        WHERE tenant_id = $1
          AND end_date >= COALESCE($2::date, CURRENT_DATE)
          AND start_date <= COALESCE($3::date, CURRENT_DATE + INTERVAL '90 days')
          ${eff !== null ? 'AND platform_code = ANY($4::text[])' : ''}
        ORDER BY start_date ASC, importance DESC`,
      params
    ))
    return sendOk(reply, {
      items: rows.map((row) => ({
        id: row.id,
        eventCode: row.event_code,
        name: row.name,
        eventType: row.event_type,
        startDate: String(row.start_date).slice(0, 10),
        endDate: String(row.end_date).slice(0, 10),
        platformCode: row.platform_code,
        categories: row.categories || [],
        importance: Number(row.importance),
        notes: row.notes,
      })),
    })
  })

  app.post('/api/v1/director/calendar', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权维护日历')
    const parsed = createCalendarSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    if (!(await isPlatformAllowed(user, data.platformCode))) return sendError(reply, 403, '无权访问该平台数据')
    try {
      const { rows } = await withRlsContext(request, (client) => client.query<{ id: string }>(
        `INSERT INTO public.seasonal_calendar
           (tenant_id, event_code, name, event_type, start_date, end_date, platform_code,
            categories, importance, notes)
         VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8::jsonb, $9, $10)
         ON CONFLICT (tenant_id, event_code) DO UPDATE
           SET name = EXCLUDED.name, event_type = EXCLUDED.event_type,
               start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
               platform_code = EXCLUDED.platform_code, categories = EXCLUDED.categories,
               importance = EXCLUDED.importance, notes = EXCLUDED.notes, updated_at = now()
         RETURNING id`,
        [
          tenantIdOf(user),
          data.eventCode,
          data.name,
          data.eventType || 'festival',
          data.startDate,
          data.endDate,
          data.platformCode || null,
          JSON.stringify(data.categories || []),
          data.importance ?? 3,
          data.notes || '',
        ]
      ))
      return sendOk(reply, { id: rows[0].id })
    } catch (err) {
      return sendError(reply, 400, (err as Error)?.message || '保存日历失败')
    }
  })

  // ── 数据回看：脚本版本 vs 视频指标 ──
  app.get('/api/v1/director/performance', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const query = (request.query || {}) as Record<string, string>
    const days = Math.min(180, Math.max(7, Number(query.days) || 30))
    const tenantId = tenantIdOf(user)
    const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
    const eff = effectivePlatforms(query.platformCode, access.platforms === null ? null : Array.from(access.platforms))

    const { rows: links } = await withRlsContext(request, (client) => client.query<any>(
      `SELECT l.script_version_id, l.idea_id, l.video_id, l.platform_code, l.biz_date, l.metrics,
              s.version, s.variant, s.title AS script_title, s.compliance_status
         FROM public.content_metrics_link l
         LEFT JOIN public.script_versions s ON s.id = l.script_version_id
        WHERE l.tenant_id = $1 AND l.biz_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
          ${eff !== null ? 'AND l.platform_code = ANY($3::text[])' : ''}
        ORDER BY l.biz_date DESC
        LIMIT 200`,
      eff !== null ? [tenantId, days, eff] : [tenantId, days]
    ))

    const { rows: videos } = await withRlsContext(request, (client) =>
      client.query<any>(
        `SELECT content_type, count(*) AS sample, COALESCE(sum(plays), 0) AS plays,
                COALESCE(sum(likes + comments + shares + collects), 0) AS engagements,
                COALESCE(sum(attributed_gmv), 0) AS gmv
           FROM public.video_metrics
          WHERE biz_date >= CURRENT_DATE - ($1::int * INTERVAL '1 day')
            ${eff !== null ? 'AND platform_code = ANY($2::text[])' : ''}
          GROUP BY content_type
          ORDER BY plays DESC`,
        eff !== null ? [days, eff] : [days]
      )
    )

    return sendOk(reply, {
      windowDays: days,
      links: links.map((row) => ({
        scriptVersionId: row.script_version_id,
        ideaId: row.idea_id,
        videoId: row.video_id,
        platformCode: row.platform_code,
        bizDate: String(row.biz_date).slice(0, 10),
        metrics: row.metrics || {},
        script: row.script_version_id ? {
          version: Number(row.version),
          variant: row.variant,
          title: row.script_title,
          complianceStatus: row.compliance_status,
        } : null,
      })),
      summary: videos.map((row) => ({
        contentType: row.content_type,
        sample: Number(row.sample),
        plays: Number(row.plays),
        engagements: Number(row.engagements),
        gmv: Number(row.gmv),
        engagementRate: Number(row.plays) > 0
          ? Math.round((Number(row.engagements) / Number(row.plays)) * 10000) / 100
          : 0,
      })),
    })
  })

  app.post('/api/v1/director/metrics-link', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isContentRole(user.role)) return sendError(reply, 403, '当前角色无权回填指标')
    const parsed = metricsLinkSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')
    const data = parsed.data
    if (!(await isPlatformAllowed(user, data.platformCode))) return sendError(reply, 403, '无权访问该平台数据')
    const { rows } = await withRlsContext(request, (client) => client.query<{ id: string }>(
      `INSERT INTO public.content_metrics_link
         (tenant_id, script_version_id, idea_id, video_id, platform_code, biz_date, metrics)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::jsonb)
       ON CONFLICT (tenant_id, platform_code, video_id, biz_date) DO UPDATE
         SET script_version_id = EXCLUDED.script_version_id,
             idea_id = EXCLUDED.idea_id,
             metrics = EXCLUDED.metrics
       RETURNING id`,
      [
        tenantIdOf(user),
        data.scriptVersionId || null,
        data.ideaId || null,
        data.videoId,
        data.platformCode,
        data.bizDate,
        JSON.stringify(data.metrics || {}),
      ]
    ))
    return sendOk(reply, { id: rows[0].id })
  })

  // ── 五区聚合 ──
  app.get('/api/v1/director/overview', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    const tenantId = tenantIdOf(user)
    const access = await resolveAccess({ userId: user.id, role: user.role, userType: user.userType, tenantId: user.tenantId })
    const eff = effectivePlatforms(undefined, access.platforms === null ? null : Array.from(access.platforms))
    const pFilter = (col: string, startIdx: number) =>
      eff !== null ? ` AND ${col} = ANY($${startIdx}::text[])` : ''
    const pf = eff !== null ? [eff] : []
    const { ideas, scripts, calendar, performance, assets } = await withRlsContext(request, async (client) => {
      const ideaRows = await client.query<any>(
        `SELECT * FROM public.content_ideas WHERE tenant_id = $1 ${pFilter('platform_code', 2)}
          ORDER BY opportunity_score DESC NULLS LAST, created_at DESC LIMIT 10`,
        [tenantId, ...pf]
      )
      const scriptRows = await client.query<any>(
        `SELECT s.id, s.version, s.variant, s.title, s.status, s.compliance_status, s.created_at,
                b.title AS brief_title
           FROM public.script_versions s
           LEFT JOIN public.content_briefs b ON b.id = s.brief_id
          WHERE s.tenant_id = $1 ${pFilter('b.platform_code', 2)}
          ORDER BY s.created_at DESC LIMIT 10`,
        [tenantId, ...pf]
      )
      const calendarRows = await client.query<any>(
        `SELECT * FROM public.seasonal_calendar
          WHERE tenant_id = $1 AND end_date >= CURRENT_DATE ${pFilter('platform_code', 2)}
          ORDER BY start_date ASC LIMIT 10`,
        [tenantId, ...pf]
      )
      const performanceRows = await client.query<any>(
        `SELECT count(*) AS links,
                COALESCE(avg(CASE WHEN metrics->>'plays' ~ '^[0-9]+(\\.[0-9]+)?$'
                                  THEN (metrics->>'plays')::numeric END), 0) AS avg_plays
           FROM public.content_metrics_link
          WHERE tenant_id = $1 AND biz_date >= CURRENT_DATE - INTERVAL '30 days' ${pFilter('platform_code', 2)}`,
        [tenantId, ...pf]
      )
      const assetRows = await client.query<any>(
        `SELECT (SELECT count(*) FROM public.media_assets WHERE tenant_id = $1) AS media_count,
                (SELECT count(*) FROM public.bgm_library WHERE tenant_id = $1 AND is_active) AS bgm_count,
                (SELECT count(*) FROM public.video_templates WHERE tenant_id = $1 AND status = 'active') AS template_count`,
        [tenantId]
      )
      return {
        ideas: ideaRows,
        scripts: scriptRows,
        calendar: calendarRows,
        performance: performanceRows,
        assets: assetRows,
      }
    })

    return sendOk(reply, {
      ideas: ideas.rows.map(mapIdea),
      scripts: scripts.rows.map((row) => ({
        id: row.id,
        version: Number(row.version),
        variant: row.variant,
        title: row.title,
        briefTitle: row.brief_title,
        status: row.status,
        complianceStatus: row.compliance_status,
        createdAt: new Date(row.created_at).toISOString(),
      })),
      calendar: calendar.rows.map((row) => ({
        id: row.id,
        name: row.name,
        eventType: row.event_type,
        startDate: String(row.start_date).slice(0, 10),
        endDate: String(row.end_date).slice(0, 10),
        importance: Number(row.importance),
        categories: row.categories || [],
      })),
      performance: {
        links: Number(performance.rows[0]?.links) || 0,
        avgPlays: Number(performance.rows[0]?.avg_plays) || 0,
      },
      assets: {
        mediaCount: Number(assets.rows[0]?.media_count) || 0,
        bgmCount: Number(assets.rows[0]?.bgm_count) || 0,
        templateCount: Number(assets.rows[0]?.template_count) || 0,
      },
    })
  })
}
