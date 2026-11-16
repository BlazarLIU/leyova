/**
 * wechat-analytics.ts — 视频号（微信小店）专属分析服务
 *
 * 视频号与其他 5 个平台的本质差异：
 *   1. **公私域混合度最高**：视频号推荐（公域）+ 朋友点赞（社交裂变，视频号独有）
 *      + 社群/朋友圈/公众号（私域）。抖快以公域为主，视频号的社交裂变占比是关键指标。
 *   2. **全域带货者**：微信小店带货者可在视频号/公众号/社群/朋友圈全域带货，
 *      只统计直播占比会低估真实体量。
 *   3. **单一实付口径**：无抖快式多口径分层。
 *   4. **T+30 结算**：微信小店结算周期显著长于其他平台（天猫 7 / 淘宝 10 / 小红书 15）。
 *
 * 数据来源：
 *   - session_channel_metrics（场次 × 渠道，含 platform_code）
 *   - fact_trade_daily（含 source_code，可归因到具体渠道）
 *   - fact_settlement_cycles（平台费/结算）
 */

import type { DbExecutor } from '../lib/audit.js'

/** 渠道归类：公域 / 私域 / 社交裂变 */
export type WechatChannelBucket = 'public' | 'private' | 'social'

/**
 * 视频号渠道 → 三桶归类
 * 注意：与 dimension 字典保持一致（dim_traffic_source）
 */
export function classifyWechatChannel(channel: string): WechatChannelBucket {
  const c = (channel || '').toLowerCase()

  // ⚠️ 顺序很重要：「朋友圈」含「朋友」二字，若先判 social 会被误归类。
  //    朋友圈是**商家私域分发**（发给自己的好友圈），不是熟人被动推荐，
  //    因此必须先判 private。

  // 私域：社群 / 朋友圈 / 公众号
  if (c.includes('社群') || c.includes('朋友圈') || c.includes('公众号') || c.includes('私域')) return 'private'
  // 社交裂变：视频号独有 —— 朋友点赞/分享带来的被动推荐流量
  if (c.includes('朋友') || c.includes('点赞') || c.includes('分享') || c.includes('社交')) return 'social'
  // 公域（视频号推荐/直播广场/发现页）
  return 'public'
}

export interface WechatBucketSummary {
  gmv: number
  views: number
  orders: number
  sessions: number
  channels: string[]
  gmvPct: number
  viewPct: number
}

export interface WechatChannelRow {
  channel: string
  bucket: WechatChannelBucket
  sessions: number
  impressions: number
  views: number
  productClicks: number
  orders: number
  gmv: number
  newFans: number
  avgWatchSec: number
}

/**
 * 视频号公私域拆分（场次级渠道聚合）
 */
export async function getWechatPrivatePublicSplit(
  from: string,
  to: string,
  client: DbExecutor,
  shopId?: number,
): Promise<{
  range: { from: string; to: string }
  summary: {
    totalGmv: number
    totalViews: number
    publicGmvPct: number
    privateGmvPct: number
    socialGmvPct: number
    publicViewPct: number
    privateViewPct: number
    socialViewPct: number
  }
  buckets: { public: WechatBucketSummary; private: WechatBucketSummary; social: WechatBucketSummary }
  channels: WechatChannelRow[]
}> {
  const params: any[] = [from, to]
  let shopCond = ''
  if (shopId && Number.isFinite(shopId)) {
    params.push(shopId)
    shopCond = ` AND shop_id = $${params.length}`
  }

  const res = await client.query(
    `SELECT channel,
            COUNT(DISTINCT session_id)::int                   AS sessions,
            COALESCE(SUM(impressions), 0)::bigint             AS impressions,
            COALESCE(SUM(views), 0)::bigint                   AS views,
            COALESCE(SUM(product_clicks), 0)::bigint          AS product_clicks,
            COALESCE(SUM(orders), 0)::bigint                  AS orders,
            COALESCE(SUM(gmv), 0)::numeric(14,2)              AS gmv,
            COALESCE(SUM(new_fans), 0)::int                   AS new_fans,
            COALESCE(ROUND(AVG(avg_watch_sec)), 0)::int       AS avg_watch_sec
       FROM public.session_channel_metrics
      WHERE platform_code = 'wechat'
        AND period_date BETWEEN $1::date AND $2::date${shopCond}
      GROUP BY channel
      ORDER BY gmv DESC`,
    params,
  )

  const channels: WechatChannelRow[] = res.rows.map((r: any) => ({
    channel: r.channel || '(未命名)',
    bucket: classifyWechatChannel(r.channel),
    sessions: Number(r.sessions || 0),
    impressions: Number(r.impressions || 0),
    views: Number(r.views || 0),
    productClicks: Number(r.product_clicks || 0),
    orders: Number(r.orders || 0),
    gmv: Number(r.gmv || 0),
    newFans: Number(r.new_fans || 0),
    avgWatchSec: Number(r.avg_watch_sec || 0),
  }))

  const totalGmv = channels.reduce((a, c) => a + c.gmv, 0)
  const totalViews = channels.reduce((a, c) => a + c.views, 0)

  const mkBucket = (b: WechatChannelBucket): WechatBucketSummary => {
    const list = channels.filter((c) => c.bucket === b)
    const gmv = list.reduce((a, c) => a + c.gmv, 0)
    const views = list.reduce((a, c) => a + c.views, 0)
    return {
      gmv: Number(gmv.toFixed(2)),
      views,
      orders: list.reduce((a, c) => a + c.orders, 0),
      sessions: list.reduce((a, c) => a + c.sessions, 0),
      channels: list.map((c) => c.channel),
      gmvPct: totalGmv > 0 ? Number(((gmv / totalGmv) * 100).toFixed(2)) : 0,
      viewPct: totalViews > 0 ? Number(((views / totalViews) * 100).toFixed(2)) : 0,
    }
  }

  const pub = mkBucket('public')
  const pri = mkBucket('private')
  const soc = mkBucket('social')

  return {
    range: { from, to },
    summary: {
      totalGmv: Number(totalGmv.toFixed(2)),
      totalViews,
      publicGmvPct: pub.gmvPct,
      privateGmvPct: pri.gmvPct,
      socialGmvPct: soc.gmvPct,
      publicViewPct: pub.viewPct,
      privateViewPct: pri.viewPct,
      socialViewPct: soc.viewPct,
    },
    buckets: { public: pub, private: pri, social: soc },
    channels,
  }
}

