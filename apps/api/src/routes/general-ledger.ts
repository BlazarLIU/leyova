import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

const GL_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']

export async function generalLedgerRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/finance/accounting-subjects ── 获取会计科目字典
  app.get('/api/v1/finance/accounting-subjects', { preHandler: [requireAuth] }, async (request, reply) => {
    try {
      const rows = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT account_code, account_name, category, direction, description, is_active
           FROM public.dim_accounting_subject
           WHERE is_active = true
           ORDER BY account_code ASC`,
        )
        return res.rows
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch accounting subjects')
      return sendError(reply, 500, '获取会计科目字典失败')
    }
  })

  // ── GET /api/v1/finance/gl-vouchers ── 查询会计总账凭证列表
  app.get<{
    Querystring: {
      from?: string
      to?: string
      period?: string
      shopId?: string
      platform?: string
      sessionId?: string
      voucherType?: string
      status?: string
      limit?: string
      offset?: string
    }
  }>('/api/v1/finance/gl-vouchers', { preHandler: [requireAuth] }, async (request, reply) => {
    const { from, to, period, shopId, platform, sessionId, voucherType, status, limit, offset } = request.query || {}
    try {
      const result = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conditions: string[] = ['1=1']

        if (from) {
          params.push(from)
          conditions.push(`v.biz_date >= $${params.length}::date`)
        }
        if (to) {
          params.push(to)
          conditions.push(`v.biz_date <= $${params.length}::date`)
        }
        if (period) {
          params.push(period)
          conditions.push(`v.period = $${params.length}`)
        }
        if (shopId) {
          params.push(Number(shopId))
          conditions.push(`v.shop_id = $${params.length}`)
        }
        if (platform) {
          params.push(platform)
          conditions.push(`v.platform_code = $${params.length}`)
        }
        if (sessionId) {
          params.push(Number(sessionId))
          conditions.push(`v.session_id = $${params.length}`)
        }
        if (voucherType) {
          params.push(voucherType)
          conditions.push(`v.voucher_type = $${params.length}`)
        }
        if (status) {
          params.push(status)
          conditions.push(`v.status = $${params.length}`)
        }

        const countRes = await client.query(
          `SELECT COUNT(*)::int AS total FROM public.fact_gl_voucher v WHERE ${conditions.join(' AND ')}`,
          params,
        )

        const take = Math.min(Number(limit) || 20, 100)
        const skip = Math.max(Number(offset) || 0, 0)
        params.push(take, skip)

        const listRes = await client.query(
          `SELECT v.id, v.voucher_no, v.biz_date, v.period, v.voucher_type,
                  v.shop_id, s.shop_name, v.platform_code, p.platform_name,
                  v.session_id, ls.title AS session_title,
                  v.ref_type, v.ref_id, v.total_debit, v.total_credit,
                  v.is_balanced, v.status, v.created_by, v.posted_at, v.summary,
                  v.created_at
           FROM public.fact_gl_voucher v
           LEFT JOIN public.dim_shop s ON s.id = v.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = v.platform_code
           LEFT JOIN public.live_sessions ls ON ls.id = v.session_id
           WHERE ${conditions.join(' AND ')}
           ORDER BY v.biz_date DESC, v.id DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        )

        return {
          total: Number(countRes.rows[0]?.total || 0),
          items: listRes.rows.map((r) => ({
            id: Number(r.id),
            voucherNo: r.voucher_no,
            bizDate: r.biz_date,
            period: r.period,
            voucherType: r.voucher_type,
            shopId: r.shop_id ? Number(r.shop_id) : null,
            shopName: r.shop_name || '',
            platformCode: r.platform_code || '',
            platformName: r.platform_name || '',
            sessionId: r.session_id ? Number(r.session_id) : null,
            sessionTitle: r.session_title || '',
            refType: r.ref_type,
            refId: r.ref_id,
            totalDebit: Number(r.total_debit),
            totalCredit: Number(r.total_credit),
            isBalanced: Boolean(r.is_balanced),
            status: r.status,
            createdBy: r.created_by,
            postedAt: r.posted_at,
            summary: r.summary,
            createdAt: r.created_at,
          })),
        }
      })

      return sendOk(reply, result)
    } catch (err) {
      request.log.error({ err }, 'Failed to list GL vouchers')
      return sendError(reply, 500, '获取会计总账凭证列表失败')
    }
  })

  // ── GET /api/v1/finance/gl-vouchers/:id ── 查询单张会计凭证与全部借贷分录明细
  app.get<{ Params: { id: string } }>('/api/v1/finance/gl-vouchers/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const voucherId = Number(request.params.id)
    if (!voucherId) {
      return sendError(reply, 400, '无效的凭证 ID')
    }

    try {
      const data = await withRlsContext(request, async (client) => {
        const vRes = await client.query(
          `SELECT v.*, s.shop_name, p.platform_name, ls.title AS session_title
           FROM public.fact_gl_voucher v
           LEFT JOIN public.dim_shop s ON s.id = v.shop_id
           LEFT JOIN public.system_platform_configs p ON p.platform_code = v.platform_code
           LEFT JOIN public.live_sessions ls ON ls.id = v.session_id
           WHERE v.id = $1`,
          [voucherId],
        )
        if (vRes.rows.length === 0) return null
        const v = vRes.rows[0]

        const eRes = await client.query(
          `SELECT e.*, sub.account_name, sub.category AS subject_category
           FROM public.fact_gl_entry e
           JOIN public.dim_accounting_subject sub ON sub.account_code = e.account_code
           WHERE e.voucher_id = $1
           ORDER BY e.line_no ASC`,
          [voucherId],
        )

        return {
          id: Number(v.id),
          voucherNo: v.voucher_no,
          bizDate: v.biz_date,
          period: v.period,
          voucherType: v.voucher_type,
          shopId: v.shop_id ? Number(v.shop_id) : null,
          shopName: v.shop_name || '',
          platformCode: v.platform_code || '',
          platformName: v.platform_name || '',
          sessionId: v.session_id ? Number(v.session_id) : null,
          sessionTitle: v.session_title || '',
          refType: v.ref_type,
          refId: v.ref_id,
          totalDebit: Number(v.total_debit),
          totalCredit: Number(v.total_credit),
          isBalanced: Boolean(v.is_balanced),
          status: v.status,
          createdBy: v.created_by,
          postedAt: v.posted_at,
          summary: v.summary,
          entries: eRes.rows.map((e) => ({
            id: Number(e.id),
            lineNo: Number(e.line_no),
            accountCode: e.account_code,
            accountName: e.account_name,
            subjectCategory: e.subject_category,
            direction: e.direction,
            debitAmount: Number(e.debit_amount),
            creditAmount: Number(e.credit_amount),
            remark: e.remark,
          })),
        }
      })

      if (!data) {
        return sendError(reply, 404, '会计凭证不存在')
      }
      return sendOk(reply, data)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch GL voucher detail')
      return sendError(reply, 500, '获取会计凭证详情失败')
    }
  })

  // ── POST /api/v1/finance/gl-vouchers ── 手动录入或系统生成复式记账总账凭证
  app.post<{
    Body: {
      voucherNo?: string
      bizDate: string
      period?: string
      voucherType: 'session_settle' | 'ad_spend' | 'order_revenue' | 'inventory_cogs' | 'refund_loss' | 'logistics_fee' | 'commission_fee' | 'manual_adjust'
      shopId?: number
      platformCode?: string
      sessionId?: number
      refType?: string
      refId?: string
      summary: string
      entries: Array<{
        accountCode: string
        direction: 'debit' | 'credit'
        amount: number
        remark?: string
      }>
    }
  }>('/api/v1/finance/gl-vouchers', { preHandler: [requireRole(GL_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body
    if (!b?.bizDate || !b?.voucherType || !Array.isArray(b?.entries) || b.entries.length < 2) {
      return sendError(reply, 400, '必须提供凭证日期、凭证类型以及至少两笔复式记账借贷分录')
    }

    let totalDebit = 0
    let totalCredit = 0
    for (const e of b.entries) {
      const amt = Number(e.amount)
      if (isNaN(amt) || amt <= 0) {
        return sendError(reply, 400, `分录金额必须大于 0: ${e.accountCode}`)
      }
      if (e.direction === 'debit') {
        totalDebit += amt
      } else if (e.direction === 'credit') {
        totalCredit += amt
      } else {
        return sendError(reply, 400, `分录借贷方向必须为 debit 或 credit: ${e.direction}`)
      }
    }

    // 校验复式平衡：SUM(debit) == SUM(credit)
    const diff = Math.abs(totalDebit - totalCredit)
    if (diff > 0.005) {
      return sendError(reply, 400, `凭证借贷不平衡: 借方 ¥${totalDebit.toFixed(2)} != 贷方 ¥${totalCredit.toFixed(2)} (差额 ¥${diff.toFixed(2)})`)
    }

    const period = b.period || b.bizDate.slice(0, 7)
    const voucherNo = b.voucherNo?.trim() || `VOU-${period.replace('-', '')}-${Date.now().toString().slice(-6)}`
    const user = (request as any).user

    try {
      const voucher = await withRlsContext(request, async (client) => {
        // 校验科目合法性
        const codes = Array.from(new Set(b.entries.map((e) => e.accountCode)))
        const subRes = await client.query(
          `SELECT account_code FROM public.dim_accounting_subject WHERE account_code = ANY($1)`,
          [codes],
        )
        const validCodes = new Set(subRes.rows.map((r) => r.account_code))
        for (const c of codes) {
          if (!validCodes.has(c)) {
            throw new Error(`会计科目不存在: ${c}`)
          }
        }

        const vRes = await client.query(
          `INSERT INTO public.fact_gl_voucher (
             voucher_no, biz_date, period, voucher_type, shop_id, platform_code, session_id,
             ref_type, ref_id, total_debit, total_credit, is_balanced, status, created_by, summary
           ) VALUES (
             $1, $2::date, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, true, 'posted', $12, $13
           ) RETURNING *`,
          [
            voucherNo,
            b.bizDate,
            period,
            b.voucherType,
            b.shopId || null,
            b.platformCode || null,
            b.sessionId || null,
            b.refType || '',
            b.refId || '',
            totalDebit,
            totalCredit,
            user?.name || user?.username || 'system',
            b.summary || '',
          ],
        )
        const v = vRes.rows[0]

        for (let i = 0; i < b.entries.length; i++) {
          const e = b.entries[i]
          const debitAmt = e.direction === 'debit' ? Number(e.amount) : 0
          const creditAmt = e.direction === 'credit' ? Number(e.amount) : 0
          await client.query(
            `INSERT INTO public.fact_gl_entry (
               voucher_id, voucher_no, line_no, account_code, direction,
               debit_amount, credit_amount, shop_id, platform_code, session_id, remark
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10, $11
             )`,
            [
              v.id,
              voucherNo,
              i + 1,
              e.accountCode,
              e.direction,
              debitAmt,
              creditAmt,
              b.shopId || null,
              b.platformCode || null,
              b.sessionId || null,
              e.remark || '',
            ],
          )
        }

        return v
      })

      return sendOk(reply, voucher)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to create GL voucher')
      return sendError(reply, 500, err?.message || '创建总账凭证失败')
    }
  })

  // ── GET /api/v1/finance/sessions/:sessionId/voucher-chain ── 单场直播真实盈亏可追溯凭证链 (Master Plan §5.2 #11)
  app.get<{ Params: { sessionId: string } }>(
    '/api/v1/finance/sessions/:sessionId/voucher-chain',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const sessionId = Number(request.params.sessionId)
      if (!sessionId) {
        return sendError(reply, 400, '无效的场次 ID')
      }

      try {
        const result = await withRlsContext(request, async (client) => {
          // 查找该场次基本信息
          const sRes = await client.query(
            `SELECT id, title, date, platform_code, gmv, ad_cost, return_amount
             FROM public.live_sessions
             WHERE id = $1`,
            [sessionId],
          )
          if (sRes.rows.length === 0) return null
          const session = sRes.rows[0]

          // 查找直接关联该场次的全部总账凭证
          const vRes = await client.query(
            `SELECT v.id, v.voucher_no, v.biz_date, v.voucher_type, v.total_debit, v.total_credit,
                    v.is_balanced, v.summary, v.posted_at
             FROM public.fact_gl_voucher v
             WHERE v.session_id = $1 OR (v.ref_type = 'live_session' AND v.ref_id = $1::text)
             ORDER BY v.id ASC`,
            [sessionId],
          )

          // 查找全部关联借贷明细
          const eRes = await client.query(
            `SELECT e.id, e.voucher_id, e.voucher_no, e.line_no, e.account_code, sub.account_name,
                    sub.category AS subject_category, e.direction, e.debit_amount, e.credit_amount, e.remark
             FROM public.fact_gl_entry e
             JOIN public.dim_accounting_subject sub ON sub.account_code = e.account_code
             WHERE e.session_id = $1 OR e.voucher_id = ANY(
               SELECT id FROM public.fact_gl_voucher WHERE session_id = $1 OR (ref_type = 'live_session' AND ref_id = $1::text)
             )
             ORDER BY e.voucher_id ASC, e.line_no ASC`,
            [sessionId],
          )

          let revenue = 0
          let cogs = 0
          let adSpend = 0
          let commission = 0
          let logistics = 0
          let otherLoss = 0

          for (const e of eRes.rows) {
            const debit = Number(e.debit_amount)
            const credit = Number(e.credit_amount)
            if (e.account_code === '5001') revenue += credit
            else if (e.account_code === '5401') cogs += debit
            else if (e.account_code === '5601') adSpend += debit
            else if (e.account_code === '5602') commission += debit
            else if (e.account_code === '5603') logistics += debit
            else if (e.account_code === '6051') otherLoss += debit
          }

          const hasChain = vRes.rows.length > 0
          const netProfit = hasChain
            ? Number((revenue - cogs - adSpend - commission - logistics - otherLoss).toFixed(2))
            : null

          return {
            session: {
              id: session.id,
              title: session.title,
              date: session.date,
              platformCode: session.platform_code,
              nominalGmv: Number(session.gmv),
              nominalAdCost: Number(session.ad_cost),
              nominalReturnAmount: Number(session.return_amount),
            },
            hasVoucherChain: hasChain,
            vouchers: vRes.rows.map((v) => ({
              id: Number(v.id),
              voucherNo: v.voucher_no,
              bizDate: v.biz_date,
              voucherType: v.voucher_type,
              totalDebit: Number(v.total_debit),
              totalCredit: Number(v.total_credit),
              isBalanced: Boolean(v.is_balanced),
              summary: v.summary,
              postedAt: v.posted_at,
            })),
            entries: eRes.rows.map((e) => ({
              id: Number(e.id),
              voucherId: Number(e.voucher_id),
              voucherNo: e.voucher_no,
              lineNo: Number(e.line_no),
              accountCode: e.account_code,
              accountName: e.account_name,
              subjectCategory: e.subject_category,
              direction: e.direction,
              debitAmount: Number(e.debit_amount),
              creditAmount: Number(e.credit_amount),
              remark: e.remark,
            })),
            reconciliation: hasChain
              ? {
                  verifiedRevenue: revenue,
                  verifiedCogs: cogs,
                  verifiedAdSpend: adSpend,
                  verifiedCommission: commission,
                  verifiedLogistics: logistics,
                  verifiedOtherLoss: otherLoss,
                  reconciledNetProfit: netProfit,
                  isFullyBalanced: vRes.rows.every((v) => v.is_balanced),
                }
              : null,
          }
        })

        if (!result) {
          return sendError(reply, 404, '直播场次不存在')
        }
        return sendOk(reply, result)
      } catch (err) {
        request.log.error({ err }, 'Failed to trace session voucher chain')
        return sendError(reply, 500, '查询单场真实净利凭证链失败')
      }
    },
  )

  // ── GET /api/v1/finance/trial-balance ── 会计期间试算平衡表（全账套借贷核算）
  app.get<{
    Querystring: { period?: string; shopId?: string; platform?: string }
  }>('/api/v1/finance/trial-balance', { preHandler: [requireAuth] }, async (request, reply) => {
    const { period, shopId, platform } = request.query || {}
    try {
      const data = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conditions: string[] = ['1=1']

        if (period) {
          params.push(period)
          conditions.push(`v.period = $${params.length}`)
        }
        if (shopId) {
          params.push(Number(shopId))
          conditions.push(`v.shop_id = $${params.length}`)
        }
        if (platform) {
          params.push(platform)
          conditions.push(`v.platform_code = $${params.length}`)
        }

        const res = await client.query(
          `SELECT sub.account_code, sub.account_name, sub.category, sub.direction,
                  COALESCE(SUM(e.debit_amount), 0)::numeric(18,2) AS total_debit,
                  COALESCE(SUM(e.credit_amount), 0)::numeric(18,2) AS total_credit
           FROM public.dim_accounting_subject sub
           LEFT JOIN public.fact_gl_entry e ON e.account_code = sub.account_code
           LEFT JOIN public.fact_gl_voucher v ON v.id = e.voucher_id AND ${conditions.join(' AND ')}
           GROUP BY sub.account_code, sub.account_name, sub.category, sub.direction
           ORDER BY sub.account_code ASC`,
          params,
        )

        let overallDebit = 0
        let overallCredit = 0
        const rows = res.rows.map((r) => {
          const d = Number(r.total_debit)
          const c = Number(r.total_credit)
          overallDebit += d
          overallCredit += c
          return {
            accountCode: r.account_code,
            accountName: r.account_name,
            category: r.category,
            direction: r.direction,
            totalDebit: d,
            totalCredit: c,
            netBalance: r.direction === 'debit' ? d - c : c - d,
          }
        })

        const isBalanced = Math.abs(overallDebit - overallCredit) < 0.01

        return {
          period: period || 'ALL',
          overallDebit: Number(overallDebit.toFixed(2)),
          overallCredit: Number(overallCredit.toFixed(2)),
          isBalanced,
          trialDiff: Number(Math.abs(overallDebit - overallCredit).toFixed(2)),
          accounts: rows,
        }
      })

      return sendOk(reply, data)
    } catch (err) {
      request.log.error({ err }, 'Failed to compute trial balance')
      return sendError(reply, 500, '计算会计期间试算平衡表失败')
    }
  })
}
