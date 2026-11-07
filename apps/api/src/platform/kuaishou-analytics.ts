/**
 * kuaishou-analytics.ts — 快手专属分析服务
 *
 * 基于调研结论（docs/platform-business-model-comparison.md）：
 *   快手是「先关注后成交」的私域电商，与抖音「先成交再沉淀」的公域兴趣电商相反。
 *
 *   核心差异：
 *   1. 公私域双轮循环：发现页（公域）拉新 → 沉淀粉丝 → 关注页（私域）复购
 *   2. 「间接成交」是官方一级指标：点击广告未直接转化，当天内通过关注/搜索/
 *      购物车/个人主页/橱窗再次触达成交
 *   3. 粉丝团/购物团：亲密度分级，是快手独有的粉丝运营资产
 *   4. ROI 有多种口径：当日总ROI / 净成交ROI / 7日累计 / 涨粉N日ROI
 *   5. 官方明确：磁力金牛（投流口径）与生意通（经营口径）不可直接对比
 */

import type { Pool } from 'pg'
import { getPool } from '../lib/db.js'
import { getDefaultCaliber } from '../platform/caliber.js'

export interface KsTrafficSplit {
  range: { from: string; to: string }
  /** 关注页 = 私域，发现页 = 公域 */
  privateTraffic: { gmv: number; share: number | null; note: string }
  publicTraffic: { gmv: number; share: number | null; note: string }
  otherTraffic: { gmv: number; share: number | null }
  totalGmv: number
  /** 私域占比是快手最关键的经营健康度指标 */
  privateRatio: number | null
  healthAssessment: string
}

