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

export type TemplateDataType = 'trade' | 'traffic' | 'ad' | 'content' | 'pdd_group' | 'jd_po'

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
// 淘宝/天猫 — 生意参谋
// ═══════════════════════════════════════════════════════════════

const TAOBAO_TRADE: PlatformTemplate = {
  code: 'taobao_trade',
  platformCode: 'taobao',
  platformName: '淘宝/天猫',
  reportType: 'trade',
  reportName: '生意参谋-交易概况',
  dataType: 'trade',
  headerHints: ['支付金额', '支付买家数', '访客数'],
  columns: [
    {
      field: 'biz_date', label: '日期', required: true, type: 'date',
      aliases: ['日期', '统计日期', '生意参谋日期', '报表日期', '日期(自然日)'],
    },
    {
      field: 'channel_name', label: '渠道', required: false, type: 'string',
      aliases: ['流量来源', '渠道', '来源', '入店来源', '访客来源'],
      note: '生意参谋按「淘内免费/淘内付费/淘外」三级归类',
    },
    {
      field: 'gmv', label: '支付金额', required: true, type: 'currency',
      aliases: ['支付金额', '支付金额(元)', '成交金额', '支付金额（元）'],
      note: '生意参谋口径：未剔除事后退款',
    },
    {
      field: 'pay_amount', label: '支付金额(实收)', required: false, type: 'currency',
      aliases: ['买家实付金额', '实收金额', '实际支付金额'],
    },
    {
      field: 'paid_order_count', label: '支付子订单数', required: false, type: 'number',
      aliases: ['支付子订单数', '支付订单数', '子订单数', '订单数'],
      note: '淘宝有父子订单双层结构，此字段通常为子订单数',
    },
    {
      field: 'paid_buyer_count', label: '支付买家数', required: true, type: 'number',
      aliases: ['支付买家数', '支付人数', '买家数'],
    },
    {
      field: 'refund_amount', label: '退款��额', required: false, type: 'currency',
      aliases: ['退款金额', '退款金额(元)', '售中退款金额', '售后退款金额'],
    },
    {
      field: 'refund_count', label: '退款订单数', required: false, type: 'number',
      aliases: ['退款订单数', '退款笔数', '��款子订单数'],
    },
  ],
  transformNote: '支付金额为未剔退款口径，退款金额单独记录，净销售 = 支付金额 - 退款金额',
}

const TAOBAO_TRAFFIC: PlatformTemplate = {
  code: 'taobao_traffic',
  platformCode: 'taobao',
  platformName: '淘宝/天猫',
  reportType: 'traffic',
  reportName: '生意参谋-流量概况',
  dataType: 'traffic',
  headerHints: ['访客数', '浏览量', '跳失率'],
  columns: [
    {
      field: 'biz_date', label: '日期', required: true, type: 'date',
      aliases: ['日期', '统计日期', '生意参谋日期'],
    },
    {
      field: 'channel_name', label: '流量来源', required: false, type: 'string',
      aliases: ['流量来源', '来源', '入店来源', '渠道'],
    },
    {
      field: 'impressions', label: '展现量', required: false, type: 'number',
      aliases: ['展现量', '曝光量', '商品展现量'],
    },
    {
      field: 'clicks', label: '浏览量(PV)', required: false, type: 'number',
      aliases: ['浏览量', '浏览量(PV)', 'PV', '点击量'],
    },
    {
      field: 'visitors', label: '访客数(UV)', required: true, type: 'number',
      aliases: ['访客数', '访客数(UV)', 'UV', '访问人数'],
    },
    {
      field: 'avg_stay_seconds', label: '平均停留时长', required: false, type: 'number',
      aliases: ['平均停留时长', '停留时长', '人均停留时长'],
      note: '生意参谋输出格式可能为「00:01:23」，需转换为秒',
    },
  ],
  transformNote: '「平均停留时长」可能是时间格式，需按 cast_duration 规则转换',
}

const TAOBAO_AD: PlatformTemplate = {
  code: 'taobao_ad',
  platformCode: 'taobao',
  platformName: '淘宝/天猫',
  reportType: 'ad',
  reportName: '万相台无界版-推广报表',
  dataType: 'ad',
  headerHints: ['花费', '总成交金额', '投入产出比'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期'] },
    { field: 'plan_name', label: '计划名称', required: true, type: 'string', aliases: ['计划名称', '推广计划', '计划'] },
    { field: 'ad_tool', label: '推广工具', required: false, type: 'string', aliases: ['推广工具', '营销场景'], note: '万相台无界版：关键词推广/信息流/全站推广' },
    { field: 'ad_spend', label: '花费', required: true, type: 'currency', aliases: ['花费', '消耗', '推广花费', '花费(元)'] },
    { field: 'ad_gmv', label: '成交金额', required: true, type: 'currency', aliases: ['总成交金额', '成交金额', '成交金额(元)', '引导成交金额'] },
    { field: 'impressions', label: '展现量', required: false, type: 'number', aliases: ['展现量', '曝光量'] },
    { field: 'clicks', label: '点击量', required: false, type: 'number', aliases: ['点击量', '点击次数'] },
    { field: 'conversions', label: '成交笔数', required: false, type: 'number', aliases: ['成交笔数', '成交订单数', '转化数'] },
  ],
  transformNote: '万相台口径与生意参谋口径天然不一致（去重与归因窗口不同），导入后需通过双源对账视图查看差异',
}

