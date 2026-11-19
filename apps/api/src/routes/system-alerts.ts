import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * system 域拆分（P2-1）：异常中心
 * 原属 routes/system.ts，2026-11-17 拆出。
 */
export async function systemAlertsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/system/alerts ──
  app.get('/api/v1/system/alerts', async (request, reply) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { events, rules, uploadsTodayRows, anchorGmvRows, channelRows, convRows, qualityRow } =
        await withRlsContext(request, async (client) => {
          const evRes = await client.query(
            'SELECT id, severity, title, description, event_time, status FROM alert_events ORDER BY event_time DESC LIMIT 20',
          )
          const ruleRes = await client.query('SELECT * FROM alert_rules ORDER BY id')
          const upRes = await client.query(
            `SELECT data_type FROM data_uploads WHERE business_date = $1::date AND status = 'completed'`,
            [today],
          )
          const gmvRes = await client.query(
            `SELECT a.name AS anchor_name,
                    COALESCE(AVG(ls.gmv_per_hour), 0) AS today_avg,
                    COALESCE((
                      SELECT AVG(sub.gmv_per_hour)
                      FROM live_sessions sub
                      WHERE sub.anchor_id = ls.anchor_id
                        AND sub.date >= CURRENT_DATE - INTERVAL '8 days'
                        AND sub.date < CURRENT_DATE
                        AND sub.gmv_per_hour IS NOT NULL
                        AND sub.status = 'completed'
                    ), 0) AS past_avg
             FROM anchors a
             JOIN live_sessions ls ON ls.anchor_id = a.id
             WHERE a.status = 1 AND ls.date = CURRENT_DATE AND ls.status IN ('live', 'completed')
             GROUP BY a.id, a.name, ls.anchor_id`,
          )
          const chRes = await client.query(
            `SELECT sc.channel,
                    COALESCE(SUM(sc.views) FILTER (WHERE s.date = CURRENT_DATE), 0) AS today_views,
                    COALESCE(SUM(sc.orders) FILTER (WHERE s.date = CURRENT_DATE), 0) AS today_orders,
                    COALESCE(SUM(sc.views) FILTER (WHERE s.date >= CURRENT_DATE - 8 AND s.date < CURRENT_DATE), 0) AS past_views,
                    COALESCE(SUM(sc.orders) FILTER (WHERE s.date >= CURRENT_DATE - 8 AND s.date < CURRENT_DATE), 0) AS past_orders
             FROM session_channel_metrics sc
             JOIN live_sessions s ON s.id = sc.session_id
             WHERE s.date >= CURRENT_DATE - INTERVAL '8 days' AND s.status = 'completed'
             GROUP BY sc.channel`,
          )
          const cRes = await client.query(
            `SELECT sc.channel,
                    COALESCE(AVG(sc.product_click_rate), 0) AS avg_click_rate,
                    COALESCE(AVG(sc.product_deal_rate), 0) AS avg_deal_rate
             FROM session_channel_metrics sc
             JOIN live_sessions s ON s.id = sc.session_id
             WHERE s.date >= CURRENT_DATE - INTERVAL '7 days' AND s.status = 'completed'
             GROUP BY sc.channel`,
          )
          const qRes = await client.query(
            `SELECT COUNT(*)::int AS total,
                    SUM(CASE WHEN uv_value IS NULL OR interaction_rate IS NULL OR retention_rate IS NULL THEN 1 ELSE 0 END)::int AS null_count
             FROM live_sessions WHERE date >= CURRENT_DATE - INTERVAL '7 days' AND status != 'scheduled'`,
          )
          return {
            events: evRes.rows,
            rules: ruleRes.rows,
            uploadsTodayRows: upRes.rows,
            anchorGmvRows: gmvRes,
            channelRows: chRes,
            convRows: cRes,
            qualityRow: qRes,
          }
        })

      // 2. 自动检测动态异常
      const autoAlerts: any[] = []
      const uploadedTypes = new Set(uploadsTodayRows.map((r: any) => r.data_type))
      if (!uploadedTypes.has('anchor_analysis')) {
        autoAlerts.push({
          id: 'auto-missing-anchor', severity: 'warning', title: '主播分析日报未上传',
          description: `今日(${today})主播分析日报尚未上传，请提醒运营团队及时上传`,
          time: today, status: 'pending',
        })
      }
      if (!uploadedTypes.has('channel_analysis')) {
        autoAlerts.push({
          id: 'auto-missing-channel', severity: 'warning', title: '渠道分析日报未上传',
          description: `今日(${today})渠道分析日报尚未上传，请提醒运营团队及时上传`,
          time: today, status: 'pending',
        })
      }

      for (const row of anchorGmvRows.rows) {
        const todayVal = parseFloat(row.today_avg)
        const pastVal = parseFloat(row.past_avg)
        if (pastVal > 0 && todayVal > 0 && (todayVal - pastVal) / pastVal < -0.3) {
          const dropPct = Math.round((1 - todayVal / pastVal) * 100)
          autoAlerts.push({
            id: `auto-anchor-gmv-${row.anchor_name}`, severity: 'critical', title: `${row.anchor_name} GMV异常下降`,
            description: `${row.anchor_name}今日小时产出¥${todayVal.toFixed(0)}，较近7天均值¥${pastVal.toFixed(0)}下降${dropPct}%`,
            time: today, status: 'pending',
          })
        }
      }

      for (const row of channelRows.rows) {
        const tv = parseInt(row.today_views)
        const to = parseInt(row.today_orders)
        const pv = parseInt(row.past_views)
        const po = parseInt(row.past_orders)
        if (pv > 0 && tv > 0 && po > 0) {
          const viewChange = (tv - pv) / pv
          const orderChange = (to - po) / po
          if (viewChange > 0.2 && orderChange < -0.3) {
            autoAlerts.push({
              id: `auto-channel-${row.channel}`, severity: 'warning', title: `${row.channel} 渠道异常`,
              description: `${row.channel}渠道观看量环比+${Math.round(viewChange * 100)}%，但成交订单环比${Math.round(orderChange * 100)}%，转化效率下降`,
              time: today, status: 'pending',
            })
          }
        }
      }

      for (const row of convRows.rows) {
        const clickRate = parseFloat(row.avg_click_rate)
        const dealRate = parseFloat(row.avg_deal_rate)
        if (clickRate > 0 && clickRate < 1.5) {
          autoAlerts.push({
            id: `auto-conv-click-${row.channel}`, severity: 'warning', title: `${row.channel} 商品点击率偏低`,
            description: `${row.channel}商品曝光-点击率仅${clickRate.toFixed(1)}%，低于正常阈值，需优化商品讲解`,
            time: today, status: 'pending',
          })
        }
        if (dealRate > 0 && dealRate < 0.5) {
          autoAlerts.push({
            id: `auto-conv-deal-${row.channel}`, severity: 'info', title: `${row.channel} 成交转化率偏低`,
            description: `${row.channel}商品点击-成交率仅${dealRate.toFixed(1)}%，需检查价格和福利机制`,
            time: today, status: 'pending',
          })
        }
      }

      const q = qualityRow.rows[0]
      if (q.total > 0 && q.null_count > 0) {
        const nullRate = Math.round((q.null_count / q.total) * 100)
        if (nullRate > 5) {
          autoAlerts.push({
            id: 'auto-data-quality', severity: 'info', title: '数据质量异常',
            description: `近7天数据中有${q.null_count}条记录存在空值（空值率${nullRate}%），建议检查数据导入完整性`,
            time: today, status: 'pending',
          })
        }
      }

      // 合并静态事件+自动检测，去重
      const allAlerts = [
        ...autoAlerts,
        ...events.map((e: any) => ({
          id: String(e.id), severity: e.severity, title: e.title,
          description: e.description || '', time: e.event_time?.toISOString?.()?.slice(0, 10) ?? '',
          status: e.status,
        })),
      ]

      // tableAlerts: 按类型汇总
      const typeCounts = new Map<string, { type: string; severity: string; source: string; count: number; lastOccur: string; status: string }>()
      const countByType = (items: any[]) => {
        for (const a of items) {
          let cat = '其他'
          if (a.title.includes('未上传')) cat = '数据缺失'
          else if (a.title.includes('GMV')) cat = 'GMV异常'
          else if (a.title.includes('渠道')) cat = '渠道异常'
          else if (a.title.includes('商品点击') || a.title.includes('成交转化')) cat = '转化异常'
          else if (a.title.includes('空值') || a.title.includes('数据质量')) cat = '数据质量'
          else if (a.title.includes('互动')) cat = '主播异常'
          else if (a.title.includes('直播间')) cat = '直播间异常'

          const existing = typeCounts.get(cat)
          if (existing) {
            existing.count++
            existing.lastOccur = a.time > existing.lastOccur ? a.time : existing.lastOccur
          } else {
            typeCounts.set(cat, {
              type: cat, severity: a.severity,
              source: cat === 'GMV异常' || cat === '主播异常' ? '主播检测' : cat === '数据缺失' ? '数据完整性检测' : cat === '渠道异常' || cat === '转化异常' ? '渠道检测' : '系统检测',
              count: 1, lastOccur: a.time, status: a.status === 'resolved' ? '已处理' : '未处理',
            })
          }
        }
      }
      countByType(allAlerts)
      const tableAlerts = Array.from(typeCounts.values())

      return sendOk(reply, { alerts: allAlerts, tableAlerts, rules })
    } catch (err) {
      request.log.warn({ err }, 'system/alerts query failed')
      return sendOk(reply, { alerts: [], tableAlerts: [], rules: [] })
    }
  })

}
