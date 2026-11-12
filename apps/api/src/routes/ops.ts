import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { withRlsContext, type DbExecutor } from '../lib/db.js'
import { canAccessCost, requireAuth, requireRole } from '../lib/guard.js'
import { getAnchorCapabilitiesAndRankings } from '../services/anchor-ranking.js'

const OPS_PLAN_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'controller']

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
      const showCost = canAccessCost(user)
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
      request.log.warn({ err }, 'ops/script-library query failed')
      return sendOk(reply, [])
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
      request.log.warn({ err }, 'ops/room-health query failed')
      return sendOk(reply, [])
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

  // ── POST /api/v1/ops/session-plans ── 创建排品计划
  app.post('/api/v1/ops/session-plans', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const { roomId, date, anchorId, products, campaignId, notes } = request.body ?? {}
    if (!roomId || !date || !anchorId) {
      return reply.status(400).send({ error: '直播间、日期、主播为必填项' })
    }
    try {
      const planId = await withRlsContext(request, async (client) => {
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
        return plan.id
      })
      return sendOk(reply, { id: planId })
    } catch (err) {
      request.log.warn({ err }, 'ops/session-plans insert failed')
      return reply.status(500).send({ error: '保存失败' })
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
