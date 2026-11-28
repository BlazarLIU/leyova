/**
 * attribution-engine.ts — 复盘归因引擎（W3 / X2）
 *
 * 替换前端写死的 0.55 / 0.25 / 0.15 与 142000 兜底，改为确定性漏斗分解：
 *
 *   GMV = 访客数(UV) × 转化率(CR) × 客单价(AOV)
 *   ΔGMV = ΔUV×CR₀×AOV₀ + UV₁×ΔCR×AOV₀ + UV₁×CR₁×ΔAOV
 *
 * 其中 CR₀/AOV₀ 来自同直播间历史基线，目标隐含 UV₀ = 目标值 ÷ (CR₀×AOV₀)，
 * 因此三项之和严格等于「实际支付 GMV − 目标 GMV」，误差为 0（禁用固定占比）。
 *
 * 退款影响不计入支付 GMV 差额，单独列示（计入净额差异）。
 * 任何一环数据不足时显式返回 insufficient，不补数、不兜底。
 */

export interface Queryable {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
}

export interface SessionFacts {
  id: number
  tenantId: number
  title: string
  date: string
  roomId: number | null
  anchorId: number | null
  roomName: string | null
  anchorName: string | null
  gmv: number
  orders: number
  views: number
  onlinePeak: number
  returnAmount: number
  adCost: number
  gpm: number
}

export interface TargetResolution {
  id: number
  periodType: string
  periodStart: string
  periodEnd: string
  scopeType: string
  scopeId: number | null
  targetValue: number
  dailyValue: number
  sessionValue: number
  source: string
  note: string | null
  resolutionNote: string
}

export interface BaselineFacts {
  sessions: number
  avgViews: number
  avgCr: number
  avgAov: number
  avgRefund: number
  scope: 'room' | 'anchor' | 'all'
}

export interface AttributionStage {
  stage: 'traffic' | 'funnel' | 'aov'
  stageName: string
  delta: number
  share: number
  evidence: string
  diagnosis: string
  reconciled: true
}

export interface RefundImpact {
  delta: number
  actualRefund: number
  baselineRefund: number
  actualRefundRate: number
  note: string
  reconciled: false
}

export interface ActionItem {
  id: string
  stage: 'traffic' | 'funnel' | 'aov' | 'refund'
  who: string
  what: string
  when: string
  targetMetric: string
  expectedImpact: { metricCode: string; from: number; to: number; unit: string }
  riskLevel: 'R1' | 'R2' | 'R3'
}

