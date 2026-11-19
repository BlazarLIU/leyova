import type { FastifyInstance } from 'fastify'
import type { PoolClient } from 'pg'
import { writeAuditLog } from '../lib/audit.js'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { canAccessCost, canAccessCostAsync, requireAuth, requireRole } from '../lib/guard.js'
import { getAnchorCapabilitiesAndRankings } from '../services/anchor-ranking.js'

const OPS_PLAN_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']

export async function opsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/ops/capabilities ── (frontend: /ops/capabilities)
  app.get('/api/v1/ops/capabilities', async (request, reply) => {
    try {
      const platformParam = (request.query as any)?.platform
      const nonLivePlatforms = ['jd', 'taobao', 'tmall', 'pdd', 'xiaohongshu']
      if (platformParam && nonLivePlatforms.includes(String(platformParam).toLowerCase())) {
        return sendOk(reply, {
          dimensions: [],
          anchorRankings: [],
          capabilities: [],
          rankings: [],
        })
      }

      const data = await withRlsContext(request, (client) => getAnchorCapabilitiesAndRankings(client))
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'ops/capabilities query failed')
      return sendOk(reply, {
        dimensions: [],
        anchorRankings: [],
        capabilities: [],
        rankings: [],
      })
    }
  })

  // ── GET /api/v1/ops/goal-tracking ──
  app.get('/api/v1/ops/goal-tracking', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    try {
      const showCost = await canAccessCostAsync(
        (user as any).id, user.role, user.userType, undefined)
      const periodKey = (((request.query as { period?: string })?.period) || '').toString().toLowerCase()
      const periodMap: Record<string, string> = { month: 'monthly', quarter: 'quarterly', year: 'yearly' }
      const dbPeriod = periodMap[periodKey] || ''
      const where = dbPeriod ? ' WHERE period = $1' : ''
      const params = dbPeriod ? [dbPeriod] : []
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, name, target AS "target", current_val AS "current",
                  unit, progress, category, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
           FROM goal_tracking${where} ORDER BY id`,
          params,
        ),
      )
      const filtered = showCost
        ? rows
        : rows.filter((r: any) => !/成本|毛利|利润|净利|ROI|投产|花费/i.test(`${r.category || ''} ${r.name || ''}`))
      return sendOk(reply, { goals: filtered })
    } catch (err) {
      request.log.warn({ err }, 'ops/goal-tracking query failed')
      return sendOk(reply, { goals: [] })
    }
  })

  // ── POST /api/v1/ops/goal-tracking ── 新建经营目标（P0-1：目标管理闭环）
  app.post('/api/v1/ops/goal-tracking', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const { name, target, unit, category, period } = request.body ?? {}
    if (!name || !String(name).trim()) return sendError(reply, 400, '目标名称不能为空')
    const targetNum = Number(target)
    if (!Number.isFinite(targetNum) || targetNum <= 0) return sendError(reply, 400, '目标值必须是正数')
    const periodVal = ['monthly', 'quarterly', 'yearly'].includes(period) ? period : 'monthly'
    const unitVal = unit && String(unit).trim() ? String(unit).trim() : '元'
    const categoryVal = category && String(category).trim() ? String(category).trim() : '营收'
    try {
      const result = await withRlsContext(request, async (client) => {
        const { rows: [goal] } = await client.query(
          `INSERT INTO goal_tracking (name, target, current_val, unit, progress, category, period)
           VALUES ($1, $2, 0, $3, 0, $4, $5) RETURNING id`,
          [String(name).trim(), targetNum, unitVal, categoryVal, periodVal])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'goal.create',
          resourceType: 'goal_tracking',
          resourceId: String(goal.id),
          afterData: { name: String(name).trim(), target: targetNum, period: periodVal },
          request,
        })
        return goal
      })
      return sendOk(reply, { id: result.id })
    } catch (err) {
      request.log.warn({ err }, 'ops/goal-tracking insert failed')
      return sendError(reply, 500, '创建目标失败')
    }
  })

  // ── PUT /api/v1/ops/goal-tracking/:id ── 更新目标（progress 由 current/target 推导）
  app.put('/api/v1/ops/goal-tracking/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) return sendError(reply, 400, '无效的目标 ID')
    const { name, target, current, unit, category, period } = request.body ?? {}
    const sets: string[] = []
    const params: any[] = []
    const push = (col: string, val: any) => { params.push(val); sets.push(col + ' = $' + params.length) }
    if (name != null) push('name', String(name).trim())
    if (target != null && Number.isFinite(Number(target))) push('target', Number(target))
    if (current != null && Number.isFinite(Number(current))) push('current_val', Number(current))
    if (unit != null) push('unit', String(unit).trim())
    if (category != null) push('category', String(category).trim())
    if (period != null && ['monthly', 'quarterly', 'yearly'].includes(period)) push('period', period)
    if (sets.length === 0) return sendError(reply, 400, '没有需要更新的字段')
    try {
      await withRlsContext(request, async (client) => {
        // PG 的 SET 左边赋值对右边不可见：若同一条语句里先 SET current_val 再算
        // progress，表达式读到的是旧值（0）。故拆成两条 UPDATE。
        await client.query(
          'UPDATE goal_tracking SET ' + sets.join(', ') + ', updated_at = now() WHERE id = $' + (params.length + 1),
          [...params, id])
        await client.query(
          `UPDATE goal_tracking
              SET progress = LEAST(200, GREATEST(0, ROUND(
                    CASE WHEN target > 0 THEN current_val::numeric / target * 100 ELSE 0 END
                  )::smallint)),
                  updated_at = now()
            WHERE id = $1`,
          [id])
      })
      return sendOk(reply, { id })
    } catch (err) {
      request.log.warn({ err }, 'ops/goal-tracking update failed')
      return sendError(reply, 500, '更新目标失败')
    }
  })

  // ── DELETE /api/v1/ops/goal-tracking/:id ── 删除目标
  app.delete('/api/v1/ops/goal-tracking/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) return sendError(reply, 400, '无效的目标 ID')
    try {
      await withRlsContext(request, async (client) => {
        await client.query('DELETE FROM goal_tracking WHERE id = $1', [id])
      })
      return sendOk(reply, { id })
    } catch (err) {
      request.log.warn({ err }, 'ops/goal-tracking delete failed')
      return sendError(reply, 500, '删除目标失败')
    }
  })

  // ── GET /api/v1/ops/script-library ──
  app.get('/api/v1/ops/script-library', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT id, title, category, content, use_count AS "useCount", likes
           FROM script_library ORDER BY use_count DESC`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      // P1-B18：不再静默吞错返回 []
      //   原实现 `catch → sendOk(reply, [])` 让「查询失败」和「真的没数据」表现一致，
      //   运营看到空页面无法判断是没数据还是系统坏了。
      request.log.warn({ err }, 'ops/script-library query failed')
      return sendError(reply, 500, '话术库查询失败，请稍后重试或联系管理员')
    }
  })

  // ── POST /api/v1/ops/script-library ── 新建话术（P1-B13）
  //    审计断点：此前话术库只有 GET，运营/编导写好话术无法入库，只能手工改数据库
  app.post('/api/v1/ops/script-library', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const { title, category, content } = request.body ?? {}
    if (!title?.trim() || !content?.trim()) {
      return reply.status(400).send({ error: '标题与内容为必填项' })
    }
    try {
      const row = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO script_library (title, category, content, use_count, likes)
           VALUES ($1, $2, $3, 0, 0)
           RETURNING id, title, category, content`,
          [title.trim(), (category || '通用').trim(), content.trim()],
        )
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'ops.script_library.create',
          resourceType: 'script_library',
          resourceId: String(rows[0].id),
          afterData: { title: rows[0].title, category: rows[0].category },
          request,
        })
        return rows[0]
      })
      return sendOk(reply, row)
    } catch (err) {
      request.log.warn({ err }, 'ops/script-library create failed')
      return reply.status(500).send({ error: '保存失败' })
    }
  })

  // ── PUT /api/v1/ops/script-library/:id ── 修改话术
  app.put('/api/v1/ops/script-library/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return reply.status(400).send({ error: 'ID 非法' })
    const { title, category, content } = request.body ?? {}
    try {
      const row = await withRlsContext(request, async (client) => {
        const { rows } = await client.query(
          `UPDATE script_library
              SET title    = COALESCE($2, title),
                  category = COALESCE($3, category),
                  content  = COALESCE($4, content),
                  updated_at = now()
            WHERE id = $1
            RETURNING id, title, category, content`,
          [id, title ?? null, category ?? null, content ?? null],
        )
        if (rows.length > 0) {
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'ops.script_library.update',
            resourceType: 'script_library',
            resourceId: String(id),
            afterData: { title: rows[0].title },
            request,
          })
        }
        return rows[0]
      })
      if (!row) return reply.status(404).send({ error: '话术不存在' })
      return sendOk(reply, row)
    } catch (err) {
      request.log.warn({ err }, 'ops/script-library update failed')
      return reply.status(500).send({ error: '更新失败' })
    }
  })

  // ── DELETE /api/v1/ops/script-library/:id ── 删除话术
  app.delete('/api/v1/ops/script-library/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return reply.status(400).send({ error: 'ID 非法' })
    try {
      await withRlsContext(request, async (client) => {
        await client.query('DELETE FROM script_library WHERE id = $1', [id])
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'ops.script_library.delete',
          resourceType: 'script_library',
          resourceId: String(id),
          request,
        })
      })
      return sendOk(reply, { deleted: true })
    } catch (err) {
      request.log.warn({ err }, 'ops/script-library delete failed')
      return reply.status(500).send({ error: '删除失败' })
    }
  })

  // ── GET /api/v1/ops/issue-library ──
  app.get('/api/v1/ops/issue-library', async (request, reply) => {
    try {
      const { rows, autoTags } = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT id, title, category, solution, occurrence_count AS "occurrenceCount",
                  detailed_solution AS "detailedSolution"
           FROM issue_library ORDER BY occurrence_count DESC`,
        )
        const tags = await generateAutoIssueTags(client)
        return { rows: res.rows, autoTags: tags }
      })
      return sendOk(reply, { issues: rows, autoTags })
    } catch (err) {
      request.log.warn({ err }, 'ops/issue-library query failed')
      return sendOk(reply, { issues: [], autoTags: [] })
    }
  })

  // ── POST /api/v1/ops/issue-library ── 录入问题（含「自动检测一键转问题」）
  // 此前只有 GET：前端能展示自动检测到的异常，却无法转成可追踪的问题条目，
  // 导致「问题库 → 改进任务 → 复盘」闭环断在第一环。
  app.post('/api/v1/ops/issue-library', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const { title, category, solution, detailedSolution } = request.body ?? {}
    if (!title || !String(title).trim()) return sendError(reply, 400, '问题标题不能为空')
    if (!solution || !String(solution).trim()) return sendError(reply, 400, '必须填写处理方式')
    const categoryVal = category && String(category).trim() ? String(category).trim() : '其他'
    try {
      const result = await withRlsContext(request, async (client) => {
        // 同标题重复录入时累加 occurrence_count，而非新建重复条目
        const { rows: existing } = await client.query(
          'SELECT id, occurrence_count FROM issue_library WHERE title = $1 LIMIT 1',
          [String(title).trim()])
        if (existing.length > 0) {
          const { rows: [updated] } = await client.query(
            `UPDATE issue_library
                SET occurrence_count = occurrence_count + 1,
                    solution = $2,
                    detailed_solution = COALESCE($3, detailed_solution),
                    updated_at = now()
              WHERE id = $1
              RETURNING id, occurrence_count`,
            [existing[0].id, String(solution).trim(), detailedSolution ? String(detailedSolution) : null])
          return { id: updated.id, occurrenceCount: Number(updated.occurrence_count), merged: true }
        }
        const { rows: [created] } = await client.query(
          `INSERT INTO issue_library (title, category, solution, detailed_solution, occurrence_count)
           VALUES ($1, $2, $3, $4, 1) RETURNING id`,
          [String(title).trim(), categoryVal, String(solution).trim(),
           detailedSolution ? String(detailedSolution) : null])
        return { id: created.id, occurrenceCount: 1, merged: false }
      })
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'ops/issue-library insert failed')
      return sendError(reply, 500, '录入问题失败')
    }
  })

  // ── PUT /api/v1/ops/issue-library/:id ── 更新问题条目
  app.put('/api/v1/ops/issue-library/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) return sendError(reply, 400, '无效的问题 ID')
    const { title, category, solution, detailedSolution, occurrenceCount } = request.body ?? {}
    const sets: string[] = []
    const params: any[] = []
    const push = (col: string, val: any) => { params.push(val); sets.push(col + ' = $' + params.length) }
    if (title != null) push('title', String(title).trim())
    if (category != null) push('category', String(category).trim())
    if (solution != null) push('solution', String(solution).trim())
    if (detailedSolution != null) push('detailed_solution', String(detailedSolution))
    if (occurrenceCount != null && Number.isFinite(Number(occurrenceCount))) {
      push('occurrence_count', Math.max(0, Math.round(Number(occurrenceCount))))
    }
    if (sets.length === 0) return sendError(reply, 400, '没有需要更新的字段')
    try {
      await withRlsContext(request, async (client) => {
        await client.query(
          'UPDATE issue_library SET ' + sets.join(', ') + ', updated_at = now() WHERE id = $' + (params.length + 1),
          [...params, id])
      })
      return sendOk(reply, { id })
    } catch (err) {
      request.log.warn({ err }, 'ops/issue-library update failed')
      return sendError(reply, 500, '更新问题失败')
    }
  })

  // ── DELETE /api/v1/ops/issue-library/:id ── 删除问题条目
  app.delete('/api/v1/ops/issue-library/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || id <= 0) return sendError(reply, 400, '无效的问题 ID')
    try {
      await withRlsContext(request, async (client) => {
        await client.query('DELETE FROM issue_library WHERE id = $1', [id])
      })
      return sendOk(reply, { id })
    } catch (err) {
      request.log.warn({ err }, 'ops/issue-library delete failed')
      return sendError(reply, 500, '删除问题失败')
    }
  })

  // ── GET /api/v1/ops/room-health ── (frontend: /ops/room-health)
  app.get('/api/v1/ops/room-health', async (request, reply) => {
    try {
      const { rows } = await withRlsContext(request, (client) =>
        client.query(
          `SELECT lr.name, rh.health_score AS "healthScore", rh.interaction_score AS "interactionScore",
                  rh.conversion_score AS "conversionScore", rh.content_score AS "contentScore",
                  rh.traffic_score AS "trafficScore", rh.status
           FROM room_health rh
           JOIN live_rooms lr ON lr.id = rh.room_id
           WHERE rh.evaluated_at = (SELECT MAX(evaluated_at) FROM room_health WHERE room_id = rh.room_id)
           ORDER BY rh.health_score DESC`,
        ),
      )
      return sendOk(reply, rows)
    } catch (err) {
      // P1-B18：同上，不再静默吞错
      request.log.warn({ err }, 'ops/room-health query failed')
      return sendError(reply, 500, '直播间健康度查询失败')
    }
  })

  // ── GET /api/v1/ops/session-plans ── 排品计划列表 (frontend: /ops/session-products)
  app.get('/api/v1/ops/session-plans', async (request, reply) => {
    try {
      const { plans, products } = await withRlsContext(request, async (client) => {
        const { rows: pRows } = await client.query(
          `SELECT sp.id, lr.name AS room_name, sp.plan_date AS "planDate",
                  a.name AS anchor_name, p.name AS campaign_name,
                  p.start_date AS "campaignStart", p.end_date AS "campaignEnd",
                  p.type AS campaign_type, p.content AS campaign_content,
                  sp.notes, sp.created_at AS "createdAt"
           FROM session_plans sp
           JOIN live_rooms lr ON lr.id = sp.room_id
           JOIN anchors a ON a.id = sp.anchor_id
           LEFT JOIN promotions p ON p.id = sp.campaign_id
           ORDER BY sp.plan_date DESC, sp.created_at DESC`,
        )
        const planIds = pRows.map((p: any) => p.id)
        const prodRows: any[] = planIds.length
          ? (
              await client.query(
                `SELECT spp.id, spp.plan_id AS "planId",
                        spp.group_letter AS "groupLetter",
                        spp.product_code AS "productCode", spp.price
                 FROM session_plan_products spp
                 WHERE spp.plan_id = ANY($1::int[])
                 ORDER BY spp.group_letter`,
                [planIds],
              )
            ).rows
          : []
        return { plans: pRows, products: prodRows }
      })
      const productMap: Record<number, any[]> = {}
      for (const prod of products) {
        ;(productMap[prod.planId] ??= []).push(prod)
      }
      return sendOk(reply, {
        plans: plans.map((p: any) => ({
          ...p,
          products: productMap[p.id] ?? [],
        })),
      })
    } catch (err) {
      request.log.warn({ err }, 'ops/session-plans query failed')
      return sendOk(reply, { plans: [] })
    }
  })

