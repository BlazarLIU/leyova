import type { FastifyInstance } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'

export async function anchorRoutes(app: FastifyInstance) {
  // ── GET /api/v1/anchors/list ──
  //    Frontend: /api/anchors ← /api/v1/anchors (no /list)
  //    We register both paths for compatibility
  const listHandler = async (_request: any, reply: any) => {
    const pool = getPool()
    const query = _request.query as { status?: string }
    try {
      let sql = `SELECT a.id, a.name, a.platform, a.level, a.status,
                        COALESCE(AVG(ls.gmv), 0) AS avg_gmv,
                        COALESCE(AVG(ls.views), 0)::int AS avg_views,
                        COALESCE(AVG(ls.uv_value), 0) AS avg_uv_value,
                        COALESCE(AVG(ls.interaction_rate), 0) AS avg_interaction_rate,
                        COALESCE(AVG(ls.retention_rate), 0) AS avg_retention_rate,
                        COALESCE(AVG(ls.gpm), 0) AS avg_gpm,
                        COALESCE(AVG(ls.online_peak), 0)::int AS avg_online_peak,
                        COALESCE(AVG(ls.new_fans), 0)::int AS avg_new_fans,
                        ac.expression, ac.interaction, ac.conversion,
                        ac.professionalism, ac.overall
                 FROM anchors a
                 LEFT JOIN live_sessions ls ON ls.anchor_id = a.id AND ls.status = 'completed'
                 LEFT JOIN LATERAL (
                   SELECT * FROM anchor_capabilities
                   WHERE anchor_id = a.id
                   ORDER BY evaluated_at DESC LIMIT 1
                 ) ac ON true
                 WHERE a.status = 1`
      const params: any[] = []
      if (query.status !== undefined) {
        sql += ' AND a.status = $1'
        params.push(parseInt(query.status))
      }
      sql += ' GROUP BY a.id, a.name, a.platform, a.level, a.status, ac.expression, ac.interaction, ac.conversion, ac.professionalism, ac.overall'
      sql += ' ORDER BY a.id'
      const result = await pool.query(sql, params)
      return sendOk(reply, result.rows.map(r => {
        // 自动识别短板
        const capMap = { expression: r.expression, interaction: r.interaction, conversion: r.conversion, professionalism: r.professionalism }
        const labels = { expression: '引流', interaction: '互动', conversion: '转化', professionalism: '专业度' }
        const minKey = Object.keys(capMap).reduce((a: string, b: string) =>
          (capMap as any)[a] <= (capMap as any)[b] ? a : b
        )
        const weakness = r.overall != null ? (labels as any)[minKey] : ''
        return {
          id: r.id, name: r.name, role: 'anchor', status: r.status,
          platform: r.platform, level: r.level,
          createdAt: r.created_at ? r.created_at.toISOString().slice(0, 10) : '',
          avgGMV: parseFloat(r.avg_gmv),
          avgViews: r.avg_views,
          avgUvValue: parseFloat(r.avg_uv_value),
          avgInteractionRate: parseFloat(r.avg_interaction_rate),
          avgRetentionRate: parseFloat(r.avg_retention_rate),
          avgGpm: parseFloat(r.avg_gpm),
          avgOnlinePeak: r.avg_online_peak,
          avgNewFans: r.avg_new_fans,
          overallScore: r.overall,
          weakness,
        }
      }))
    } catch (err) {
      _request.log.warn({ err }, 'anchors/list query failed')
      return sendOk(reply, [])
    }
  }

  app.get('/api/v1/anchors/list', listHandler)
  app.get('/api/v1/anchors', listHandler)

  // ── GET /api/v1/anchors/profile/:id ──
  //    Frontend: /api/anchors/:id
  app.get('/api/v1/anchors/profile/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pool = getPool()
    try {
      const result = await pool.query<{
        id: number; name: string; level: string; followers: number
        join_date: string; email: string; phone: string; tags: string[]
      }>(
        `SELECT a.id, a.name, ap.level, ap.followers, ap.join_date,
                ap.email, ap.phone, ap.tags
         FROM anchors a
         LEFT JOIN anchor_profiles ap ON ap.id = a.id
         WHERE a.id = $1 AND a.status = 1`,
        [parseInt(id)]
      )
      const r = result.rows[0]
      if (!r) return sendOk(reply, { id, name: '未知主播' })
      return sendOk(reply, {
        id: String(r.id), name: r.name, initials: r.name.slice(0, 2),
        level: r.level || 'B级', followers: r.followers || 0,
        joinDate: r.join_date ? new Date(r.join_date).toISOString().slice(0, 10) : '',
        email: r.email || '', phone: r.phone || '',
        tags: r.tags || [],
      })
    } catch (err) {
      request.log.warn({ err }, 'anchors/profile query failed')
      return sendOk(reply, { id, name: '加载失败' })
    }
  })
  // Alias for frontend calls like /api/anchors/1
  app.get('/api/v1/anchors/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    // Reuse the profile handler by forwarding
    request.params = { id }
    return sendOk(reply, await getAnchorDetail(parseInt(id)))
  })

  // ── GET /api/v1/anchors/profile/:id/performance ──
  app.get('/api/v1/anchors/profile/:id/performance', async (request, reply) => {
    const { id } = request.params as { id: string }
    const pool = getPool()
    try {
      const stats = await pool.query<{
        avg_gmv: string; avg_viewers: number; avg_conversion: number; session_count: number
      }>(
        `SELECT COALESCE(AVG(gmv), 0) AS avg_gmv,
                COALESCE(AVG(online_peak), 0)::int AS avg_viewers,
                0 AS avg_conversion,
                COUNT(*)::int AS session_count
         FROM session_anchor_metrics WHERE anchor_id = $1`,
        [parseInt(id)]
      )
      const s = stats.rows[0]
      const monthly = await pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month,
                COUNT(*)::int AS session_count,
                COALESCE(SUM(duration_min), 0)::int AS total_duration_min,
                COALESCE(SUM(gmv), 0) AS total_gmv,
                COALESCE(AVG(gmv_per_hour), 0) AS avg_gmv_per_hour,
                COALESCE(MAX(online_peak), 0)::int AS max_online_peak,
                COALESCE(AVG(avg_online), 0)::int AS avg_avg_online,
                COALESCE(AVG(avg_item_price), 0) AS avg_avg_item_price,
                COALESCE(AVG(exposure_view_rate), 0) AS avg_exposure_view_rate,
                COALESCE(AVG(retention_rate), 0) AS avg_retention_rate,
                COALESCE(AVG(interaction_rate), 0) AS avg_interaction_rate,
                COALESCE(SUM(new_fans), 0)::int AS total_new_fans,
                COALESCE(AVG(view_follow_rate), 0) AS avg_view_follow_rate,
                COALESCE(SUM(new_group_members), 0)::int AS total_new_group_members,
                COALESCE(AVG(uv_value), 0) AS avg_uv_value
         FROM session_anchor_metrics WHERE anchor_id = $1
         GROUP BY month ORDER BY month DESC LIMIT 6`,
        [parseInt(id)]
      )
      const recent = await pool.query(
        `SELECT id, title, date::text, duration_min, gmv, gmv_per_hour,
                online_peak, avg_online, avg_item_price, exposure_view_rate,
                retention_rate, interaction_rate, new_fans, view_follow_rate,
                new_group_members, uv_value
         FROM session_anchor_metrics
         WHERE anchor_id = $1
         ORDER BY date DESC
         LIMIT 10`,
        [parseInt(id)]
      )
      return sendOk(reply, {
        stats: [
          { id: 'avg-gmv', label: '场均GMV', value: `¥${(parseFloat(s.avg_gmv) / 10000).toFixed(1)}万`, change: 12.5 },
          { id: 'avg-viewers', label: '场均观看', value: s.avg_viewers.toLocaleString(), change: 8.3 },
          { id: 'conversion', label: '转化率', value: `${s.avg_conversion.toFixed(1)}%`, change: 0.6 },
          { id: 'session-count', label: '总场次', value: String(s.session_count), change: 5.0 },
        ],
        monthlyData: monthly.rows.map(r => ({
          month: r.month,
          sessionCount: r.session_count,
          totalDurationMin: parseFloat(r.total_duration_min ?? '0'),
          totalGmv: parseFloat(r.total_gmv ?? '0'),
          avgGmvPerHour: parseFloat(r.avg_gmv_per_hour ?? '0'),
          maxOnlinePeak: r.max_online_peak,
          avgAvgOnline: parseFloat(r.avg_avg_online ?? '0'),
          avgAvgItemPrice: parseFloat(r.avg_avg_item_price ?? '0'),
          avgExposureViewRate: parseFloat(r.avg_exposure_view_rate ?? '0'),
          avgRetentionRate: parseFloat(r.avg_retention_rate ?? '0'),
          avgInteractionRate: parseFloat(r.avg_interaction_rate ?? '0'),
          totalNewFans: parseFloat(r.total_new_fans ?? '0'),
          avgViewFollowRate: parseFloat(r.avg_view_follow_rate ?? '0'),
          totalNewGroupMembers: parseFloat(r.total_new_group_members ?? '0'),
          avgUvValue: parseFloat(r.avg_uv_value ?? '0'),
        })),
        recentSessions: recent.rows.map(r => ({
          id: String(r.id),
          date: typeof r.date === 'string' ? r.date.slice(0, 10) : r.date,
          durationMin: r.duration_min ?? 0,
          gmv: parseFloat(r.gmv ?? '0'),
          gmvPerHour: parseFloat(r.gmv_per_hour ?? '0'),
          onlinePeak: r.online_peak ?? 0,
          avgOnline: r.avg_online ?? 0,
          avgItemPrice: parseFloat(r.avg_item_price ?? '0'),
          exposureViewRate: parseFloat(r.exposure_view_rate ?? '0'),
          retentionRate: parseFloat(r.retention_rate ?? '0'),
          interactionRate: parseFloat(r.interaction_rate ?? '0'),
          newFans: r.new_fans ?? 0,
          viewFollowRate: parseFloat(r.view_follow_rate ?? '0'),
          newGroupMembers: r.new_group_members ?? 0,
          uvValue: parseFloat(r.uv_value ?? '0'),
        })),
      })
    } catch (err) {
      request.log.warn({ err }, 'anchors/performance query failed')
      return sendOk(reply, { stats: [], monthlyData: [], recentSessions: [] })
    }
  })
  app.get('/api/v1/anchors/:id/performance', async (request, reply) => {
    const { id } = request.params as { id: string }
    request.params = { id }
    // forward to profile performance
    const result = await getAnchorPerformance(parseInt(id))
    return sendOk(reply, result)
  })

  // ── GET /api/v1/anchors/my/performance ── 主播个人视角专属绩效看板
  app.get('/api/v1/anchors/my/performance', async (request, reply) => {
    const pool = getPool()
    const { anchorId } = request.query as { anchorId?: string }

    try {
      let aId = anchorId ? parseInt(anchorId) : null
      if (!aId) {
        const defaultAnchor = await pool.query('SELECT id FROM public.anchors WHERE status = 1 ORDER BY id LIMIT 1')
        aId = defaultAnchor.rows[0]?.id || 1
      }

      const anchorRes = await pool.query(
        'SELECT a.id, a.name, a.level, a.platform, a.platform_code, c.expression, c.interaction, c.conversion, c.professionalism, c.overall FROM public.anchors a LEFT JOIN public.anchor_capabilities c ON a.id = c.anchor_id WHERE a.id = $1',
        [aId]
      )
      if (anchorRes.rows.length === 0) {
        return sendError(reply, 404, '主播档案不存在')
      }
      const anchor = anchorRes.rows[0]

      const statsRes = await pool.query(
        `SELECT 
           COUNT(*)::int AS "monthlySessions",
           COALESCE(SUM(gmv), 0)::float AS "monthlyGmv",
           COALESCE(SUM(orders), 0)::int AS "monthlyOrders",
           COALESCE(AVG(duration_min), 0)::float AS "avgDurationMin"
         FROM public.live_sessions 
         WHERE anchor_id = $1`,
        [aId]
      )

      const rankRes = await pool.query(
        `SELECT rank FROM (
           SELECT anchor_id, RANK() OVER (ORDER BY COALESCE(SUM(gmv), 0) DESC) as rank
           FROM public.live_sessions GROUP BY anchor_id
         ) r WHERE r.anchor_id = $1`,
        [aId]
      )
      const rank = rankRes.rows[0]?.rank ? Number(rankRes.rows[0].rank) : 3

      const recentRes = await pool.query(
        `SELECT id, date::text, title, duration_min AS "durationMin", gmv::float, orders, status 
         FROM public.live_sessions 
         WHERE anchor_id = $1 
         ORDER BY date DESC, id DESC LIMIT 8`,
        [aId]
      )

      return sendOk(reply, {
        anchor: {
          id: anchor.id,
          name: anchor.name,
          level: anchor.level,
          platform: anchor.platform,
          platformCode: anchor.platform_code,
          radar: {
            expression: anchor.expression || 85,
            interaction: anchor.interaction || 80,
            conversion: anchor.conversion || 90,
            professionalism: anchor.professionalism || 88,
            overall: anchor.overall || 86,
          },
        },
        kpis: {
          monthlyGmv: statsRes.rows[0]?.monthlyGmv || 0,
          monthlySessions: statsRes.rows[0]?.monthlySessions || 0,
          monthlyOrders: statsRes.rows[0]?.monthlyOrders || 0,
          avgDurationMin: Math.round(statsRes.rows[0]?.avgDurationMin || 0),
          teamRank: rank,
          targetGmv: 500000,
          targetCompletionRate: statsRes.rows[0]?.monthlyGmv ? Number(((statsRes.rows[0].monthlyGmv / 500000) * 100).toFixed(1)) : 0,
        },
        recentSessions: recentRes.rows,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch anchor personal performance')
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/anchors/training ──
  app.get('/api/v1/anchors/training', async (request, reply) => {
    const pool = getPool()
    const query = request.query as { status?: string }
    try {
      let sql = `SELECT id, name, anchor_count, start_date, end_date, progress, status
                 FROM anchor_training_plans`
      const params: any[] = []
      if (query.status) {
        sql += ' WHERE status = $1'
        params.push(query.status)
      }
      sql += ' ORDER BY id'
      const result = await pool.query(sql, params)
      return sendOk(reply, result.rows.map(r => ({
        id: String(r.id), name: r.name,
        anchorCount: r.anchor_count,
        startDate: r.start_date.toISOString().slice(0, 10),
        endDate: r.end_date.toISOString().slice(0, 10),
        progress: r.progress, status: r.status,
      })))
    } catch (err) {
      request.log.warn({ err }, 'anchors/training query failed')
      return sendOk(reply, [])
    }
  })
  // Alias for frontend: /api/training/plans
  app.get('/api/v1/training/plans', async (request, reply) => {
    request.query = request.query
    const pool = getPool()
    try {
      const result = await pool.query(
        `SELECT id, name, anchor_count, start_date, end_date, progress, status
         FROM anchor_training_plans ORDER BY id`
      )
      return sendOk(reply, result.rows.map(r => ({
        id: String(r.id), name: r.name,
        anchorCount: r.anchor_count,
        startDate: r.start_date.toISOString().slice(0, 10),
        endDate: r.end_date.toISOString().slice(0, 10),
        progress: r.progress, status: r.status,
      })))
    } catch { return sendOk(reply, []) }
  })

  // ── GET /api/v1/anchors/training/records ──
  app.get('/api/v1/anchors/training/records', async (_request, reply) => {
    const pool = getPool()
    try {
      const result = await pool.query(
        `SELECT id, anchor_name, date, project, duration_hours, completion, score
         FROM anchor_training_records ORDER BY date DESC LIMIT 20`
      )
      return sendOk(reply, result.rows.map(r => ({
        id: String(r.id), date: r.date.toISOString().slice(0, 10),
        anchor: r.anchor_name, project: r.project,
        duration: `${r.duration_hours}h`, completion: r.completion,
        score: r.score,
      })))
    } catch { return sendOk(reply, []) }
  })
  // Alias for frontend: /api/training/records
  app.get('/api/v1/training/records', async (_request, reply) => {
    const pool = getPool()
    try {
      const result = await pool.query(
        `SELECT id, anchor_name, date, project, duration_hours, completion, score
         FROM anchor_training_records ORDER BY date DESC LIMIT 20`
      )
      return sendOk(reply, result.rows.map(r => ({
        id: String(r.id), date: r.date.toISOString().slice(0, 10),
        anchor: r.anchor_name, project: r.project,
        duration: `${r.duration_hours}h`, completion: r.completion,
        score: r.score,
      })))
    } catch { return sendOk(reply, []) }
  })

  // ── GET /api/v1/anchors/scripts ──
  app.get('/api/v1/anchors/scripts', async (request, reply) => {
    const pool = getPool()
    const query = request.query as { category?: string }
    try {
      let sql = `SELECT id, category, title, scenario, content, usage_count, last_used
                 FROM anchor_script_templates`
      const params: any[] = []
      if (query.category) {
        sql += ' WHERE category = $1'
        params.push(query.category)
      }
      sql += ' ORDER BY id'
      const result = await pool.query(sql, params)
      return sendOk(reply, result.rows.map(r => ({
        id: String(r.id), category: r.category, title: r.title,
        scenario: r.scenario, content: r.content,
        usageCount: r.usage_count,
        lastUsed: r.last_used ? r.last_used.toISOString().slice(0, 10) : '',
      })))
    } catch { return sendOk(reply, []) }
  })
  // Alias for frontend: /api/scripts/templates
  app.get('/api/v1/scripts/templates', async (request, reply) => {
    const pool = getPool()
    try {
      const result = await pool.query(
        `SELECT id, category, title, scenario, content, usage_count, last_used
         FROM anchor_script_templates ORDER BY id`
      )
      return sendOk(reply, result.rows.map(r => ({
        id: String(r.id), category: r.category, title: r.title,
        scenario: r.scenario, content: r.content,
        usageCount: r.usage_count,
        lastUsed: r.last_used ? r.last_used.toISOString().slice(0, 10) : '',
      })))
    } catch { return sendOk(reply, []) }
  })

  // ── POST /api/v1/scripts/templates ──
  app.post('/api/v1/scripts/templates', async (request, reply) => {
    const pool = getPool()
    const body = request.body as { category?: string; title?: string; scenario?: string; content?: string }
    if (!body.title?.trim()) {
      return reply.code(400).send({ success: false, message: '请输入话术标题' })
    }
    try {
      const result = await pool.query(
        `INSERT INTO anchor_script_templates (category, title, scenario, content)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [body.category || 'opening', body.title.trim(), body.scenario?.trim() || '', body.content?.trim() || '']
      )
      return sendOk(reply, { id: result.rows[0].id })
    } catch {
      return reply.code(500).send({ success: false, message: '创建失败' })
    }
  })
}