/**
 * 视频号全域带货场景拆分
 * 直播 / 短视频（公众号图文）/ 社群朋友圈，三场景合计 = 全域体量
 */
export async function getWechatAffiliateScenes(
  from: string,
  to: string,
  client: DbExecutor,
  shopId?: number,
): Promise<{
  range: { from: string; to: string }
  scenes: Array<{ scene: string; views: number; newFans: number; orders: number; gmv: number; gmvPct: number }>
  totalGmv: number
  note: string
}> {
  const params: any[] = [from, to]
  let shopCond = ''
  if (shopId && Number.isFinite(shopId)) {
    params.push(shopId)
    shopCond = ` AND shop_id = $${params.length}`
  }

  const res = await client.query(
    `SELECT channel,
            COALESCE(SUM(views), 0)::bigint      AS views,
            COALESCE(SUM(new_fans), 0)::int      AS new_fans,
            COALESCE(SUM(orders), 0)::bigint     AS orders,
            COALESCE(SUM(gmv), 0)::numeric(14,2) AS gmv
       FROM public.session_channel_metrics
      WHERE platform_code = 'wechat'
        AND period_date BETWEEN $1::date AND $2::date${shopCond}
      GROUP BY channel`,
    params,
  )

  // 场景归类
  const sceneOf = (ch: string): string => {
    const b = classifyWechatChannel(ch)
    if (b === 'social') return '视频号直播（社交裂变）'
    if (b === 'public') return '视频号直播（公域推荐）'
    const c = (ch || '').toLowerCase()
    if (c.includes('公众号')) return '公众号图文'
    return '社群/朋友圈'
  }

  const agg = new Map<string, { views: number; newFans: number; orders: number; gmv: number }>()
  for (const r of res.rows) {
    const k = sceneOf(r.channel)
    const cur = agg.get(k) || { views: 0, newFans: 0, orders: 0, gmv: 0 }
    cur.views += Number(r.views || 0)
    cur.newFans += Number(r.new_fans || 0)
    cur.orders += Number(r.orders || 0)
    cur.gmv += Number(r.gmv || 0)
    agg.set(k, cur)
  }

  const totalGmv = Array.from(agg.values()).reduce((a, b) => a + b.gmv, 0)
  const scenes = Array.from(agg.entries())
    .map(([scene, v]) => ({
      scene,
      views: v.views,
      newFans: v.newFans,
      orders: v.orders,
      gmv: Number(v.gmv.toFixed(2)),
      gmvPct: totalGmv > 0 ? Number(((v.gmv / totalGmv) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.gmv - a.gmv)

  return {
    range: { from, to },
    scenes,
    totalGmv: Number(totalGmv.toFixed(2)),
    note: '微信小店带货者可在视频号/公众号/社群/朋友圈全域带货；只统计直播占比会低估视频号真实体量',
  }
}

/**
 * 视频号结算周期与资金占用
 * 微信小店 T+30 结算，显著慢于其他平台，是资金效率的关键差异点
 */
export async function getWechatSettlement(
  from: string,
  to: string,
  client: DbExecutor,
  shopId?: number,
): Promise<{
  range: { from: string; to: string }
  summary: {
    cycles: number
    grossGmv: number
    settledGmv: number
    platformFee: number
    reserveHeld: number
    adSpend: number
    avgSettleDays: number
    settledRatio: number
  }
  byStatus: Array<{ status: string; count: number; amount: number }>
  note: string
}> {
  const params: any[] = [from, to]
  let shopCond = ''
  if (shopId && Number.isFinite(shopId)) {
    params.push(shopId)
    shopCond = ` AND shop_id = $${params.length}`
  }

  const res = await client.query(
    `SELECT COALESCE(settlement_status, 'unknown') AS status,
            COUNT(*)::int                            AS cnt,
            COALESCE(SUM(settled_gmv), 0)::numeric(14,2) AS amount
       FROM public.fact_settlement_cycles
      WHERE platform_code = 'wechat'
        AND order_date BETWEEN $1::date AND $2::date${shopCond}
      GROUP BY COALESCE(settlement_status, 'unknown')
      ORDER BY amount DESC`,
    params,
  )

  const sumRes = await client.query(
    `SELECT COUNT(*)::int                                  AS cycles,
            COALESCE(SUM(gross_gmv), 0)::numeric(14,2)     AS gross_gmv,
            COALESCE(SUM(settled_gmv), 0)::numeric(14,2)   AS settled_gmv,
            COALESCE(SUM(platform_fee), 0)::numeric(14,2)  AS platform_fee,
            COALESCE(SUM(reserve_held), 0)::numeric(14,2)  AS reserve_held,
            COALESCE(SUM(ad_spend), 0)::numeric(14,2)      AS ad_spend,
            COALESCE(ROUND(AVG(settlement_cycle_days)), 0)::int AS avg_days
       FROM public.fact_settlement_cycles
      WHERE platform_code = 'wechat'
        AND order_date BETWEEN $1::date AND $2::date${shopCond}`,
    params,
  )

  const s = sumRes.rows[0] || {}
  const gross = Number(s.gross_gmv || 0)
  const settled = Number(s.settled_gmv || 0)

  return {
    range: { from, to },
    summary: {
      cycles: Number(s.cycles || 0),
      grossGmv: Number(gross.toFixed(2)),
      settledGmv: Number(settled.toFixed(2)),
      platformFee: Number(Number(s.platform_fee || 0).toFixed(2)),
      reserveHeld: Number(Number(s.reserve_held || 0).toFixed(2)),
      adSpend: Number(Number(s.ad_spend || 0).toFixed(2)),
      avgSettleDays: Number(s.avg_days || 0),
      settledRatio: gross > 0 ? Number(((settled / gross) * 100).toFixed(2)) : 0,
    },
    byStatus: res.rows.map((r: any) => ({
      status: r.status,
      count: Number(r.cnt || 0),
      amount: Number(Number(r.amount || 0).toFixed(2)),
    })),
    note: '微信小店 T+30 结算，资金占用显著高于天猫(T+7)/淘宝(T+10)；已结算比例是现金流健康度指标',
  }
}

/**
 * 视频号内容场（短视频 + 公众号图文）对直播的引流
 */
export async function getWechatContentTraffic(
  from: string,
  to: string,
  client: DbExecutor,
  shopId?: number,
): Promise<{
  range: { from: string; to: string }
  summary: { total: number; published: number; compliant: number; publishRate: number; complianceRate: number }
  byStage: Array<{ stage: string; count: number; published: number }>
  note: string
}> {
  const params: any[] = [from, to]
  let shopCond = ''
  if (shopId && Number.isFinite(shopId)) {
    params.push(shopId)
    shopCond = ` AND shop_id = $${params.length}`
  }

  const res = await client.query(
    `SELECT COALESCE(stage, 'unknown') AS stage,
            COUNT(*)::int AS cnt,
            COUNT(*) FILTER (WHERE published_at IS NOT NULL)::int AS published
       FROM public.content_schedules
      WHERE platform_code = 'wechat'
        AND planned_publish_at BETWEEN $1::date AND $2::date + interval '1 day'${shopCond}
      GROUP BY COALESCE(stage, 'unknown')
      ORDER BY cnt DESC`,
    params,
  ).catch(() => ({ rows: [] as any[] }))

  const compRes = await client.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE compliance_checked)::int AS compliant
       FROM public.content_schedules
      WHERE platform_code = 'wechat'
        AND planned_publish_at BETWEEN $1::date AND $2::date + interval '1 day'${shopCond}`,
    params,
  ).catch(() => ({ rows: [{ total: 0, compliant: 0 }] }))

  const c = compRes.rows[0] || {}
  const total = Number(c.total || 0)
  const compliant = Number(c.compliant || 0)
  const published = res.rows.reduce((a: number, r: any) => a + Number(r.published || 0), 0)

  return {
    range: { from, to },
    summary: {
      total,
      published,
      compliant,
      publishRate: total > 0 ? Number(((published / total) * 100).toFixed(2)) : 0,
      complianceRate: total > 0 ? Number(((compliant / total) * 100).toFixed(2)) : 0,
    },
    byStage: res.rows.map((r: any) => ({
      stage: r.stage,
      count: Number(r.cnt || 0),
      published: Number(r.published || 0),
    })),
    note: '视频号内容生态 = 短视频 + 公众号图文，两者都能为直播蓄水；合规已检率是红线指标',
  }
}