async function validateSessionPlanStock(
  client: PoolClient,
  products?: Record<string, { code?: string; price?: number }>,
): Promise<{ passed: boolean; warnings: string[]; items: any[] }> {
  if (!products || typeof products !== 'object') {
    return { passed: true, warnings: [], items: [] }
  }

  const groupLetters = ['a', 'b', 'c', 'd', 'e']
  const productCodes = groupLetters
    .map((k) => products[k]?.code)
    .filter((c): c is string => Boolean(c && typeof c === 'string'))

  if (productCodes.length === 0) {
    return { passed: true, warnings: [], items: [] }
  }

  const stockRes = await client.query(
    `SELECT p.id, p.sku_code, p.spu_code, p.product_name, p.status, p.safety_stock,
            COALESCE(SUM(s.available_qty), 0)::int AS available_qty,
            COALESCE(SUM(s.on_hand_qty), 0)::int AS on_hand_qty
     FROM public.dim_product p
     LEFT JOIN public.fact_inventory_stock s ON s.product_id = p.id
     WHERE p.sku_code = ANY($1) OR p.spu_code = ANY($1)
     GROUP BY p.id, p.sku_code, p.spu_code, p.product_name, p.status, p.safety_stock`,
    [productCodes],
  )

  const stockMap = new Map<string, any>()
  for (const row of stockRes.rows) {
    stockMap.set(row.sku_code, row)
    stockMap.set(row.spu_code, row)
  }

  const warnings: string[] = []
  const items: any[] = []

  for (const code of productCodes) {
    const item = stockMap.get(code)
    if (!item) {
      warnings.push(`商品编码 ${code} 在商品中心未找到登记档案`)
      items.push({ code, status: 'unregistered', availableQty: 0, safetyStock: 0 })
    } else if (item.status !== 'active') {
      warnings.push(`商品 ${item.product_name} (${code}) 当前处于非在售状态 (${item.status})`)
      items.push({ code, name: item.product_name, status: item.status, availableQty: item.available_qty, safetyStock: item.safety_stock })
    } else if (item.available_qty <= 0) {
      warnings.push(`商品 ${item.product_name} (${code}) 可用库存为 0，存在超卖断货风险`)
      items.push({ code, name: item.product_name, status: 'out_of_stock', availableQty: 0, safetyStock: item.safety_stock })
    } else if (item.available_qty < item.safety_stock) {
      warnings.push(`商品 ${item.product_name} (${code}) 可用库存低于安全线 (${item.available_qty} < ${item.safety_stock})`)
      items.push({ code, name: item.product_name, status: 'low_stock', availableQty: item.available_qty, safetyStock: item.safety_stock })
    } else {
      items.push({ code, name: item.product_name, status: 'healthy', availableQty: item.available_qty, safetyStock: item.safety_stock })
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
    items,
  }
}

  // ── POST /api/v1/ops/session-plans ── 创建排品计划（含库存健康度与缺货校验）
  app.post('/api/v1/ops/session-plans', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const { roomId, date, anchorId, products, campaignId, notes, strictStock } = request.body ?? {}
    if (!roomId || !date || !anchorId) {
      return reply.status(400).send({ error: '直播间、日期、主播为必填项' })
    }
    try {
      const outcome = await withRlsContext(request, async (client) => {
        // 校验库存健康度
        const stockCheck = await validateSessionPlanStock(client, products)
        if (strictStock && stockCheck.items.some((i) => i.status === 'out_of_stock' || i.status === 'unregistered')) {
          return { error: '严格模式：存在缺货或未登记商品，已阻断排品入库', stockValidation: stockCheck }
        }

        const { rows: [plan] } = await client.query(
          `INSERT INTO session_plans (room_id, plan_date, anchor_id, campaign_id, notes)
           VALUES ($1, $2::date, $3, $4, $5) RETURNING id`,
          [roomId, date, anchorId, campaignId || null, notes || ''],
        )
        const groupLetters = ['a', 'b', 'c', 'd', 'e']
        for (const letter of groupLetters) {
          const prod = products?.[letter]
          if (prod?.code) {
            await client.query(
              `INSERT INTO session_plan_products (plan_id, group_letter, product_code, price)
               VALUES ($1, $2, $3, $4)`,
              [plan.id, letter.toUpperCase(), prod.code, prod.price || 0],
            )
          }
        }
        return { planId: plan.id, stockValidation: stockCheck }
      })

      if ('error' in outcome && outcome.error) {
        return reply.status(400).send({ error: outcome.error, stockValidation: outcome.stockValidation })
      }

      return sendOk(reply, { id: outcome.planId, stockValidation: outcome.stockValidation })
    } catch (err) {
      request.log.warn({ err }, 'ops/session-plans insert failed')
      return reply.status(500).send({ error: '保存失败' })
    }
  })

  // ── PUT /api/v1/ops/session-plans/:id ── 修改排品计划（P1-B10 + 库存健康度校验）
  //    审计断点：此前只有 POST/DELETE，运营排完品发现要改一个商品只能删了重建
  app.put('/api/v1/ops/session-plans/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const planId = Number(request.params.id)
    if (!Number.isFinite(planId)) {
      return reply.status(400).send({ error: '排品计划 ID 非法' })
    }
    const { roomId, date, anchorId, products, campaignId, notes, strictStock } = request.body ?? {}

    try {
      const result = await withRlsContext(request, async (client) => {
        const existing = await client.query(
          `SELECT id FROM session_plans WHERE id = $1`,
          [planId],
        )
        if (existing.rows.length === 0) return { notFound: true as const }

        // 校验库存健康度
        const stockCheck = await validateSessionPlanStock(client, products)
        if (strictStock && stockCheck.items.some((i) => i.status === 'out_of_stock' || i.status === 'unregistered')) {
          return { error: '严格模式：存在缺货或未登记商品，已阻断排品修改', stockValidation: stockCheck }
        }

        // 只更新传了值的字段（部分更新）
        await client.query(
          `UPDATE session_plans
              SET room_id    = COALESCE($2, room_id),
                  plan_date  = COALESCE($3::date, plan_date),
                  anchor_id  = COALESCE($4, anchor_id),
                  campaign_id = $5,
                  notes      = COALESCE($6, notes)
            WHERE id = $1`,
          [planId, roomId ?? null, date ?? null, anchorId ?? null,
           campaignId ?? null, notes ?? null],
        )

        // 若传了 products，全量替换（与 POST 语义一致）
        if (products && typeof products === 'object') {
          await client.query(`DELETE FROM session_plan_products WHERE plan_id = $1`, [planId])
          const groupLetters = ['a', 'b', 'c', 'd', 'e']
          for (const letter of groupLetters) {
            const prod = products[letter]
            if (prod?.code) {
              await client.query(
                `INSERT INTO session_plan_products (plan_id, group_letter, product_code, price)
                 VALUES ($1, $2, $3, $4)`,
                [planId, letter.toUpperCase(), prod.code, prod.price || 0],
              )
            }
          }
        }

        const after = await client.query(
          `SELECT id, room_id, plan_date, anchor_id, campaign_id, notes
             FROM session_plans WHERE id = $1`,
          [planId],
        )
        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'ops.session_plan.update',
          resourceType: 'session_plans',
          resourceId: String(planId),
          afterData: after.rows[0],
          request,
        })
        return { data: after.rows[0], stockValidation: stockCheck }
      })

      if ('notFound' in result) {
        return reply.status(404).send({ error: '排品计划不存在' })
      }
      if ('error' in result && result.error) {
        return reply.status(400).send({ error: result.error, stockValidation: result.stockValidation })
      }
      return sendOk(reply, result)
    } catch (err) {
      request.log.warn({ err }, 'ops/session-plans update failed')
      return reply.status(500).send({ error: '更新失败' })
    }
  })

  // ── DELETE /api/v1/ops/session-plans/:id ── 删除排品计划
  app.delete('/api/v1/ops/session-plans/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    try {
      await withRlsContext(request, (client) =>
        client.query('DELETE FROM session_plans WHERE id = $1', [request.params.id]),
      )
      return sendOk(reply, { deleted: true })
    } catch (err) {
      request.log.warn({ err }, 'ops/session-plans delete failed')
      return reply.status(500).send({ error: '删除失败' })
    }
  })
}