export interface AttributionResult {
  sessionId: number
  sessionTitle: string
  date: string
  anchor: string
  room: string
  caliber: 'pay_gmv'
  trafficCaliber: 'uv' | 'online_peak'
  dataQualityWarnings: string[]
  actual: {
    payGmv: number
    views: number
    orders: number
    cr: number
    aov: number
    refundAmount: number
    refundRate: number
    gpm: number
    adCost: number
  }
  target: (TargetResolution & { metricCode: 'gmv' }) | null
  baseline: BaselineFacts | null
  deltaGmv: number | null
  deltaNet: number | null
  attributions: AttributionStage[]
  refund: RefundImpact | null
  actionItems: ActionItem[]
  mathClosed: boolean
  mathErrorRatio: number
  insufficient: boolean
  insufficientReasons: string[]
  facts: true
  generatedAt: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function loadSessionFacts(db: Queryable, tenantId: number, sessionId: number): Promise<SessionFacts | null> {
  const { rows } = await db.query(
    `SELECT ls.id, ls.title, ls.date::text AS date, ls.room_id, ls.anchor_id,
            lr.name AS room_name, a.name AS anchor_name,
            ls.gmv, ls.orders, ls.views, ls.online_peak, ls.return_amount, ls.ad_cost, ls.gpm
       FROM public.live_sessions ls
       LEFT JOIN public.live_rooms lr ON lr.id = ls.room_id
       LEFT JOIN public.anchors a ON a.id = ls.anchor_id
      WHERE ls.id = $1`,
    [sessionId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    id: Number(r.id),
    tenantId,
    title: r.title || `场次 #${r.id}`,
    date: r.date,
    roomId: r.room_id != null ? Number(r.room_id) : null,
    anchorId: r.anchor_id != null ? Number(r.anchor_id) : null,
    roomName: r.room_name || null,
    anchorName: r.anchor_name || null,
    gmv: Number(r.gmv) || 0,
    orders: Number(r.orders) || 0,
    views: Number(r.views) || 0,
    onlinePeak: Number(r.online_peak) || 0,
    returnAmount: Number(r.return_amount) || 0,
    adCost: Number(r.ad_cost) || 0,
    gpm: Number(r.gpm) || 0,
  }
}

/** 按「范围越具体越优先」解析目标；月/周/大促目标按天折算，再按当日同范围场次数分摊。 */
export async function resolveTargetForSession(
  db: Queryable,
  tenantId: number,
  s: SessionFacts,
): Promise<TargetResolution | null> {
  const { rows } = await db.query(
    `SELECT t.id, t.period_type, t.period_start::text AS period_start, t.period_end::text AS period_end,
            t.scope_type, t.scope_id, t.target_value, t.source, t.note,
            (t.period_end - t.period_start + 1)::int AS days,
            CASE t.scope_type
              WHEN 'live_room' THEN 0 WHEN 'anchor' THEN 1 WHEN 'shop' THEN 2 ELSE 3
            END AS priority
       FROM public.biz_targets t
      WHERE t.tenant_id = $1
        AND t.metric_code = 'gmv'
        AND t.status = 'active'
        AND t.period_start <= $2::date
        AND t.period_end >= $2::date
        AND (
          (t.scope_type = 'live_room' AND t.scope_id = $3)
          OR (t.scope_type = 'anchor' AND t.scope_id = $4)
          OR (t.scope_type = 'shop' AND t.scope_id = (
               SELECT lr.shop_id FROM public.live_rooms lr WHERE lr.id = $5
             ))
          OR t.scope_type = 'company'
        )
      ORDER BY priority ASC, t.period_start DESC
      LIMIT 1`,
    [tenantId, s.date, s.roomId, s.anchorId, s.roomId],
  )
  if (rows.length === 0) return null
  const r = rows[0]
  const targetValue = Number(r.target_value)
  const days = Math.max(1, Number(r.days) || 1)
  const dailyValue = round2(targetValue / days)

  // 当日同范围场次数：让「日目标」落到单场上
  const countParams: any[] = [s.date]
  let countWhere = 'TRUE'
  if (r.scope_type === 'live_room') {
    countParams.push(Number(r.scope_id))
    countWhere = 'room_id = $2'
  } else if (r.scope_type === 'anchor') {
    countParams.push(Number(r.scope_id))
    countWhere = 'anchor_id = $2'
  } else if (r.scope_type === 'shop') {
    countParams.push(Number(r.scope_id))
    countWhere = 'room_id IN (SELECT id FROM public.live_rooms WHERE shop_id = $2)'
  }
  const cnt = await db.query(
    `SELECT count(*)::int AS n FROM public.live_sessions
      WHERE date = $1::date AND status IN ('completed', 'live') AND ${countWhere}`,
    countParams,
  )
  const sessionsThatDay = Math.max(1, Number(cnt.rows[0]?.n) || 1)
  const sessionValue = round2(dailyValue / sessionsThatDay)

  return {
    id: Number(r.id),
    periodType: r.period_type,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    scopeType: r.scope_type,
    scopeId: r.scope_id != null ? Number(r.scope_id) : null,
    targetValue,
    dailyValue,
    sessionValue,
    source: r.source,
    note: r.note || null,
    resolutionNote:
      r.period_type === 'day'
        ? '日目标直接取用'
        : `${r.period_type} 目标 ${targetValue} ÷ ${days} 天 = ${dailyValue}/天，再按当日 ${sessionsThatDay} 场分摊`,
  }
}

/** 历史基线：优先同直播间，其次同主播，最后全公司；至少 3 场且关键指标非零才可用。 */
export async function loadBaseline(db: Queryable, _tenantId: number, s: SessionFacts): Promise<BaselineFacts | null> {
  const candidates: Array<{ scope: BaselineFacts['scope']; where: string; params: any[] }> = []
  if (s.roomId != null) {
    candidates.push({ scope: 'room', where: 'room_id = $2', params: [s.roomId] })
  }
  if (s.anchorId != null) {
    candidates.push({ scope: 'anchor', where: 'anchor_id = $2', params: [s.anchorId] })
  }
  candidates.push({ scope: 'all', where: 'TRUE', params: [] })

  for (const c of candidates) {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n,
              COALESCE(AVG(COALESCE(NULLIF(views, 0), online_peak)), 0) AS avg_views,
              COALESCE(AVG(CASE WHEN orders > 0 THEN gmv / orders END), 0) AS avg_aov,
              COALESCE(AVG(CASE WHEN COALESCE(NULLIF(views, 0), online_peak) > 0
                                THEN orders::numeric / COALESCE(NULLIF(views, 0), online_peak) END), 0) AS avg_cr,
              COALESCE(AVG(return_amount), 0) AS avg_refund
         FROM public.live_sessions
        WHERE status = 'completed'
          AND date >= ($1::date - INTERVAL '30 days')
          AND date < $1::date
          AND ${c.where}`,
      [s.date, ...c.params],
    )
    const r = rows[0]
    const n = Number(r?.n) || 0
    const avgViews = Number(r?.avg_views) || 0
    const avgCr = Number(r?.avg_cr) || 0
    const avgAov = Number(r?.avg_aov) || 0
    if (n >= 3 && avgViews > 0 && avgCr > 0 && avgAov > 0) {
      return {
        sessions: n,
        avgViews: round2(avgViews),
        avgCr,
        avgAov: round2(avgAov),
        avgRefund: round2(Number(r?.avg_refund) || 0),
        scope: c.scope,
      }
    }
  }
  return null
}

function buildStages(input: {
  actualPay: number
  actualViews: number
  actualCr: number
  actualAov: number
  targetValue: number
  baseline: BaselineFacts
  trafficCaliber: 'uv' | 'online_peak'
}): { stages: AttributionStage[]; errorRatio: number } {
  const { actualPay, actualViews, actualCr, actualAov, targetValue, baseline, trafficCaliber } = input
  const trafficLabel = trafficCaliber === 'uv' ? '访客数' : '在线峰值（views 缺失，代理口径）'
  const crLabel = trafficCaliber === 'uv' ? '转化率' : '成交密度（订单/在线峰值）'

  // 目标隐含访客：保持基线转化率与客单价不变
  const impliedViews = targetValue / (baseline.avgCr * baseline.avgAov)
  const delta = round2(actualPay - targetValue)

  const traffic = round2((actualViews - impliedViews) * baseline.avgCr * baseline.avgAov)
  const funnel = round2(actualViews * (actualCr - baseline.avgCr) * baseline.avgAov)
  // 残差项保证「三项之和 = 差额」，误差恒为 0
  const aov = round2(delta - traffic - funnel)

  const share = (v: number) => (delta !== 0 ? Math.round((v / delta) * 10000) / 10000 : 0)

  const stages: AttributionStage[] = [
    {
      stage: 'traffic',
      stageName: '① 流量结构',
      delta: traffic,
      share: share(traffic),
      evidence: `当天${trafficLabel} ${actualViews.toLocaleString()}；目标隐含值 ${Math.round(impliedViews).toLocaleString()}（= 目标 ÷ 基线${crLabel} ÷ 基线客单价，基线 ${baseline.sessions} 场，范围 ${baseline.scope}）`,
      diagnosis:
        propagation(actualViews - impliedViews, '流量不足，优先补付费流量与开播前预热', '流量高于目标隐含水位，流量侧是正贡献，注意承接效率'),
      reconciled: true,
    },
    {
      stage: 'funnel',
      stageName: '② 转化漏斗',
      delta: funnel,
      share: share(funnel),
      evidence: `当天${crLabel} ${(actualCr * 100).toFixed(2)}%；历史基线 ${(baseline.avgCr * 100).toFixed(2)}%`,
      diagnosis:
        propagation(actualCr - baseline.avgCr, '转化效率低于基线，检查讲解节奏、利益点口播与商品卡承接', '转化效率高于基线，保持当前讲解与逼单节奏'),
      reconciled: true,
    },
    {
      stage: 'aov',
      stageName: '③ 客单价',
      delta: aov,
      share: share(aov),
      evidence: `当天客单价 ¥${actualAov.toFixed(2)}；历史基线 ¥${baseline.avgAov.toFixed(2)}`,
      diagnosis:
        propagation(actualAov - baseline.avgAov, '客单价低于基线，检查套组、加购与利润品切入时机', '客单价高于基线，货盘结构对高客单承接有效'),
      reconciled: true,
    },
  ]

  const sum = round2(traffic + funnel + aov)
  const errorRatio = delta === 0 ? 0 : Math.abs(sum - delta) / Math.abs(delta)
  return { stages, errorRatio }
}

function propagation(diff: number, negativeText: string, positiveText: string): string {
  if (Math.abs(diff) < 1e-9) return '该环节与基线基本持平，不是本次差额的主要来源。'
  return diff < 0 ? negativeText + '。' : positiveText + '。'
}

export function buildActionItems(input: {
  sessionId: number
  stages: AttributionStage[]
  refundRate: number
  baseline: BaselineFacts
  actual: { views: number; cr: number; aov: number }
  trafficCaliber: 'uv' | 'online_peak'
}): ActionItem[] {
  const items: ActionItem[] = []
  const { sessionId, stages, refundRate, baseline, actual, trafficCaliber } = input
  const trafficLabel = trafficCaliber === 'uv' ? '访客数' : '在线峰值'
  const trafficUnit = trafficCaliber === 'uv' ? '人次' : '人'
  const byStage = Object.fromEntries(stages.map((s) => [s.stage, s])) as Record<string, AttributionStage>

  if (byStage.traffic && byStage.traffic.delta < 0) {
    items.push({
      id: `ACT-${sessionId}-T`,
      stage: 'traffic',
      who: '投手（投放专员）',
      what: '下一场开播前 1.5 小时按定向人群包预设付费投放，开播后 30 分钟根据在线峰值追投',
      when: '下一场开播前完成',
      targetMetric: `${trafficLabel} ≥ ${Math.round(actual.views - byStage.traffic.delta / (baseline.avgCr * baseline.avgAov)).toLocaleString()}`,
      expectedImpact: {
        metricCode: 'traffic_views',
        from: actual.views,
        to: Math.round(actual.views - byStage.traffic.delta / (baseline.avgCr * baseline.avgAov)),
        unit: trafficUnit,
      },
      riskLevel: 'R3',
    })
  }
  if (byStage.funnel && byStage.funnel.delta < 0) {
    items.push({
      id: `ACT-${sessionId}-F`,
      stage: 'funnel',
      who: '中控（场控）',
      what: '主推款讲解第 3 分钟推送限时机制贴片与弹窗，每 15 分钟复述一次利益点',
      when: '下一场开播执行',
      targetMetric: `转化率 ≥ ${(baseline.avgCr * 100).toFixed(2)}%`,
      expectedImpact: {
        metricCode: 'paid_order_count',
        from: Math.round(actual.views * actual.cr),
        to: Math.round(actual.views * baseline.avgCr),
        unit: '单',
      },
      riskLevel: 'R2',
    })
  }
  if (byStage.aov && byStage.aov.delta < 0) {
    items.push({
      id: `ACT-${sessionId}-A`,
      stage: 'aov',
      who: '运营（排品）',
      what: '调整四层货盘顺序，利润品前置到流量峰值后的第 30 分钟，并配置套装加购',
      when: '下一场排品前完成',
      targetMetric: `客单价 ≥ ¥${baseline.avgAov.toFixed(2)}`,
      expectedImpact: {
        metricCode: 'avg_order_value',
        from: Math.round(actual.aov * 100) / 100,
        to: baseline.avgAov,
        unit: '元',
      },
      riskLevel: 'R2',
    })
  }
  if (refundRate > 0 && refundRate > 0.1) {
    items.push({
      id: `ACT-${sessionId}-R`,
      stage: 'refund',
      who: '客服（售后）',
      what: '开播前核对秒杀品规格与发货时效口播口径，售后 2 小时内主动联系高风险订单',
      when: '下一场开播前完成',
      targetMetric: `退款率 ≤ 10%`,
      expectedImpact: {
        metricCode: 'refund_rate',
        from: Math.round(refundRate * 10000) / 100,
        to: 10,
        unit: '%',
      },
      riskLevel: 'R1',
    })
  }
  return items
}

export async function getSessionAttribution(
  db: Queryable,
  tenantId: number,
  sessionId: number,
): Promise<AttributionResult | null> {
  const s = await loadSessionFacts(db, tenantId, sessionId)
  if (!s) return null

  const reasons: string[] = []
  const [target, baseline] = await Promise.all([
    resolveTargetForSession(db, tenantId, s),
    loadBaseline(db, tenantId, s),
  ])

  // 流量口径：优先真实访客数；缺失时用在线峰值代理并显式标注（不伪装成 UV）
  const trafficCaliber: 'uv' | 'online_peak' = s.views > 0 ? 'uv' : 'online_peak'
  const trafficValue = trafficCaliber === 'uv' ? s.views : s.onlinePeak
  const dataQualityWarnings: string[] =
    trafficCaliber === 'online_peak'
      ? ['views（访客数）缺失，流量环节使用 online_peak（在线峰值）代理，转化率口径为「订单/在线峰值」，结论仅用于趋势判断']
      : []

  const actualCr = trafficValue > 0 ? s.orders / trafficValue : 0
  const actualAov = s.orders > 0 ? s.gmv / s.orders : 0

  if (s.gmv <= 0) reasons.push('该场次支付 GMV 为 0，无法归因')
  if (trafficValue <= 0) reasons.push('该场次访客数（views）与在线峰值（online_peak）均缺失')
  if (s.orders <= 0) reasons.push('该场次支付订单数缺失')
  if (!target) reasons.push('未找到该场次生效中的 GMV 目标（biz_targets），无法计算目标缺口')
  if (!baseline) reasons.push('同范围近 30 天历史基线不足 3 场，无法做漏斗分解')

  const insufficient = reasons.length > 0
  const deltaGmv = target ? round2(s.gmv - target.sessionValue) : null
  const refundRate = s.gmv > 0 ? s.returnAmount / s.gmv : 0

  let stages: AttributionStage[] = []
  let refund: RefundImpact | null = null
  let actionItems: ActionItem[] = []
  let errorRatio = 0

  if (!insufficient && target && baseline) {
    const built = buildStages({
      actualPay: s.gmv,
      actualViews: trafficValue,
      actualCr,
      actualAov,
      targetValue: target.sessionValue,
      baseline,
      trafficCaliber,
    })
    stages = built.stages
    errorRatio = built.errorRatio
    refund = {
      delta: round2(-(s.returnAmount - baseline.avgRefund)),
      actualRefund: round2(s.returnAmount),
      baselineRefund: baseline.avgRefund,
      actualRefundRate: Math.round(refundRate * 10000) / 10000,
      note: '退款影响不计入支付 GMV 差额，单独列示；净额差异 = 支付差额 + 退款影响',
      reconciled: false,
    }
    actionItems = buildActionItems({
      sessionId: s.id,
      stages,
      refundRate,
      baseline,
      actual: { views: trafficValue, cr: actualCr, aov: actualAov },
      trafficCaliber,
    })
  }

  return {
    sessionId: s.id,
    sessionTitle: s.title,
    date: s.date,
    anchor: s.anchorName || '未关联主播',
    room: s.roomName || '未关联直播间',
    caliber: 'pay_gmv',
    trafficCaliber,
    dataQualityWarnings,
    actual: {
      payGmv: round2(s.gmv),
      views: trafficValue,
      orders: s.orders,
      cr: Math.round(actualCr * 10000) / 10000,
      aov: round2(actualAov),
      refundAmount: round2(s.returnAmount),
      refundRate: Math.round(refundRate * 10000) / 10000,
      gpm: s.gpm,
      adCost: round2(s.adCost),
    },
    target: target ? { ...target, metricCode: 'gmv' } : null,
    baseline,
    deltaGmv,
    deltaNet: deltaGmv != null && refund ? round2(deltaGmv + refund.delta) : null,
    attributions: stages,
    refund,
    actionItems,
    mathClosed: !insufficient && errorRatio <= 0.01,
    mathErrorRatio: Math.round(errorRatio * 1000000) / 1000000,
    insufficient,
    insufficientReasons: reasons,
    facts: true,
    generatedAt: new Date().toISOString(),
  }
}
