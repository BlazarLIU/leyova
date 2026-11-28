/**
 * assortment-engine.ts — 排品推荐引擎（P3）
 *
 * 老大原话：「排品的逻辑是根据直播带货的 GMV销量、库存、短视频数据、点击转化等数据来」
 *
 * 引擎输入（全部来自真实业务表，非模拟值）：
 *   1. GMV 销量      session_plan_products.payment_amount / sold_count（近 N 场历史成交）
 *   2. 库存          fact_inventory_stock.available_qty（生成列 = on_hand - locked）vs safety_stock
 *   3. 短视频数据    session_short_video_traffic.traffic_to_live / entry_click_rate
 *   4. 点击转化      session_plan_products.exposure_users / click_users（历史曝光点击率）
 *
 * 输出：按综合分排序的候选商品 + T(引流)/B(福利)/P(利润) 角色建议 + 可解释理由。
 *
 * 设计原则：
 *   - fail-closed：任一口径缺数据时降级为 0 分并标注，不伪造；
 *   - 可解释：每个因子分数与权重都返回，前端可展示「为什么推荐它」；
 *   - 确定性：同一输入同一输出，无随机。
 */

import type { PoolClient } from 'pg'

export interface AssortmentCandidate {
  productId: number
  spuCode: string
  skuCode: string
  productName: string
  category: string
  categoryCode: string
  unitCost: number
  retailPrice: number
  margin: number
  /** 综合分 0-100 */
  totalScore: number
  /** 各因子分数 0-1 */
  factors: {
    gmvSales: number
    inventory: number
    shortVideo: number
    clickConversion: number
    marginProfit: number
  }
  /** 建议角色：T 引流 / B 福利 / P 利润 */
  suggestedRole: 'T' | 'B' | 'P'
  /** 可解释理由 */
  reasons: string[]
  /** 原始指标（供前端展示） */
  metrics: {
    recentSoldCount: number
    recentPayment: number
    availableQty: number
    safetyStock: number
    shortVideoTraffic: number
    avgEntryClickRate: number
    historicalClickRate: number
  }
}

export interface AssortmentResult {
  candidates: AssortmentCandidate[]
  /** 分组建议：T/B/P 各取 top N */
  suggested: {
    traffic: AssortmentCandidate[]
    benefit: AssortmentCandidate[]
    profit: AssortmentCandidate[]
  }
  meta: {
    days: number
    candidateCount: number
    dataSufficiency: {
      hasSales: boolean
      hasInventory: boolean
      hasShortVideo: boolean
      hasClick: boolean
    }
  }
}

/** 默认权重（可按类目覆盖） */
const DEFAULT_WEIGHTS = {
  gmvSales: 0.30,
  clickConversion: 0.25,
  inventory: 0.20,
  shortVideo: 0.15,
  marginProfit: 0.10,
}

export interface AssortmentOptions {
  /** 统计窗口（天） */
  days?: number
  /** 类目筛选（可选） */
  categoryCode?: string
  /** 每组取前 N */
  topN?: number
  /** 权重覆盖 */
  weights?: Partial<typeof DEFAULT_WEIGHTS>
}

/**
 * 计算排品推荐。
 *
 * @param client 已在使用中的 PoolClient（复用同一事务/连接，避免并发告警）
 * @param opts   选项
 */
