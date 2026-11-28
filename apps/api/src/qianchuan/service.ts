/**
 * qianchuan/service.ts — W12 千川数据同步与预算审批
 *
 * 原则：
 *   1. 报表数据落 fact_ad_spend_daily，按 (tenant, platform, shop, biz_date, ad_tool) 幂等 upsert；
 *   2. 未配置千川凭证时只允许人工导入，不伪造 API 拉取；
 *   3. 预算变更属 R3：只生成申请单，审批通过后才写 ad_plan，绝不直接改远端。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { loadIntegrationCredential } from '../integrations/credentials.js'
import { recordIntegrationCall } from '../integrations/call-log.js'

export interface AdSpendRow {
  bizDate: string
  platformCode: string
  /** 0 表示未指定，落库前会解析为该平台默认店铺 */
  shopId: number
  adToolCode: string
  adSpend: number
  impressions: number
  clicks: number
  attributedOrders: number
  attributedGmv: number
  netGmv: number
}

export interface SyncResult {
  runId: string
  source: 'manual' | 'api'
  rowCount: number
  inserted: number
  updated: number
  status: 'succeeded' | 'failed' | 'partial'
  error?: string
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

/** 默认结算周期（天）：该表 estimated_settle_date 为 NOT NULL，需按周期推算 */
const SETTLEMENT_CYCLE_DAYS = 7

/** 校验并规范化一行报表数据 */
export function normalizeAdSpendRow(raw: Record<string, unknown>): AdSpendRow | null {
  const bizDate = String(raw.bizDate || raw.biz_date || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bizDate)) return null
  const platformCode = String(raw.platformCode || raw.platform_code || 'douyin').slice(0, 32)
  const adToolCode = String(raw.adToolCode || raw.ad_tool_code || 'qianchuan').slice(0, 32)
  const shopRaw = raw.shopId ?? raw.shop_id
  const parsedShop = shopRaw === undefined || shopRaw === null || shopRaw === '' ? 0 : Number(shopRaw)

  return {
    bizDate,
    platformCode,
    // 0 = 全店汇总；该列 NOT NULL，禁止传 null
    shopId: Number.isFinite(parsedShop) && parsedShop > 0 ? parsedShop : 0,
    adToolCode,
    adSpend: toNumber(raw.adSpend ?? raw.ad_spend),
    impressions: Math.round(toNumber(raw.impressions)),
    clicks: Math.round(toNumber(raw.clicks)),
    attributedOrders: Math.round(toNumber(raw.attributedOrders ?? raw.attributed_orders)),
    attributedGmv: toNumber(raw.attributedGmv ?? raw.attributed_gross_gmv),
    netGmv: toNumber(raw.netGmv ?? raw.net_gmv),
  }
}

/**
 * 解析店铺：显式 shopId 优先；否则取该平台第一个店铺。
 * fact_ad_spend_daily.shop_id 有外键约束，必须指向真实店铺。
 */
async function resolveShopId(
  executor: DbExecutor,
  tenantId: number,
  platformCode: string,
  shopId: number
): Promise<number | null> {
  if (shopId > 0) {
    const { rows } = await executor.query<{ id: number }>(
      `SELECT id FROM public.dim_shop WHERE id = $1 LIMIT 1`,
      [shopId]
    )
    return rows[0] ? Number(rows[0].id) : null
  }
  const { rows } = await executor.query<{ id: number }>(
    `SELECT id FROM public.dim_shop
      WHERE platform_code = $1
      ORDER BY id ASC LIMIT 1`,
    [platformCode]
  )
  return rows[0] ? Number(rows[0].id) : null
}

