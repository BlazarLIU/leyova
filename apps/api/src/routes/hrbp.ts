/**
 * hrbp.ts — HRBP 工作台（S5）
 *
 * 老大原话：「有 HRBP 的角色，但是没有相应的功能」
 *
 * 现状（实测）：
 *   - hrbp 角色只有 5 个通用模块（ai / anchor / overview / personal_achievement / system_personnel_ops）
 *   - 底层数据齐备但无 HRBP 视角的聚合：
 *       anchors(34) / anchor_profiles(32) / anchor_capabilities(32)
 *       live_registrations(3037) / anchor_training_plans(3)
 *   - personnel.ts 只有 CRUD，没有「人才经营」视角
 *
 * 本文件提供 HRBP 的四类核心视图：
 *   1. 人才画像总览（规模/层级/在岗/新人）
 *   2. 考勤与出勤（按主播聚合场次、时长、缺勤）
 *   3. 绩效分布（能力四维 + GMV 贡献分档）
 *   4. 培训进度（计划完成率、未完成名单）
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'

const HRBP_ROLES = ['super_admin', 'admin', 'hrbp', 'ops_director']

export async function hrbpRoutes(app: FastifyInstance) {
  // ── GET /api/v1/hrbp/overview ── 人才画像总览
  app.get('/api/v1/hrbp/overview', { preHandler: [requireRole(HRBP_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        // 规模与层级分布
        const levelRes = await client.query(
          `SELECT COALESCE(level, '未评级') AS level, COUNT(*)::int AS n
             FROM public.anchors WHERE status = 1
            GROUP BY 1 ORDER BY n DESC`,
        )

        // 新人（入职 30 天内）
        const newbieRes = await client.query(
          `SELECT COUNT(*)::int AS n
             FROM public.anchor_profiles
            WHERE join_date >= CURRENT_DATE - 30`,
        )

        // 有档案 vs 无档案
        const profileRes = await client.query(
          `SELECT
             COUNT(*) FILTER (WHERE p.id IS NOT NULL)::int AS with_profile,
             COUNT(*) FILTER (WHERE p.id IS NULL)::int     AS without_profile
           FROM public.anchors a
           LEFT JOIN public.anchor_profiles p ON p.id = a.id
          WHERE a.status = 1`,
        )

        // 平台分布
        const platformRes = await client.query(
          `SELECT COALESCE(platform_code, platform, 'unknown') AS platform, COUNT(*)::int AS n
             FROM public.anchors WHERE status = 1
            GROUP BY 1 ORDER BY n DESC`,
        )

        // 粉丝规模
        const fansRes = await client.query(
          `SELECT COALESCE(SUM(followers), 0)::bigint AS total,
                  COALESCE(ROUND(AVG(NULLIF(followers, 0))), 0)::bigint AS avg
             FROM public.anchor_profiles`,
        )

        return {
          totalActive: levelRes.rows.reduce((a: number, r: any) => a + Number(r.n), 0),
          byLevel: levelRes.rows,
          newbieLast30d: Number(newbieRes.rows[0]?.n || 0),
          profiles: {
            withProfile: Number(profileRes.rows[0]?.with_profile || 0),
            withoutProfile: Number(profileRes.rows[0]?.without_profile || 0),
          },
          byPlatform: platformRes.rows,
          fans: {
            total: Number(fansRes.rows[0]?.total || 0),
            avg: Number(fansRes.rows[0]?.avg || 0),
          },
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/overview failed')
      return sendError(reply, 500, '获取人才总览失败')
    }
  })

  // ── GET /api/v1/hrbp/attendance ── 考勤与出勤（按主播聚合）
  app.get('/api/v1/hrbp/attendance', { preHandler: [requireRole(HRBP_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as { days?: string }
    const days = Math.min(Math.max(Number(q.days) || 30, 7), 180)
    try {
      const data = await withRlsContext(request, async (client) => {
        // 缺勤用 v_staff_attendance 反推（方案A，全岗位）：
        //   场次取消 / 过期未开播 → 该场全体排班人员缺勤；主播额外校验直播登记；当日休/假不计
        const res = await client.query(
          `SELECT a.id,
                  a.name,
                  COALESCE(a.level, '未评级')                       AS level,
                  COUNT(lr.id)::int                                 AS sessions,
                  COALESCE(SUM(lr.duration_min), 0)::int            AS total_minutes,
                  COALESCE(ROUND(AVG(lr.duration_min)), 0)::int     AS avg_minutes,
                  COALESCE(MAX(att.absent_days), 0)::int            AS absent,
                  COALESCE(MAX(att.expected_days), 0)::int          AS expected_days,
                  COALESCE(MAX(att.rest_days), 0)::int              AS rest_days,
                  COALESCE(SUM(lr.gmv), 0)::numeric(14,2)           AS gmv
             FROM public.anchors a
             LEFT JOIN public.live_registrations lr
               ON lr.anchor_id = a.id
              AND lr.biz_date >= CURRENT_DATE - $1::int
             LEFT JOIN (
               -- 方案A：全岗位缺勤（场次取消/过期未开播 → 该场全体排班人员缺勤）
               SELECT staff_name,
                      COUNT(DISTINCT session_id) FILTER (WHERE is_absent)::int              AS absent_days,
                      COUNT(DISTINCT session_id)::int                                       AS expected_days,
                      COUNT(DISTINCT biz_date) FILTER (WHERE day_status IN ('rest','leave','sick'))::int AS rest_days
                 FROM public.v_staff_attendance
                WHERE biz_date >= CURRENT_DATE - $1::int
                GROUP BY staff_name
             ) att ON att.staff_name = a.name
             WHERE a.status = 1
            GROUP BY a.id, a.name, a.level
            ORDER BY sessions DESC, gmv DESC
            LIMIT 100`,
          [days],
        )

        const totals = res.rows.reduce(
          (acc: any, r: any) => {
            acc.sessions += Number(r.sessions)
            acc.totalMinutes += Number(r.total_minutes)
            acc.absent += Number(r.absent)
            acc.restDays += Number(r.rest_days)
            return acc
          },
          { sessions: 0, totalMinutes: 0, absent: 0, restDays: 0 },
        )

        // 零出勤主播（在岗但本月无场次）
        const idleCount = res.rows.filter((r: any) => Number(r.sessions) === 0).length

        return {
          range: { days },
          totals: {
            ...totals,
            idleAnchors: idleCount,
            avgSessionsPerAnchor: res.rows.length > 0
              ? Number((totals.sessions / res.rows.length).toFixed(1))
              : 0,
          },
          anchors: res.rows,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/attendance failed')
      return sendError(reply, 500, '获取考勤数据失败')
    }
  })

  // ── GET /api/v1/hrbp/performance ── 绩效分布（能力四维 + GMV 分档）
  app.get('/api/v1/hrbp/performance', { preHandler: [requireRole(HRBP_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        // 能力四维（取每人最新一次评估）
        const capRes = await client.query(
          `SELECT DISTINCT ON (ac.anchor_id)
                  ac.anchor_id,
                  a.name,
                  ac.expression, ac.interaction, ac.conversion, ac.professionalism, ac.overall,
                  ac.evaluated_at
             FROM public.anchor_capabilities ac
             JOIN public.anchors a ON a.id = ac.anchor_id
            WHERE a.status = 1
            ORDER BY ac.anchor_id, ac.evaluated_at DESC`,
        )

        // GMV 分档（近 30 天）
        const gmvRes = await client.query(
          `SELECT a.id, a.name, COALESCE(SUM(lr.gmv), 0)::numeric(14,2) AS gmv
             FROM public.anchors a
             LEFT JOIN public.live_registrations lr
               ON lr.anchor_id = a.id AND lr.biz_date >= CURRENT_DATE - 30
            WHERE a.status = 1
            GROUP BY a.id, a.name`,
        )

        const bands = { top: 0, mid: 0, low: 0, none: 0 }
        const sorted = gmvRes.rows
          .map((r: any) => ({ ...r, gmv: Number(r.gmv) }))
          .sort((a: any, b: any) => b.gmv - a.gmv)
        const third = Math.max(1, Math.ceil(sorted.length / 3))
        sorted.forEach((r: any, i: number) => {
          if (r.gmv <= 0) bands.none++
          else if (i < third) bands.top++
          else if (i < third * 2) bands.mid++
          else bands.low++
        })

        // 四维均分
        const avg = (key: string) => {
          const vals = capRes.rows.map((r: any) => Number(r[key])).filter((n: number) => Number.isFinite(n) && n > 0)
          return vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null
        }

        return {
          evaluatedCount: capRes.rows.length,
          dimensions: {
            expression: avg('expression'),
            interaction: avg('interaction'),
            conversion: avg('conversion'),
            professionalism: avg('professionalism'),
            overall: avg('overall'),
          },
          gmvBands: bands,
          capabilities: capRes.rows,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/performance failed')
      return sendError(reply, 500, '获取绩效数据失败')
    }
  })

  // ── GET /api/v1/hrbp/training ── 培训进度
  app.get('/api/v1/hrbp/training', { preHandler: [requireRole(HRBP_ROLES)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await withRlsContext(request, async (client) => {
        const planRes = await client.query(
          `SELECT id, name, anchor_count, start_date, end_date, progress, status
             FROM public.anchor_training_plans
            ORDER BY start_date DESC NULLS LAST
            LIMIT 50`,
        )

        const recRes = await client.query(
          `SELECT COUNT(*)::int AS total FROM public.anchor_training_records`,
        ).catch(() => ({ rows: [{ total: 0 }] }))

        const plans = planRes.rows
        const avgProgress = plans.length > 0
          ? Number((plans.reduce((a: number, p: any) => a + Number(p.progress || 0), 0) / plans.length).toFixed(1))
          : 0

        return {
          planCount: plans.length,
          avgProgress,
          inProgress: plans.filter((p: any) => p.status === 'in_progress').length,
          completed: plans.filter((p: any) => p.status === 'completed').length,
          recordCount: Number((recRes as any).rows[0]?.total || 0),
          plans,
        }
      })
      return sendOk(reply, data)
    } catch (err) {
      request.log.warn({ err }, 'hrbp/training failed')
      return sendError(reply, 500, '获取培训数据失败')
    }
  })
}