// Helper to get anchor detail
async function getAnchorDetail(id: number) {
  const pool = getPool()
  const result = await pool.query<{
    id: number; name: string; level: string; followers: number
    join_date: string; email: string; phone: string; tags: string[]
  }>(
    `SELECT a.id, a.name, ap.level, ap.followers, ap.join_date,
            ap.email, ap.phone, ap.tags
     FROM anchors a LEFT JOIN anchor_profiles ap ON ap.id = a.id
     WHERE a.id = $1 AND a.status = 1`,
    [id]
  )
  const r = result.rows[0]
  if (!r) return { id: String(id), name: '未知主播' }
  return {
    id: String(r.id), name: r.name, initials: r.name.slice(0, 2),
    level: r.level || 'B级', followers: r.followers || 0,
    joinDate: r.join_date ? new Date(r.join_date).toISOString().slice(0, 10) : '',
    email: r.email || '', phone: r.phone || '',
    tags: r.tags || [],
  }
}

// Helper to get anchor performance
async function getAnchorPerformance(id: number) {
  const pool = getPool()
  const stats = await pool.query<{
    avg_gmv: string; avg_viewers: number; avg_conversion: number; session_count: number
  }>(
    `SELECT COALESCE(AVG(gmv), 0) AS avg_gmv,
            COALESCE(AVG(online_peak), 0)::int AS avg_viewers,
            0 AS avg_conversion,
            COUNT(*)::int AS session_count
     FROM session_anchor_metrics WHERE anchor_id = $1`,
    [id]
  )
  const s = stats.rows[0]
  const monthly = await pool.query(
    `SELECT to_char(date, 'YYYY-MM') AS month,
            COUNT(*)::int AS session_count,
            COALESCE(SUM(duration_min), 0)::int AS total_duration_min,
            COALESCE(SUM(gmv), 0) AS total_gmv,
            COALESCE(AVG(gmv_per_hour), 0) AS avg_gmv_per_hour,
            COALESCE(MAX(online_peak), 0)::int AS max_online_peak,
            COALESCE(AVG(avg_online), 0)::int AS avg_avg_online,
            COALESCE(AVG(avg_item_price), 0) AS avg_avg_item_price,
            COALESCE(AVG(exposure_view_rate), 0) AS avg_exposure_view_rate,
            COALESCE(AVG(retention_rate), 0) AS avg_retention_rate,
            COALESCE(AVG(interaction_rate), 0) AS avg_interaction_rate,
            COALESCE(SUM(new_fans), 0)::int AS total_new_fans,
            COALESCE(AVG(view_follow_rate), 0) AS avg_view_follow_rate,
            COALESCE(SUM(new_group_members), 0)::int AS total_new_group_members,
            COALESCE(AVG(uv_value), 0) AS avg_uv_value
     FROM session_anchor_metrics WHERE anchor_id = $1
     GROUP BY month ORDER BY month DESC LIMIT 6`,
    [id]
  )

  const recent = await pool.query(
    `SELECT id, title, date::text, duration_min, gmv, gmv_per_hour,
            online_peak, avg_online, avg_item_price, exposure_view_rate,
            retention_rate, interaction_rate, new_fans, view_follow_rate,
            new_group_members, uv_value
     FROM session_anchor_metrics
     WHERE anchor_id = $1
     ORDER BY date DESC
     LIMIT 10`,
    [id]
  )

  // ── 对比数据 ──
  const allMetrics = await pool.query(
    `SELECT date, gmv, online_peak FROM session_anchor_metrics
     WHERE anchor_id = $1 ORDER BY date ASC`,
    [id]
  )
  const metrics = allMetrics.rows
  const totalCount = metrics.length

  const vsLastSession: Record<string, number> = { 'avg-gmv': 0, 'avg-viewers': 0, 'conversion': 0, 'session-count': 0 }
  const vsLastWeek: Record<string, number> = { 'avg-gmv': 0, 'avg-viewers': 0, 'conversion': 0, 'session-count': 0 }
  const vsLastMonth: Record<string, number> = { 'avg-gmv': 0, 'avg-viewers': 0, 'conversion': 0, 'session-count': 0 }

  if (totalCount >= 2) {
    // 较上场：最新场次 vs 倒数第二场
    const latest = metrics[totalCount - 1]
    const prev = metrics[totalCount - 2]
    const prevGmv = parseFloat(prev.gmv)
    const latestGmv = parseFloat(latest.gmv)
    vsLastSession['avg-gmv'] = prevGmv ? Math.round((latestGmv - prevGmv) / prevGmv * 100) : 0
    vsLastSession['avg-viewers'] = prev.online_peak ? Math.round((latest.online_peak - prev.online_peak) / prev.online_peak * 100) : 0
    vsLastSession['session-count'] = Math.round(1 / (totalCount - 1) * 100)
  }

  if (totalCount > 0) {
    // 较上周
    const weekComp = await pool.query(
      `WITH wk AS (
        SELECT date_trunc('week', date)::date AS week_start,
               SUM(gmv::numeric) AS total_gmv,
               AVG(online_peak) AS avg_viewers,
               COUNT(*) AS session_count
        FROM session_anchor_metrics WHERE anchor_id = $1
        GROUP BY date_trunc('week', date)
        ORDER BY week_start DESC LIMIT 2
      )
      SELECT * FROM wk ORDER BY week_start ASC`,
      [id]
    )
    if (weekComp.rows.length === 2) {
      const [prevW, curW] = weekComp.rows
      const prevGmvW = parseFloat(prevW.total_gmv)
      const curGmvW = parseFloat(curW.total_gmv)
      vsLastWeek['avg-gmv'] = prevGmvW ? Math.round((curGmvW - prevGmvW) / prevGmvW * 100) : 0
      vsLastWeek['avg-viewers'] = prevW.avg_viewers ? Math.round((curW.avg_viewers - prevW.avg_viewers) / prevW.avg_viewers * 100) : 0
      vsLastWeek['session-count'] = prevW.session_count ? Math.round((curW.session_count - prevW.session_count) / prevW.session_count * 100) : 0
    }

    // 较上月
    const monthComp = await pool.query(
      `WITH mo AS (
        SELECT date_trunc('month', date)::date AS month_start,
               SUM(gmv::numeric) AS total_gmv,
               AVG(online_peak) AS avg_viewers,
               COUNT(*) AS session_count
        FROM session_anchor_metrics WHERE anchor_id = $1
        GROUP BY date_trunc('month', date)
        ORDER BY month_start DESC LIMIT 2
      )
      SELECT * FROM mo ORDER BY month_start ASC`,
      [id]
    )
    if (monthComp.rows.length === 2) {
      const [prevM, curM] = monthComp.rows
      const prevGmvM = parseFloat(prevM.total_gmv)
      const curGmvM = parseFloat(curM.total_gmv)
      vsLastMonth['avg-gmv'] = prevGmvM ? Math.round((curGmvM - prevGmvM) / prevGmvM * 100) : 0
      vsLastMonth['avg-viewers'] = prevM.avg_viewers ? Math.round((curM.avg_viewers - prevM.avg_viewers) / prevM.avg_viewers * 100) : 0
      vsLastMonth['session-count'] = prevM.session_count ? Math.round((curM.session_count - prevM.session_count) / prevM.session_count * 100) : 0
    }
  }

  const comparisons = { vsLastSession, vsLastWeek, vsLastMonth }

  // ── 能力评分数据 ──
  // 最新一次评估
  let latestCapabilities = { expression: 0, interaction: 0, conversion: 0, professionalism: 0, overall: 0 }
  const latestCap = await pool.query(
    `SELECT expression, interaction, conversion, professionalism, overall
     FROM anchor_capabilities
     WHERE anchor_id = $1
     ORDER BY evaluated_at DESC LIMIT 1`,
    [id]
  )
  if (latestCap.rows.length > 0) {
    latestCapabilities = latestCap.rows[0]
  }

  // 能力评分历史（用于趋势图）
  const capHistory = await pool.query(
    `SELECT to_char(evaluated_at, 'YYYY-MM-DD') AS date,
            expression, interaction, conversion, professionalism, overall
     FROM anchor_capabilities
     WHERE anchor_id = $1
     ORDER BY evaluated_at ASC`,
    [id]
  )

  return {
    stats: [
      { id: 'avg-gmv', label: '场均GMV', value: `¥${(parseFloat(s.avg_gmv) / 10000).toFixed(1)}万`, change: 0 },
      { id: 'avg-viewers', label: '场均观看', value: s.avg_viewers.toLocaleString(), change: 0 },
      { id: 'conversion', label: '转化率', value: `${s.avg_conversion.toFixed(1)}%`, change: 0 },
      { id: 'session-count', label: '总场次', value: String(s.session_count), change: 0 },
    ],
    comparisons,
    monthlyData: monthly.rows.map(r => ({
      month: r.month,
      sessionCount: r.session_count,
      totalDurationMin: parseFloat(r.total_duration_min ?? '0'),
      totalGmv: parseFloat(r.total_gmv ?? '0'),
      avgGmvPerHour: parseFloat(r.avg_gmv_per_hour ?? '0'),
      maxOnlinePeak: r.max_online_peak,
      avgAvgOnline: parseFloat(r.avg_avg_online ?? '0'),
      avgAvgItemPrice: parseFloat(r.avg_avg_item_price ?? '0'),
      avgExposureViewRate: parseFloat(r.avg_exposure_view_rate ?? '0'),
      avgRetentionRate: parseFloat(r.avg_retention_rate ?? '0'),
      avgInteractionRate: parseFloat(r.avg_interaction_rate ?? '0'),
      totalNewFans: parseFloat(r.total_new_fans ?? '0'),
      avgViewFollowRate: parseFloat(r.avg_view_follow_rate ?? '0'),
      totalNewGroupMembers: parseFloat(r.total_new_group_members ?? '0'),
      avgUvValue: parseFloat(r.avg_uv_value ?? '0'),
    })),
    recentSessions: recent.rows.map(r => ({
      id: String(r.id),
      date: typeof r.date === 'string' ? r.date.slice(0, 10) : r.date,
      durationMin: r.duration_min ?? 0,
      gmv: parseFloat(r.gmv ?? '0'),
      gmvPerHour: parseFloat(r.gmv_per_hour ?? '0'),
      onlinePeak: r.online_peak ?? 0,
      avgOnline: r.avg_online ?? 0,
      avgItemPrice: parseFloat(r.avg_item_price ?? '0'),
      exposureViewRate: parseFloat(r.exposure_view_rate ?? '0'),
      retentionRate: parseFloat(r.retention_rate ?? '0'),
      interactionRate: parseFloat(r.interaction_rate ?? '0'),
      newFans: r.new_fans ?? 0,
      viewFollowRate: parseFloat(r.view_follow_rate ?? '0'),
      newGroupMembers: r.new_group_members ?? 0,
      uvValue: parseFloat(r.uv_value ?? '0'),
    })),
    capabilities: latestCapabilities,
    capabilityHistory: capHistory.rows.map(r => ({
      date: r.date,
      expression: r.expression,
      interaction: r.interaction,
      conversion: r.conversion,
      professionalism: r.professionalism,
      overall: r.overall,
    })),
  }
}