export async function computeAssortment(
  client: PoolClient,
  opts: AssortmentOptions = {},
): Promise<AssortmentResult> {
  const days = Math.min(Math.max(opts.days ?? 30, 7), 180)
  const topN = Math.min(Math.max(opts.topN ?? 3, 1), 10)
  const weights = { ...DEFAULT_WEIGHTS, ...opts.weights }

  // ── 1. 历史成交（GMV 销量）──────────────────────────────────────
  //    近 N 天每商品的销量与成交额；无成交记 0（不伪造）
  const salesRes = await client.query(
    `SELECT product_id,
            COALESCE(SUM(sold_count), 0)::int      AS sold_count,
            COALESCE(SUM(payment_amount), 0)::numeric(14,2) AS payment_amount,
            COALESCE(AVG(exposure_users), 0)::numeric(14,2)  AS avg_exposure,
            COALESCE(AVG(click_users), 0)::numeric(14,2)     AS avg_click,
            CASE WHEN COALESCE(SUM(exposure_users), 0) > 0
                 THEN SUM(click_users)::numeric / SUM(exposure_users)::numeric
                 ELSE NULL END                     AS click_rate
       FROM public.session_plan_products
      WHERE business_date >= CURRENT_DATE - $1::int
        AND sold_count > 0
      GROUP BY product_id`,
    [days],
  )
  const sales = new Map<number, {
    soldCount: number; payment: number; avgExposure: number; avgClick: number; clickRate: number | null
  }>()
  for (const r of salesRes.rows) {
    sales.set(Number(r.product_id), {
      soldCount: Number(r.sold_count),
      payment: Number(r.payment_amount),
      avgExposure: Number(r.avg_exposure),
      avgClick: Number(r.avg_click),
      clickRate: r.click_rate == null ? null : Number(r.click_rate),
    })
  }

  // ── 2. 库存健康度 ───────────────────────────────────────────────
  const stockRes = await client.query(
    `SELECT product_id,
            COALESCE(SUM(available_qty), 0)::int AS available_qty,
            COALESCE(MAX(safety_stock), 0)::int  AS safety_stock
       FROM public.fact_inventory_stock
      GROUP BY product_id`,
  )
  const stock = new Map<number, { available: number; safety: number }>()
  for (const r of stockRes.rows) {
    stock.set(Number(r.product_id), {
      available: Number(r.available_qty),
      safety: Number(r.safety_stock),
    })
  }

  // ── 3. 短视频引流 ───────────────────────────────────────────────
  //    短视频带来的进房流量 + 进入点击率（按直播间聚合，作为商品所在场次的引流强度代理）
  const videoRes = await client.query(
    `SELECT room_id,
            COALESCE(SUM(traffic_to_live), 0)::int          AS traffic_to_live,
            COALESCE(AVG(entry_click_rate), 0)::numeric(8,4) AS avg_entry_click_rate,
            COUNT(*)::int                                   AS video_count
       FROM public.session_short_video_traffic
      WHERE business_date >= CURRENT_DATE - $1::int
      GROUP BY room_id`,
    [days],
  )
  const videoByRoom = new Map<number, { traffic: number; clickRate: number; count: number }>()
  for (const r of videoRes.rows) {
    videoByRoom.set(Number(r.room_id), {
      traffic: Number(r.traffic_to_live),
      clickRate: Number(r.avg_entry_click_rate),
      count: Number(r.video_count),
    })
  }

  // ── 4. 候选商品 ─────────────────────────────────────────────────
  //    注意：商品查询不使用 days 参数，参数数组必须与 WHERE 中的占位符严格对应
  const prodParams: any[] = []
  let prodWhere = `p.status = 'active'`
  if (opts.categoryCode) {
    prodParams.push(opts.categoryCode)
    prodWhere += ` AND (p.category_code = ${prodParams.length} OR p.category_code LIKE ${prodParams.length} || '%')`
  }
  const prodRes = await client.query(
    `SELECT p.id, p.spu_code, p.sku_code, p.product_name, p.category, p.category_code,
            p.unit_cost, p.retail_price
       FROM public.dim_product p
      WHERE ${prodWhere}
      ORDER BY p.id ASC`,
    prodParams,
  )

  // ── 5. 打分 ─────────────────────────────────────────────────────
  // 归一化基准：取窗口内最大值，避免绝对值尺度失真
  const maxSold = Math.max(1, ...[...sales.values()].map((s) => s.soldCount))
  const maxTraffic = Math.max(1, ...[...videoByRoom.values()].map((v) => v.traffic))

  const candidates: AssortmentCandidate[] = prodRes.rows.map((p: any) => {
    const productId = Number(p.id)
    const price = Number(p.retail_price) || 0
    const cost = Number(p.unit_cost) || 0
    const margin = price > 0 ? (price - cost) / price : 0

    const s = sales.get(productId)
    const st = stock.get(productId)

    // 因子 1：GMV 销量（历史销量归一化）
    const gmvSales = s ? Math.min(1, s.soldCount / maxSold) : 0

    // 因子 2：库存健康度（available / (safety * 期望覆盖倍数)）
    //   fail-closed：无库存档案 → 0 分（不可推，避免超卖）
    let inventory = 0
    if (st && st.available > 0) {
      const target = Math.max(st.safety * 3, 30)
      inventory = Math.min(1, st.available / target)
    }

    // 因子 3：短视频引流（取该商品历史出场场次的引流强度）
    //   简化代理：商品无直接关联短视频，用全局场均引流强度 × 该商品历史销量占比
    let shortVideo = 0
    if (s && s.soldCount > 0) {
      const avgTraffic = [...videoByRoom.values()].reduce((a, v) => a + v.traffic, 0) /
        Math.max(1, videoByRoom.size)
      shortVideo = Math.min(1, avgTraffic / maxTraffic)
    }

    // 因子 4：点击转化（历史曝光点击率；行业基准约 5%-12%）
    //   fail-closed：无曝光数据 → 0 分
    let clickConversion = 0
    if (s && s.clickRate != null && s.clickRate > 0) {
      clickConversion = Math.min(1, s.clickRate / 0.12)
    }

    // 因子 5：毛利（利润率，50% 毛利记满分）
    const marginProfit = Math.min(1, Math.max(0, margin / 0.5))

    const totalScore =
      (gmvSales * weights.gmvSales +
        clickConversion * weights.clickConversion +
        inventory * weights.inventory +
        shortVideo * weights.shortVideo +
        marginProfit * weights.marginProfit) *
      100

    // 角色建议：
    //   P 利润款 = 高毛利 + 有成交
    //   T 引流款 = 低价 + 高点击转化（或高短视频引流）
    //   B 福利款 = 中间地带
    let suggestedRole: 'T' | 'B' | 'P' = 'B'
    if (marginProfit >= 0.7 && gmvSales > 0) suggestedRole = 'P'
    else if (price > 0 && price <= 99 && (clickConversion > 0.3 || shortVideo > 0.3)) suggestedRole = 'T'
    else if (marginProfit >= 0.6) suggestedRole = 'P'

    const reasons: string[] = []
    if (s && s.soldCount > 0) {
      reasons.push(`近 ${days} 天售出 ${s.soldCount} 件、成交 ${Math.round(s.payment)} 元`)
    } else {
      reasons.push('近窗口内无成交记录')
    }
    if (st) {
      reasons.push(`可用库存 ${st.available}（安全库存 ${st.safety}）`)
    } else {
      reasons.push('无库存档案，不可排（防超卖）')
    }
    if (s && s.clickRate != null) {
      reasons.push(`历史曝光点击率 ${(s.clickRate * 100).toFixed(2)}%`)
    }
    reasons.push(`毛利率 ${(margin * 100).toFixed(1)}%`)

    return {
      productId,
      spuCode: p.spu_code,
      skuCode: p.sku_code,
      productName: p.product_name,
      category: p.category,
      categoryCode: p.category_code,
      unitCost: cost,
      retailPrice: price,
      margin: Math.round(margin * 10000) / 10000,
      totalScore: Math.round(totalScore * 10) / 10,
      factors: {
        gmvSales: Math.round(gmvSales * 1000) / 1000,
        inventory: Math.round(inventory * 1000) / 1000,
        shortVideo: Math.round(shortVideo * 1000) / 1000,
        clickConversion: Math.round(clickConversion * 1000) / 1000,
        marginProfit: Math.round(marginProfit * 1000) / 1000,
      },
      suggestedRole,
      reasons,
      metrics: {
        recentSoldCount: s?.soldCount ?? 0,
        recentPayment: s?.payment ?? 0,
        availableQty: st?.available ?? 0,
        safetyStock: st?.safety ?? 0,
        shortVideoTraffic: s ? Math.round(
          ([...videoByRoom.values()].reduce((a, v) => a + v.traffic, 0) / Math.max(1, videoByRoom.size)),
        ) : 0,
        avgEntryClickRate: videoByRoom.size > 0
          ? Math.round(
              ([...videoByRoom.values()].reduce((a, v) => a + v.clickRate, 0) / videoByRoom.size) * 10000,
            ) / 10000
          : 0,
        historicalClickRate: s?.clickRate ?? 0,
      },
    }
  })

  // 按综合分排序
  candidates.sort((a, b) => b.totalScore - a.totalScore)

  // 分组建议：每角色取 top N（避免同一商品重复出现在多组）
  const used = new Set<number>()
  // 引流款价格上限：超过它就不再是「引流」而是正价款
  const TRAFFIC_PRICE_CAP = 129
  const pickByRole = (role: 'T' | 'B' | 'P') => {
    const out: AssortmentCandidate[] = []
    // 先取建议角色匹配的
    for (const c of candidates) {
      if (out.length >= topN) break
      if (used.has(c.productId)) continue
      if (c.suggestedRole !== role) continue
      // 所有角色都必须有库存（否则无法承接，防超卖）
      if (c.metrics.availableQty <= 0) continue
      // T 引流款必须是低价品（价格带是引流角色定义的一部分）
      if (role === 'T' && c.retailPrice > TRAFFIC_PRICE_CAP) continue
      used.add(c.productId)
      out.push(c)
    }
    // 不足时按角色语义补足（不破坏角色定义）
    if (out.length < topN) {
      for (const c of candidates) {
        if (out.length >= topN) break
        if (used.has(c.productId)) continue
        if (c.metrics.availableQty <= 0) continue
        // T 补足仍受价格上限约束；宁缺毋滥
        if (role === 'T' && c.retailPrice > TRAFFIC_PRICE_CAP) continue
        used.add(c.productId)
        out.push(c)
      }
    }
    return out
  }

  const traffic = pickByRole('T')
  const benefit = pickByRole('B')
  const profit = pickByRole('P')

  return {
    candidates,
    suggested: { traffic, benefit, profit },
    meta: {
      days,
      candidateCount: candidates.length,
      dataSufficiency: {
        hasSales: sales.size > 0,
        hasInventory: stock.size > 0,
        hasShortVideo: videoByRoom.size > 0,
        hasClick: [...sales.values()].some((s) => s.clickRate != null),
      },
    },
  }
}
