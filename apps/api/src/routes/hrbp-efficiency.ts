/**
 * hrbp-efficiency.ts — HRBP 人效分析（P3）
 *
 * 老大原话：「只做 HRBP 工作台（工作台要做完整功能的工作台）里面的人效」
 *
 * 人效 = 人（主播/中控/运营）在单位投入（场次、时长、人数）下的产出（GMV/订单）。
 * 本文件提供完整人效分析能力：
 *
 *   1. GET /hrbp/efficiency/summary      人效总览（核心 KPI + 趋势 + 梯队）
 *   2. GET /hrbp/efficiency/anchors      人效明细榜（可排序：GMV/场均/转化/产能）
 *   3. GET /hrbp/efficiency/roles        岗位人效对比（主播 vs 中控 vs 运营）
 *   4. GET /hrbp/efficiency/utilization  工时利用率（排班 vs 实际开播）
 *   5. GET /hrbp/efficiency/growth       成长追踪（新人爬坡曲线）
 *   6. GET /hrbp/efficiency/risk         人效风险（连续下滑/零产出/高缺勤）
 *
 * 数据来源（全部来自已生成演示数据）：
 *   live_registrations  场次产出（gmv / orders / duration_min）
 *   session_staff_assignments  排班到岗位
 *   staff_day_status    考勤状态
 *   anchor_capabilities 能力四维
 *   anchors / anchor_profiles  人员档案
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'

const HRBP_ROLES = ['super_admin', 'admin', 'hrbp', 'ops_director']

export async function hrbpEfficiencyRoutes(app: FastifyInstance) {
  const guard = { preHandler: [requireRole(HRBP_ROLES)] }

  // ════════════════════════════════════════════════════════════════
  // 1. 人效总览：核心 KPI + 30 日趋势 + 梯队贡献
  // ════════════════════════════════════════════════════════════════
  app.get('/api/v1/hrbp/efficiency/summary', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        // 核心 KPI（近 30 天，排除取消场次）
        const kpiRes = await client.query(
          `SELECT
             COUNT(*)::int                                        AS sessions,
             COUNT(DISTINCT anchor_id)::int                       AS active_anchors,
             COALESCE(SUM(gmv), 0)::numeric(14,2)                 AS total_gmv,
             COALESCE(SUM(duration_min), 0)::int                  AS total_minutes,
             COALESCE(AVG(gmv), 0)::numeric(14,2)                 AS avg_gmv_per_session,
             COALESCE(SUM(orders), 0)::int                        AS total_orders,
             COALESCE(AVG(orders), 0)::numeric(10,1)              AS avg_orders_per_session
           FROM public.live_registrations
          WHERE biz_date >= CURRENT_DATE - 30
            AND status <> 'cancelled'`,
        )
        const kpi = kpiRes.rows[0]

        // 在岗总人数（人效分母）
        const headcountRes = await client.query(
          `SELECT
             (SELECT COUNT(*)::int FROM public.anchors WHERE status = 1) AS anchors,
             (SELECT COUNT(*)::int FROM public.operators WHERE status = 1) AS operators`,
        )
        const headcount = headcountRes.rows[0]
        const totalHeadcount = Number(headcount.anchors) + Number(headcount.operators)

        // 人效核心指标
        const gmvPerAnchor = Number(headcount.anchors) > 0
          ? Number(kpi.total_gmv) / Number(headcount.anchors) : 0
        const sessionsPerAnchor = Number(headcount.anchors) > 0
          ? Number(kpi.sessions) / Number(headcount.anchors) : 0
        const minutesPerAnchor = Number(headcount.anchors) > 0
          ? Number(kpi.total_minutes) / Number(headcount.anchors) : 0

        // 30 日趋势（按周聚合，避免 30 个点太密）
        const trendRes = await client.query(
          `SELECT date_trunc('week', biz_date)::date AS week_start,
                  COUNT(*)::int                                              AS sessions,
                  COALESCE(SUM(gmv), 0)::numeric(14,2)                       AS gmv,
                  COALESCE(SUM(duration_min), 0)::int                        AS minutes,
                  COUNT(DISTINCT anchor_id)::int                             AS active_anchors
             FROM public.live_registrations
            WHERE biz_date >= CURRENT_DATE - 84
              AND status <> 'cancelled'
            GROUP BY 1
            ORDER BY 1`,
        )

        // 梯队贡献（S/A/B/C）
        const tierRes = await client.query(
          `SELECT COALESCE(a.level, '未评级') AS level,
                  COUNT(*)::int                                        AS sessions,
                  COUNT(DISTINCT lr.anchor_id)::int                    AS headcount,
                  COALESCE(SUM(lr.gmv), 0)::numeric(14,2)              AS gmv,
                  COALESCE(AVG(lr.gmv), 0)::numeric(14,2)              AS avg_gmv
             FROM public.live_registrations lr
             JOIN public.anchors a ON a.id = lr.anchor_id
            WHERE lr.biz_date >= CURRENT_DATE - 30
              AND lr.status <> 'cancelled'
            GROUP BY 1
            ORDER BY gmv DESC`,
        )

        // 岗位人效对比
        const roleRes = await client.query(
          `SELECT ssa.role_code,
                  COUNT(DISTINCT ssa.session_id)::int                     AS sessions,
                  COUNT(DISTINCT ssa.staff_id)::int                       AS headcount,
                  COALESCE(SUM(lr.gmv), 0)::numeric(14,2)                 AS gmv
             FROM public.session_staff_assignments ssa
             JOIN public.live_registrations lr ON lr.id = ssa.session_id
            WHERE lr.biz_date >= CURRENT_DATE - 30
              AND lr.status <> 'cancelled'
            GROUP BY 1
            ORDER BY gmv DESC`,
        )

        return {
          range: { days: 30 },
          kpi: {
            sessions: Number(kpi.sessions),
            activeAnchors: Number(kpi.active_anchors),
            totalGmv: Number(kpi.total_gmv),
            totalMinutes: Number(kpi.total_minutes),
            avgGmvPerSession: Number(kpi.avg_gmv_per_session),
            totalOrders: Number(kpi.total_orders),
            avgOrdersPerSession: Number(kpi.avg_orders_per_session),
          },
          headcount: {
            anchors: Number(headcount.anchors),
            operators: Number(headcount.operators),
            total: totalHeadcount,
          },
          efficiency: {
            // 人均 GMV（月度）
            gmvPerAnchor: Math.round(gmvPerAnchor),
            // 人均场次
            sessionsPerAnchor: Number(sessionsPerAnchor.toFixed(2)),
            // 人均时长（小时）
            hoursPerAnchor: Number((minutesPerAnchor / 60).toFixed(1)),
            // 人均小时 GMV（时薪化人效）
            gmvPerHour: minutesPerAnchor > 0
              ? Math.round(Number(kpi.total_gmv) / (minutesPerAnchor / 60))
              : 0,
          },
          trend: trendRes.rows.map((r: any) => ({
            weekStart: r.week_start,
            sessions: Number(r.sessions),
            gmv: Number(r.gmv),
            minutes: Number(r.minutes),
            activeAnchors: Number(r.active_anchors),
          })),
          tiers: tierRes.rows.map((r: any) => ({
            level: r.level,
            sessions: Number(r.sessions),
            headcount: Number(r.headcount),
            gmv: Number(r.gmv),
            avgGmv: Number(r.avg_gmv),
          })),
          roles: roleRes.rows.map((r: any) => ({
            roleCode: r.role_code,
            sessions: Number(r.sessions),
            headcount: Number(r.headcount),
            gmv: Number(r.gmv),
          })),
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/efficiency/summary failed')
      return sendError(reply, 500, '获取人效总览失败')
    }
  })

  // ════════════════════════════════════════════════════════════════
  // 2. 人效明细榜：每人 GMV / 场均 / 转化 / 产能
  // ════════════════════════════════════════════════════════════════
  app.get('/api/v1/hrbp/efficiency/anchors', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { days?: string; sort?: string }
    const days = Math.min(Math.max(Number(q.days) || 30, 7), 180)
    const sort = q.sort || 'gmv'
    const sortMap: Record<string, string> = {
      gmv: 'gmv DESC',
      avg_gmv: 'avg_gmv DESC',
      gmv_per_hour: 'gmv_per_hour DESC',
      conversion: 'conversion_rate DESC',
      sessions: 'sessions DESC',
    }
    const orderBy = sortMap[sort] || sortMap.gmv

    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `WITH stats AS (
             SELECT lr.anchor_id,
                    COUNT(*)::int                                        AS sessions,
                    COALESCE(SUM(lr.gmv), 0)::numeric(14,2)              AS gmv,
                    COALESCE(SUM(lr.duration_min), 0)::int               AS minutes,
                    COALESCE(AVG(lr.gmv), 0)::numeric(14,2)              AS avg_gmv,
                    COALESCE(SUM(lr.orders), 0)::int                     AS orders,
                    COALESCE(AVG(lr.orders), 0)::numeric(10,1)           AS avg_orders,
                    COALESCE(SUM(lr.return_amount), 0)::numeric(14,2)   AS return_amount,
                    COALESCE(AVG(lr.buyer_count), 0)::numeric(10,1)      AS avg_buyers
               FROM public.live_registrations lr
              WHERE lr.biz_date >= CURRENT_DATE - $1::int
                AND lr.status <> 'cancelled'
              GROUP BY lr.anchor_id
           )
           SELECT a.id,
                  a.name,
                  COALESCE(a.level, '未评级')                                    AS level,
                  COALESCE(s.sessions, 0)::int                                   AS sessions,
                  COALESCE(s.gmv, 0)::numeric(14,2)                              AS gmv,
                  COALESCE(s.avg_gmv, 0)::numeric(14,2)                          AS avg_gmv,
                  COALESCE(s.minutes, 0)::int                                    AS minutes,
                  CASE WHEN COALESCE(s.minutes, 0) > 0
                       THEN ROUND(s.gmv / (s.minutes / 60.0))
                       ELSE 0 END::numeric(14,2)                                AS gmv_per_hour,
                  COALESCE(s.orders, 0)::int                                     AS orders,
                  COALESCE(s.avg_orders, 0)::numeric(10,1)                       AS avg_orders,
                  COALESCE(s.return_amount, 0)::numeric(14,2)                    AS return_amount,
                  CASE WHEN COALESCE(s.gmv, 0) > 0
                       THEN ROUND(s.return_amount / s.gmv * 100, 2)
                       ELSE 0 END::numeric(6,2)                                 AS return_rate,
                  CASE WHEN COALESCE(s.orders, 0) > 0
                       THEN ROUND(s.gmv / s.orders, 2)
                       ELSE 0 END::numeric(10,2)                                AS avg_order_value,
                  COALESCE(ac.overall, 0)::int                                   AS capability,
                  COALESCE(ap.followers, 0)::bigint                              AS followers
             FROM public.anchors a
             LEFT JOIN stats s ON s.anchor_id = a.id
             LEFT JOIN LATERAL (
               SELECT overall FROM public.anchor_capabilities
                WHERE anchor_id = a.id ORDER BY evaluated_at DESC LIMIT 1
             ) ac ON true
             LEFT JOIN public.anchor_profiles ap ON ap.id = a.id
            WHERE a.status = 1
            ORDER BY ${orderBy}`,
          [days],
        )

        const rows = res.rows.map((r: any) => ({
          id: Number(r.id),
          name: r.name,
          level: r.level,
          sessions: Number(r.sessions),
          gmv: Number(r.gmv),
          avgGmv: Number(r.avg_gmv),
          minutes: Number(r.minutes),
          gmvPerHour: Number(r.gmv_per_hour),
          orders: Number(r.orders),
          avgOrders: Number(r.avg_orders),
          returnAmount: Number(r.return_amount),
          returnRate: Number(r.return_rate),
          avgOrderValue: Number(r.avg_order_value),
          capability: Number(r.capability),
          followers: Number(r.followers),
        }))

        // 汇总（用于前端算占比）
        const totalGmv = rows.reduce((a: number, r: any) => a + r.gmv, 0)

        return {
          range: { days },
          sort,
          totalGmv,
          anchors: rows,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/efficiency/anchors failed')
      return sendError(reply, 500, '获取人效明细失败')
    }
  })

  // ════════════════════════════════════════════════════════════════
  // 3. 工时利用率：排班场次 vs 实际开播（含缺勤）
  // ════════════════════════════════════════════════════════════════
  app.get('/api/v1/hrbp/efficiency/utilization', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { days?: string }
    const days = Math.min(Math.max(Number(q.days) || 30, 7), 180)
    try {
      const data = await withRlsContext(request, async (client) => {
        // 每人：排班场次、实际开播、取消、时长、缺勤天数
        const res = await client.query(
          `WITH assigned AS (
             SELECT ssa.staff_name,
                    COUNT(DISTINCT ssa.session_id)::int                     AS assigned_sessions
               FROM public.session_staff_assignments ssa
               JOIN public.live_registrations lr ON lr.id = ssa.session_id
              WHERE lr.biz_date >= CURRENT_DATE - $1::int
              GROUP BY ssa.staff_name
           ),
           actual AS (
             SELECT a.name,
                    COUNT(lr.id)::int                                        AS actual_sessions,
                    COALESCE(SUM(lr.duration_min), 0)::int                   AS minutes
               FROM public.anchors a
               LEFT JOIN public.live_registrations lr
                 ON lr.anchor_id = a.id
                AND lr.biz_date >= CURRENT_DATE - $1::int
                AND lr.status <> 'cancelled'
              WHERE a.status = 1
              GROUP BY a.name
           ),
           attendance AS (
             SELECT staff_name,
                    COUNT(*) FILTER (WHERE status = 'work')::int             AS work_days,
                    COUNT(*) FILTER (WHERE status = 'rest')::int             AS rest_days,
                    COUNT(*) FILTER (WHERE status IN ('leave', 'sick'))::int AS leave_days
               FROM public.staff_day_status
              WHERE biz_date >= CURRENT_DATE - $1::int
              GROUP BY staff_name
           )
           SELECT a.id,
                  a.name,
                  COALESCE(a.level, '未评级')                    AS level,
                  COALESCE(asg.assigned_sessions, 0)::int       AS assigned_sessions,
                  COALESCE(act.actual_sessions, 0)::int         AS actual_sessions,
                  COALESCE(act.minutes, 0)::int                 AS minutes,
                  COALESCE(att.work_days, 0)::int               AS work_days,
                  COALESCE(att.rest_days, 0)::int               AS rest_days,
                  COALESCE(att.leave_days, 0)::int              AS leave_days
             FROM public.anchors a
             LEFT JOIN assigned asg ON asg.staff_name = a.name
             LEFT JOIN actual   act ON act.name = a.name
             LEFT JOIN attendance att ON att.staff_name = a.name
            WHERE a.status = 1
            ORDER BY act.minutes DESC NULLS LAST, a.id`,
          [days],
        )

        const anchors = res.rows.map((r: any) => {
          const assigned = Number(r.assigned_sessions)
          const actual = Number(r.actual_sessions)
          const minutes = Number(r.minutes)
          const workDays = Number(r.work_days)
          const leaveDays = Number(r.leave_days)
          // 利用率 = 实际开播 / 排班场次
          const utilization = assigned > 0
            ? Number(((actual / assigned) * 100).toFixed(1))
            : null
          // 出勤率 = 上班 / (上班 + 休假)
          const attendanceRate = (workDays + leaveDays) > 0
            ? Number((workDays / (workDays + leaveDays) * 100).toFixed(1))
            : null
          return {
            id: Number(r.id),
            name: r.name,
            level: r.level,
            assignedSessions: assigned,
            actualSessions: actual,
            minutes,
            hours: Number((minutes / 60).toFixed(1)),
            workDays,
            restDays: Number(r.rest_days),
            leaveDays,
            utilization,
            attendanceRate,
          }
        })

        const totalAssigned = anchors.reduce((a: number, r: any) => a + r.assignedSessions, 0)
        const totalActual = anchors.reduce((a: number, r: any) => a + r.actualSessions, 0)

        // 总体利用率用「总场次」口径而非「人场次总和」：
        //   一场直播常有主播+中控+编导 3 人排班，按人求和会重复计数同一场次。
        const totalSessionsRes = await client.query(
          `SELECT COUNT(DISTINCT ssa.session_id)::int AS assigned_total
             FROM public.session_staff_assignments ssa
             JOIN public.live_registrations lr ON lr.id = ssa.session_id
            WHERE lr.biz_date >= CURRENT_DATE - $1::int`,
          [days],
        )
        const totalSessionsActualRes = await client.query(
          `SELECT COUNT(*)::int AS actual_total
             FROM public.live_registrations
            WHERE biz_date >= CURRENT_DATE - $1::int
              AND status <> 'cancelled'`,
          [days],
        )
        const assignedTotal = Number(totalSessionsRes.rows[0]?.assigned_total || 0)
        const actualTotal = Number(totalSessionsActualRes.rows[0]?.actual_total || 0)

        return {
          range: { days },
          totals: {
            assignedSessions: assignedTotal,
            actualSessions: actualTotal,
            utilization: assignedTotal > 0
              ? Number(((actualTotal / assignedTotal) * 100).toFixed(1))
              : null,
            // 人场次（供参考：同一场次多人排班会重复计数）
            assignedStaffSessions: totalAssigned,
          },
          anchors,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/efficiency/utilization failed')
      return sendError(reply, 500, '获取工时利用率失败')
    }
  })

  // ════════════════════════════════════════════════════════════════
  // 4. 成长追踪：新人爬坡曲线（按入职月分组的场均 GMV 演进）
  // ════════════════════════════════════════════════════════════════
  app.get('/api/v1/hrbp/efficiency/growth', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        // 每人「开播第 N 场」的场均 GMV（爬坡曲线）
        const res = await client.query(
          `WITH ordered AS (
             SELECT lr.anchor_id,
                    lr.gmv,
                    lr.biz_date,
                    ROW_NUMBER() OVER (PARTITION BY lr.anchor_id ORDER BY lr.biz_date, lr.id) AS nth
               FROM public.live_registrations lr
              WHERE lr.status <> 'cancelled'
           )
           SELECT o.nth,
                  COUNT(*)::int                                    AS anchor_count,
                  COALESCE(AVG(o.gmv), 0)::numeric(14,2)           AS avg_gmv
             FROM ordered o
             JOIN public.anchors a ON a.id = o.anchor_id
            WHERE a.status = 1
              AND o.nth <= 20
            GROUP BY o.nth
            ORDER BY o.nth`,
        )

        // 新人（入职 90 天内）当前表现
        const newbieRes = await client.query(
          `SELECT a.id, a.name, COALESCE(a.level, '未评级') AS level,
                  ap.join_date,
                  (SELECT COUNT(*)::int FROM public.live_registrations lr
                    WHERE lr.anchor_id = a.id AND lr.status <> 'cancelled') AS sessions,
                  (SELECT COALESCE(AVG(lr.gmv), 0)::numeric(14,2) FROM public.live_registrations lr
                    WHERE lr.anchor_id = a.id AND lr.status <> 'cancelled') AS avg_gmv
             FROM public.anchors a
             JOIN public.anchor_profiles ap ON ap.id = a.id
            WHERE a.status = 1
              AND ap.join_date >= CURRENT_DATE - 90
            ORDER BY ap.join_date DESC`,
        )

        return {
          rampCurve: res.rows.map((r: any) => ({
            nth: Number(r.nth),
            anchorCount: Number(r.anchor_count),
            avgGmv: Number(r.avg_gmv),
          })),
          newbies: newbieRes.rows.map((r: any) => ({
            id: Number(r.id),
            name: r.name,
            level: r.level,
            joinDate: r.join_date,
            sessions: Number(r.sessions),
            avgGmv: Number(r.avg_gmv),
          })),
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/efficiency/growth failed')
      return sendError(reply, 500, '获取成长追踪失败')
    }
  })

  // ════════════════════════════════════════════════════════════════
  // 5. 人效风险：连续下滑 / 零产出 / 高缺勤
  // ════════════════════════════════════════════════════════════════
  app.get('/api/v1/hrbp/efficiency/risk', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { days?: string }
    const days = Math.min(Math.max(Number(q.days) || 30, 7), 180)
    try {
      const data = await withRlsContext(request, async (client) => {
        // 每人近半段 vs 前半段 GMV 对比，识别下滑
        const declineRes = await client.query(
          `WITH halves AS (
             SELECT anchor_id,
                    CASE WHEN biz_date >= CURRENT_DATE - ($1::int / 2)
                         THEN 'recent' ELSE 'prior' END AS half,
                    COALESCE(SUM(gmv), 0)::numeric(14,2) AS gmv,
                    COUNT(*)::int AS sessions
               FROM public.live_registrations
              WHERE biz_date >= CURRENT_DATE - $1::int
                AND status <> 'cancelled'
              GROUP BY 1, 2
           )
           SELECT a.id, a.name, COALESCE(a.level, '未评级') AS level,
                  COALESCE(r.gmv, 0)::numeric(14,2)  AS recent_gmv,
                  COALESCE(p.gmv, 0)::numeric(14,2)  AS prior_gmv,
                  COALESCE(r.sessions, 0)::int       AS recent_sessions,
                  COALESCE(p.sessions, 0)::int       AS prior_sessions
             FROM public.anchors a
             LEFT JOIN halves r ON r.anchor_id = a.id AND r.half = 'recent'
             LEFT JOIN halves p ON p.anchor_id = a.id AND p.half = 'prior'
            WHERE a.status = 1
            ORDER BY a.id`,
          [days],
        )

        // 零产出主播（在岗但周期内无有效场次）
        const zeroRes = await client.query(
          `SELECT a.id, a.name, COALESCE(a.level, '未评级') AS level,
                  (SELECT MAX(lr.biz_date) FROM public.live_registrations lr
                    WHERE lr.anchor_id = a.id AND lr.status <> 'cancelled') AS last_session_date
             FROM public.anchors a
            WHERE a.status = 1
              AND NOT EXISTS (
                SELECT 1 FROM public.live_registrations lr
                 WHERE lr.anchor_id = a.id
                   AND lr.biz_date >= CURRENT_DATE - $1::int
                   AND lr.status <> 'cancelled'
              )
            ORDER BY a.id`,
          [days],
        )

        // 高缺勤（请假+病假 ≥ 3 天）
        const absentRes = await client.query(
          `SELECT staff_name,
                  COUNT(*) FILTER (WHERE status IN ('leave', 'sick'))::int AS leave_days,
                  COUNT(*) FILTER (WHERE status = 'rest')::int              AS rest_days
             FROM public.staff_day_status
            WHERE biz_date >= CURRENT_DATE - $1::int
            GROUP BY staff_name
           HAVING COUNT(*) FILTER (WHERE status IN ('leave', 'sick')) >= 3
            ORDER BY leave_days DESC`,
          [days],
        )

        const declining = declineRes.rows
          .map((r: any) => {
            const recent = Number(r.recent_gmv)
            const prior = Number(r.prior_gmv)
            const change = prior > 0
              ? Number(((recent - prior) / prior * 100).toFixed(1))
              : (recent > 0 ? 100 : 0)
            return {
              id: Number(r.id),
              name: r.name,
              level: r.level,
              recentGmv: recent,
              priorGmv: prior,
              changePct: change,
              recentSessions: Number(r.recent_sessions),
              priorSessions: Number(r.prior_sessions),
            }
          })
          .filter((r: any) => r.changePct <= -20 && r.priorGmv > 0)
          .sort((a: any, b: any) => a.changePct - b.changePct)

        return {
          range: { days },
          declining,
          zeroOutput: zeroRes.rows.map((r: any) => ({
            id: Number(r.id),
            name: r.name,
            level: r.level,
            lastSessionDate: r.last_session_date,
          })),
          highAbsence: absentRes.rows.map((r: any) => ({
            name: r.staff_name,
            leaveDays: Number(r.leave_days),
            restDays: Number(r.rest_days),
          })),
          riskCount: declining.length + zeroRes.rows.length + absentRes.rows.length,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/efficiency/risk failed')
      return sendError(reply, 500, '获取人效风险失败')
    }
  })

  // ════════════════════════════════════════════════════════════════
  // 7. 招聘管理与声画试镜打分漏斗（P3 闭环）
  // ════════════════════════════════════════════════════════════════

  // GET /api/v1/hrbp/recruitment/candidates ── 候选人列表与漏斗统计
  app.get('/api/v1/hrbp/recruitment/candidates', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        const candidatesRes = await client.query(
          `SELECT
             c.id,
             c.name,
             c.phone,
             c.target_category,
             c.experience_years::float AS experience_years,
             c.expected_salary::float AS expected_salary,
             c.source,
             c.stage,
             c.eliminated_reason,
             c.anchor_id,
             c.created_at,
             a.id AS audition_id,
             a.audition_date,
             a.interviewer,
             a.camera_presence_score::float AS camera_presence_score,
             a.vocal_clarity_score::float AS vocal_clarity_score,
             a.sales_pitch_score::float AS sales_pitch_score,
             a.script_adaptability_score::float AS script_adaptability_score,
             a.rhythm_control_score::float AS rhythm_control_score,
             a.total_score::float AS total_score,
             a.trial_gmv::float AS trial_gmv,
             a.trial_orders::int AS trial_orders,
             a.result AS audition_result,
             a.comments AS audition_comments
           FROM public.hrbp_candidates c
           LEFT JOIN LATERAL (
             SELECT * FROM public.hrbp_auditions
              WHERE candidate_id = c.id
              ORDER BY id DESC LIMIT 1
           ) a ON true
           ORDER BY c.created_at DESC`
        )

        // 统计漏斗各阶段人数
        const funnelRes = await client.query(
          `SELECT stage, COUNT(*)::int AS count
             FROM public.hrbp_candidates
            GROUP BY stage`
        )
        const funnelMap: Record<string, number> = {}
        for (const row of funnelRes.rows) {
          funnelMap[row.stage] = row.count
        }

        return {
          candidates: candidatesRes.rows,
          funnel: {
            resume_screening: funnelMap['resume_screening'] || 0,
            audition_scheduled: funnelMap['audition_scheduled'] || 0,
            trial_streaming: funnelMap['trial_streaming'] || 0,
            offer_extended: funnelMap['offer_extended'] || 0,
            onboarded: funnelMap['onboarded'] || 0,
            eliminated: funnelMap['eliminated'] || 0,
            total: candidatesRes.rows.length,
          },
        }
      })
      return sendOk(reply, data)
    } catch (err: any) {
      request.log.warn({ err }, 'hrbp/recruitment/candidates failed')
      return sendError(reply, 500, '获取招聘候选人列表失败')
    }
  })

  // POST /api/v1/hrbp/recruitment/candidates ── 录入应聘候选人
  app.post('/api/v1/hrbp/recruitment/candidates', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, phone, targetCategory, experienceYears = 0, expectedSalary = 0, source = 'BOSS直聘' } = request.body as any
    if (!name || !targetCategory) {
      return sendError(reply, 400, '候选人姓名和应聘品类为必填项')
    }

    try {
      const row = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO public.hrbp_candidates
             (name, phone, target_category, experience_years, expected_salary, source, stage)
           VALUES ($1, $2, $3, $4, $5, $6, 'resume_screening')
           RETURNING *`,
          [name, phone || '', targetCategory, Number(experienceYears) || 0, Number(expectedSalary) || 0, source]
        )
        return res.rows[0]
      })
      return sendOk(reply, row, '候选人录入成功')
    } catch (err: any) {
      request.log.error(err, 'create candidate failed')
      return sendError(reply, 500, err.message)
    }
  })

  // POST /api/v1/hrbp/recruitment/auditions ── 录入声画试镜打分与15分钟试播成绩
  app.post('/api/v1/hrbp/recruitment/auditions', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      candidateId,
      interviewer = '李HRBP',
      cameraPresenceScore = 8.0,
      vocalClarityScore = 8.0,
      salesPitchScore = 8.0,
      scriptAdaptabilityScore = 8.0,
      rhythmControlScore = 8.0,
      trialGmv = 0,
      trialOrders = 0,
      result = 'pass',
      comments = '',
    } = request.body as any

    if (!candidateId) {
      return sendError(reply, 400, '缺少 candidateId')
    }

    const totalScore = Number(
      ((Number(cameraPresenceScore) * 0.25) +
       (Number(vocalClarityScore) * 0.2) +
       (Number(salesPitchScore) * 0.25) +
       (Number(scriptAdaptabilityScore) * 0.15) +
       (Number(rhythmControlScore) * 0.15)).toFixed(1)
    )

    try {
      const row = await withRlsContext(request, async (client) => {
        const audRes = await client.query(
          `INSERT INTO public.hrbp_auditions
             (candidate_id, audition_date, interviewer, camera_presence_score, vocal_clarity_score,
              sales_pitch_score, script_adaptability_score, rhythm_control_score, total_score,
              trial_gmv, trial_orders, result, comments)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            candidateId, interviewer, cameraPresenceScore, vocalClarityScore,
            salesPitchScore, scriptAdaptabilityScore, rhythmControlScore, totalScore,
            trialGmv, trialOrders, result, comments,
          ]
        )

        // 联动推进候选人阶段状态
        let nextStage = 'trial_streaming'
        if (result === 'fail') {
          nextStage = 'eliminated'
        } else if (Number(trialGmv) > 0 || result === 'pass') {
          nextStage = 'offer_extended'
        }

        await client.query(
          `UPDATE public.hrbp_candidates
              SET stage = $1, updated_at = NOW()
            WHERE id = $2`,
          [nextStage, candidateId]
        )

        return audRes.rows[0]
      })
      return sendOk(reply, row, '试镜评估打分已保存')
    } catch (err: any) {
      request.log.error(err, 'record audition failed')
      return sendError(reply, 500, err.message)
    }
  })

  // POST /api/v1/hrbp/recruitment/candidates/:id/onboard ── 一键转正（生成正式主播档案并闭环）
  app.post('/api/v1/hrbp/recruitment/candidates/:id/onboard', guard, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const candidateId = Number(id)
    const { level = 'B', platform = 'douyin' } = (request.body as any) || {}

    try {
      const result = await withRlsContext(request, async (client) => {
        const candRes = await client.query(`SELECT * FROM public.hrbp_candidates WHERE id = $1`, [candidateId])
        if (candRes.rows.length === 0) throw new Error('候选人不存在')
        const candidate = candRes.rows[0]

        // 1. 在 anchors 表创建正式主播记录
        const anchorRes = await client.query(
          `INSERT INTO public.anchors (name, platform, level, status, created_at, updated_at)
           VALUES ($1, $2, $3, 1, NOW(), NOW())
           RETURNING *`,
          [candidate.name, platform, level]
        )
        const newAnchor = anchorRes.rows[0]

        // 2. 更新候选人状态为 onboarded 并关联 anchor_id
        await client.query(
          `UPDATE public.hrbp_candidates
              SET stage = 'onboarded', anchor_id = $1, updated_at = NOW()
            WHERE id = $2`,
          [newAnchor.id, candidateId]
        )

        return { candidate, anchor: newAnchor }
      })

      return sendOk(reply, result, `已成功办理转正！已在正式主播库中生成主播档案【${result.anchor.name}】(${result.anchor.level}级)`)
    } catch (err: any) {
      request.log.error(err, 'onboard candidate failed')
      return sendError(reply, 500, err.message)
    }
  })
}