/** 幂等写入报表：同键更新，不存在则插入 */
export async function upsertAdSpendRows(
  tenantId: number,
  rows: AdSpendRow[],
  db?: DbExecutor,
  options: { isDemo?: boolean } = {}
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const executor = db || getPool()
  const isDemo = options.isDemo === true
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const row of rows) {
    const shopId = await resolveShopId(executor, tenantId, row.platformCode, row.shopId)
    if (shopId === null) {
      // 平台下无店铺，无法满足外键约束，跳过并计入 skipped
      skipped += 1
      continue
    }

    const existing = await executor.query<{ id: string }>(
      `SELECT id FROM public.fact_ad_spend_daily
        WHERE tenant_id = $1 AND platform_code = $2
          AND shop_id = $3
          AND biz_date = $4 AND ad_tool_code = $5
        LIMIT 1`,
      [tenantId, row.platformCode, shopId, row.bizDate, row.adToolCode]
    )

    if (existing.rows[0]) {
      await executor.query(
        `UPDATE public.fact_ad_spend_daily
            SET ad_spend = $2, impressions = $3, clicks = $4,
                attributed_orders = $5, attributed_gross_gmv = $6, net_gmv = $7,
                updated_at = now()
          WHERE id = $1`,
        [existing.rows[0].id, row.adSpend, row.impressions, row.clicks, row.attributedOrders, row.attributedGmv, row.netGmv]
      )
      updated += 1
    } else {
      await executor.query(
        `INSERT INTO public.fact_ad_spend_daily
           (tenant_id, platform_code, shop_id, biz_date, ad_tool_code, ad_spend,
            impressions, clicks, attributed_orders, attributed_gross_gmv, net_gmv,
            settlement_cycle_days, estimated_settle_date, is_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $4::date + $12::int, $13)`,
        [
          tenantId,
          row.platformCode,
          shopId,
          row.bizDate,
          row.adToolCode,
          row.adSpend,
          row.impressions,
          row.clicks,
          row.attributedOrders,
          row.attributedGmv,
          row.netGmv,
          SETTLEMENT_CYCLE_DAYS,
          isDemo,
        ]
      )
      inserted += 1
    }
  }

  return { inserted, updated, skipped }
}

export interface ManualSyncInput {
  tenantId: number
  rows: Array<Record<string, unknown>>
  userId?: number | null
  db?: DbExecutor
}

/** 人工导入报表（CSV 解析后的行数组） */
export async function syncManualAdSpend(input: ManualSyncInput): Promise<SyncResult> {
  const executor = input.db || getPool()
  const normalized: AdSpendRow[] = []
  let invalid = 0
  for (const raw of input.rows) {
    const row = normalizeAdSpendRow(raw)
    if (row) normalized.push(row)
    else invalid += 1
  }

  const dates = normalized.map((row) => row.bizDate).sort()
  const { rows: runRows } = await executor.query<{ id: string }>(
    `INSERT INTO public.qianchuan_sync_runs
       (tenant_id, source, biz_date_from, biz_date_to, row_count, status, detail, created_by)
     VALUES ($1, 'manual', $2, $3, $4, 'succeeded', $5::jsonb, $6)
     RETURNING id`,
    [
      input.tenantId,
      dates[0] || null,
      dates[dates.length - 1] || null,
      normalized.length,
      JSON.stringify({ invalidRows: invalid }),
      input.userId ?? null,
    ]
  )
  const runId = runRows[0].id

  try {
    const { inserted, updated, skipped } = await upsertAdSpendRows(input.tenantId, normalized, executor)
    const status = normalized.length === 0 ? 'failed' : (invalid > 0 || skipped > 0) ? 'partial' : 'succeeded'
    const notes: string[] = []
    if (invalid > 0) notes.push(`${invalid} 行格式不合法已跳过`)
    if (skipped > 0) notes.push(`${skipped} 行因平台无可用店铺已跳过`)
    await executor.query(
      `UPDATE public.qianchuan_sync_runs
          SET inserted_count = $2, updated_count = $3, status = $4,
              error = $5
        WHERE id = $1`,
      [runId, inserted, updated, status, notes.join('；')]
    )
    return {
      runId,
      source: 'manual',
      rowCount: normalized.length,
      inserted,
      updated,
      status,
      error: notes.length > 0 ? notes.join('；') : undefined,
    }
  } catch (err) {
    const message = (err as Error)?.message || String(err)
    await executor.query(
      `UPDATE public.qianchuan_sync_runs SET status = 'failed', error = $2 WHERE id = $1`,
      [runId, message.slice(0, 1000)]
    )
    return { runId, source: 'manual', rowCount: normalized.length, inserted: 0, updated: 0, status: 'failed', error: message }
  }
}

/**
 * API 拉取：未配置凭证或接口未实现时返回明确原因，由调用方提示改走人工导入。
 */
