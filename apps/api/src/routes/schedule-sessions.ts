import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { effectivePlatforms } from '../lib/platform-scope.js'

const SCHEDULE_WRITE_ROLES = [
  'super_admin', 'ops_director', 'ops_staff',
  'hrbp', 'controller', 'ad_buyer',
]

/**
 * schedule 域拆分（P2-1）：排班场次 CRUD + 一键应用推荐
 * 原属 routes/schedule.ts，2026-11-17 拆出。
 */
export async function scheduleSessionsRoutes(app: FastifyInstance) {
  // ── GET /api/v1/schedule/sessions ── 获取排班场次列表（按周/按月/按筛选）
  app.get('/api/v1/schedule/sessions', { preHandler: [requireAuth] }, async (request, reply) => {
    const { startDate, endDate, anchorId, roomId, projectId, status } = request.query as any

    try {
      const conditions: string[] = ['1=1']
      const params: any[] = []
      let pIdx = 1

      if (startDate) {
        conditions.push(`s.date >= $${pIdx++}`)
        params.push(startDate)
      }
      if (endDate) {
        conditions.push(`s.date <= $${pIdx++}`)
        params.push(endDate)
      }
      if (anchorId) {
        conditions.push(`s.anchor_id = $${pIdx++}`)
        params.push(Number(anchorId))
      }
      if (roomId) {
        conditions.push(`s.room_id = $${pIdx++}`)
        params.push(Number(roomId))
      }
      if (projectId) {
        conditions.push(`s.project_id = $${pIdx++}`)
        params.push(Number(projectId))
      }
      if (status) {
        conditions.push(`s.status = $${pIdx++}`)
        params.push(status)
      }

      const { rows } = await withRlsContext(request, (client, scope) => {
        const eff = effectivePlatforms(undefined, scope.allowedPlatforms)
        if (eff !== null) {
          conditions.push(`s.platform_code = ANY($${pIdx++}::text[])`)
          params.push(eff)
        }
        const sql = `
        SELECT
          s.id,
          s.title,
          s.date::text AS "date",
          s.start_time::text AS "startTime",
          s.end_time::text AS "endTime",
          s.status,
          s.room_id AS "roomId",
          r.name AS "roomName",
          s.anchor_id AS "anchorId",
          a.name AS "anchorName",
          a.level AS "anchorLevel",
          s.operator_id AS "operatorId",
          u.real_name AS "operatorName",
          ctrl.staff_id AS "controllerId",
          ctrl.staff_name AS "controllerName",
          s.project_id AS "projectId",
          NULL::text AS "projectName",
          NULL::text AS "brandName",
          s.gmv::float AS "gmv",
          s.orders::int AS "orders",
          s.duration_min AS "durationMin",
          s.platform_code AS "platformCode",
          s.remark
        FROM public.live_sessions s
        LEFT JOIN public.live_rooms r ON s.room_id = r.id
        LEFT JOIN public.anchors a ON s.anchor_id = a.id
        LEFT JOIN public.users u ON s.operator_id = u.id
        LEFT JOIN LATERAL (
          SELECT staff_id, staff_name
          FROM public.session_staff_assignments
          WHERE session_id = s.id AND role_code = 'controller'
          LIMIT 1
        ) ctrl ON true
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.date DESC, s.start_time ASC
      `

        return client.query(sql, params)
      })
      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch schedule sessions')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/schedule/sessions ── 新建排班场次（含冲突检测）
  app.post('/api/v1/schedule/sessions', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const {
      title,
      date,
      startTime,
      endTime,
      roomId,
      anchorId,
      operatorId,
      controllerId,
      controllerName,
      projectId,
      platformCode = 'douyin',
      remark = '',
      status = 'scheduled',
    } = request.body as any

    if (!date || !startTime || !endTime || !anchorId || !roomId) {
      return sendError(reply, 400, '缺少必填字段: date, startTime, endTime, anchorId, roomId')
    }

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        if (effectivePlatforms(platformCode, scope.allowedPlatforms)?.length === 0) {
          return { error: { code: 403, msg: '无权访问该平台数据' } }
        }
        const conflictCheck = await client.query(
          `
          SELECT s.id, s.title, s.start_time, s.end_time, a.name AS anchor_name
          FROM public.live_sessions s
          JOIN public.anchors a ON s.anchor_id = a.id
          WHERE s.anchor_id = $1
            AND s.date = $2
            AND s.status != 'cancelled'
            AND NOT (s.end_time <= $3 OR s.start_time >= $4)
          LIMIT 1
          `,
          [anchorId, date, startTime, endTime],
        )

        if (conflictCheck.rows.length > 0) {
          return { conflict: conflictCheck.rows[0] }
        }

        const insertSql = `
          INSERT INTO public.live_sessions (
            title, date, start_time, end_time, room_id, anchor_id, operator_id,
            project_id, platform_code, remark, status, duration_min
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 240)
          RETURNING *
        `
        const { rows } = await client.query(insertSql, [
          title || `排期直播 ${date}`,
          date,
          startTime,
          endTime,
          roomId,
          anchorId,
          operatorId || null,
          projectId || null,
          platformCode,
          remark,
          status,
        ])
        const createdSession = rows[0]

        // 写入中控人员分配
        if (createdSession && (controllerId || controllerName)) {
          let cName = controllerName
          if (!cName && controllerId) {
            const uRes = await client.query('SELECT real_name FROM public.users WHERE id = $1', [controllerId])
            if (uRes.rows.length > 0) cName = uRes.rows[0].real_name
          }
          if (cName) {
            await client.query(
              `INSERT INTO public.session_staff_assignments (session_id, role_code, staff_id, staff_name)
               VALUES ($1, 'controller', $2, $3)
               ON CONFLICT (session_id, role_code, staff_name) DO NOTHING`,
              [createdSession.id, controllerId || null, cName],
            )
          }
        }

        return { row: createdSession }
      })

      if ('error' in outcome && outcome.error) {
        return sendError(reply, outcome.error.code, outcome.error.msg)
      }
      if ('conflict' in outcome && outcome.conflict) {
        const c = outcome.conflict
        return sendError(
          reply,
          409,
          `排班冲突：主播【${c.anchor_name}】在该时段已有场次【${c.title}】(${c.start_time}~${c.end_time})，不可重叠排班！`,
        )
      }

      return sendOk(reply, outcome.row, '排班创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to create schedule session')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/schedule/sessions/:id ── 更新排班场次
  app.put('/api/v1/schedule/sessions/:id', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { title, date, startTime, endTime, roomId, anchorId, operatorId, controllerId, controllerName, projectId, status, remark } = request.body as any

    try {
      const updates: string[] = ['updated_at = NOW()']
      const params: any[] = [Number(id)]
      let pIdx = 2

      if (title !== undefined) { updates.push(`title = $${pIdx++}`); params.push(title) }
      if (date !== undefined) { updates.push(`date = $${pIdx++}`); params.push(date) }
      if (startTime !== undefined) { updates.push(`start_time = $${pIdx++}`); params.push(startTime) }
      if (endTime !== undefined) { updates.push(`end_time = $${pIdx++}`); params.push(endTime) }
      if (roomId !== undefined) { updates.push(`room_id = $${pIdx++}`); params.push(roomId) }
      if (anchorId !== undefined) { updates.push(`anchor_id = $${pIdx++}`); params.push(anchorId) }
      if (operatorId !== undefined) { updates.push(`operator_id = $${pIdx++}`); params.push(operatorId) }
      if (projectId !== undefined) { updates.push(`project_id = $${pIdx++}`); params.push(projectId) }
      if (status !== undefined) { updates.push(`status = $${pIdx++}`); params.push(status) }
      if (remark !== undefined) { updates.push(`remark = $${pIdx++}`); params.push(remark) }

      const sql = `UPDATE public.live_sessions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`
      const { rows } = await withRlsContext(request, async (client) => {
        const res = await client.query(sql, params)
        if (res.rows.length > 0) {
          if (controllerId !== undefined || controllerName !== undefined) {
            await client.query(`DELETE FROM public.session_staff_assignments WHERE session_id = $1 AND role_code = 'controller'`, [Number(id)])
            let cName = controllerName
            if (!cName && controllerId) {
              const uRes = await client.query('SELECT real_name FROM public.users WHERE id = $1', [controllerId])
              if (uRes.rows.length > 0) cName = uRes.rows[0].real_name
            }
            if (cName) {
              await client.query(
                `INSERT INTO public.session_staff_assignments (session_id, role_code, staff_id, staff_name)
                 VALUES ($1, 'controller', $2, $3)
                 ON CONFLICT (session_id, role_code, staff_name) DO NOTHING`,
                [Number(id), controllerId || null, cName],
              )
            }
          }

          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'schedule.update',
            resourceType: 'live_session',
            resourceId: id,
            afterData: res.rows[0],
            request,
          })
        }
        return res
      })

      if (rows.length === 0) {
        return sendError(reply, 404, '场次不存在')
      }

      return sendOk(reply, rows[0], '排班更新成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to update schedule session')
      return sendError(reply, 500, err.message)
    }
  })

  // ── DELETE /api/v1/schedule/sessions/:id ── 取消/删除排班场次
  app.delete('/api/v1/schedule/sessions/:id', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const cancelled = await withRlsContext(request, async (client) => {
        const { rowCount } = await client.query(
          "DELETE FROM public.live_sessions WHERE id = $1 AND status = 'scheduled'",
          [Number(id)],
        )

        if (rowCount === 0) {
          await client.query("UPDATE public.live_sessions SET status = 'cancelled' WHERE id = $1", [Number(id)])
          await writeAuditLog(client, {
            actorUserId: (request as any).user?.id,
            action: 'schedule.cancel',
            resourceType: 'live_session',
            resourceId: id,
            request,
          })
          return true
        }

        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'schedule.delete',
          resourceType: 'live_session',
          resourceId: id,
          request,
        })
        return false
      })

      if (cancelled) return sendOk(reply, { cancelled: true }, '场次已标记为已取消')
      return sendOk(reply, { deleted: true }, '排班已删除')
    } catch (err: any) {
      request.log.error(err, 'Failed to delete schedule session')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/schedule/apply-recommendation ── 一键将 AI 排班建议应用为指定日期的排班
  app.post('/api/v1/schedule/apply-recommendation', { preHandler: [requireRole(SCHEDULE_WRITE_ROLES)] }, async (request, reply) => {
    const { targetDate, roomId = 1, projectId, scheduleItems } = request.body as any

    if (!targetDate || !Array.isArray(scheduleItems) || scheduleItems.length === 0) {
      return sendError(reply, 400, '缺少必填字段: targetDate 或 scheduleItems')
    }

    try {
      const timeSlotMap: Record<string, { start: string; end: string }> = {
        morning: { start: '07:00:00', end: '10:30:00' },
        noon: { start: '11:30:00', end: '14:30:00' },
        prime: { start: '19:00:00', end: '23:30:00' },
        late_night: { start: '23:30:00', end: '02:00:00' },
      }

      const createdSessions = await withRlsContext(request, async (client, scope) => {
        const roomRes = await client.query('SELECT platform_code FROM public.live_rooms WHERE id = $1', [roomId])
        const roomPlatform = roomRes.rows[0]?.platform_code || 'douyin'
        if (effectivePlatforms(roomPlatform, scope.allowedPlatforms)?.length === 0) {
          return { forbidden: true as const }
        }
        const list: any[] = []
        for (const item of scheduleItems) {
          const slotTimes = timeSlotMap[item.slotKey] || { start: '19:00:00', end: '23:00:00' }
          const leadAnchorId = item.leadAnchor?.id
          if (!leadAnchorId) continue

          const title = `AI排班 · ${item.slotName.split(' ')[0]}`

          // 获取直播间归属平台
          const roomRes = await client.query('SELECT platform_code FROM public.live_rooms WHERE id = $1', [roomId])
          const roomPlatform = roomRes.rows[0]?.platform_code || 'douyin'

          const res = await client.query(
            `
            INSERT INTO public.live_sessions (
              title, date, start_time, end_time, room_id, anchor_id, project_id,
              platform_code, remark, status, duration_min
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled', 210)
            RETURNING id, title, date, start_time, end_time, anchor_id
            `,
            [
              title,
              targetDate,
              slotTimes.start,
              slotTimes.end,
              roomId,
              leadAnchorId,
              projectId || null,
              roomPlatform,
              `AI智能推导排班：${item.aiReason || ''}`,
            ],
          )
          list.push(res.rows[0])
        }

        await writeAuditLog(client, {
          actorUserId: (request as any).user?.id,
          action: 'schedule.apply_recommendation',
          resourceType: 'live_session',
          afterData: { targetDate, createdCount: list.length },
          request,
        })
        return list
      })

      if (!Array.isArray(createdSessions)) return sendError(reply, 403, '无权访问该平台数据')
      return sendOk(reply, { createdCount: createdSessions.length, sessions: createdSessions }, 'AI排班建议已成功转化为正式排班计划！')
    } catch (err: any) {
      request.log.error(err, 'Failed to apply recommendation')
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/schedule/my ── 当前主播个人排班行程日历
  app.get('/api/v1/schedule/my', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as any).user

    try {
      const outcome = await withRlsContext(request, async (client, scope) => {
        const eff = effectivePlatforms(undefined, scope.allowedPlatforms)
        let anchorId = user?.anchorId
        if (!anchorId) {
          const findAnchor = await client.query(
            'SELECT id, name FROM public.anchors WHERE user_id = $1 OR name = $2 LIMIT 1',
            [user?.id, user?.realName || user?.username],
          )
          if (findAnchor.rows.length > 0) {
            anchorId = findAnchor.rows[0].id
          }
        }

        if (!anchorId) {
          return { anchorId: null, sessions: [], empty: true }
        }

        const params: any[] = [anchorId]
        if (eff !== null) params.push(eff)
        const sql = `
          SELECT
            s.id,
            s.title,
            s.date::text AS "date",
            s.start_time::text AS "startTime",
            s.end_time::text AS "endTime",
            s.status,
            s.room_id AS "roomId",
            r.name AS "roomName",
            s.project_id AS "projectId",
            NULL::text AS "projectName",
            NULL::text AS "brandName",
            s.gmv::float AS "gmv",
            s.orders::int AS "orders",
            s.duration_min AS "durationMin",
            s.remark
          FROM public.live_sessions s
          LEFT JOIN public.live_rooms r ON s.room_id = r.id
          WHERE s.anchor_id = $1
          ${eff !== null ? 'AND s.platform_code = ANY($2::text[])' : ''}
          ORDER BY s.date DESC, s.start_time ASC
          LIMIT 30
        `
        const { rows } = await client.query(sql, params)
        return { anchorId, sessions: rows, empty: false }
      })

      if (outcome.empty) {
        return sendOk(reply, {
          anchorId: null,
          sessions: [],
          message: '当前登录账号未绑定主播档案，无个人排班数据',
        })
      }

      return sendOk(reply, {
        anchorId: outcome.anchorId,
        sessions: outcome.sessions,
      })
    } catch (err: any) {
      return sendError(reply, 500, err.message)
    }
  })

  // ── GET /api/v1/schedule/recommendations ── AI 智能排班建议
  app.get('/api/v1/schedule/recommendations', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const anchorQuery = `
        SELECT
          a.id,
          a.name,
          a.level,
          COALESCE(c.overall, 80) AS "capabilityScore",
          COALESCE(SUM(s.gmv), 0)::float AS "historicalGmv",
          COALESCE(AVG(s.gmv), 0)::float AS "avgSessionGmv",
          COUNT(s.id)::int AS "sessionCount"
        FROM public.anchors a
        LEFT JOIN LATERAL (
          SELECT overall FROM public.anchor_capabilities
          WHERE anchor_id = a.id
          ORDER BY evaluated_at DESC, id DESC LIMIT 1
        ) c ON true
        LEFT JOIN public.live_sessions s ON a.id = s.anchor_id
        WHERE a.status = 1
        GROUP BY a.id, a.name, a.level, c.overall
        ORDER BY "historicalGmv" DESC
      `
      const [anchorRes, slotRes] = await withRlsContext(request, (client, scope) => {
        const eff = effectivePlatforms(undefined, scope.allowedPlatforms)
        const anchorSql = anchorQuery.replace(
          'WHERE a.status = 1',
          `WHERE a.status = 1${eff !== null ? ' AND a.platform = ANY($1::text[])' : ''}`,
        )
        return Promise.all([
          client.query(anchorSql, eff !== null ? [eff] : []),
          client.query(`
            SELECT
              s.anchor_id,
              CASE
                WHEN s.start_time >= '06:00:00' AND s.start_time < '11:00:00' THEN 'morning'
                WHEN s.start_time >= '11:00:00' AND s.start_time < '15:00:00' THEN 'noon'
                WHEN s.start_time >= '18:00:00' AND s.start_time < '23:30:00' THEN 'prime'
                ELSE 'late_night'
              END AS slot_key,
              COUNT(s.id)::int AS slot_sessions,
              COALESCE(AVG(s.gmv), 0)::float AS slot_avg_gmv,
              COALESCE(MAX(s.gmv), 0)::float AS slot_max_gmv,
              COALESCE(AVG(s.online_peak), 0)::int AS slot_avg_peak
            FROM public.live_sessions s
            WHERE s.anchor_id IS NOT NULL AND s.gmv > 0
              ${eff !== null ? 'AND s.platform_code = ANY($1::text[])' : ''}
            GROUP BY s.anchor_id, slot_key
          `, eff !== null ? [eff] : []),
        ])
      })

      const anchors = anchorRes.rows
      if (anchors.length === 0) {
        return sendOk(reply, {
          schedule: [],
          strategy: '暂无活跃主播数据，请先录入主播档案',
        })
      }

      const slotStatsMap = new Map<string, { sessions: number; avgGmv: number; maxGmv: number; avgPeak: number }>()
      for (const row of slotRes.rows) {
        slotStatsMap.set(`${row.anchor_id}:${row.slot_key}`, {
          sessions: row.slot_sessions,
          avgGmv: Number(row.slot_avg_gmv),
          maxGmv: Number(row.slot_max_gmv),
          avgPeak: Number(row.slot_avg_peak),
        })
      }

      const slots = [
        {
          slotKey: 'morning',
          slotName: '早间清醒场 (07:00 - 10:30)',
          trafficWeight: 0.65,
          requiredTrait: '亲和力强、语速沉稳、适合高客单日用/保暖',
        },
        {
          slotKey: 'noon',
          slotName: '午间白领冲锋场 (11:30 - 14:30)',
          trafficWeight: 0.85,
          requiredTrait: '节奏紧凑、快打快切、适合短平快服饰',
        },
        {
          slotKey: 'prime',
          slotName: '晚间巅峰大促场 (19:00 - 23:30)',
          trafficWeight: 1.0,
          requiredTrait: '全盘气场、压单爆发力、高转化带货一号位',
        },
        {
          slotKey: 'late_night',
          slotName: '深夜长尾捡漏场 (23:30 - 02:00)',
          trafficWeight: 0.55,
          requiredTrait: '陪伴互动、低压力聊天促单、尾货福利',
        },
      ]

      const assignedLeadIds = new Set<number>()

      const schedule = slots.map((slot) => {
        // 计算全员在此 slot 下的实测聚合产出与综合评分
        const ranked = anchors.map((a) => {
          const key = `${a.id}:${slot.slotKey}`
          const stat = slotStatsMap.get(key)
          const hasHistory = Boolean(stat && stat.sessions > 0)
          const slotGmv = hasHistory ? stat!.avgGmv : (a.avgSessionGmv * slot.trafficWeight)
          // 综合分：历史该时段产出 (70%) + 综合能力模型 (30%)
          const score = (slotGmv * 0.7) + (Number(a.capabilityScore) * 100 * 0.3)
          return {
            anchor: a,
            score,
            hasHistory,
            stat: stat || { sessions: 0, avgGmv: Math.round(slotGmv), maxGmv: Math.round(slotGmv), avgPeak: 0 },
          }
        }).sort((x, y) => y.score - x.score)

        // 优先挑选本时段综合排名最高且未在前序时段担任主打的主播
        let leadChoice = ranked.find((r) => !assignedLeadIds.has(r.anchor.id))
        if (!leadChoice) leadChoice = ranked[0]
        assignedLeadIds.add(leadChoice.anchor.id)

        // 副播挑选互补主播（非同一人）
        const supportChoice = ranked.find((r) => r.anchor.id !== leadChoice!.anchor.id) || ranked[0]

        const lead = leadChoice.anchor
        const support = supportChoice.anchor
        const stat = leadChoice.stat

        // 真实预测 GMV：基于该主播在该时段真实历史均值（无硬编码假数据兜底）
        const expectedGmv = Math.round(stat.avgGmv > 0 ? stat.avgGmv : (lead.avgSessionGmv * slot.trafficWeight))
        const rankInSlot = ranked.findIndex((r) => r.anchor.id === lead.id) + 1

        const evidence = {
          slotSessions: stat.sessions,
          slotAvgGmv: Math.round(stat.avgGmv),
          slotMaxGmv: Math.round(stat.maxGmv),
          overallAvgGmv: Math.round(lead.avgSessionGmv),
          capabilityScore: lead.capabilityScore,
          rankInSlot,
          timeSlotRange: slot.slotName,
          dataSource: leadChoice.hasHistory ? 'historical_session_aggregate' : 'overall_capability_weighted',
        }

        const aiReason = leadChoice.hasHistory
          ? `基于历史 ${stat.sessions} 场「${slot.slotName}」真实开播数据，${lead.name}在同时段平均 GMV 达 ¥${Math.round(stat.avgGmv).toLocaleString()}（排名第 ${rankInSlot}），综合能力分 ${lead.capabilityScore}，为该时段最优首发主播`
          : `根据综合能力模型（${lead.capabilityScore}分）与历史场均 GMV ¥${Math.round(lead.avgSessionGmv).toLocaleString()}，${lead.name}与「${slot.slotName}」风格画像（${slot.requiredTrait}）契合度最高`

        return {
          slotKey: slot.slotKey,
          slotName: slot.slotName,
          trait: slot.requiredTrait,
          leadAnchor: {
            id: lead.id,
            name: lead.name,
            score: lead.capabilityScore,
            historicalGmv: lead.historicalGmv,
          },
          supportAnchor: {
            id: support.id,
            name: support.name,
            score: support.capabilityScore,
          },
          expectedGmv,
          evidence,
          aiReason,
        }
      })

      return sendOk(reply, {
        platform: 'douyin',
        shopId: 1,
        generatedAt: new Date().toISOString(),
        strategy: 'AI 根据主播历史时段带货峰值、真实场均 GMV 与综合能力评级推导出最优排班矩阵',
        schedule,
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to generate schedule recommendations')
      return sendError(reply, 500, err.message)
    }
  })
}
