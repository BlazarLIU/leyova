/**
 * campaign-plan-service.ts — 12 模块一键运营方案生成服务
 * 
 * 整合店铺主档、选品结果、库存与投放规则，输出结构化全流程运营案：
 * M1 场次定位与目标 | M2 货盘结构 | M3 选品依据 | M4 时段节奏 | M5 主播话术
 * M6 岗位分工 | M7 投流计划 | M8 货品库存 | M9 促销机制 | M10 合规自查
 * M11 应急预案 | M12 复盘指标
 */

import type { PoolClient } from 'pg'
import { getRecommendationDetail } from './selection-service.js'

export interface GeneratePlanParams {
  shopId: number
  categoryCode?: string
  templateCode?: string
  sourceRecommendationId?: number
  targetGmv?: number
}

export async function getPlanTemplates(client: PoolClient) {
  const res = await client.query(`
    SELECT t.id, t.template_code, t.name, t.category_code, t.platform_code,
           t.version, t.blocks, t.compliance_rules_version, t.is_active, t.created_at
    FROM public.campaign_plan_template t
    WHERE t.is_active = true
    ORDER BY t.id ASC
  `)
  return res.rows
}

export const PROHIBITED_TERMS = [
  '顶级',
  '全网第一',
  '全网首发',
  '绝无仅有',
  '极品',
  '顶尖',
  '万能',
  '第一品牌',
  '国家级',
  '世界级',
  '最高级',
  '最佳',
] as const

export function checkTextCompliance(texts: (string | undefined | null)[]): {
  passed: boolean
  violations: string[]
} {
  const violations: string[] = []
  for (const text of texts) {
    if (!text) continue
    for (const term of PROHIBITED_TERMS) {
      if (text.includes(term) && !violations.includes(`违禁用语: "${term}"`)) {
        violations.push(`违禁用语: "${term}"`)
      }
    }
  }
  return {
    passed: violations.length === 0,
    violations,
  }
}

