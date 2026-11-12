import type { FastifyInstance } from 'fastify'
import { sendOk } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import { canAccessCost, requireAuth, requireRole } from '../lib/guard.js'

const OPS_PLAN_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'controller']

export async function opsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/ops/capabilities ── (frontend: /ops/capabilities)
  app.get('/api/v1/ops/capabilities', async (request, reply) => {
    const pool = getPool()
    try {
      const platformParam = (request.query as any)?.platform
      // 若平台为货架或内容平台（如 jd, taobao, tmall, pdd, xiaohongshu），这些平台无主播业务，直接返回空
      const nonLivePlatforms = ['jd', 'taobao', 'tmall', 'pdd', 'xiaohongshu']
      if (platformParam && nonLivePlatforms.includes(String(platformParam).toLowerCase())) {
        return sendOk(reply, {
          dimensions: [],
          anchorRankings: [],
          capabilities: [],
          rankings: [],
        })
      }

      const { rows: caps } = await pool.query(
        `SELECT a.name AS anchor_name, ac.*
         FROM anchor_capabilities ac
         JOIN anchors a ON a.id = ac.anchor_id
         WHERE a.status = 1
           AND ac.evaluated_at = (
           SELECT MAX(evaluated_at) FROM anchor_capabilities WHERE anchor_id = ac.anchor_id
         )
         ORDER BY ac.overall DESC`
      )
      const { rows: rankings } = await pool.query(
        `SELECT a.name AS anchor_name, ar.*
         FROM anchor_rankings ar
         JOIN anchors a ON a.id = ar.anchor_id
         WHERE a.status = 1
           AND ar.rank_date = (SELECT MAX(rank_date) FROM anchor_rankings)
         ORDER BY ar.overall DESC`
      )

      let avgExpression = 0
      let avgInteraction = 0
      let avgConversion = 0
      let avgProfessionalism = 0
      if (caps.length > 0) {
        avgExpression = Math.round(caps.reduce((sum: number, c: any) => sum + Number(c.expression || 0), 0) / caps.length)
        avgInteraction = Math.round(caps.reduce((sum: number, c: any) => sum + Number(c.interaction || 0), 0) / caps.length)
        avgConversion = Math.round(caps.reduce((sum: number, c: any) => sum + Number(c.conversion || 0), 0) / caps.length)
        avgProfessionalism = Math.round(caps.reduce((sum: number, c: any) => sum + Number(c.professionalism || 0), 0) / caps.length)
      }

      const dimensions = [
        { id: 'expression', label: '表达能力', score: avgExpression, color: 'primary' },
        { id: 'interaction', label: '互动能力', score: avgInteraction, color: 'accent' },
        { id: 'conversion', label: '转化能力', score: avgConversion, color: 'success' },
        { id: 'professionalism', label: '专业度', score: avgProfessionalism, color: 'warning' },
      ]

      const rankSource = rankings.length > 0 ? rankings : caps
      const anchorRankings = rankSource.map((r: any, idx: number) => ({
        rank: idx + 1,
        id: r.id || r.anchor_id || idx + 1,
        anchorId: r.anchor_id,
        name: r.anchor_name || r.name || `主播 ${idx + 1}`,
        overall: Number(r.overall) || 0,
        expression: Number(r.expression) || 0,
        interaction: Number(r.interaction) || 0,
        conversion: Number(r.conversion) || 0,
        professionalism: Number(r.professionalism) || 0,
      }))

      return sendOk(reply, {
        dimensions,
        anchorRankings,
        capabilities: caps,
        rankings: anchorRankings,
      })
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

  // ── GET /api/v1/ops/goal-tracking ── (alias: /api/v1/ops/goals)
  const goalTrackingHandler = async (request: any, reply: any) => {
    const user = await requireAuth(request, reply)
    if (!user) return

    const pool = getPool()
    try {
      const showCost = canAccessCost(user)
      const periodKey = (request.query?.period || '').toString().toLowerCase()
      const periodMap: Record<string, string> = { month: 'monthly', quarter: 'quarterly', year: 'yearly' }
      const dbPeriod = periodMap[periodKey] || ''
      const where = dbPeriod ? ' WHERE period = $1' : ''
      const params = dbPeriod ? [dbPeriod] : []
      const { rows } = await pool.query(
        `SELECT id, name, target AS "target", current_val AS "current",
                unit, progress, category, period, created_at::text AS "createdAt", updated_at::text AS "updatedAt"
         FROM goal_tracking${where} ORDER BY id`,
        params
      )
      const filtered = showCost
        ? rows
        : rows.filter((r: any) => !/成本|毛利|利润|净利|ROI|投产|花费/i.test(`${r.category || ''} ${r.name || ''}`))
      return sendOk(reply, { goals: filtered })
    } catch (err) {
      request.log.warn({ err }, 'ops/goal-tracking query failed')
      return sendOk(reply, { goals: [] })
    }
  }
  app.get('/api/v1/ops/goal-tracking', goalTrackingHandler)
  app.get('/api/v1/ops/goals', goalTrackingHandler)

  // ── GET /api/v1/ops/script-library ── (alias: /api/v1/ops/scripts)
  const scriptLibraryHandler = async (request: any, reply: any) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, title, category, content, use_count AS "useCount", likes
         FROM script_library ORDER BY use_count DESC`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'ops/script-library query failed')
      return sendOk(reply, [])
    }
  }
  app.get('/api/v1/ops/script-library', scriptLibraryHandler)
  app.get('/api/v1/ops/scripts', scriptLibraryHandler)

  // ── GET /api/v1/ops/issue-library ── (alias: /api/v1/ops/issues)
  const issueLibraryHandler = async (request: any, reply: any) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, title, category, solution, occurrence_count AS "occurrenceCount",
                detailed_solution AS "detailedSolution"
         FROM issue_library ORDER BY occurrence_count DESC`
      )
      const autoTags = await generateAutoIssueTags(pool)
      return sendOk(reply, { issues: rows, autoTags })
    } catch (err) {
      request.log.warn({ err }, 'ops/issue-library query failed')
      return sendOk(reply, { issues: [], autoTags: [] })
    }
  }
  app.get('/api/v1/ops/issue-library', issueLibraryHandler)
  app.get('/api/v1/ops/issues', issueLibraryHandler)