// ═══════════════════════════════════════════════════════════════
// 京东 — 京麦 / 商智
// ═══════════════════════════════════════════════════════════════

const JD_TRADE: PlatformTemplate = {
  code: 'jd_trade',
  platformCode: 'jd',
  platformName: '京东',
  reportType: 'trade',
  reportName: '京麦-交易概况',
  dataType: 'trade',
  headerHints: ['成交金额', '成交客户数', '成交单量'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期', '时间'] },
    { field: 'channel_name', label: '渠道', required: false, type: 'string', aliases: ['渠道', '流量来源', '来源'] },
    {
      field: 'gmv', label: '成交金额', required: true, type: 'currency',
      aliases: ['成交金额', '成交���额(元)', '下单金额'],
      note: '京东口径含货到付款与公司转账，比纯在线支付平台大',
    },
    { field: 'paid_order_count', label: '成交单量', required: true, type: 'number', aliases: ['成交单量', '订单量', '成交订单数'] },
    { field: 'paid_buyer_count', label: '成交客户数', required: true, type: 'number', aliases: ['成交客户数', '客户数', '买家数'] },
    { field: 'refund_amount', label: '退款金额', required: false, type: 'currency', aliases: ['退款金额', '退货金额'] },
    { field: 'refund_count', label: '退款单量', required: false, type: 'number', aliases: ['退款单量', '退款笔数'] },
  ],
  transformNote: '成交金额含 COD，入库时 amount_type 应为 offline_cod_included。若报表区分了在线支付与货到付款，建议分开导入',
}

// ═══════════════════════════════════════════════════════════════
// 拼多多 — 商家后台
// ═══════════════════════════════════════════════════════════════

const PDD_TRADE: PlatformTemplate = {
  code: 'pdd_trade',
  platformCode: 'pdd',
  platformName: '拼多多',
  reportType: 'trade',
  reportName: '商家后台-交易数据',
  dataType: 'trade',
  headerHints: ['成交金额', '订单数', '已成团'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期', '时间'] },
    { field: 'channel_name', label: '渠道', required: false, type: 'string', aliases: ['渠道', '来源', '流量来源'] },
    {
      field: 'gmv', label: '交易额', required: true, type: 'currency',
      aliases: ['交易额', '成交金额', '支付金额', '商家实收金额'],
      note: '拼多多交易额以已成团订单为准',
    },
    { field: 'paid_order_count', label: '订单数', required: true, type: 'number', aliases: ['订单数', '成交订单数', '支付订单数'] },
    { field: 'paid_buyer_count', label: '买家数', required: false, type: 'number', aliases: ['买家数', '支付买家数', '成交买家数'] },
    { field: 'refund_amount', label: '退款金额', required: false, type: 'currency', aliases: ['退款金额', '成功退款金额'] },
    { field: 'refund_count', label: '退款订单数', required: false, type: 'number', aliases: ['退款订单数', '退款笔数', '成功退款订单数'] },
  ],
  transformNote: '⚠️ 拼多多售后指标分母必须是「已成团订单数」。若报表同时含「待成团」与「已成团」，应分开导入或只取已成团',
}