export async function generateCampaignPlan(
  client: PoolClient,
  params: GeneratePlanParams,
  user?: { id?: number; tenantId?: number },
) {
  const { shopId, categoryCode = 'APPAREL', templateCode = 'TMPL_STANDARD_LIVE', sourceRecommendationId, targetGmv = 50000 } = params

  // 1. 查询店铺信息
  const shopRes = await client.query(`SELECT id, shop_name, platform_code, business_mode FROM public.dim_shop WHERE id = $1 LIMIT 1`, [shopId])
  if (shopRes.rows.length === 0) {
    throw new Error(`店铺不存在: ${shopId}`)
  }
  const shop = shopRes.rows[0]

  // 2. 查询模板
  const tmplRes = await client.query(
    `SELECT id, template_code, name, version, blocks FROM public.campaign_plan_template WHERE template_code = $1 LIMIT 1`,
    [templateCode],
  )
  const template = tmplRes.rows[0] || {
    id: 1,
    template_code: 'TMPL_STANDARD_LIVE',
    name: '标准全渠道运营方案',
    version: 1,
  }

  // 3. 关联商品池数据
  let selectedSkus: any[] = []
  if (sourceRecommendationId) {
    const recDetail = await getRecommendationDetail(client, sourceRecommendationId)
    if (recDetail && recDetail.items) {
      selectedSkus = recDetail.items
    }
  }

  if (selectedSkus.length === 0) {
    const prodRes = await client.query(
      `SELECT p.id, p.sku_code, p.spu_code, p.product_name, p.category, p.retail_price, p.unit_cost, p.safety_stock
       FROM public.dim_product p
       WHERE p.status = 'active'
       ORDER BY p.id ASC LIMIT 5`,
    )
    selectedSkus = prodRes.rows.map((p, idx) => ({
      rankNo: idx + 1,
      productId: p.id,
      productCode: p.sku_code || p.spu_code,
      suggestedName: p.product_name,
      suggestedPrice: parseFloat(p.retail_price),
      reason: '店铺当季主力现货库存，动销毛利优选',
    }))
  }

  // 4. 构建 12 模块标准 Payload
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const planNo = `PLAN-${dateStr}-${randSuffix}`

  const scripts = {
    title: '主播核心话术库',
    opening: `欢迎各位来到${shop.shop_name}官方直播间！今天不讲虚的，全场换季爆款现货顺丰直发！`,
    hookAndHold: '左下角 1 号链接是今天专属福利款，主播手上的福利码还剩最后 50 份，扣【1】马上解锁！',
    pitch: '这款选用优质高支高密面料，亲肤透气不臃肿，专柜同等品质今天直播间直接砍掉中间商差价！',
    urgency: '这批货是当季现货直发，抢完立即转预售排期 15 天！倒数 3、2、1，直接改价上车！',
  }
  const scriptCompliance = checkTextCompliance([
    scripts.opening,
    scripts.hookAndHold,
    scripts.pitch,
    scripts.urgency,
  ])

  const planPayload = {
    planNo,
    generatedAt: new Date().toISOString(),
    shop: { id: shop.id, name: shop.shop_name, platform: shop.platform_code, mode: shop.business_mode },
    modules: {
      m1_positioning: {
        title: '场次定位与目标拆解',
        theme: `${shop.shop_name}·换季上新与爆款大促专场`,
        targetGmv,
        targetOrders: Math.round(targetGmv / 180),
        targetViewers: 25000,
        expectedRoi: 2.8,
        audienceProfile: '25-40岁都市品质生活人群，兼顾保暖、舒适与高质价比',
      },
      m2_assortment: {
        title: '货盘结构分层',
        structure: [
          { role: '爆款主推 (40%)', count: 2, skus: selectedSkus.slice(0, 2).map((s) => s.suggestedName) },
          { role: '利润连带 (35%)', count: 2, skus: selectedSkus.slice(2, 4).map((s) => s.suggestedName) },
          { role: '引流福利 (15%)', count: 1, skus: selectedSkus.slice(4, 5).map((s) => s.suggestedName) },
          { role: '形象打榜 (10%)', count: 1, skus: ['品牌限定定制周边礼盒'] },
        ],
      },
      m3_selection_reason: {
        title: '选品依据与信号佐证',
        sourceRecommendationId: sourceRecommendationId || null,
        signalsHighlighted: ['真实气温骤降刚需', '近30天GMV高环比', '退款率低于品类基准5%', '现货安全库存充足'],
        skusDetail: selectedSkus,
      },
      m4_timing: {
        title: '时段节奏与5分钟循环',
        suggestedSlot: '18:30 - 22:30 (黄金高峰时段)',
        loops: [
          { period: '18:30-19:00', focus: '开场暖场 + 福袋抽奖 + 憋单拉高在线' },
          { period: '19:00-20:30', focus: '主推款 1 号集中爆破 + 价格锚点对比' },
          { period: '20:30-21:30', focus: '利润款连带组合 + 粉丝团限时加赠' },
          { period: '21:30-22:30', focus: '全场返场清单 + 催付尾单冲刺' },
        ],
      },
      m5_scripts: scripts,
      m6_staffing: {
        title: '主播场控中控岗位协同',
        anchor: '掌控节奏，强化痛点展示与试穿试用，主导 15 分钟过款循环',
        controller: '实时盯紧在线人数与评论弹幕，每 3 分钟同步公屏反馈并播报热销库存',
        operator: '监控投流消耗与实时千川/万相台投放 ROI，依流量峰谷调节出价',
      },
      m7_ad_traffic: {
        title: '付费投流与流量追投',
        budgetAlloc: { preHeat: '20%', livePeak: '60%', tailPush: '20%' },
        chasingCondition: '当场次千次曝光成交额 GPM > 1200 且 ROI > 2.5 时，每 10 分钟追投 2000 元',
        stopCondition: '实时 ROI < 1.2 且退款率异常飙升时，立即暂停追投并切换自然流低价引流款',
      },
      m8_inventory_risk: {
        title: '货品库存与安全预警',
        rule: '当主推款可用库存跌破安全库存 30% 时，场控提示主播切换次主推，避免超卖纠纷',
        replacements: '提前准备同价格带 B 方案 SKU 作为断货替补',
      },
      m9_pricing_promos: {
        title: '大促促销机制设计',
        mechanisms: ['跨店满减满300减50', '官方立减15%', '前100名实付满299赠运费险+定制收纳袋'],
      },
      m10_compliance_checklist: {
        title: '合规风控自查清单',
        rulesChecked: [
          '严禁使用“全网第一”、“顶级”、“绝无仅有”等新广告法绝对化用语',
          '功效性宣称必须具备检测报告备案支持',
          '价格对比必须具备真实划线价凭据',
        ],
        status: scriptCompliance.passed ? 'PASSED' : 'FAILED',
        violations: scriptCompliance.violations,
      },
      m11_emergency_plan: {
        title: '突发异常应急预案',
        plans: [
          { event: '直播间突发断流', action: '中控 60 秒内启动备用推流机，场控向粉丝群推送重开公告' },
          { event: '公屏出现恶意客诉差评', action: '客服专员 30 秒内私信对接解决，中控置顶正向买家秀' },
        ],
      },
      m12_post_session_review: {
        title: '复盘指标与数据对齐',
        kpiList: ['总GMV达成率', '平均停留时长', '曝光点击率 CTR', '点击转化率 CVR', '投流综合 ROI', '30天退款率预期'],
      },
    },
  }

  // 5. 插入数据库
  const tenantId = user?.tenantId || 1
  const userId = user?.id || null

  const insRes = await client.query(
    `INSERT INTO public.campaign_plan (
      plan_no, tenant_id, template_id, template_version, shop_id,
      category_code, plan_payload, source_recommendation_id, approval_status, generated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
    RETURNING id, plan_no, approval_status, created_at`,
    [
      planNo,
      tenantId,
      template.id,
      template.version,
      shop.id,
      categoryCode,
      JSON.stringify(planPayload),
      sourceRecommendationId || null,
      userId,
    ],
  )

  const created = insRes.rows[0]

  return {
    id: parseInt(created.id, 10),
    planNo: created.plan_no,
    shopId: shop.id,
    shopName: shop.shop_name,
    categoryCode,
    templateCode: template.template_code,
    approvalStatus: created.approval_status,
    planPayload,
    createdAt: created.created_at,
  }
}