// ── 自动标签生成 ──
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

async function generateAutoIssueTags(pool: any): Promise<AutoTag[]> {
  const tags: AutoTag[] = []
  const tagId = () => `auto-${tags.length + 1}`

  // 1. 主播维度数据扫描（近 30 天）
  try {
    const { rows: anchorMetrics } = await pool.query(
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
       GROUP BY a.name`
    )

    for (const row of anchorMetrics) {
      // 互动率偏低
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
      // 留存率偏低
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
      // UV价值偏低
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
      // 关注转化率偏低
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
      // GPM 偏低（仅当有 views 数据时）
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
  } catch (err) {
    // 静默失败，不影响静态问题库
  }

  // 2. 渠道维度扫描（近 30 天）
  try {
    const { rows: channelMetrics } = await pool.query(
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
       GROUP BY sc.channel`
    )

    for (const row of channelMetrics) {
      const spend = parseFloat(row.total_spend)
      const output = parseFloat(row.total_output)
      const orders = parseInt(row.total_orders)
      const views = parseInt(row.total_views)
      const roi = spend > 0 ? output / spend : 0

      // ROI 不达标
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
      // 渠道转化率低
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
  } catch (err) {
    // 静默失败
  }

  return tags
}

  // ── GET /api/v1/ops/room-health ── (frontend: /ops/room-health)
  app.get('/api/v1/ops/room-health', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT lr.name, rh.health_score AS "healthScore", rh.interaction_score AS "interactionScore",
                rh.conversion_score AS "conversionScore", rh.content_score AS "contentScore",
                rh.traffic_score AS "trafficScore", rh.status
         FROM room_health rh
         JOIN live_rooms lr ON lr.id = rh.room_id
         WHERE rh.evaluated_at = (SELECT MAX(evaluated_at) FROM room_health WHERE room_id = rh.room_id)
         ORDER BY rh.health_score DESC`
      )
      return sendOk(reply, rows)
    } catch (err) {
      request.log.warn({ err }, 'ops/room-health query failed')
      return sendOk(reply, [])
    }
  })

  // ── GET /api/v1/ops/session-plans ── 排品计划列表 (frontend: /ops/session-products)
  app.get('/api/v1/ops/session-plans', async (request, reply) => {
    const pool = getPool()
    try {
      const { rows: plans } = await pool.query(
        `SELECT sp.id, lr.name AS room_name, sp.plan_date AS "planDate",
                a.name AS anchor_name, p.name AS campaign_name,
                p.start_date AS "campaignStart", p.end_date AS "campaignEnd",
                p.type AS campaign_type, p.content AS campaign_content,
                sp.notes, sp.created_at AS "createdAt"
         FROM session_plans sp
         JOIN live_rooms lr ON lr.id = sp.room_id
         JOIN anchors a ON a.id = sp.anchor_id
         LEFT JOIN promotions p ON p.id = sp.campaign_id
         ORDER BY sp.plan_date DESC, sp.created_at DESC`
      )
      const planIds = plans.map((p: any) => p.id)
      const products: any[] = planIds.length
        ? (await pool.query(
            `SELECT spp.id, spp.plan_id AS "planId",
                    spp.group_letter AS "groupLetter",
                    spp.product_code AS "productCode", spp.price
             FROM session_plan_products spp
             WHERE spp.plan_id = ANY($1::int[])
             ORDER BY spp.group_letter`,
            [planIds]
          )).rows
        : []
      const productMap: Record<number, any[]> = {}
      for (const prod of products) {
        (productMap[prod.planId] ??= []).push(prod)
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
    const pool = getPool()
    const { roomId, date, anchorId, products, campaignId, notes } = request.body ?? {}
    if (!roomId || !date || !anchorId) {
      return reply.status(400).send({ error: '直播间、日期、主播为必填项' })
    }
    try {
      await pool.query('BEGIN')
      const { rows: [plan] } = await pool.query(
        `INSERT INTO session_plans (room_id, plan_date, anchor_id, campaign_id, notes)
         VALUES ($1, $2::date, $3, $4, $5) RETURNING id`,
        [roomId, date, anchorId, campaignId || null, notes || '']
      )
      const groupLetters = ['a', 'b', 'c', 'd', 'e']
      for (const letter of groupLetters) {
        const prod = products?.[letter]
        if (prod?.code) {
          await pool.query(
            `INSERT INTO session_plan_products (plan_id, group_letter, product_code, price)
             VALUES ($1, $2, $3, $4)`,
            [plan.id, letter.toUpperCase(), prod.code, prod.price || 0]
          )
        }
      }
      await pool.query('COMMIT')
      return sendOk(reply, { id: plan.id })
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {})
      request.log.warn({ err }, 'ops/session-plans insert failed')
      return reply.status(500).send({ error: '保存失败' })
    }
  })

  // ── DELETE /api/v1/ops/session-plans/:id ── 删除排品计划
  app.delete('/api/v1/ops/session-plans/:id', { preHandler: [requireRole(OPS_PLAN_WRITE_ROLES)] }, async (request: any, reply) => {
    const pool = getPool()
    try {
      await pool.query('DELETE FROM session_plans WHERE id = $1', [request.params.id])
      return sendOk(reply, { deleted: true })
    } catch (err) {
      request.log.warn({ err }, 'ops/session-plans delete failed')
      return reply.status(500).send({ error: '删除失败' })
    }
  })
}