export async function syncFromQianchuanApi(input: {
  tenantId: number
  bizDateFrom: string
  bizDateTo: string
  userId?: number | null
  db?: DbExecutor
}): Promise<SyncResult> {
  const executor = input.db || getPool()
  const credential = await loadIntegrationCredential(executor, input.tenantId, 'qianchuan')

  const { rows: runRows } = await executor.query<{ id: string }>(
    `INSERT INTO public.qianchuan_sync_runs
       (tenant_id, source, biz_date_from, biz_date_to, row_count, status, error, created_by)
     VALUES ($1, 'api', $2, $3, 0, 'failed', $4, $5)
     RETURNING id`,
    [
      input.tenantId,
      input.bizDateFrom,
      input.bizDateTo,
      credential ? '千川报表 API 尚未实现，请使用人工导入' : '未配置千川凭证，请先在集成中心配置或使用人工导入',
      input.userId ?? null,
    ]
  )

  await recordIntegrationCall({
    db: executor,
    tenantId: input.tenantId,
    platform: 'qianchuan',
    operation: 'ad.report.get',
    method: 'INTERNAL',
    requestSummary: { bizDateFrom: input.bizDateFrom, bizDateTo: input.bizDateTo },
    responseSummary: { implemented: false, hasCredential: Boolean(credential) },
    status: 'skipped',
    errorCode: credential ? 'CAPABILITY_NOT_IMPLEMENTED' : 'CREDENTIAL_MISSING',
    actorUserId: input.userId ?? null,
  })

  return {
    runId: runRows[0].id,
    source: 'api',
    rowCount: 0,
    inserted: 0,
    updated: 0,
    status: 'failed',
    error: credential ? '千川报表 API 尚未实现，请使用人工导入' : '未配置千川凭证',
  }
}

export interface BudgetRequestInput {
  tenantId: number
  planId: number
  requestedBudget: number
  reason?: string
  userId?: number | null
  db?: DbExecutor
}