const PDD_GROUP: PlatformTemplate = {
  code: 'pdd_group',
  platformCode: 'pdd',
  platformName: '拼多多',
  reportType: 'group',
  reportName: '拼团订单明细',
  dataType: 'pdd_group',
  headerHints: ['团号', '成团状态', '拼团状态'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '下单日期', '支付日期'] },
    {
      field: 'group_id', label: '团号', required: true, type: 'string',
      aliases: ['团号', '拼团号', 'group_id', '拼团编号'],
    },
    { field: 'product_id', label: '商品ID', required: false, type: 'string', aliases: ['商品ID', '商品编号', 'goods_id'] },
    { field: 'product_name', label: '商品名称', required: false, type: 'string', aliases: ['商品名称', '商品'] },
    {
      field: 'status', label: '成团状态', required: true, type: 'string',
      aliases: ['成团状态', '拼团状态', '团状态', '订单状态'],
      note: '需映射为：waiting(待成团) / grouping(拼团中) / grouped(已成团) / expired(已过期)',
    },
    { field: 'group_size_required', label: '成团人数', required: false, type: 'number', aliases: ['成团人数', '团人数', '拼团人数'] },
    { field: 'group_size_actual', label: '当前人数', required: false, type: 'number', aliases: ['当前人数', '已拼人数', '参团人数'] },
    { field: 'pay_amount', label: '团金额', required: false, type: 'currency', aliases: ['团金额', '支付金额', '订单金额'] },
    { field: 'refund_amount', label: '退款金额', required: false, type: 'currency', aliases: ['退款金额'] },
  ],
  transformNote: '「成团状态」需通过 map_value 规则归一：待分享/待成团→waiting，拼团中→grouping，已成团→grouped，已过期/拼团失败→expired',
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
// 小红书 — 千帆
// ═══════════════════════════════════════════════════════════════

const XHS_NOTE: PlatformTemplate = {
  code: 'xhs_note',
  platformCode: 'xiaohongshu',
  platformName: '小红书',
  reportType: 'note',
  reportName: '千帆-笔记数据',
  dataType: 'content',
  headerHints: ['笔记标题', '笔记曝光', '笔记阅读'],
  columns: [
    { field: 'biz_date', label: '日期', required: true, type: 'date', aliases: ['日期', '统计日期', '数据日期'] },
    {
      field: 'note_id', label: '笔记ID', required: true, type: 'string',
      aliases: ['笔记ID', '笔记编号', 'note_id', '笔记链接'],
    },
    { field: 'title', label: '笔记标题', required: false, type: 'string', aliases: ['笔记标题', '标题', '笔记名称'] },
    {
      field: 'note_type', label: '笔记类型', required: false, type: 'string',
      aliases: ['笔记类型', '内容类型', '���型'],
      note: '图文 / 视频',
    },
    { field: 'impressions', label: '曝光量', required: true, type: 'number', aliases: ['曝光量', '笔记曝光', '曝光数', '展现量'] },
    { field: 'reads', label: '阅读量', required: true, type: 'number', aliases: ['阅读量', '笔记阅读', '阅读数', '点击量'] },
    { field: 'likes', label: '点赞数', required: false, type: 'number', aliases: ['点赞数', '赞', '点赞量'] },
    { field: 'collects', label: '收藏数', required: false, type: 'number', aliases: ['收藏数', '收藏量', '藏'] },
    { field: 'comments', label: '评论数', required: false, type: 'number', aliases: ['评论数', '评论量'] },
    { field: 'shares', label: '分享数', required: false, type: 'number', aliases: ['分享数', '分享���', '转发数'] },
    { field: 'follows', label: '涨粉数', required: false, type: 'number', aliases: ['涨粉数', '新增粉丝', '关注数'] },
    {
      field: 'search_impressions', label: '搜索曝光', required: false, type: 'number',
      aliases: ['搜索曝光', '搜索曝光量', '搜索展现'],
      note: '小红书独立维度：搜索是核心决策入口',
    },
    { field: 'recommend_impressions', label: '推荐曝光', required: false, type: 'number', aliases: ['推荐曝光', '发现页曝光'] },
    { field: 'product_clicks', label: '商品点击', required: false, type: 'number', aliases: ['商品点击', '商品点击量', '进店数'] },
    { field: 'onsite_gmv', label: '站内成交', required: false, type: 'currency', aliases: ['站内成交', '站内成交金额', '成交���额'] },
    {
      field: 'offsite_gmv', label: '站外成交', required: false, type: 'currency',
      aliases: ['站外成交', '站外成交金额', '小红星成交', '种草成交'],
      note: '红猫/红京/红美广告挂链跳转外部平台成交，来自小红星/小红盟回传',
    },
  ],
  transformNote: '⚠️ 小红书允许「零成交」的笔记，导入时不要过滤无成交行——它们是种草资产',
}

// ═══════════════════════════════════════════════════════════════
// 注册表
// ═══════════════════════════════════════════════════════════════

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  TAOBAO_TRADE,
  TAOBAO_TRAFFIC,
  TAOBAO_AD,
  JD_TRADE,
  PDD_TRADE,
  PDD_GROUP,
  KUAISHOU_TRADE,
  KUAISHOU_AD,
  XHS_NOTE,
]

/** 按平台获取模板 */
export function getTemplatesByPlatform(platformCode: string): PlatformTemplate[] {
  return PLATFORM_TEMPLATES.filter(
    (t) => t.platformCode === platformCode ||
      // 天猫复用淘宝模板
      (platformCode === 'tmall' && t.platformCode === 'taobao'),
  )
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