/** 公私域流量与成交拆分 */
export async function getKsTrafficSplit(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<KsTrafficSplit> {
  const p = pool || getPool()

  const { rows } = await p.query(
    `SELECT
       COALESCE(ds.level1, '其他') AS level1,
       COALESCE(SUM(f.gmv), 0)::numeric AS gmv
     FROM fact_trade_daily f
     LEFT JOIN dim_traffic_source ds ON ds.code = f.source_code
     WHERE f.shop_id = $1
       AND f.platform_code = 'kuaishou'
       AND f.biz_date BETWEEN $2::date AND $3::date
     GROUP BY 1`,
    [shopId, from, to],
  )

  let privateGmv = 0
  let publicGmv = 0
  let otherGmv = 0
  for (const r of rows) {
    const amount = Number(r.gmv)
    if (r.level1 === '私域') privateGmv += amount
    else if (r.level1 === '推荐' || r.level1 === '自然搜索') publicGmv += amount
    else otherGmv += amount
  }

  const total = privateGmv + publicGmv + otherGmv
  const privateRatio = total > 0 ? Number(((privateGmv / total) * 100).toFixed(2)) : null

  // 快手健康度评估：私域占比是核心
  let health = '数据不足，无法评估'
  if (privateRatio !== null) {
    if (privateRatio >= 50) health = '私域经营健康：超过半数成交来自关注页，复购基础扎实'
    else if (privateRatio >= 30) health = '私域经营一般：公域依赖偏高，建议加强粉丝沉淀'
    else health = '私域经营薄弱：过度依赖公域拉新，获客成本将持续走高'
  }

  return {
    range: { from, to },
    privateTraffic: {
      gmv: Number(privateGmv.toFixed(2)),
      share: privateRatio,
      note: '关注页成交（私域）：快手最核心的资产，反映粉丝复购能力',
    },
    publicTraffic: {
      gmv: Number(publicGmv.toFixed(2)),
      share: total > 0 ? Number(((publicGmv / total) * 100).toFixed(2)) : null,
      note: '发现页/搜索成交（公域）：拉新获客的主要来源',
    },
    otherTraffic: {
      gmv: Number(otherGmv.toFixed(2)),
      share: total > 0 ? Number(((otherGmv / total) * 100).toFixed(2)) : null,
    },
    totalGmv: Number(total.toFixed(2)),
    privateRatio,
    healthAssessment: health,
  }
}

export interface KsIndirectGmv {
  range: { from: string; to: string }
  direct: { gmv: number; share: number | null; note: string }
  indirect: { gmv: number; share: number | null; note: string }
  total: number
  /** 间接成交占比，快手独有指标 */
  indirectRatio: number | null
  assessment: string
}

/** 间接成交分析（快手独有的一级指标） */
export async function getKsIndirectGmv(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<KsIndirectGmv> {
  const p = pool || getPool()

  // 优先从投放事实表读直接/间接拆分
  const adRes = await p.query(
    `SELECT
       COALESCE(SUM(direct_gmv), 0)::numeric   AS direct_gmv,
       COALESCE(SUM(indirect_gmv), 0)::numeric AS indirect_gmv
     FROM fact_ad_daily
     WHERE shop_id = $1
       AND platform_code = 'kuaishou'
       AND biz_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  )

  let direct = Number(adRes.rows[0]?.direct_gmv || 0)
  let indirect = Number(adRes.rows[0]?.indirect_gmv || 0)

  // 投放表无数据时，回退到 fans_ops 表
  if (direct === 0 && indirect === 0) {
    const opsRes = await p.query(
      `SELECT
         COALESCE(SUM(direct_gmv), 0)::numeric   AS direct_gmv,
         COALESCE(SUM(indirect_gmv), 0)::numeric AS indirect_gmv
       FROM kuaishou_fans_ops
       WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date`,
      [shopId, from, to],
    )
    direct = Number(opsRes.rows[0]?.direct_gmv || 0)
    indirect = Number(opsRes.rows[0]?.indirect_gmv || 0)
  }

  const total = direct + indirect
  const indirectRatio = total > 0 ? Number(((indirect / total) * 100).toFixed(2)) : null

  let assessment = '无投放数据，无法评估'
  if (indirectRatio !== null) {
    if (indirectRatio >= 30) assessment = '间接成交占比高：大量用户在点击广告后通过关注/搜索/橱窗二次触达才成交，说明私域承接能力强'
    else if (indirectRatio >= 15) assessment = '间接成交占比正常：广告触达与私域转化衔接良好'
    else assessment = '间接成交占比偏低：用户多为即点即买，广告直接转化效率高但私域沉淀较弱'
  }

  return {
    range: { from, to },
    direct: {
      gmv: Number(direct.toFixed(2)),
      share: total > 0 ? Number(((direct / total) * 100).toFixed(2)) : null,
      note: '直接成交：用户点击广告后直接下单',
    },
    indirect: {
      gmv: Number(indirect.toFixed(2)),
      share: indirectRatio,
      note: '间接成交：点击广告未直接转化，当天内通过关注/搜索/购物车/主页/橱窗再次触达成交。这是快手独有的一级指标。',
    },
    total: Number(total.toFixed(2)),
    indirectRatio,
    assessment,
  }
}

export interface KsFansTeam {
  range: { from: string; to: string }
  followers: {
    new: number
    total: number
    note: string
  }
  fansTeam: {
    newJoiners: number
    total: number
    /** 粉丝团新增占新增粉丝比例 */
    joinRate: number | null
    note: string
  }
  closeFriends: number
  assessment: string
}

/** 粉丝团与粉丝资产 */
export async function getKsFansTeam(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<KsFansTeam> {
  const p = pool || getPool()

  const { rows } = await p.query(
    `SELECT
       COALESCE(SUM(new_followers), 0)::int      AS new_followers,
       COALESCE(MAX(total_followers), 0)::int    AS total_followers,
       COALESCE(SUM(fans_team_joiners), 0)::int  AS team_joiners,
       COALESCE(MAX(fans_team_total), 0)::int    AS team_total,
       COALESCE(SUM(close_friends), 0)::int      AS close_friends
     FROM kuaishou_fans_ops
     WHERE shop_id = $1 AND biz_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  )
  const r = rows[0] || {}
  const newFollowers = Number(r.new_followers || 0)
  const teamJoiners = Number(r.team_joiners || 0)
  const joinRate = newFollowers > 0 ? Number(((teamJoiners / newFollowers) * 100).toFixed(2)) : null

  let assessment = '暂��粉丝数据'
  if (joinRate !== null) {
    if (joinRate >= 40) assessment = '粉丝团转化优秀：近半数新粉丝加入购物团，私域运营能力强'
    else if (joinRate >= 20) assessment = '粉丝团转化正常：有一定比例的粉丝进入购物团'
    else assessment = '粉丝团转化偏低：新粉丝沉淀为购物团成员的比例不足，建议加强入团引导'
  }

  return {
    range: { from, to },
    followers: {
      new: newFollowers,
      total: Number(r.total_followers || 0),
      note: '快手号粉丝资产，是私域复购的基础',
    },
    fansTeam: {
      newJoiners: teamJoiners,
      total: Number(r.team_total || 0),
      joinRate,
      note: '购物团/粉丝团：关注后可加入，随购物点赞分享累积亲密度升级，享受梯度权益',
    },
    closeFriends: Number(r.close_friends || 0),
    assessment,
  }
}

export interface KsAdRoi {
  range: { from: string; to: string }
  spend: number
  /** 快手有多种 ROI 口径 */
  rois: {
    totalRoi: number | null       // 当日总ROI = 总成交/花费
    directRoi: number | null      // 直接ROI
    netRoi: number | null         // 净成交ROI（剔除1小时内退款）
    roi7d: number | null          // 7日累计ROI
  }
  gmv: {
    total: number
    direct: number
    indirect: number
    net: number
  }
  comparison: {
    adPlatformGmv: number
    merchantGmv: number
    diffPct: number | null
    warning: string
  }
}

/** 磁力金牛 ROI 多口径分析 + 双源对账 */
export async function getKsAdRoi(
  shopId: number,
  from: string,
  to: string,
  pool?: Pool,
): Promise<KsAdRoi> {
  const p = pool || getPool()

  const adRes = await p.query(
    `SELECT
       COALESCE(SUM(ad_spend), 0)::numeric     AS spend,
       COALESCE(SUM(ad_gmv), 0)::numeric       AS ad_gmv,
       COALESCE(SUM(direct_gmv), 0)::numeric   AS direct_gmv,
       COALESCE(SUM(indirect_gmv), 0)::numeric AS indirect_gmv,
       COALESCE(SUM(net_gmv), 0)::numeric      AS net_gmv
     FROM fact_ad_daily
     WHERE shop_id = $1
       AND platform_code = 'kuaishou'
       AND biz_date BETWEEN $2::date AND $3::date`,
    [shopId, from, to],
  )
  const a = adRes.rows[0] || {}
  const spend = Number(a.spend || 0)
  const adGmv = Number(a.ad_gmv || 0)
  const directGmv = Number(a.direct_gmv || 0)
  const indirectGmv = Number(a.indirect_gmv || 0)
  const netGmv = Number(a.net_gmv || 0)

  // 生意通口径（经营后台）
  const merchantRes = await p.query(
    `SELECT COALESCE(SUM(gmv), 0)::numeric AS gmv
       FROM fact_trade_daily
      WHERE shop_id = $1 AND platform_code = 'kuaishou'
        AND biz_date BETWEEN $2::date AND $3::date
        AND amount_type = 'indirect_included'`,
    [shopId, from, to],
  )
  const merchantGmv = Number(merchantRes.rows[0]?.gmv || 0)

  const roi = (numerator: number) => (spend > 0 ? Number((numerator / spend).toFixed(2)) : null)

  return {
    range: { from, to },
    spend: Number(spend.toFixed(2)),
    rois: {
      totalRoi: roi(adGmv),
      directRoi: roi(directGmv),
      netRoi: netGmv > 0 ? roi(netGmv) : null,
      roi7d: null, // 需 7 日累计数据，当前数据源未包含
    },
    gmv: {
      total: Number(adGmv.toFixed(2)),
      direct: Number(directGmv.toFixed(2)),
      indirect: Number(indirectGmv.toFixed(2)),
      net: Number(netGmv.toFixed(2)),
    },
    comparison: {
      adPlatformGmv: Number(adGmv.toFixed(2)),
      merchantGmv: Number(merchantGmv.toFixed(2)),
      diffPct: merchantGmv > 0
        ? Number((((adGmv - merchantGmv) / merchantGmv) * 100).toFixed(2))
        : null,
      warning: '快手官方明确：磁力金牛（投流口径）与生意通（经营口径）因归因时间（广告触达24h vs 实际支付）、成交渠道（不区分 vs 按渠道）、账户范围（单账户 vs 全店铺）不同，数据天然不可直接对比。',
    },
  }
}
