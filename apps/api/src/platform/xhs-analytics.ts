/**
 * xhs-analytics.ts — 小红书专属分析服务
 *
 * 基于调研结论（docs/platform-business-model-comparison.md）：
 *
 * ⚠️ 小红书是全平台最特殊的一个：**没有「店铺经营」概念**
 *
 *   官方 NPL 经营方法论：
 *     N（note 笔记）— 形成基础认知、激发潜在购买需求
 *     P（people）— 借助群聊把粉丝转化为用户资产
 *     L（直播）— 锁定高意向用户、放大成交
 *
 *   核心差异：
 *   1. 经营单元是「笔记」而非店铺，允许「无成交的笔记」计入分析
 *   2. 搜索是核心决策入口（官方：有购买意图的搜索占比 25%）
 *   3. 成交可发生在站外（红猫/红京/红美），GMV 天然有两个口径
 *   4. ROI 没有统一口径：过程用 AIPS 人群资产，结果用种草联盟跨平台归因
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { getDefaultCaliber } from '../platform/caliber.js'

export interface XhsNoteBoard {
  range: { from: string; to: string }
  summary: {
    noteCount: number
    totalImpressions: number
    totalReads: number
    totalLikes: number
    totalCollects: number
    totalComments: number
    totalFollows: number
    /** 平均阅读率 */
    avgReadRate: number | null
    /** 平均互动率 = (赞+藏+评+享) / 阅读 */
    avgEngagementRate: number | null
  }
  /** 笔记列表：按阅读量排序 */
  notes: Array<{
    noteId: string
    title: string
    noteType: string
    impressions: number
    reads: number
    readRate: number | null
    likes: number
    collects: number
    comments: number
    engagementRate: number | null
    onsiteGmv: number
    offsiteGmv: number
    /** 是否零成交（小红书的笔记可以是纯种草） */
    isSeedingOnly: boolean
  }>
  note: string
}

/** 笔记经营看板：以笔记为核心，允许无成交笔记 */
export async function getXhsNoteBoard(
  shopId: number | null,
  from: string,
  to: string,
  pool?: Pool,
): Promise<XhsNoteBoard> {
  const p = pool || getPool()

  const cond = shopId ? 'AND shop_id = $3' : ''
  const params: any[] = [from, to]
  if (shopId) params.push(shopId)

  const { rows } = await p.query(
    `SELECT note_id, title, note_type,
            impressions, reads, likes, collects, comments, shares, follows,
            onsite_gmv, offsite_gmv
       FROM xhs_note
      WHERE biz_date BETWEEN $1::date AND $2::date ${cond}
      ORDER BY reads DESC`,
    params,
  )

  let totalImpressions = 0
  let totalReads = 0
  let totalLikes = 0
  let totalCollects = 0
  let totalComments = 0
  let totalFollows = 0

  const notes = rows.map((r: any) => {
    const impressions = Number(r.impressions)
    const reads = Number(r.reads)
    const likes = Number(r.likes)
    const collects = Number(r.collects)
    const comments = Number(r.comments)
    const shares = Number(r.shares)
    const onsiteGmv = Number(r.onsite_gmv)
    const offsiteGmv = Number(r.offsite_gmv)

    totalImpressions += impressions
    totalReads += reads
    totalLikes += likes
    totalCollects += collects
    totalComments += comments
    totalFollows += Number(r.follows)

    const interactions = likes + collects + comments + shares
    return {
      noteId: r.note_id,
      title: r.title || '(无标题)',
      noteType: r.note_type,
      impressions,
      reads,
      readRate: impressions > 0 ? Number(((reads / impressions) * 100).toFixed(2)) : null,
      likes,
      collects,
      comments,
      engagementRate: reads > 0 ? Number(((interactions / reads) * 100).toFixed(2)) : null,
      onsiteGmv,
      offsiteGmv,
      // 关键：零成交的笔记在小红书是正常的（纯种草价值）
      isSeedingOnly: onsiteGmv === 0 && offsiteGmv === 0,
    }
  })

  return {
    range: { from, to },
    summary: {
      noteCount: rows.length,
      totalImpressions,
      totalReads,
      totalLikes,
      totalCollects,
      totalComments,
      totalFollows,
      avgReadRate: totalImpressions > 0
        ? Number(((totalReads / totalImpressions) * 100).toFixed(2)) : null,
      avgEngagementRate: totalReads > 0
        ? Number((((totalLikes + totalCollects + totalComments) / totalReads) * 100).toFixed(2)) : null,
    },
    notes,
    note: '小红书的笔记是经营资产本身，零成交的笔记也有种草价值，不应被过滤。',
  }
}