/** 创建预算变更申请（R3，不直接改远端） */
export async function createBudgetRequest(input: BudgetRequestInput) {
  const executor = input.db || getPool()
  const { rows: planRows } = await executor.query<{ planned_budget: string; plan_name: string }>(
    `SELECT planned_budget, plan_name FROM public.ad_plan
      WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.planId]
  )
  const plan = planRows[0]
  if (!plan) throw new Error('投放计划不存在')

  const currentBudget = Number(plan.planned_budget) || 0
  const requested = Number(input.requestedBudget)
  if (!Number.isFinite(requested) || requested <= 0) throw new Error('申请预算必须大于 0')
  if (requested === currentBudget) throw new Error('申请预算与当前预算相同')

  const { rows } = await executor.query<any>(
    `INSERT INTO public.qianchuan_budget_requests
       (tenant_id, plan_id, current_budget, requested_budget, reason, status, created_by)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING *`,
    [input.tenantId, input.planId, currentBudget, requested, String(input.reason || '').slice(0, 500), input.userId ?? null]
  )
  return {
    id: rows[0].id,
    planId: Number(rows[0].plan_id),
    planName: plan.plan_name,
    currentBudget,
    requestedBudget: requested,
    status: rows[0].status,
    reason: rows[0].reason,
    createdAt: new Date(rows[0].created_at).toISOString(),
  }
}

export interface ReviewBudgetInput {
  tenantId: number
  requestId: string
  decision: 'approve' | 'reject'
  note?: string
  userId?: number | null
  db?: DbExecutor
}

/**
 * 审批预算申请：
 *   - approve：写 ad_plan.planned_budget 并标记 applied（本地生效，远端仍需人工同步）；
 *   - reject：仅记录。
 */
export async function reviewBudgetRequest(input: ReviewBudgetInput) {
  const executor = input.db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT * FROM public.qianchuan_budget_requests
      WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [input.tenantId, input.requestId]
  )
  const request = rows[0]
  if (!request) throw new Error('预算申请不存在')
  if (request.status !== 'pending') throw new Error('该申请已处理')

  if (input.decision === 'reject') {
    await executor.query(
      `UPDATE public.qianchuan_budget_requests
          SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), review_note = $3
        WHERE id = $1`,
      [request.id, input.userId ?? null, String(input.note || '').slice(0, 500)]
    )
    return { id: request.id, status: 'rejected', appliedBudget: null }
  }

  await executor.query(
    `UPDATE public.ad_plan
        SET planned_budget = $2, updated_at = now()
      WHERE tenant_id = $1 AND id = $3`,
    [input.tenantId, request.requested_budget, request.plan_id]
  )
  await executor.query(
    `UPDATE public.qianchuan_budget_requests
        SET status = 'applied', reviewed_by = $2, reviewed_at = now(),
            review_note = $3, applied_at = now()
      WHERE id = $1`,
    [request.id, input.userId ?? null, String(input.note || '').slice(0, 500)]
  )

  return {
    id: request.id,
    status: 'applied',
    appliedBudget: Number(request.requested_budget),
    note: '本地计划预算已更新；远端千川需人工同步',
  }
}

export async function listBudgetRequests(tenantId: number, db?: DbExecutor) {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT r.id, r.plan_id, r.current_budget, r.requested_budget, r.reason, r.status,
            r.review_note, r.created_at, p.plan_name
       FROM public.qianchuan_budget_requests r
       LEFT JOIN public.ad_plan p ON p.id = r.plan_id
      WHERE r.tenant_id = $1
      ORDER BY r.created_at DESC
      LIMIT 50`,
    [tenantId]
  )
  return rows.map((row) => ({
    id: row.id,
    planId: Number(row.plan_id),
    planName: row.plan_name || '',
    currentBudget: Number(row.current_budget) || 0,
    requestedBudget: Number(row.requested_budget) || 0,
    reason: row.reason,
    status: row.status,
    reviewNote: row.review_note,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

export async function listSyncRuns(tenantId: number, db?: DbExecutor) {
  const executor = db || getPool()
  const { rows } = await executor.query<any>(
    `SELECT id, source, biz_date_from, biz_date_to, row_count, inserted_count,
            updated_count, status, error, created_at
       FROM public.qianchuan_sync_runs
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 30`,
    [tenantId]
  )
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    bizDateFrom: row.biz_date_from,
    bizDateTo: row.biz_date_to,
    rowCount: Number(row.row_count) || 0,
    inserted: Number(row.inserted_count) || 0,
    updated: Number(row.updated_count) || 0,
    status: row.status,
    error: row.error,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

/** 投放概览：按日期聚合消耗与 ROI；默认排除演示数据 */
export async function adSpendOverview(
  tenantId: number,
  options: { days?: number; includeDemo?: boolean; platformCodes?: string[] | null } = {},
  db?: DbExecutor
) {
  const executor = db || getPool()
  const days = Math.min(90, Math.max(1, options.days || 7))
  const demoClause = options.includeDemo ? '' : ' AND is_demo = false'
  const params: unknown[] = [tenantId, days]
  let platformClause = ''
  if (options.platformCodes !== undefined && options.platformCodes !== null) {
    params.push(options.platformCodes)
    platformClause = ` AND platform_code = ANY($${params.length}::text[])`
  }
  const { rows } = await executor.query<any>(
    `SELECT biz_date,
            sum(ad_spend) AS spend,
            sum(attributed_gross_gmv) AS gmv,
            sum(attributed_orders) AS orders,
            sum(impressions) AS impressions,
            sum(clicks) AS clicks
       FROM public.fact_ad_spend_daily
      WHERE tenant_id = $1 AND biz_date >= current_date - ($2::int - 1)${demoClause}${platformClause}
      GROUP BY biz_date
      ORDER BY biz_date DESC`,
    params
  )
  const items = rows.map((row) => {
    const spend = Number(row.spend) || 0
    const gmv = Number(row.gmv) || 0
    return {
      bizDate: row.biz_date,
      spend,
      gmv,
      orders: Number(row.orders) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
      roi: spend > 0 ? Number((gmv / spend).toFixed(4)) : 0,
    }
  })
  const totalSpend = items.reduce((sum, item) => sum + item.spend, 0)
  const totalGmv = items.reduce((sum, item) => sum + item.gmv, 0)
  return {
    items,
    totalSpend: Number(totalSpend.toFixed(2)),
    totalGmv: Number(totalGmv.toFixed(2)),
    overallRoi: totalSpend > 0 ? Number((totalGmv / totalSpend).toFixed(4)) : 0,
  }
}