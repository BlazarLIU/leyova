import type { Pool } from 'pg'

export interface BusinessLiveSummaryParams {
  date?: string
  roomId?: number
}

export interface BusinessLiveSummary {
  scopeLabel: string
  sessionCount: number
  roomCount: number
  totalGmv: number
  totalViews: number
  totalOrders: number
  avgOrderValue: number
  avgInteractionRate: number
  avgWatchSeconds: number
  avgOnline: number
  peakOnline: number
  totalDurationMin: number
  totalRefundAmount: number
  totalRefundOrders: number
  totalNewFollowers: number
  totalDealUsers: number
  totalProductClicks: number
  avgConversionRate: number
  avgGpm: number
}

export function extractBusinessDate(message: string): string | null {
  const trimmed = message.trim()
  const full = trimmed.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (full) {
    const [, year, month, day] = full
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const partial = trimmed.match(/(?<!\d)(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (partial) {
    const year = new Date().getFullYear()
    const [, month, day] = partial
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const iso = trimmed.match(/(20\d{2}-\d{1,2}-\d{1,2})/)
  if (iso) {
    const [y, m, d] = iso[1].split('-')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

export async function queryBusinessLiveSummary(
  pool: Pool,
  params: BusinessLiveSummaryParams
): Promise<BusinessLiveSummary | null> {
  const conditions: string[] = []
  const values: unknown[] = []
  let idx = 1

  if (params.date) {
    conditions.push(`b.business_date = $${idx++}::date`)
    values.push(params.date)
  }
  if (params.roomId) {
    conditions.push(`b.room_id = $${idx++}`)
    values.push(params.roomId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await pool.query(
    `SELECT
       COALESCE(COUNT(*), 0)::int AS session_count,
       COALESCE(COUNT(DISTINCT b.room_id), 0)::int AS room_count,
       COALESCE(SUM(b.payment_amount), 0)::float8 AS total_gmv,
       COALESCE(SUM(o.viewers), 0)::float8 AS total_views,
       COALESCE(SUM(o.product_click_users), 0)::float8 AS total_orders,
       COALESCE(AVG(b.gpm), 0)::float8 AS avg_gpm,
       COALESCE(AVG(o.conversion_rate), 0)::float8 AS avg_conversion_rate,
       COALESCE(AVG(o.interaction_rate), 0)::float8 AS avg_interaction_rate,
       COALESCE(AVG(o.avg_watch_seconds), 0)::float8 AS avg_watch_seconds,
       COALESCE(AVG(o.avg_online), 0)::float8 AS avg_online,
       COALESCE(MAX(o.peak_online), 0)::float8 AS peak_online,
       COALESCE(SUM(b.live_duration_min), 0)::float8 AS total_duration_min,
       COALESCE(SUM(o.refund_amount), 0)::float8 AS total_refund_amount,
       COALESCE(SUM(o.refund_orders), 0)::float8 AS total_refund_orders,
       COALESCE(SUM(o.new_followers), 0)::float8 AS total_new_followers,
       COALESCE(SUM(o.deal_users), 0)::float8 AS total_deal_users,
       COALESCE(SUM(o.product_click_users), 0)::float8 AS total_product_clicks,
       COALESCE(AVG(o.avg_order_value), 0)::float8 AS avg_order_value
     FROM session_live_basic_info b
     LEFT JOIN session_overview_metrics o
       ON o.business_date = b.business_date
      AND o.room_id = b.room_id
     ${where}`,
    values
  )

  const row = rows[0]
  if (!row) return null

  const scopeLabel = params.date
    ? `${params.date}${params.roomId ? `（room ${params.roomId}）` : ''}`
    : params.roomId
      ? `room ${params.roomId}`
      : '全部业务直播'

  return {
    scopeLabel,
    sessionCount: Number(row.session_count) || 0,
    roomCount: Number(row.room_count) || 0,
    totalGmv: Number(row.total_gmv) || 0,
    totalViews: Number(row.total_views) || 0,
    totalOrders: Number(row.total_orders) || 0,
    avgOrderValue: Number(row.avg_order_value) || 0,
    avgInteractionRate: Number(row.avg_interaction_rate) || 0,
    avgWatchSeconds: Number(row.avg_watch_seconds) || 0,
    avgOnline: Number(row.avg_online) || 0,
    peakOnline: Number(row.peak_online) || 0,
    totalDurationMin: Number(row.total_duration_min) || 0,
    totalRefundAmount: Number(row.total_refund_amount) || 0,
    totalRefundOrders: Number(row.total_refund_orders) || 0,
    totalNewFollowers: Number(row.total_new_followers) || 0,
    totalDealUsers: Number(row.total_deal_users) || 0,
    totalProductClicks: Number(row.total_product_clicks) || 0,
    avgConversionRate: Number(row.avg_conversion_rate) || 0,
    avgGpm: Number(row.avg_gpm) || 0,
  }
}

export function formatBusinessLiveSummary(summary: BusinessLiveSummary): string {
  return [
    `**📊 业务直播数据概览 · ${summary.scopeLabel}**`,
    '',
    `- 直播场次：${summary.sessionCount} 场`,
    `- 覆盖直播间：${summary.roomCount} 个`,
    `- 总 GMV：¥${(summary.totalGmv / 10000).toFixed(2)}万`,
    `- 总观看：${summary.totalViews.toLocaleString()}`,
    `- 总订单：${Math.round(summary.totalOrders)} 单`,
    `- 平均互动率：${(summary.avgInteractionRate * 100).toFixed(2)}%`,
    `- 平均观看时长：${summary.avgWatchSeconds.toFixed(0)} 秒`,
    `- 平均在线：${summary.avgOnline.toFixed(0)}`,
    `- 峰值在线：${summary.peakOnline.toFixed(0)}`,
    `- 直播总时长：${summary.totalDurationMin.toFixed(0)} 分钟`,
    `- 新增粉丝：${Math.round(summary.totalNewFollowers)} 人`,
    `- 成交用户：${Math.round(summary.totalDealUsers)} 人`,
    `- 点击人数：${Math.round(summary.totalProductClicks)} 人`,
    `- 平均 GPM：¥${summary.avgGpm.toFixed(2)}`,
    `- 平均客单价：¥${summary.avgOrderValue.toFixed(2)}`,
    `- 总退款金额：¥${summary.totalRefundAmount.toFixed(2)}`,
    `- 退款订单：${Math.round(summary.totalRefundOrders)} 单`,
    '',
    '> 数据边界：仅统计业务直播数据（session_live_basic_info / session_overview_metrics），不包含直播管理分组数据。',
  ].join('\n')
}