export interface XhsSearchAnalysis {
  range: { from: string; to: string }
  search: {
    impressions: number
    /** 搜索曝光占总曝光比例 */
    searchShare: number | null
    note: string
  }
  recommend: {
    impressions: number
    share: number | null
  }
  assessment: string
}

/** 搜索分析（小红书独立维度） */
export async function getXhsSearchAnalysis(
  shopId: number | null,
  from: string,
  to: string,
  pool?: Pool,
): Promise<XhsSearchAnalysis> {
  const p = pool || getPool()

  const cond = shopId ? 'AND shop_id = $3' : ''
  const params: any[] = [from, to]
  if (shopId) params.push(shopId)

  const { rows } = await p.query(
    `SELECT
       COALESCE(SUM(search_impressions), 0)::bigint    AS search_imp,
       COALESCE(SUM(recommend_impressions), 0)::bigint AS rec_imp,
       COALESCE(SUM(impressions), 0)::bigint           AS total_imp
     FROM xhs_note
     WHERE biz_date BETWEEN $1::date AND $2::date ${cond}`,
    params,
  )
  const r = rows[0] || {}
  const searchImp = Number(r.search_imp || 0)
  const recImp = Number(r.rec_imp || 0)
  const totalImp = Number(r.total_imp || 0)

  const searchShare = totalImp > 0 ? Number(((searchImp / totalImp) * 100).toFixed(2)) : null
  const recShare = totalImp > 0 ? Number(((recImp / totalImp) * 100).toFixed(2)) : null

  let assessment = '暂无数据'
  if (searchShare !== null) {
    if (searchShare >= 30) assessment = '搜索流量占比高：用户主动搜索意向强烈，是高质量流量'
    else if (searchShare >= 15) assessment = '搜索流量占比正常：推荐与搜索形成互补'
    else assessment = '搜索流量占比偏低：过度依赖推荐分发，建议优化标题与关键词布局'
  }

  return {
    range: { from, to },
    search: {
      impressions: searchImp,
      searchShare,
      note: '官方口径：有购买意图的搜索占比约 25%。搜索是小红书的核心决策入口，链路为「发现浏览 → 搜索决策 → 内容/直播转化 → 评价反馈」。',
    },
    recommend: {
      impressions: recImp,
      share: recShare,
    },
    assessment,
  }
}

export interface XhsConversionFunnel {
  range: { from: string; to: string }
  stages: {
    impressions: { count: number; label: string; note: string }
    reads: { count: number; rate: number | null; label: string; note: string }
    productClicks: { count: number; rate: number | null; label: string; note: string }
    conversions: { count: number; rate: number | null; label: string; note: string }
  }
  gmv: {
    onsite: number
    offsite: number
    total: number
    offsiteShare: number | null
  }
}

/** 种草转化链路：曝光 → 阅读 → 商品点击 → 成交 */
export async function getXhsConversionFunnel(
  shopId: number | null,
  from: string,
  to: string,
  pool?: Pool,
): Promise<XhsConversionFunnel> {
  const p = pool || getPool()

  const cond = shopId ? 'AND shop_id = $3' : ''
  const params: any[] = [from, to]
  if (shopId) params.push(shopId)

  const { rows } = await p.query(
    `SELECT
       COALESCE(SUM(impressions), 0)::bigint     AS impressions,
       COALESCE(SUM(reads), 0)::bigint           AS reads,
       COALESCE(SUM(product_clicks), 0)::bigint  AS product_clicks,
       COALESCE(SUM(onsite_gmv), 0)::numeric     AS onsite_gmv,
       COALESCE(SUM(offsite_gmv), 0)::numeric    AS offsite_gmv
     FROM xhs_note
     WHERE biz_date BETWEEN $1::date AND $2::date ${cond}`,
    params,
  )
  const r = rows[0] || {}
  const impressions = Number(r.impressions || 0)
  const reads = Number(r.reads || 0)
  const clicks = Number(r.product_clicks || 0)
  const onsite = Number(r.onsite_gmv || 0)
  const offsite = Number(r.offsite_gmv || 0)
  const total = onsite + offsite

  // 成交笔数无法从 GMV 反推，用「有成交的笔记数」近似
  const convRes = await p.query(
    `SELECT COUNT(*)::int AS n
       FROM xhs_note
      WHERE biz_date BETWEEN $1::date AND $2::date ${cond}
        AND (onsite_gmv > 0 OR offsite_gmv > 0)`,
    params,
  )
  const convCount = Number(convRes.rows[0]?.n || 0)

  return {
    range: { from, to },
    stages: {
      impressions: {
        count: impressions,
        label: '笔记曝光',
        note: '笔记在发现页/搜索页被展示的次数',
      },
      reads: {
        count: reads,
        rate: impressions > 0 ? Number(((reads / impressions) * 100).toFixed(2)) : null,
        label: '笔记阅读',
        note: '用户点击进入笔记详情',
      },
      productClicks: {
        count: clicks,
        rate: reads > 0 ? Number(((clicks / reads) * 100).toFixed(2)) : null,
        label: '商品点击',
        note: '笔记内点击商品链接',
      },
      conversions: {
        count: convCount,
        rate: clicks > 0 ? Number(((convCount / clicks) * 100).toFixed(2)) : null,
        label: '产生成交的笔记数',
        note: '注意：小红书成交可发生在站外，此处统计有成交的笔记数量而非订单数',
      },
    },
    gmv: {
      onsite: Number(onsite.toFixed(2)),
      offsite: Number(offsite.toFixed(2)),
      total: Number(total.toFixed(2)),
      offsiteShare: total > 0 ? Number(((offsite / total) * 100).toFixed(2)) : null,
    },
  }
}

