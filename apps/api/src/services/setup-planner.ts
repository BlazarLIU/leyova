/**
 * setup-planner.ts — 首次部署 AI 配置顾问（W2）
 *
 * 设计原则：
 * - 规则优先：模块/平台推荐由确定性规则产生，LLM 只负责解释与文案。
 * - 模型不可用时可完整降级，不阻塞初始化。
 * - 推荐结果必须可解释：每个模块/平台都带理由。
 */

export const SETUP_MODULE_MAP = {
  live: ['session', 'session_products', 'live_data', 'live_registration', 'overview'],
  goods: ['product_center', 'system_inventory', 'net_roi'],
  content: ['content', 'content_schedule'],
  ads: ['net_roi', 'ops'],
  review: ['review', 'review_overview', 'review_channels', 'review_anchors', 'review_funnel', 'review_closed_loop', 'bi'],
  people: ['anchor', 'personal_achievement', 'system_personnel_ops'],
  service: ['customer_service', 'after_sales', 'fulfillment'],
  compliance: ['compliance'],
} as const

export type BusinessEntityType = 'brand_self' | 'mcn' | 'agency' | 'individual'
export type BusinessChannel = 'live' | 'short_video' | 'both'

export interface BusinessProfile {
  entityType: BusinessEntityType
  platforms: string[]
  channel: BusinessChannel
  teamSize: number
  targetGmvBand: 'under_100w' | '100w_500w' | '500w_3000w' | 'above_3000w'
  category?: string
  painPoints: string[]
  needsCrossBorder: boolean
}

export interface SetupRecommendation {
  modules: string[]
  platforms: string[]
  reasons: Record<string, string>
  notes: string[]
}

const PLATFORM_LABEL: Record<string, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  wechat: '视频号',
}

const PAIN_TO_MODULES: Record<string, string[]> = {
  low_traffic: ['ops', 'content', 'net_roi'],
  low_conversion: ['session', 'session_products', 'review_funnel'],
  high_refund: ['after_sales', 'customer_service', 'review_closed_loop'],
  inventory: ['system_inventory', 'product_center'],
  content: ['content', 'content_schedule'],
  ads_roi: ['net_roi', 'ops'],
  staff: ['personal_achievement', 'system_personnel_ops'],
  compliance: ['compliance'],
}

/** 规则画像：把结构化问答归一化为 BusinessProfile */
export function buildProfile(input: Partial<BusinessProfile>): BusinessProfile {
  const entityType = (input.entityType || 'brand_self') as BusinessEntityType
  return {
    entityType,
    platforms: input.platforms?.length ? Array.from(new Set(input.platforms)) : ['douyin'],
    channel: (input.channel || 'live') as BusinessChannel,
    teamSize: Number.isFinite(input.teamSize) ? Math.max(1, Number(input.teamSize)) : 5,
    targetGmvBand: input.targetGmvBand || 'under_100w',
    category: input.category?.trim() || undefined,
    painPoints: input.painPoints?.length ? Array.from(new Set(input.painPoints)) : [],
    needsCrossBorder: Boolean(input.needsCrossBorder),
  }
}