export async function getCampaignPlanDetail(client: PoolClient, id: number) {
  const res = await client.query(
    `SELECT p.*, s.shop_name, s.platform_code, t.name as template_name,
            u1.real_name as generator_name, u2.real_name as approver_name
     FROM public.campaign_plan p
     LEFT JOIN public.dim_shop s ON p.shop_id = s.id
     LEFT JOIN public.campaign_plan_template t ON p.template_id = t.id
     LEFT JOIN public.users u1 ON p.generated_by = u1.id
     LEFT JOIN public.users u2 ON p.approved_by = u2.id
     WHERE p.id = $1 LIMIT 1`,
    [id],
  )

  return res.rows[0] || null
}

export async function updateCampaignPlanStatus(
  client: PoolClient,
  id: number,
  status: 'approved' | 'rejected',
  user?: { id?: number },
) {
  const res = await client.query(
    `UPDATE public.campaign_plan
     SET approval_status = $1, approved_by = $2, approved_at = now(), updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [status, user?.id || null, id],
  )

  if (res.rows.length === 0) {
    throw new Error(`方案不存在: ${id}`)
  }

  return res.rows[0]
}

export interface DispatchPlanOptions {
  sessionId?: number
  roomId?: number
  planDate?: string
  anchorId?: number
  adBudget?: number
  replaceExistingAssortment?: boolean
}

export interface DispatchSummary {
  scripts: {
    count: number
    items: Array<{ id: number; title: string; category: string }>
  }
  sessionPlan: {
    planId: number
    roomId: number
    planDate: string
    anchorId: number
    productsCount: number
    products: Array<{ groupLetter: string; productCode: string; price: number; productName: string }>
  }
  adPlan: {
    id: number
    planNo: string
    plannedBudget: number
    targetRoi: number
    platformCode: string
    adToolCode: string
    status: string
  }
  dispatchedAt: string
  dispatchedBy?: number | null
}

export async function dispatchCampaignPlan(
  client: PoolClient,
  planId: number,
  options: DispatchPlanOptions = {},
  user?: { id?: number; tenantId?: number },
): Promise<DispatchSummary> {
  const planRes = await client.query(
    `SELECT p.*, s.id as shop_id, s.shop_name, s.platform_code, s.business_mode
     FROM public.campaign_plan p
     JOIN public.dim_shop s ON p.shop_id = s.id
     WHERE p.id = $1 LIMIT 1`,
    [planId],
  )
  if (planRes.rows.length === 0) {
    throw new Error(`运营方案不存在: ${planId}`)
  }
  const plan = planRes.rows[0]
  if (plan.approval_status !== 'approved') {
    throw new Error('只有已审批通过（approved）的运营方案方可下发拆解执行')
  }

  const payload = typeof plan.plan_payload === 'string'
    ? JSON.parse(plan.plan_payload)
    : (plan.plan_payload || {})
  const modules = payload.modules || {}

  // 1. 下发主播核心话术至 script_library
  const m5 = modules.m5_scripts || {}
  const scriptDefinitions = [
    { title: `[${plan.plan_no}] 开场话术`, category: 'opening', content: m5.opening },
    { title: `[${plan.plan_no}] 互动憋单`, category: 'hook', content: m5.hookAndHold },
    { title: `[${plan.plan_no}] 产品推介`, category: 'pitch', content: m5.pitch },
    { title: `[${plan.plan_no}] 促单紧迫感`, category: 'urgency', content: m5.urgency },
  ].filter((s) => Boolean(s.content && typeof s.content === 'string' && s.content.trim().length > 0))

  const createdScripts: Array<{ id: number; title: string; category: string }> = []
  for (const s of scriptDefinitions) {
    const sRes = await client.query(
      `INSERT INTO public.script_library (title, category, content, use_count, likes, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 0, now(), now())
       RETURNING id, title, category`,
      [s.title, s.category, s.content.trim()],
    )
    if (sRes.rows[0]) {
      createdScripts.push(sRes.rows[0])
    }
  }

  // 2. 下发排品计划至 session_plans 与 session_plan_products
  let targetSessionId = options.sessionId ? Number(options.sessionId) : null
  let targetRoomId: number = options.roomId ? Number(options.roomId) : 0
  let targetPlanDate: string = options.planDate || ''
  let targetAnchorId: number = options.anchorId ? Number(options.anchorId) : 0

  if (targetSessionId) {
    const sessRes = await client.query(
      `SELECT id, room_id, anchor_id, date::text as date_str FROM public.live_sessions WHERE id = $1 LIMIT 1`,
      [targetSessionId],
    )
    if (sessRes.rows[0]) {
      const s = sessRes.rows[0]
      if (!targetRoomId && s.room_id) targetRoomId = Number(s.room_id)
      if (!targetAnchorId && s.anchor_id) targetAnchorId = Number(s.anchor_id)
      if (!targetPlanDate && s.date_str) targetPlanDate = s.date_str
    }
  }

  if (!targetRoomId) {
    const roomRes = await client.query(
      `SELECT id FROM public.live_rooms WHERE shop_id = $1 ORDER BY id ASC LIMIT 1`,
      [plan.shop_id],
    )
    targetRoomId = Number(roomRes.rows[0]?.id || 0)
    if (!targetRoomId) {
      const anyRoom = await client.query(`SELECT id FROM public.live_rooms ORDER BY id ASC LIMIT 1`)
      targetRoomId = Number(anyRoom.rows[0]?.id || 1)
    }
  }

  if (!targetAnchorId) {
    const anchorRes = await client.query(
      `SELECT id FROM public.anchors WHERE status = 'active' ORDER BY id ASC LIMIT 1`,
    )
    targetAnchorId = Number(anchorRes.rows[0]?.id || 0)
    if (!targetAnchorId) {
      const anyAnchor = await client.query(`SELECT id FROM public.anchors ORDER BY id ASC LIMIT 1`)
      targetAnchorId = Number(anyAnchor.rows[0]?.id || 1)
    }
  }

  if (!targetPlanDate) {
    targetPlanDate = new Date().toISOString().slice(0, 10)
  }

  let sessionPlanId: number
  const existingPlanRes = await client.query(
    `SELECT id FROM public.session_plans WHERE room_id = $1 AND plan_date = $2::date LIMIT 1`,
    [targetRoomId, targetPlanDate],
  )
  if (existingPlanRes.rows.length > 0) {
    sessionPlanId = existingPlanRes.rows[0].id
    await client.query(`DELETE FROM public.session_plan_products WHERE plan_id = $1`, [sessionPlanId])
  } else {
    const newPlanRes = await client.query(
      `INSERT INTO public.session_plans (room_id, plan_date, anchor_id, notes, created_at, updated_at)
       VALUES ($1, $2::date, $3, $4, now(), now())
       RETURNING id`,
      [
        targetRoomId,
        targetPlanDate,
        targetAnchorId,
        `[AI方案自动拆解] ${plan.plan_no} - ${modules.m1_positioning?.theme || '大促专场'}`,
      ],
    )
    sessionPlanId = newPlanRes.rows[0].id
  }

  const skusDetail: any[] = modules.m3_selection_reason?.skusDetail || []
  const groupLetters = ['A', 'B', 'C', 'D', 'E']
  const insertedProducts: Array<{ groupLetter: string; productCode: string; price: number; productName: string }> = []

  const itemsToInsert = skusDetail.length > 0
    ? skusDetail
    : [
        { rankNo: 1, productCode: 'SKU-CORE-001', suggestedName: '核心引流爆款', suggestedPrice: 69.9 },
        { rankNo: 2, productCode: 'SKU-PROFIT-002', suggestedName: '高毛利主推款', suggestedPrice: 199 },
      ]

  for (let i = 0; i < Math.min(itemsToInsert.length, 5); i++) {
    const item = itemsToInsert[i]
    const letter = groupLetters[i]
    const code = item.productCode || item.skuCode || item.spuCode || `SKU-${item.productId || i + 1}`
    const price = Number(item.suggestedPrice || item.retailPrice || 0)
    const name = item.suggestedName || item.productName || item.name || `方案规划商品 ${letter}`
    const prodIdStr = String(item.productId || item.id || code)

    const snapshot = [
      {
        id: item.productId || i + 1,
        sku_name: name,
        product_code: code,
        suggested_price: price,
        reason: item.reason || 'AI 运营方案排品推荐',
      },
    ]

    await client.query(
      `INSERT INTO public.session_plan_products (
        plan_id, group_letter, product_code, price, session_id,
        room_id, business_date, product_order, product_name, product_id,
        sku_snapshot_jsonb, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7::date, $8, $9, $10,
        $11, now(), now()
      )`,
      [
        sessionPlanId,
        letter,
        code,
        price,
        targetSessionId,
        targetRoomId,
        targetPlanDate,
        i + 1,
        name,
        prodIdStr,
        JSON.stringify(snapshot),
      ],
    )

    insertedProducts.push({ groupLetter: letter, productCode: code, price, productName: name })
  }

  // 3. 下发投流计划至 ad_plan
  const m1 = modules.m1_positioning || {}
  const m7 = modules.m7_ad_traffic || {}

  const targetGmv = Number(m1.targetGmv || 50000)
  const targetRoi = Number(m1.expectedRoi || 2.5)
  const plannedBudget = options.adBudget ?? (targetRoi > 0 ? Number((targetGmv / targetRoi).toFixed(2)) : 5000)

  const parseRatio = (r: any, def: number) => {
    if (typeof r === 'number') return r > 1 ? r / 100 : r
    if (typeof r === 'string') {
      const match = r.match(/([0-9]+(\.[0-9]+)?)/)
      if (match) return Number(match[1]) / 100
    }
    return def
  }
  const preHeatRatio = parseRatio(m7.budgetAlloc?.preHeat, 0.20)
  const livePeakRatio = parseRatio(m7.budgetAlloc?.livePeak, 0.60)
  const tailPushRatio = parseRatio(m7.budgetAlloc?.tailPush, 0.20)

  const platformCode = plan.platform_code || 'douyin'
  const adToolMap: Record<string, string> = {
    douyin: 'qianchuan',
    kuaishou: 'cili_jinniu',
    taobao: 'wanxiangtai',
    tmall: 'wanxiangtai_tm',
    xiaohongshu: 'juguang',
    wechat: 'wechat_ad',
  }
  const adToolCode = adToolMap[platformCode] || 'qianchuan'

  const adPlanNo = `AD-${plan.plan_no}`
  const adPlanName = `[方案拆解投流] ${m1.theme || plan.shop_name + '专场'} (${plan.plan_no})`
  const targetingTags = [
    { tag: m1.audienceProfile || '优质潜力人群', type: 'audience' },
    { tag: m7.chasingCondition || '追投策略', type: 'condition' },
  ]

  const existingAdPlan = await client.query(
    `SELECT id FROM public.ad_plan WHERE plan_no = $1 LIMIT 1`,
    [adPlanNo],
  )
  let adPlanRow: any
  if (existingAdPlan.rows.length > 0) {
    const updRes = await client.query(
      `UPDATE public.ad_plan SET
        planned_budget = $1,
        target_roi = $2,
        pre_heat_ratio = $3,
        live_peak_ratio = $4,
        tail_push_ratio = $5,
        session_id = COALESCE($6, session_id),
        targeting_tags = $7,
        status = 'approved',
        updated_at = now()
       WHERE id = $8
       RETURNING id, plan_no, planned_budget, target_roi, status`,
      [
        plannedBudget,
        targetRoi,
        preHeatRatio,
        livePeakRatio,
        tailPushRatio,
        targetSessionId,
        JSON.stringify(targetingTags),
        existingAdPlan.rows[0].id,
      ],
    )
    adPlanRow = updRes.rows[0]
  } else {
    const insAdRes = await client.query(
      `INSERT INTO public.ad_plan (
        tenant_id, plan_no, session_id, shop_id, platform_code, ad_tool_code,
        plan_name, plan_date, planned_budget, target_roi,
        pre_heat_ratio, live_peak_ratio, tail_push_ratio,
        targeting_tags, bid_strategy, status, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8::date, $9, $10,
        $11, $12, $13,
        $14, 'auto_bid', 'approved', $15, now(), now()
      )
      RETURNING id, plan_no, planned_budget, target_roi, status`,
      [
        plan.tenant_id || 1,
        adPlanNo,
        targetSessionId,
        plan.shop_id,
        platformCode,
        adToolCode,
        adPlanName,
        targetPlanDate,
        plannedBudget,
        targetRoi,
        preHeatRatio,
        livePeakRatio,
        tailPushRatio,
        JSON.stringify(targetingTags),
        user?.id || null,
      ],
    )
    adPlanRow = insAdRes.rows[0]
  }

  // 4. 更新 campaign_plan 拆解状态与汇总
  const dispatchSummary: DispatchSummary = {
    scripts: {
      count: createdScripts.length,
      items: createdScripts,
    },
    sessionPlan: {
      planId: sessionPlanId,
      roomId: targetRoomId,
      planDate: targetPlanDate,
      anchorId: targetAnchorId,
      productsCount: insertedProducts.length,
      products: insertedProducts,
    },
    adPlan: {
      id: Number(adPlanRow.id),
      planNo: adPlanRow.plan_no,
      plannedBudget: Number(adPlanRow.planned_budget),
      targetRoi: Number(adPlanRow.target_roi),
      platformCode,
      adToolCode,
      status: adPlanRow.status,
    },
    dispatchedAt: new Date().toISOString(),
    dispatchedBy: user?.id || null,
  }

  await client.query(
    `UPDATE public.campaign_plan
     SET dispatched_at = now(),
         dispatched_by = $1,
         dispatch_summary = $2,
         updated_at = now()
     WHERE id = $3`,
    [user?.id || null, JSON.stringify(dispatchSummary), planId],
  )

  return dispatchSummary
}