type AutoTag = {
  id: string
  type: 'anchor' | 'channel'
  title: string
  category: string
  severity: 'high' | 'medium' | 'low'
  targetName: string
  metric: string
  value: string
  threshold: string
  date: string | null
}

async function generateAutoIssueTags(client: DbExecutor): Promise<AutoTag[]> {
  const tags: AutoTag[] = []
  const tagId = () => `auto-${tags.length + 1}`

  // 1. 主播维度数据扫描（近 30 天）
  await client.query('SAVEPOINT sp_auto_anchor_tags')
  try {
    const { rows: anchorMetrics } = await client.query(
      `SELECT a.name AS anchor_name,
              COALESCE(AVG(combined.interaction_rate), 0) AS avg_interaction_rate,
              COALESCE(AVG(combined.retention_rate), 0) AS avg_retention_rate,
              COALESCE(AVG(combined.uv_value), 0) AS avg_uv_value,
              COALESCE(AVG(combined.gpm), 0) AS avg_gpm,
              COALESCE(AVG(combined.view_follow_rate), 0) AS avg_view_follow_rate,
              COALESCE(MAX(combined.last_date)::text, '') AS last_date
       FROM (
         SELECT ls.anchor_id, ls.interaction_rate, ls.retention_rate,
                ls.uv_value, ls.gpm, ls.view_follow_rate, ls.date AS last_date
         FROM live_sessions ls
         WHERE ls.date >= CURRENT_DATE - INTERVAL '30 days' AND ls.status = 'completed'

         UNION ALL

         SELECT sam.anchor_id, sam.interaction_rate, sam.retention_rate,
                sam.uv_value, sam.gpm, sam.view_follow_rate, sam.date AS last_date
         FROM session_anchor_metrics sam
         WHERE sam.date >= CURRENT_DATE - INTERVAL '30 days'
       ) AS combined
       JOIN anchors a ON a.id = combined.anchor_id
       WHERE a.status = 1
       GROUP BY a.name`,
    )
    await client.query('RELEASE SAVEPOINT sp_auto_anchor_tags')

    for (const row of anchorMetrics) {
      if (row.avg_interaction_rate > 0 && row.avg_interaction_rate < 5) {
        tags.push({
          id: tagId(), type: 'anchor', category: '数据异常',
          title: `${row.anchor_name} 互动率偏低`,
          severity: row.avg_interaction_rate < 2 ? 'high' : 'medium',
          targetName: row.anchor_name, metric: '平均互动率',
          value: `${parseFloat(row.avg_interaction_rate).toFixed(1)}%`,
          threshold: '≥ 5%', date: row.last_date,
        })
      }
      if (row.avg_retention_rate > 0 && row.avg_retention_rate < 2) {
        tags.push({
          id: tagId(), type: 'anchor', category: '数据异常',
          title: `${row.anchor_name} 留存率偏低`,
          severity: row.avg_retention_rate < 1 ? 'high' : 'medium',
          targetName: row.anchor_name, metric: '平均留存率',
          value: `${parseFloat(row.avg_retention_rate).toFixed(1)}%`,
          threshold: '≥ 2%', date: row.last_date,
        })
      }
      if (row.avg_uv_value > 0 && row.avg_uv_value < 1.0) {
        tags.push({
          id: tagId(), type: 'anchor', category: '数据异常',
          title: `${row.anchor_name} UV价值偏低`,
          severity: row.avg_uv_value < 0.5 ? 'high' : 'medium',
          targetName: row.anchor_name, metric: '平均UV价值',
          value: parseFloat(row.avg_uv_value).toFixed(2),
          threshold: '≥ 1.0', date: row.last_date,
        })
      }
      if (row.avg_view_follow_rate > 0 && row.avg_view_follow_rate < 0.5) {
        tags.push({
          id: tagId(), type: 'anchor', category: '数据异常',
          title: `${row.anchor_name} 关注转化率偏低`,
          severity: 'low',
          targetName: row.anchor_name, metric: '平均观看-关注率',
          value: `${parseFloat(row.avg_view_follow_rate).toFixed(2)}%`,
          threshold: '≥ 0.5%', date: row.last_date,
        })
      }
      if (row.avg_gpm > 0 && row.avg_gpm < 1000) {
        tags.push({
          id: tagId(), type: 'anchor', category: '数据异常',
          title: `${row.anchor_name} GPM偏低`,
          severity: row.avg_gpm < 500 ? 'medium' : 'low',
          targetName: row.anchor_name, metric: '平均GPM',
          value: `¥${parseFloat(row.avg_gpm).toFixed(0)}`,
          threshold: '≥ ¥1,000', date: row.last_date,
        })
      }
    }
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT sp_auto_anchor_tags')
  }

  // 2. 渠道维度扫描（近 30 天）
  await client.query('SAVEPOINT sp_auto_channel_tags')
  try {
    const { rows: channelMetrics } = await client.query(
      `SELECT sc.channel,
              COALESCE(SUM(sc.ad_spend), 0) AS total_spend,
              COALESCE(SUM(sc.gmv), 0) AS total_output,
              COALESCE(SUM(sc.orders), 0) AS total_orders,
              COALESCE(SUM(sc.views), 0) AS total_views,
              COUNT(*) AS session_count,
              COALESCE(MAX(s.date)::text, '') AS last_date
       FROM session_channel_metrics sc
       JOIN live_sessions s ON s.id = sc.session_id
       WHERE s.date >= CURRENT_DATE - INTERVAL '30 days' AND s.status = 'completed'
       GROUP BY sc.channel`,
    )
    await client.query('RELEASE SAVEPOINT sp_auto_channel_tags')

    for (const row of channelMetrics) {
      const spend = parseFloat(row.total_spend)
      const output = parseFloat(row.total_output)
      const orders = parseInt(row.total_orders)
      const views = parseInt(row.total_views)
      const roi = spend > 0 ? output / spend : 0

      if (spend > 0 && roi < 1.0) {
        tags.push({
          id: tagId(), type: 'channel', category: '数据异常',
          title: `${row.channel} ROI 不达标`,
          severity: roi < 0.5 ? 'high' : 'medium',
          targetName: row.channel, metric: 'ROI',
          value: roi.toFixed(2),
          threshold: '≥ 1.0', date: row.last_date,
        })
      }
      if (views > 100 && orders > 0) {
        const convRate = (orders / views) * 100
        if (convRate < 0.5) {
          tags.push({
            id: tagId(), type: 'channel', category: '数据异常',
            title: `${row.channel} 转化率过低`,
            severity: convRate < 0.2 ? 'high' : 'medium',
            targetName: row.channel, metric: '下单转化率',
            value: `${convRate.toFixed(1)}%`,
            threshold: '≥ 0.5%', date: row.last_date,
          })
        }
      }
    }
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT sp_auto_channel_tags')
  }

  return tags
}
