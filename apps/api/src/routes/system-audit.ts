import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext } from '../lib/db.js'
import { canManageTargetUser, requireAuth, requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'

/**
 * system 域拆分（P2-1）：审计日志 + 异步任务队列
 * 原属 routes/system.ts，2026-11-17 拆出。
 */
export async function systemAuditRoutes(app: FastifyInstance) {
  // ── GET /api/v1/system/audit-logs ── 安全审计日志查询
  app.get('/api/v1/system/audit-logs', { preHandler: [requireRole(['super_admin', 'admin'])] }, async (request, reply) => {
    try {
      const q = request.query as {
        page?: string
        pageSize?: string
        action?: string
        resourceType?: string
        actorUserId?: string
        from?: string
        to?: string
      }
      const page = Math.max(1, parseInt(q.page || '1', 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '30', 10) || 30))
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (q.action) {
        conditions.push(`al.action ILIKE $${idx++}`)
        params.push(`%${q.action.trim()}%`)
      }
      if (q.resourceType) {
        conditions.push(`al.resource_type = $${idx++}`)
        params.push(q.resourceType.trim())
      }
      if (q.actorUserId) {
        conditions.push(`al.actor_user_id = $${idx++}`)
        params.push(parseInt(q.actorUserId, 10))
      }
      if (q.from) {
        conditions.push(`al.created_at >= $${idx++}::timestamptz`)
        params.push(q.from)
      }
      if (q.to) {
        conditions.push(`al.created_at <= $${idx++}::timestamptz`)
        params.push(q.to)
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const data = await withRlsContext(request, async (client) => {
        const countRes = await client.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM public.audit_logs al ${whereSql}`,
          params
        )
        const listRes = await client.query(
          `SELECT
             al.id::text AS id,
             al.actor_user_id AS "actorUserId",
             u.username AS "actorUsername",
             u.real_name AS "actorRealName",
             u.role AS "actorRole",
             al.action,
             al.resource_type AS "resourceType",
             al.resource_id AS "resourceId",
             al.before_data AS "beforeData",
             al.after_data AS "afterData",
             al.ip_address AS "ipAddress",
             al.user_agent AS "userAgent",
             al.created_at::text AS "createdAt"
           FROM public.audit_logs al
           LEFT JOIN public.users u ON u.id = al.actor_user_id
           ${whereSql}
           ORDER BY al.created_at DESC, al.id DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageSize, offset]
        )
        return {
          total: countRes.rows[0]?.total ?? 0,
          items: listRes.rows,
          page,
          pageSize,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'system/audit-logs query failed')
      return sendError(reply, 500, '获取审计日志失败')
    }
  })

  // ── GET /api/v1/system/jobs ── 异步任务队列列表
  app.get('/api/v1/system/jobs', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const q = (request.query || {}) as {
        status?: string
        jobType?: string
        search?: string
        page?: string
        pageSize?: string
      }
      const page = Math.max(1, parseInt(q.page || '1', 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '20', 10) || 20))
      const offset = (page - 1) * pageSize

      const conditions: string[] = []
      const params: any[] = []
      let idx = 1

      if (q.status) {
        conditions.push(`status = $${idx++}`)
        params.push(q.status)
      }
      if (q.jobType) {
        conditions.push(`job_type = $${idx++}`)
        params.push(q.jobType)
      }
      if (q.search) {
        conditions.push(`(job_name ILIKE $${idx} OR job_type ILIKE $${idx})`)
        params.push(`%${q.search}%`)
        idx++
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const data = await withRlsContext(request, async (client) => {
        const countRes = await client.query<{ total: number }>(
          `SELECT COUNT(*)::int AS total FROM public.system_jobs ${whereSql}`,
          params
        )
        const listRes = await client.query(
          `SELECT
             id::text,
             job_type AS "jobType",
             job_name AS "jobName",
             status,
             input_payload AS "inputPayload",
             result_payload AS "resultPayload",
             error_message AS "errorMessage",
             run_at AS "runAt",
             started_at AS "startedAt",
             finished_at AS "finishedAt",
             created_at AS "createdAt",
             ROUND(EXTRACT(EPOCH FROM (COALESCE(finished_at, NOW()) - started_at)) * 1000) AS "durationMs"
           FROM public.system_jobs
           ${whereSql}
           ORDER BY id DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageSize, offset]
        )
        return {
          total: countRes.rows[0]?.total ?? 0,
          items: listRes.rows,
          page,
          pageSize,
        }
      })

      return sendOk(reply, data)
    } catch (err: any) {
      request.log.error({ err }, 'system/jobs query failed')
      return sendError(reply, 500, '获取异步任务队列失败')
    }
  })

  // ── POST /api/v1/system/jobs ── 派发异步任务进队
  app.post(
    '/api/v1/system/jobs',
    { preHandler: [requireRole(['super_admin', 'admin', 'ops_director', 'operator'])] },
    async (request, reply) => {
      try {
        const user = request.user!
        const body = (request.body || {}) as {
          jobType?: string
          jobName?: string
          inputPayload?: any
          runAt?: string
        }

        const jobType = (body.jobType || '').trim()
        if (!jobType) return sendError(reply, 400, '任务类型 (jobType) 不能为空')
        const jobName = (body.jobName || '').trim() || jobType

        const data = await withRlsContext(request, async (client) => {
          const insertRes = await client.query(
            `INSERT INTO public.system_jobs (job_type, job_name, input_payload, status, run_at, created_at, updated_at)
             VALUES ($1, $2, $3::jsonb, 'pending', $4, NOW(), NOW())
             RETURNING id::text, job_type AS "jobType", job_name AS "jobName", status, created_at AS "createdAt"`,
            [jobType, jobName, JSON.stringify(body.inputPayload || {}), body.runAt || null]
          )
          const created = insertRes.rows[0]
          await writeAuditLog(client, {
            request,
            action: 'CREATE_SYSTEM_JOB',
            resourceType: 'system_jobs',
            resourceId: created.id,
            afterData: created,
          })
          return created
        })

        return sendOk(reply, data)
      } catch (err: any) {
        request.log.error({ err }, 'system/jobs create failed')
        return sendError(reply, 500, '创建异步任务失败')
      }
    }
  )

  // ── GET /api/v1/system/jobs/:id ── 查询单个异步任务详情
  app.get<{ Params: { id: string } }>(
    '/api/v1/system/jobs/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      try {
        const jobId = Number(request.params.id)
        if (!jobId) return sendError(reply, 400, '无效的任务 ID')

        const data = await withRlsContext(request, async (client) => {
          const res = await client.query(
            `SELECT
               id::text,
               job_type AS "jobType",
               job_name AS "jobName",
               status,
               input_payload AS "inputPayload",
               result_payload AS "resultPayload",
               error_message AS "errorMessage",
               run_at AS "runAt",
               started_at AS "startedAt",
               finished_at AS "finishedAt",
               created_at AS "createdAt",
               updated_at AS "updatedAt",
               ROUND(EXTRACT(EPOCH FROM (COALESCE(finished_at, NOW()) - started_at)) * 1000) AS "durationMs"
             FROM public.system_jobs
             WHERE id = $1`,
            [jobId]
          )
          return res.rows[0] || null
        })

        if (!data) return sendError(reply, 404, '任务不存在')
        return sendOk(reply, data)
      } catch (err: any) {
        request.log.error({ err }, 'system/jobs/:id query failed')
        return sendError(reply, 500, '查询任务详情失败')
      }
    }
  )

  // ── POST /api/v1/system/jobs/:id/cancel ── 取消待执行任务
  app.post<{ Params: { id: string } }>(
    '/api/v1/system/jobs/:id/cancel',
    { preHandler: [requireRole(['super_admin', 'admin', 'ops_director'])] },
    async (request, reply) => {
      try {
        const user = request.user!
        const jobId = Number(request.params.id)
        if (!jobId) return sendError(reply, 400, '无效的任务 ID')

        const updated = await withRlsContext(request, async (client) => {
          const res = await client.query(
            `UPDATE public.system_jobs
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING id::text, job_type AS "jobType", status`,
            [jobId]
          )
          const record = res.rows[0] || null
          if (record) {
            await writeAuditLog(client, {
              request,
              action: 'CANCEL_SYSTEM_JOB',
              resourceType: 'system_jobs',
              resourceId: String(jobId),
              afterData: record,
            })
          }
          return record
        })

        if (!updated) {
          return sendError(reply, 400, '任务无法取消 (可能已在执行或已结束)')
        }

        return sendOk(reply, updated)
      } catch (err: any) {
        request.log.error({ err }, 'system/jobs/:id/cancel failed')
        return sendError(reply, 500, '取消任务失败')
      }
    }
  )
}
