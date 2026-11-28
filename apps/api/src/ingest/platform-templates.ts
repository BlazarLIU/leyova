/**
 * platform-templates.ts — 平台数据接入模板注册表（阶段 C）
 *
 * 背景：各平台后台导出的报表格式完全不同，不能共用一套解析。
 *
 * ⚠️ 说明：本模板基于调研报告（docs/platform-business-model-comparison.md）
 * 中已知的指标名与字段名构建。真实导出文件可能存在列名差异，
 * 因此每个字段都配置了多个候选别名 + 模糊匹配，并支持用户手动覆盖映射。
 * 拿到真实样本后可用 describeTemplate() 校验并补充别名。
 *
 * 模板结构：
 *   - platformCode：适用平台
 *   - reportType：报表类型（交易/流量/投放/笔记/采团/采销）
 *   - dataType：落入哪张事实表
 *   - columns：标准字段 → { aliases, required, type }
 *   - transform：特殊处理（如父订单展开、成团状态归一）
 */

export type TemplateDataType = 'trade' | 'traffic' | 'ad' | 'content'

export interface TemplateColumn {
  /** 标准字段名 */
  field: string
  /** 中文标签（前端展示） */
  label: string
  /** 候选别名（按优先级） */
  aliases: string[]
  /** 是否必填 */
  required: boolean
  /** 值类型 */
  type: 'string' | 'number' | 'percent' | 'date' | 'currency'
  /** 说明 */
  note?: string
}

export interface PlatformTemplate {
  code: string
  platformCode: string
  platformName: string
  reportType: string
  reportName: string
  dataType: TemplateDataType
  /** 表头特征（用于自动识别） */
  headerHints: string[]
  columns: TemplateColumn[]
  /** 特殊处理说明 */
  transformNote?: string
}

// ═══════════════════════════════════════════════════════════════
// 快手 — 磁力金牛 / 生意通
// ═══════════════════════════════════════════════════════════════

const KUAISHOU_TRADE: PlatformTemplate = {
  code: 'kuaishou_trade',
  platformCode: 'kuaishou',
  platformName: '快手',
  reportType: 'trade',
  reportName: '生意通-交易分析',
  dataType: 'trade',
  headerHints: ['成交金额', '成交订单数', '关注页'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期', '时间'] },
    {
      field: 'channel_name', label: '流量来源', required: false, type: 'string',
      aliases: ['流量来源', '来源', '渠道', '场景'],
      note: '快手核心是「关注页(私域)」与「发现页(公域)」的区分',
    },
    {
      field: 'gmv', label: '成交金额', required: true, type: 'currency',
      aliases: ['成交金额', '成交金额(元)', '支付金额', 'GMV'],
      note: '生意通口径按实际支付时间归日',
    },
    { field: 'paid_order_count', label: '成交订单数', required: true, type: 'number', aliases: ['成交订单数', '订单数', '支付订单数'] },
    { field: 'paid_buyer_count', label: '成交人数', required: false, type: 'number', aliases: ['成交人数', '支付人数', '买家数'] },
    { field: 'refund_amount', label: '退款金额', required: false, type: 'currency', aliases: ['退款金额', '退款金额(元)'] },
    { field: 'refund_count', label: '退款订单数', required: false, type: 'number', aliases: ['退款订单数', '退款笔数'] },
  ],
  transformNote: '流量来源需映射：关注页→private_follow，发现页→recommend。这是快手公私域分析的基础',
}