export interface XhsOnOffsite {
  range: { from: string; to: string }
  onsite: { gmv: number; share: number | null; note: string }
  offsite: { gmv: number; share: number | null; note: string; available: boolean }
  total: number
  caliber: { amountType: string; amountTypeName: string; displayNote: string } | null
}

/** 站内外成交拆分 */
export async function getXhsOnOffsite(
  shopId: number | null,
  from: string,
  to: string,
  pool?: Pool,
): Promise<XhsOnOffsite> {
  const p = pool || getPool()

  const cond = shopId ? 'AND shop_id = $3' : ''
  const params: any[] = [from, to]
  if (shopId) params.push(shopId)

  const { rows } = await p.query(
    `SELECT
       COALESCE(SUM(onsite_gmv), 0)::numeric  AS onsite,
       COALESCE(SUM(offsite_gmv), 0)::numeric AS offsite
     FROM xhs_note
     WHERE biz_date BETWEEN $1::date AND $2::date ${cond}`,
    params,
  )
  const r = rows[0] || {}
  const onsite = Number(r.onsite || 0)
  const offsite = Number(r.offsite || 0)
  const total = onsite + offsite

  const caliber = await getDefaultCaliber('xiaohongshu', 'gmv', p)

  return {
    range: { from, to },
    onsite: {
      gmv: Number(onsite.toFixed(2)),
      share: total > 0 ? Number(((onsite / total) * 100).toFixed(2)) : null,
      note: '站内成交：小红书店铺/直播内完成的成交',
    },
    offsite: {
      gmv: Number(offsite.toFixed(2)),
      share: total > 0 ? Number(((offsite / total) * 100).toFixed(2)) : null,
      note: '站外成交：通过红猫/红京/红美等广告挂链跳转外部平台完成，依赖小红星/小红盟回传',
      available: offsite > 0,
    },
    total: Number(total.toFixed(2)),
    caliber: caliber ? {
      amountType: caliber.amountType,
      amountTypeName: caliber.amountTypeName,
      displayNote: caliber.displayNote,
    } : null,
  }
}

export interface XhsAips {
  available: boolean
  stages: Array<{ code: string; name: string; description: string }>
  note: string
}

/** AIPS 人群资产模型说明（小红书 ROI 的过程度量） */
export async function getXhsAips(): Promise<XhsAips> {
  return {
    available: false,
    stages: [
      { code: 'A', name: 'Awareness 认知', description: '用户通过笔记/广告首次接触品牌' },
      { code: 'I', name: 'Interest 兴趣', description: '产生阅读、收藏、评论等互动行为' },
      { code: 'P', name: 'Purchase 购买', description: '完成站内或站外成交' },
      { code: 'S', name: 'Loyalty 忠诚', description: '复购、进群、成为品牌拥护者（官方 AIPS 的 S 阶段）' },
    ],
    note: 'AIPS 是小红书官方的人群资产模型，用于衡量种草过程而非即时转化。当前数据源未包含人群流转数据，需从灵犀或聚光后台导出。小红书没有统一的「投产比」口径，过程看 AIPS，结果看种草联盟跨平台归因。',
  }
}
