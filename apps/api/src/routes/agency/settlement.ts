import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../../lib/db.js'
import { sendOk, sendError } from '../../lib/http.js'
import { requireRole } from '../../lib/guard.js'
import { writeAuditLog } from '../../lib/audit.js'

export async function agencySettlementRoutes(app: FastifyInstance) {
  // ── GET /api/v1/agency/settlement/bills ── 获取对账单列表
  app.get('/api/v1/agency/settlement/bills', { preHandler: [requireRole(['super_admin', 'admin', 'finance', 'ops_director'])] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const { projectId, periodMonth, status } = request.query as any

    try {
      const conditions: string[] = ['b.tenant_id = $1']
      const params: any[] = [tenantId]
      let pIdx = 2

      if (projectId) {
        conditions.push(`b.project_id = $${pIdx++}`)
        params.push(Number(projectId))
      }
      if (periodMonth) {
        conditions.push(`b.period_month = $${pIdx++}`)
        params.push(periodMonth)
      }
      if (status) {
        conditions.push(`b.status = $${pIdx++}`)
        params.push(status)
      }

      const querySql = `
        SELECT 
          b.id,
          b.project_id AS "projectId",
          p.name AS "projectName",
          c.name AS "clientName",
          c.brand_name AS "brandName",
          b.period_month AS "periodMonth",
          b.total_gmv::float AS "totalGmv",
          b.flat_fee::float AS "flatFee",
          b.commission_amount::float AS "commissionAmount",
          b.slot_fee_total::float AS "slotFeeTotal",
          b.anchor_commission::float AS "anchorCommission",
          b.deduction_total::float AS "deductionTotal",
          b.total_payable::float AS "totalPayable",
          b.status,
          b.pdf_url AS "pdfUrl",
          b.sent_at AS "sentAt",
          b.confirmed_at AS "confirmedAt",
          b.paid_at AS "paidAt",
          b.created_at AS "createdAt"
        FROM public.agency_settlement_bills b
        JOIN public.agency_projects p ON b.project_id = p.id
        JOIN public.agency_clients c ON p.client_id = c.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY b.period_month DESC, b.id DESC
      `
      const { rows } = await withRlsContext(request, (client) => client.query(querySql, params))
      return sendOk(reply, rows)
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch settlement bills')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/agency/settlement/calculate ── 预览计算月度对账单
  app.post('/api/v1/agency/settlement/calculate', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const { projectId, periodMonth } = request.body as { projectId: number; periodMonth: string }

    if (!projectId || !periodMonth) {
      return sendError(reply, 400, 'projectId 与 periodMonth 为必填')
    }

    try {
      const calcResult = await withRlsContext(request, async (client) => {
        // 1. 获取项目信息
        const projectRes = await client.query(
          'SELECT * FROM public.agency_projects WHERE id = $1 AND tenant_id = $2',
          [projectId, tenantId]
        )
        if (projectRes.rows.length === 0) {
          return { notFound: true as const }
        }
        const project = projectRes.rows[0]

        // 2. 统计该月直播场次 GMV
        const startDate = `${periodMonth}-01`
        const sessionRes = await client.query(
          `
          SELECT 
            COUNT(*)::int AS "sessionCount",
            COALESCE(SUM(gmv), 0)::float AS "totalGmv"
          FROM public.live_sessions
          WHERE project_id = $1 
            AND date >= $2::date 
            AND date < ($2::date + interval '1 month')
          `,
          [projectId, startDate]
        )
        const totalGmv = sessionRes.rows[0]?.totalGmv || 0

        // 3. 统计该月坑位费与代垫费用
        const feeRes = await client.query(
          `
          SELECT 
            COALESCE(SUM(CASE WHEN fee_type = 'slot' THEN amount ELSE 0 END), 0)::float AS "slotFee",
            COALESCE(SUM(CASE WHEN fee_type = 'ad_pass_through' THEN amount ELSE 0 END), 0)::float AS "adPassThrough",
            COALESCE(SUM(CASE WHEN fee_type = 'penalty' THEN amount ELSE 0 END), 0)::float AS "penalty"
          FROM public.agency_slot_fees
          WHERE project_id = $1 AND tenant_id = $2
            AND biz_date >= $3::date 
            AND biz_date < ($3::date + interval '1 month')
          `,
          [projectId, tenantId, startDate]
        )
        const slotFee = feeRes.rows[0]?.slotFee || 0
        const adPassThrough = feeRes.rows[0]?.adPassThrough || 0
        const penalty = feeRes.rows[0]?.penalty || 0

        // 4. 计算固定服务费
        const flatFee = project.billing_model === 'monthly_flat' || project.billing_model === 'hybrid'
          ? Number(project.flat_fee || 0)
          : 0

        // 5. 计算 GMV 阶梯佣金
        let commissionAmount = 0
        const commissionTiers = project.commission_tiers || []
        if (commissionTiers.length > 0) {
          for (const tier of commissionTiers) {
            const min = tier.gmv_min || 0
            const max = tier.gmv_max || Infinity
            const rate = tier.rate || 0
            if (totalGmv > min) {
              const taxable = Math.min(totalGmv, max) - min
              commissionAmount += taxable * rate
            }
          }
        } else if (project.billing_model === 'gmv_commission' || project.billing_model === 'hybrid') {
          commissionAmount = totalGmv * 0.03 // 默认 3% 佣金
        }

        // 应收总计
        const totalPayable = flatFee + commissionAmount + slotFee + adPassThrough - penalty

        return {
          data: {
            projectId,
            periodMonth,
            projectName: project.name,
            billingModel: project.billing_model,
            totalGmv,
            sessionCount: sessionRes.rows[0]?.sessionCount || 0,
            flatFee,
            commissionAmount: Number(commissionAmount.toFixed(2)),
            slotFeeTotal: slotFee + adPassThrough,
            deductionTotal: penalty,
            totalPayable: Number(totalPayable.toFixed(2)),
          },
        }
      })

      if ('notFound' in calcResult && calcResult.notFound) {
        return sendError(reply, 404, '项目不存在或无权限')
      }
      return sendOk(reply, calcResult.data)
    } catch (err: any) {
      request.log.error(err, 'Failed to calculate settlement bill')
      return sendError(reply, 500, err.message)
    }
  })

  // ── POST /api/v1/agency/settlement/bills ── 生成并保存对账单
  app.post('/api/v1/agency/settlement/bills', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const {
      projectId,
      periodMonth,
      totalGmv = 0,
      flatFee = 0,
      commissionAmount = 0,
      slotFeeTotal = 0,
      anchorCommission = 0,
      deductionTotal = 0,
      totalPayable = 0,
      items = [],
    } = request.body as any

    if (!projectId || !periodMonth) {
      return sendError(reply, 400, 'projectId 与 periodMonth 为必填')
    }

    try {
      const outcome = await withRlsContext(request, async (client) => {
        // 检查项目归属当前租户
        const projRes = await client.query(
          'SELECT id FROM public.agency_projects WHERE id = $1 AND tenant_id = $2',
          [projectId, tenantId]
        )
        if (projRes.rows.length === 0) {
          return { status: 404 as const, message: '项目不存在或无权限' }
        }

        // 检查是否已存在该月的已发送/已确认账单 (IMMUTABLE 保护)
        const existing = await client.query(
          'SELECT id, status FROM public.agency_settlement_bills WHERE project_id = $1 AND period_month = $2',
          [projectId, periodMonth]
        )
        if (existing.rows.length > 0 && ['sent', 'confirmed', 'paid'].includes(existing.rows[0].status)) {
          return {
            status: 403 as const,
            message: `该月对账单已处于 ${existing.rows[0].status} 状态，已锁定禁止重写`,
          }
        }

        // 插入或更新账单头
        const billRes = await client.query(
          `
          INSERT INTO public.agency_settlement_bills (
            tenant_id, project_id, period_month, total_gmv, flat_fee,
            commission_amount, slot_fee_total, anchor_commission, deduction_total, total_payable,
            status, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11)
          ON CONFLICT (project_id, period_month)
          DO UPDATE SET 
            total_gmv = EXCLUDED.total_gmv,
            flat_fee = EXCLUDED.flat_fee,
            commission_amount = EXCLUDED.commission_amount,
            slot_fee_total = EXCLUDED.slot_fee_total,
            anchor_commission = EXCLUDED.anchor_commission,
            deduction_total = EXCLUDED.deduction_total,
            total_payable = EXCLUDED.total_payable,
            updated_at = NOW()
          RETURNING *
          `,
          [
            tenantId,
            projectId,
            periodMonth,
            totalGmv,
            flatFee,
            commissionAmount,
            slotFeeTotal,
            anchorCommission,
            deductionTotal,
            totalPayable,
            user?.id || null,
          ]
        )
        const bill = billRes.rows[0]

        // 刷新明细行
        await client.query('DELETE FROM public.agency_settlement_items WHERE bill_id = $1', [bill.id])

        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            await client.query(
              `
              INSERT INTO public.agency_settlement_items (
                tenant_id, bill_id, item_type, description, amount, ref_session_id, ref_date
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              `,
              [
                tenantId,
                bill.id,
                item.itemType,
                item.description || null,
                item.amount,
                item.refSessionId || null,
                item.refDate || null,
              ]
            )
          }
        }

        await writeAuditLog(client, {
          request,
          action: existing.rows.length > 0 ? 'agency.settlement.bill.update' : 'agency.settlement.bill.create',
          resourceType: 'agency_settlement_bills',
          resourceId: bill.id,
          beforeData: existing.rows[0] ?? null,
          afterData: bill,
        })

        return { status: 200 as const, bill }
      })

      if (outcome.status !== 200) {
        return sendError(reply, outcome.status, outcome.message)
      }
      return sendOk(reply, outcome.bill, '对账单创建成功')
    } catch (err: any) {
      request.log.error(err, 'Failed to save settlement bill')
      return sendError(reply, 500, err.message)
    }
  })

  // ── PUT /api/v1/agency/settlement/bills/:id/status ── 推进账单状态机
  app.put('/api/v1/agency/settlement/bills/:id/status', { preHandler: [requireRole(['super_admin', 'admin', 'finance'])] }, async (request, reply) => {
    const user = (request as any).user
    const tenantId = user?.tenantId || 1
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }

    const validStatuses = ['draft', 'review', 'sent', 'confirmed', 'paid']
    if (!validStatuses.includes(status)) {
      return sendError(reply, 400, `无效的状态值: ${status}`)
    }

    try {
      const outcome = await withRlsContext(request, async (client) => {
        const billRes = await client.query(
          'SELECT id, status FROM public.agency_settlement_bills WHERE id = $1 AND tenant_id = $2',
          [Number(id), tenantId]
        )
        if (billRes.rows.length === 0) {
          return { status: 404 as const, message: '对账单不存在' }
        }
        const curStatus = billRes.rows[0].status

        // 规则：一旦确认 sent 之后，不能退回 draft 或 review
        if (['sent', 'confirmed', 'paid'].includes(curStatus) && ['draft', 'review'].includes(status)) {
          return { status: 403 as const, message: '已发送或已确认的对账单不可回退状态' }
        }

        const updates: string[] = ['status = $1', 'updated_at = NOW()']
        const params: any[] = [status, Number(id), tenantId]

        if (status === 'sent') {
          updates.push('sent_at = NOW()')
        } else if (status === 'confirmed') {
          updates.push('confirmed_at = NOW()')
        } else if (status === 'paid') {
          updates.push('paid_at = NOW()')
        }

        const updateSql = `
          UPDATE public.agency_settlement_bills 
          SET ${updates.join(', ')}
          WHERE id = $2 AND tenant_id = $3
          RETURNING *
        `
        const { rows } = await client.query(updateSql, params)
        await writeAuditLog(client, {
          request,
          action: 'agency.settlement.bill.status',
          resourceType: 'agency_settlement_bills',
          resourceId: id,
          beforeData: { status: curStatus },
          afterData: rows[0],
        })
        return { status: 200 as const, row: rows[0] }
      })

      if (outcome.status !== 200) {
        return sendError(reply, outcome.status, outcome.message)
      }
      return sendOk(reply, outcome.row, `账单状态已变更为: ${status}`)
    } catch (err: any) {
      request.log.error(err, 'Failed to update bill status')
      return sendError(reply, 500, err.message)
    }
  })
}