const KUAISHOU_AD: PlatformTemplate = {
  code: 'kuaishou_ad',
  platformCode: 'kuaishou',
  platformName: '快手',
  reportType: 'ad',
  reportName: '磁力金牛-推广报表',
  dataType: 'ad',
  headerHints: ['花费', '直接成交订单金额', '间接成交订单金额'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期'] },
    { field: 'plan_name', label: '广告计划', required: true, type: 'string', aliases: ['广告计划', '计划名称', '计划'] },
    { field: 'ad_tool', label: '推广工具', required: false, type: 'string', aliases: ['推广工具', '营销工具'] },
    { field: 'ad_spend', label: '花费', required: true, type: 'currency', aliases: ['花费', '消耗', '总消耗'] },
    {
      field: 'ad_gmv', label: '当日总成交订单金额', required: true, type: 'currency',
      aliases: ['当日总成交订单金额', '总成交订单金额', '全站GMV', '成交订单金额'],
      note: '快手官方：当日总成交 = 直接 + 间接',
    },
    {
      field: 'direct_gmv', label: '直接成交订单金额', required: false, type: 'currency',
      aliases: ['直接成交订单金额', '直接成交金额'],
    },
    {
      field: 'indirect_gmv', label: '间接成交订单金额', required: false, type: 'currency',
      aliases: ['间接成交订单金额', '间接成交金额'],
      note: '快手独有的一级指标：点击广告后当天内经其他渠道再次触达成交',
    },
    { field: 'net_gmv', label: '净成交订单金额', required: false, type: 'currency', aliases: ['净成交订单金额', '净成交金额'], note: '剔除下单后 1 小时内退款' },
    { field: 'impressions', label: '曝光数', required: false, type: 'number', aliases: ['曝光数', '曝光量', '展现数'] },
    { field: 'clicks', label: '点击数', required: false, type: 'number', aliases: ['点击数', '点击量'] },
    { field: 'conversions', label: '成交订单数', required: false, type: 'number', aliases: ['成交订单数', '订单数'] },
  ],
  transformNote: '⚠️ 快手官方明确：磁力金牛（投流口径，24h 归因）与生意通（经营口径，实际支付时间）数据天然不可对比，导入后通过双源对账查看差异即可',
}

// ═══════════════════════════════════════════════════════════════
// 视频号 / 微信小店 — 微信小店后台 / 视频号助手
// ═══════════════════════════════════════════════════════════════

const WECHAT_TRADE: PlatformTemplate = {
  code: 'wechat_trade',
  platformCode: 'wechat',
  platformName: '视频号小店',
  reportType: 'trade',
  reportName: '微信小店后台-交易概况',
  dataType: 'trade',
  headerHints: ['成交金额', '订单数', '视频号直播'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期', '时间'] },
    {
      field: 'channel_name', label: '成交场景', required: false, type: 'string',
      aliases: ['成交场景', '来源', '渠道', '场景', '带货场景'],
      note: '视频号侧需区分「视频号直播」「视频号短视频」「公众号」「小程序」「社群/朋友圈(私域)」',
    },
    {
      field: 'gmv', label: '成交金额', required: true, type: 'currency',
      aliases: ['成交金额', '成交金额(元)', '支付金额', '订单实付金额'],
      note: '微信小店仅单一成交口径（订单实付），无抖快式多口径分层',
    },
    { field: 'paid_order_count', label: '成交订单数', required: true, type: 'number', aliases: ['成交订单数', '订单数', '支付订单数'] },
    { field: 'paid_buyer_count', label: '成交人数', required: false, type: 'number', aliases: ['成交人数', '支付人数', '买家数'] },
    { field: 'refund_amount', label: '退款金额', required: false, type: 'currency', aliases: ['退款金额', '退款金额(元)'] },
    { field: 'refund_count', label: '退款订单数', required: false, type: 'number', aliases: ['退款订单数', '退款笔数'] },
  ],
  transformNote:
    '成交场景需归一：视频号直播→live_room，视频号短视频→short_video，公众号→official_account，社群/朋友圈→private_social。微信小店金额单位为元（API 侧为分，由适配器换算）',
}