/** 规则推荐：主体类型 + 渠道 + 规模 + 痛点 → 模块/平台 */
export function recommend(profile: BusinessProfile): SetupRecommendation {
  const modules = new Set<string>()
  const reasons: Record<string, string> = {}
  const notes: string[] = []

  const add = (code: string, reason: string) => {
    if (!modules.has(code)) {
      modules.add(code)
      reasons[code] = reason
    }
  }

  add('overview', '经营驾驶舱是所有角色的统一入口')
  add('data', '数据底座用于承接 Excel/API 导入与指标口径')
  add('bi', '经营分析需要口径统一的报表与趋势')
  add('session', '以场次为核心组织排品、盯盘与复盘')

  if (profile.entityType === 'brand_self') {
    for (const code of [...SETUP_MODULE_MAP.goods, ...SETUP_MODULE_MAP.live, ...SETUP_MODULE_MAP.review]) {
      add(code, '品牌自播需要完整的货、场、复盘闭环')
    }
    add('net_roi', '自播投流需要净 ROI 与成本穿透')
    add('system_inventory', '自播要联动库存深度，避免超卖与断货')
  } else if (profile.entityType === 'mcn') {
    for (const code of [...SETUP_MODULE_MAP.people, ...SETUP_MODULE_MAP.content]) {
      add(code, 'MCN 的核心资产是主播与内容产能')
    }
    add('review', '需要按主播/达人维度核算交付与效果')
    add('ops', '多账号并行需要统一运营协同')
    notes.push('MCN 模式默认不启用库存与履约模块，避免干扰人力与内容主线')
  } else if (profile.entityType === 'agency') {
    for (const code of [...SETUP_MODULE_MAP.ads, ...SETUP_MODULE_MAP.review, ...SETUP_MODULE_MAP.people]) {
      add(code, '代运营需要投放、复盘与人效三条主线')
    }
    add('content', '代运营交付通常包含短视频与直播素材')
  } else {
    add('content', '个人/小团队优先用内容撬动自然流量')
    add('personal_achievement', '个人经营需要清晰的个人达成与提成口径')
  }

  if (profile.channel === 'short_video') {
    add('content', '以短视频为主渠道，内容生产是主线')
    add('content_schedule', '需要发布日历管理选题与排期')
  } else if (profile.channel === 'both') {
    add('content', '直播与短视频双渠道，需要统一内容资产')
    add('content_schedule', '双渠道发布需要排期与冲突检查')
  }

  if (profile.teamSize >= 10) {
    add('system_personnel_ops', '团队规模 ≥10 人，需要排班与人效管理')
    add('personal_achievement', '需要按人核算绩效与提成')
  } else if (profile.teamSize >= 5) {
    add('personal_achievement', '小团队也需要个人达成与激励口径')
  }

  for (const pain of profile.painPoints) {
    for (const code of PAIN_TO_MODULES[pain] || []) {
      add(code, `针对痛点「${pain}」推荐`)
    }
  }

  if (profile.needsCrossBorder) {
    add('compliance', '跨境业务需要合规闸门（GPSR/EPR/CPC）')
    notes.push('跨境合规为强前置：缺失资质将阻断上架，建议初始化后优先补齐')
  }

  if (!['under_100w', '100w_500w'].includes(profile.targetGmvBand)) {
    add('review_closed_loop', '目标 GMV 较高，需要动作-结果闭环追踪')
  }

  const platforms = profile.platforms.filter((p) => Boolean(PLATFORM_LABEL[p]))
  const platformReasons: Record<string, string> = {}
  for (const p of platforms) {
    platformReasons[p] = `已在业务画像中选择${PLATFORM_LABEL[p]}`
  }
  if (platforms.length === 0) {
    platforms.push('douyin')
    platformReasons.douyin = '未选择平台时默认启用抖音'
  }

  return {
    modules: Array.from(modules),
    platforms,
    reasons: Object.fromEntries(
      Object.entries(reasons).filter(([code]) => modules.has(code))
    ),
    notes,
  }
}

/** 把推荐结果组装为可提交的 SetupPlan 结构 */
export function composePlan(
  tenant: { name: string; siteName?: string; timezone?: string; logoUrl?: string },
  profile: BusinessProfile,
  recommendation: SetupRecommendation
) {
  return {
    tenant,
    modules: recommendation.modules,
    platforms: recommendation.platforms,
    business: {
      industry: profile.category,
      mode: profile.entityType,
      shopCount: profile.entityType === 'brand_self' ? 1 : undefined,
      teamSize: profile.teamSize,
    },
    aiProfile: profile as unknown as Record<string, unknown>,
    setupSource: 'ai' as const,
  }
}

/** 供前端展示的追问清单（缺字段时） */
export function missingProfileFields(profile: Partial<BusinessProfile>): string[] {
  const missing: string[] = []
  if (!profile.entityType) missing.push('entityType')
  if (!profile.platforms?.length) missing.push('platforms')
  if (!profile.channel) missing.push('channel')
  if (!profile.teamSize) missing.push('teamSize')
  if (!profile.targetGmvBand) missing.push('targetGmvBand')
  return missing
}