const WECHAT_TRAFFIC: PlatformTemplate = {
  code: 'wechat_traffic',
  platformCode: 'wechat',
  platformName: '视频号小店',
  reportType: 'traffic',
  reportName: '视频号助手-流量分析',
  dataType: 'traffic',
  headerHints: ['曝光', '观看人数', '直播'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期', '时间'] },
    { field: 'channel_name', label: '流量场景', required: false, type: 'string', aliases: ['流量场景', '来源', '渠道', '场景'] },
    { field: 'impressions', label: '曝光次数', required: false, type: 'number', aliases: ['曝光次数', '曝光量', '展现量'] },
    { field: 'clicks', label: '点击次数', required: false, type: 'number', aliases: ['点击次数', '点击量'] },
    { field: 'visitors', label: '观看/访客人数', required: true, type: 'number', aliases: ['观看人数', '访客数', 'UV', '进房人数'] },
    { field: 'avg_stay_seconds', label: '平均停留时长(秒)', required: false, type: 'number', aliases: ['平均停留时长', '人均观看时长', '停留时长'] },
  ],
  transformNote:
    '视频号流量公私域混合度最高：推荐流(公域)、朋友点赞(社交裂变)、社群与朋友圈(私域)必须分开统计，否则 GPM 与停留时长会被平均值掩盖',
}

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  KUAISHOU_TRADE,
  KUAISHOU_AD,
  WECHAT_TRADE,
  WECHAT_TRAFFIC,
]

/** 按平台获取模板 */
export function getTemplatesByPlatform(platformCode: string): PlatformTemplate[] {
  return PLATFORM_TEMPLATES.filter((t) => t.platformCode === platformCode)
}

/** 按 code 获取模板 */
export function getTemplate(code: string): PlatformTemplate | undefined {
  return PLATFORM_TEMPLATES.find((t) => t.code === code)
}

/**
 * 根据表头自动识别最匹配的模板。
 * 打分：命中的 headerHints 数量 / 总 hints 数量
 */
export function detectTemplate(
  headers: string[],
  platformCode?: string,
): { template: PlatformTemplate; score: number; hintScore: number; fieldScore: number } | null {
  const candidates = platformCode
    ? getTemplatesByPlatform(platformCode)
    : PLATFORM_TEMPLATES

  const headerStr = headers.join('|')

  let best: { template: PlatformTemplate; score: number; hintScore: number; fieldScore: number } | null = null

  for (const t of candidates) {
    // 信号1：表头提示词命中率
    let hintHit = 0
    for (const h of t.headerHints) {
      if (headerStr.includes(h)) hintHit++
    }
    const hintScore = hintHit / Math.max(t.headerHints.length, 1)

    // 信号2：字段别名命中率（更细粒度，能区分同平台的不同报表）
    let fieldHit = 0
    for (const col of t.columns) {
      const matched = col.aliases.some((a) =>
        headers.some((h) => h === a || h.includes(a) || a.includes(h)),
      )
      if (matched) fieldHit++
    }
    const fieldScore = fieldHit / Math.max(t.columns.length, 1)

    // 两个信号都太弱则跳过
    if (hintHit === 0 && fieldHit < 2) continue

    // 加权：字段结构（0.6）比提示词（0.4）更能反映报表类型
    const score = Number((hintScore * 0.4 + fieldScore * 0.6).toFixed(2))

    if (!best || score > best.score) {
      best = { template: t, score, hintScore: Number(hintScore.toFixed(2)), fieldScore: Number(fieldScore.toFixed(2)) }
    }
  }
  return best
}

/**
 * 为给定表头生成字段映射建议。
 * 每个标准字段找第一个匹配的别名（精确 → 包含）。
 */
export function suggestMapping(
  template: PlatformTemplate,
  headers: string[],
): { mapping: Record<string, string | null>; missing: string[] } {
  const mapping: Record<string, string | null> = {}
  const missing: string[] = []

  for (const col of template.columns) {
    let matched: string | null = null
    // 精确匹配
    for (const alias of col.aliases) {
      if (headers.includes(alias)) { matched = alias; break }
    }
    // 包含匹配
    if (!matched) {
      for (const alias of col.aliases) {
        const hit = headers.find((h) => h.includes(alias) || alias.includes(h))
        if (hit) { matched = hit; break }
      }
    }
    mapping[col.field] = matched
    if (!matched && col.required) missing.push(col.label)
  }

  return { mapping, missing }
}

/** 模板摘要（供前端展示） */
export function summarizeTemplate(t: PlatformTemplate) {
  return {
    code: t.code,
    platformCode: t.platformCode,
    platformName: t.platformName,
    reportName: t.reportName,
    reportType: t.reportType,
    dataType: t.dataType,
    fieldCount: t.columns.length,
    requiredFields: t.columns.filter((c) => c.required).map((c) => c.label),
  }
}
