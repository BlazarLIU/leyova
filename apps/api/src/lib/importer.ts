/**
 * importer.ts — 抖音直播日报 CSV/XLSX 解析、校验与导入核心库
 *
 * 功能：
 *   - 数值/百分比/时长解析
 *   - 主播/直播间/中控 名称 → ID 缓存查询
 *   - 抖音模板自动识别
 *   - 三种数据类型导入（直播场次 CSV / 主播分析 XLSX / 渠道分析 XLSX）
 *   - 导入前校验 + 预览
 */

import type { Pool, PoolClient } from 'pg'

// ═══════════════════════════════════════════════════════════════
// 1. 基础解析函数
// ═══════════════════════════════════════════════════════════════

export function text(value: unknown): string {
  return String(value ?? '').trim()
}

/** 列名查找：优先精确匹配，再模糊匹配（包含关键词）。兼容不同模板列名差异 */
export function findColumn(row: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (c in row) return c
  }
  for (const c of candidates) {
    const hit = Object.keys(row).find((k) => k.includes(c))
    if (hit) return hit
  }
  return undefined
}

/** 解析含 ¥/逗号/空值的金额/数字 → number|null */
export function parseNumeric(value: unknown): number | null {
  const raw = text(value).replace(/[¥,\s]/g, '')
  if (!raw || raw === '—' || raw === '-') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

/** 解析 "6.19%" → 6.19，非百分比格式返回 null */
export function parsePercentage(value: unknown): number | null {
  const raw = text(value)
  const num = parseNumeric(raw.replace('%', ''))
  if (num === null) return null
  return raw.includes('%') ? num : null
}

/** 解析 "3小时57分钟" → 237（分钟数） */
export function parseDurationMin(value: unknown): number | null {
  const raw = text(value)
  if (!raw || raw === '—' || raw === '-') return null
  const hour = Number(raw.match(/(\d+)小时/)?.[1] ?? 0)
  const minute = Number(raw.match(/(\d+)分(?:钟)?/)?.[1] ?? 0)
  return hour * 60 + minute
}

/** 解析 "1分钟21秒" → 81（秒数） */
export function parseDurationSec(value: unknown): number | null {
  const raw = text(value)
  if (!raw || raw === '—' || raw === '-') return null
  const hour = Number(raw.match(/(\d+)小时/)?.[1] ?? 0)
  const minute = Number(raw.match(/(\d+)分(?:钟)?/)?.[1] ?? 0)
  const second = Number(raw.match(/(\d+)秒/)?.[1] ?? 0)
  return hour * 3600 + minute * 60 + second
}

// ═══════════════════════════════════════════════════════════════
// 2. 名称 → ID 缓存查询
// ═══════════════════════════════════════════════════════════════

export type NameCache = Record<string, { id: number }>

export async function resolveAnchorId(
  pool: Pool | PoolClient,
  name: string,
  cache: NameCache = {},
): Promise<number | null> {
  if (cache[name]) return cache[name].id
  const r = await pool.query('SELECT id FROM anchors WHERE name = $1 LIMIT 1', [name])
  if (r.rows.length > 0) {
    cache[name] = r.rows[0]
    return r.rows[0].id
  }
  return null
}

export async function resolveRoomId(
  pool: Pool | PoolClient,
  name: string,
  cache: NameCache = {},
): Promise<number | null> {
  if (cache[name]) return cache[name].id
  const r = await pool.query('SELECT id FROM live_rooms WHERE name = $1 LIMIT 1', [name])
  if (r.rows.length > 0) {
    cache[name] = r.rows[0]
    return r.rows[0].id
  }
  return null
}

export async function resolveOperatorId(
  pool: Pool | PoolClient,
  name: string,
  cache: NameCache = {},
): Promise<number | null> {
  if (cache[name]) return cache[name].id
  const r = await pool.query('SELECT id FROM operators WHERE name = $1 AND status = 1 LIMIT 1', [name])
  if (r.rows.length > 0) {
    cache[name] = r.rows[0]
    return r.rows[0].id
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 3. 抖音模板识别
// ═══════════════════════════════════════════════════════════════

export const TEMPLATES = {
  ANCHOR: 'anchor_analysis',
  CHANNEL: 'channel_analysis',
  FULL_SESSION: 'full_session',
} as const

export type TemplateType = (typeof TEMPLATES)[keyof typeof TEMPLATES] | null

export function detectDouyinTemplate(headers: string[]): TemplateType {
  if (headers.includes('渠道名称') && headers.includes('直播间曝光次数')) {
    return TEMPLATES.CHANNEL
  }
  if (
    headers.includes('主播名称') &&
    headers.includes('单小时用户支付金额')
  ) {
    return TEMPLATES.ANCHOR
  }
  return null
}

/**
 * 检测是否为「整场数据」（直播间详情页多 Sheet Excel）
 * 基于文件名匹配
 */
export function detectFullSessionTemplate(fileName: string): boolean {
  return /直播间详情页.*整场数据下载\.xlsx$/i.test(fileName)
}

/** 解析 "08:31" 或 "08:31:00" → 秒数（距午夜） */
function parseTimeToSec(value: unknown): number | null {
  const raw = text(value)
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + (parseInt(m[3]) || 0)
}

/** 解析 "08:31" 或 "08:31:00" → "08:31:00" 格式 TIME */
function parseTimeStr(value: unknown): string | null {
  const raw = text(value)
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3]?.padStart(2, '0') || '00'}`
}

/** 从抖音导出文件名提取业务日期 */
export function inferBusinessDate(fileName: string): string | null {
  // 1. 筛选日期[YYYY-MM-DD-YYYY-MM-DD]
  const range = fileName.match(
    /筛选日期\[(\d{4}-\d{2}-\d{2})-\d{4}-\d{2}-\d{2}\]/,
  )
  if (range) return range[1]

  // 2. _YYYYMMDD_ 紧凑格式
  const compact = fileName.match(/_(\d{4})(\d{2})(\d{2})_/)
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`

  // 3. _YYYY-MM-DD_ 带横线格式（如 直播间详情页_店铺名_2026-08-06_...）
  const dashed = fileName.match(/_(\d{4})-(\d{2})-(\d{2})_/)
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`

  // 4. _MMdd_HHmm 紧凑格式（如 直播复盘_渠道分析_0808_2000）
  //    从文件名推断年份，若推断日期在未来则用上一年
  const shortTime = fileName.match(/_(\d{2})(\d{2})_(\d{4})/)
  if (shortTime) {
    const month = shortTime[1]
    const day = shortTime[2]
    const now = new Date()
    const year = now.getFullYear()
    const candidate = new Date(`${year}-${month}-${day}`)
    if (candidate > now) {
      candidate.setFullYear(year - 1)
    }
    return `${candidate.getFullYear()}-${month}-${day}`
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// 4. 导入：主播分析 XLSX → session_anchor_metrics（独立表）
// ═══════════════════════════════════════════════════════════════

export type WorksheetRow = Record<string, unknown>

export interface ImportResult {
  imported: number
  errors: string[]
}

/**
 * 将主播分析 XLSX 数据导入 session_anchor_metrics 独立表
 * 使用 UPSERT（ON CONFLICT (date, anchor_id) DO UPDATE）
 * 完全独立于 live_sessions，不影响直播管理模块
 */
export async function importAnchorAnalysis(
  pool: Pool | PoolClient,
  rows: WorksheetRow[],
  businessDate: string,
  roomAssignments: Record<string, number> = {},
  anchorNameCache?: NameCache,
  uploadId?: number | null,
): Promise<ImportResult> {
  const errors: string[] = []
  let imported = 0
  const anchorCache: NameCache = anchorNameCache ?? {}

  for (const row of rows) {
    try {
      const anchorName = text(row['主播名称'])
      if (!anchorName || ['整体', '较上周期', '同行同级优秀值'].includes(anchorName)) {
        continue
      }

      const anchorId = await resolveAnchorId(pool, anchorName, anchorCache)
      if (!anchorId) {
        errors.push(`主播"${anchorName}"未在系统中找到，跳过`)
        continue
      }

      const durationMin = parseDurationMin(row['开播时长'])
      const gmv = parseNumeric(row['直播间用户支付金额']) ?? 0
      const gmvPerHour = parseNumeric(row['单小时用户支付金额']) ?? 0
      const peakOnline = parseNumeric(row['最高在线人数']) ?? 0
      const avgOnline = parseNumeric(row['平均在线人数']) ?? 0
      const avgItemPrice = parseNumeric(row['平均件单价']) ?? 0
      const expViewRate = parsePercentage(row['引流能力 曝光-观看率']) ?? 0
      const retentionRate = parsePercentage(row['留人能力 留存率']) ?? 0
      const interactionRate = parsePercentage(row['互动能力 观看-互动率']) ?? 0
      const newFans = parseNumeric(row['吸粉能力 新增粉丝数']) ?? 0
      const viewFollowRate = parsePercentage(row['吸粉能力 观看-关注率']) ?? 0
      const groupJoiners = parseNumeric(row['吸粉能力 新加团人数']) ?? 0
      const uvValue = parseNumeric(row['转化能力 单UV价值(元)']) ?? 0
      const buyers = parseNumeric(row['成交人数']) ?? 0
      const views = parseNumeric(row['直播间观看次数']) ?? 0

      // 构建人群画像 JSON
      const profile: Record<string, string> = {}
      const strategy = text(row['策略人群TOP3'])
      if (strategy) profile.strategy_top3 = strategy
      const gender = text(row['性别'])
      if (gender) profile.gender = gender
      const age = text(row['年龄段TOP3'])
      if (age) profile.age_top3 = age
      const cityTier = text(row['城市等级TOP3'])
      if (cityTier) profile.city_tier_top3 = cityTier
      const region = text(row['地域分布TOP3'])
      if (region) profile.region_top3 = region
      const audienceProfile =
        Object.keys(profile).length > 0 ? JSON.stringify(profile) : null

      // 计算 GPM（如果 views 可用，否则为 0）
      const gpm = views > 0 && gmv > 0 ? Number(((gmv / views) * 1000).toFixed(2)) : 0

      // 获取 room_id：优先使用预览时关联的直播间
      const roomId = roomAssignments[anchorName] ?? null
      if (!roomId) {
        errors.push(`主播"${anchorName}"没有关联的直播间，无法导入数据`)
        continue
      }

      // UPSERT 到独立的 session_anchor_metrics 表
      await pool.query(
        `INSERT INTO session_anchor_metrics
           (date, anchor_id, room_id, duration_min, gmv, gmv_per_hour,
            online_peak, avg_online, avg_item_price, exposure_view_rate,
            retention_rate, interaction_rate, new_fans, view_follow_rate,
            new_group_members, uv_value, buyer_count, audience_profile, gpm, views, title)
         VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (date, anchor_id) DO UPDATE SET
           room_id            = EXCLUDED.room_id,
           duration_min       = EXCLUDED.duration_min,
           gmv                = EXCLUDED.gmv,
           gmv_per_hour       = EXCLUDED.gmv_per_hour,
           online_peak        = EXCLUDED.online_peak,
           avg_online         = EXCLUDED.avg_online,
           avg_item_price     = EXCLUDED.avg_item_price,
           exposure_view_rate = EXCLUDED.exposure_view_rate,
           retention_rate     = EXCLUDED.retention_rate,
           interaction_rate   = EXCLUDED.interaction_rate,
           new_fans           = EXCLUDED.new_fans,
           view_follow_rate   = EXCLUDED.view_follow_rate,
           new_group_members  = EXCLUDED.new_group_members,
           uv_value           = EXCLUDED.uv_value,
           buyer_count        = EXCLUDED.buyer_count,
           audience_profile   = EXCLUDED.audience_profile,
           gpm                = EXCLUDED.gpm,
           views              = EXCLUDED.views,
           title              = EXCLUDED.title,
           updated_at         = NOW()`,
        [
          businessDate,
          anchorId,
          roomId,
          durationMin || 0,
          gmv,
          gmvPerHour,
          peakOnline,
          avgOnline,
          avgItemPrice,
          expViewRate,
          retentionRate,
          interactionRate,
          newFans,
          viewFollowRate,
          groupJoiners,
          uvValue,
          buyers,
          audienceProfile,
          gpm,
          views,
          `主播分析导入 ${businessDate}`,
        ],
      )

      // 同步写入 douyin_anchor_daily_metrics 表（供上传数据管理页面展示）
      await pool.query(
        `INSERT INTO douyin_anchor_daily_metrics
           (business_date, account_name, anchor_name, anchor_id, live_duration_seconds,
            payment_amount, hourly_payment, peak_online, avg_online, avg_item_price,
            exposure_view_rate, retention_rate, interaction_rate, new_followers,
            watch_follow_rate, group_joiners, uv_value, buyers,
            strategy_audience_top3, gender_top3, age_top3, city_tier_top3, region_top3,
            upload_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                 $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 $21,$22,$23,$24)
         ON CONFLICT (business_date, account_name, anchor_name) DO UPDATE SET
           anchor_id            = EXCLUDED.anchor_id,
           live_duration_seconds = EXCLUDED.live_duration_seconds,
           payment_amount       = EXCLUDED.payment_amount,
           hourly_payment       = EXCLUDED.hourly_payment,
           peak_online          = EXCLUDED.peak_online,
           avg_online           = EXCLUDED.avg_online,
           avg_item_price       = EXCLUDED.avg_item_price,
           exposure_view_rate   = EXCLUDED.exposure_view_rate,
           retention_rate       = EXCLUDED.retention_rate,
           interaction_rate     = EXCLUDED.interaction_rate,
           new_followers        = EXCLUDED.new_followers,
           watch_follow_rate    = EXCLUDED.watch_follow_rate,
           group_joiners        = EXCLUDED.group_joiners,
           uv_value             = EXCLUDED.uv_value,
           buyers               = EXCLUDED.buyers,
           strategy_audience_top3 = EXCLUDED.strategy_audience_top3,
           gender_top3          = EXCLUDED.gender_top3,
           age_top3             = EXCLUDED.age_top3,
           city_tier_top3       = EXCLUDED.city_tier_top3,
           region_top3          = EXCLUDED.region_top3,
           upload_id            = EXCLUDED.upload_id,
           updated_at           = NOW()`,
        [
          businessDate,
          '',            // account_name 暂空
          anchorName,
          anchorId,
          (durationMin || 0) * 60, // 分钟→秒
          gmv,
          gmvPerHour,
          peakOnline,
          avgOnline,
          avgItemPrice,
          expViewRate / 100,  // 百分比→小数 (5.82→0.0582)
          retentionRate / 100,
          interactionRate / 100,
          newFans,
          viewFollowRate / 100,
          groupJoiners,
          uvValue,
          buyers,
          strategy || null,
          gender || null,
          age || null,
          cityTier || null,
          region || null,
          uploadId,
        ],
      )
      imported++
    } catch (err: any) {
      errors.push(
        `主播"${text(row['主播名称'])}"处理失败: ${err.message}`,
      )
    }
  }

  return { imported, errors }
}

// ═══════════════════════════════════════════════════════════════
// 5. 导入：渠道分析 XLSX → session_channel_metrics
// ═══════════════════════════════════════════════════════════════

/**
 * 将渠道分析 XLSX 数据导入 session_channel_metrics 表
 * 可通过 sessionId 关联到 live_sessions，也可独立存储（sessionId=null）
 */
export async function importChannelAnalysis(
  pool: Pool | PoolClient,
  rows: WorksheetRow[],
  businessDate: string,
  sessionId: number | null,
  uploadId?: number | null,
): Promise<ImportResult> {
  const errors: string[] = []
  let imported = 0

  // 非 session 关联的上传，先清理该日期下已有的无 session 数据
  if (!sessionId) {
    await pool.query(
      'DELETE FROM session_channel_metrics WHERE period_date = $1::date AND session_id IS NULL',
      [businessDate],
    )
    // 同步清理 douyin_channel_daily_metrics 同日期数据
    await pool.query(
      'DELETE FROM douyin_channel_daily_metrics WHERE business_date = $1::date',
      [businessDate],
    )
  }

  for (const row of rows) {
    try {
      const channelName = text(row['渠道名称'])
      if (!channelName || ['整体', '较上周期', '同行同级优秀值'].includes(channelName)) {
        continue
      }

      const impressions = parseNumeric(row['直播间曝光次数']) ?? 0
      const views = parseNumeric(row['直播间观看次数']) ?? 0
      const interactions = parseNumeric(row['直播间互动次数']) ?? 0
      const productImpressions = parseNumeric(row['商品曝光次数']) ?? 0
      const productClicks = parseNumeric(row['商品点击次数']) ?? 0
      const orders = parseNumeric(row['成交订单数']) ?? 0
      const buyers = parseNumeric(row['成交人数']) ?? 0
      const gmv = parseNumeric(row['用户支付金额']) ?? 0
      const items = parseNumeric(row['成交件数']) ?? 0
      const gpm = parseNumeric(row['千次观看用户支付金额']) ?? 0
      const avgOrderValue = parseNumeric(row['客单价']) ?? 0
      const adSpendBound = parseNumeric(row['投放消耗(店铺绑定)']) ?? 0
      const adSpendPromoted = parseNumeric(row['投放消耗(店铺被投)']) ?? 0
      const adSpendCombined = parseNumeric(row['投放消耗(店铺绑定/被投)']) ?? 0
      const adSpend = adSpendCombined || adSpendBound + adSpendPromoted
      const channelNewFans = parseNumeric(row['新增粉丝数']) ?? 0
      const avgWatchSec = parseDurationSec(row['人均观看时长']) ?? 0
      const expViewRate = parsePercentage(row['直播间曝光-观看率(次数)']) ?? 0
      const viewInteractRate = parsePercentage(row['直播间观看-互动率(次数)']) ?? 0
      const productClickRate = parsePercentage(row['商品曝光-点击率(次数)']) ?? 0
      const productDealRate = parsePercentage(row['商品点击-成交率(次数)']) ?? 0

      await pool.query(
        `INSERT INTO session_channel_metrics
           (session_id, channel, avg_watch_sec, impressions, views, exposure_view_rate,
            interactions, view_interaction_rate, new_fans,
            product_impressions, product_clicks, product_click_rate, product_deal_rate,
            orders, buyer_count, gmv, item_count, gpm, avg_order_value, ad_spend, period_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::date)
         ON CONFLICT (period_date, channel) DO UPDATE SET
           session_id            = EXCLUDED.session_id,
           avg_watch_sec         = EXCLUDED.avg_watch_sec,
           impressions           = EXCLUDED.impressions,
           views                 = EXCLUDED.views,
           exposure_view_rate    = EXCLUDED.exposure_view_rate,
           interactions           = EXCLUDED.interactions,
           view_interaction_rate = EXCLUDED.view_interaction_rate,
           new_fans               = EXCLUDED.new_fans,
           product_impressions    = EXCLUDED.product_impressions,
           product_clicks         = EXCLUDED.product_clicks,
           product_click_rate     = EXCLUDED.product_click_rate,
           product_deal_rate      = EXCLUDED.product_deal_rate,
           orders                 = EXCLUDED.orders,
           buyer_count            = EXCLUDED.buyer_count,
           gmv                    = EXCLUDED.gmv,
           item_count             = EXCLUDED.item_count,
           gpm                    = EXCLUDED.gpm,
           avg_order_value        = EXCLUDED.avg_order_value,
           ad_spend               = EXCLUDED.ad_spend,
           period_date            = EXCLUDED.period_date`,
        [
          sessionId,
          channelName,
          avgWatchSec,
          impressions,
          views,
          expViewRate,
          interactions,
          viewInteractRate,
          channelNewFans,
          productImpressions,
          productClicks,
          productClickRate,
          productDealRate,
          orders,
          buyers,
          gmv,
          items,
          gpm,
          avgOrderValue,
          adSpend,
          businessDate,
        ],
      )

      // 同步写入 douyin_channel_daily_metrics（供上传数据管理页面展示）
      await pool.query(
        `INSERT INTO douyin_channel_daily_metrics
           (business_date, channel_name, live_duration_seconds, avg_watch_seconds,
            impressions, viewers, interactions, new_followers,
            product_impressions, product_clicks, order_count, buyer_count,
            payment_amount, item_count, thousand_view_payment, avg_order_value,
            ad_cost_bound, ad_cost_promoted, upload_id)
         VALUES ($1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (business_date, channel_name) DO UPDATE SET
           avg_watch_seconds     = EXCLUDED.avg_watch_seconds,
           impressions           = EXCLUDED.impressions,
           viewers               = EXCLUDED.viewers,
           interactions          = EXCLUDED.interactions,
           new_followers         = EXCLUDED.new_followers,
           product_impressions   = EXCLUDED.product_impressions,
           product_clicks        = EXCLUDED.product_clicks,
           order_count           = EXCLUDED.order_count,
           buyer_count           = EXCLUDED.buyer_count,
           payment_amount        = EXCLUDED.payment_amount,
           item_count            = EXCLUDED.item_count,
           thousand_view_payment = EXCLUDED.thousand_view_payment,
           avg_order_value       = EXCLUDED.avg_order_value,
           ad_cost_bound         = EXCLUDED.ad_cost_bound,
           ad_cost_promoted      = EXCLUDED.ad_cost_promoted,
           upload_id             = EXCLUDED.upload_id,
           updated_at            = NOW()`,
        [
          businessDate,
          channelName,
          0,                      // live_duration_seconds 渠道分析无此字段
          avgWatchSec,
          impressions,
          views,
          interactions,
          channelNewFans,
          productImpressions,
          productClicks,
          orders,
          buyers,
          gmv,
          items,
          gpm,
          avgOrderValue,
          adSpendBound,
          adSpendPromoted,
          uploadId,
        ],
      )
      imported++
    } catch (err: any) {
      errors.push(
        `渠道"${text(row['渠道名称'])}"处理失败: ${err.message}`,
      )
    }
  }

  return { imported, errors }
}

// ═══════════════════════════════════════════════════════════════
// 6. CSV 解析 + 导入
// ═══════════════════════════════════════════════════════════════

export interface CsvParseResult {
  headers: string[]
  rows: string[][]
}

export function parseCsv(content: string): CsvParseResult {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map((line) =>
    line.split(',').map((v) => v.trim().replace(/^"|"$/g, '')),
  )
  return { headers, rows }
}

/** 创建列名匹配闭包（支持中英文列名列表） */
export function makeColumnGetter(headers: string[]) {
  const colMap: Record<string, number> = {}
  headers.forEach((h, i) => {
    colMap[h.toLowerCase()] = i
  })
  return (names: string[], vals: string[]): string => {
    for (const n of names) {
      const idx = colMap[n]
      if (idx !== undefined) return vals[idx] || ''
    }
    return ''
  }
}

/**
 * 将直播场次 CSV 数据导入 live_sessions 表
 * 支持中英文列名，自动解析主播/直播间/中控名称→ID
 */
export async function importLiveSessionCsv(
  pool: Pool | PoolClient,
  headers: string[],
  csvRows: string[][],
): Promise<ImportResult> {
  const errors: string[] = []
  let imported = 0
  const get = makeColumnGetter(headers)
  const nameCache: NameCache = {}

  for (const vals of csvRows) {
    try {
      const date = get(['date', '日期'], vals)
      if (!date) continue

      const gmv = parseFloat(get(['gmv', 'gmv', '支付金额', 'user_payment'], vals)) || 0
      const gsv = parseFloat(get(['gsv', 'gsv', '成交金额', 'settlement'], vals)) || 0
      const orders = parseInt(get(['orders', '订单数'], vals)) || 0
      const adCost = parseFloat(get(['ad_cost', 'adcost', '广告费', 'ad_spend'], vals)) || 0
      const adGsv = parseFloat(get(['ad_gsv', 'adgsv', '广告gsv', '广告gmv'], vals)) || 0
      const returnAmount = parseFloat(get(['return_amount', 'returnamount', '退款金额'], vals)) || 0
      const durationMin = parseInt(get(['duration_min', 'durationmin', 'duration', '时长'], vals)) || 0
      const onlinePeak = parseInt(get(['online_peak', 'onlinepeak', '在线峰值', '最高在线'], vals)) || 0
      const title = get(['title', '标题'], vals)
      const startTime = get(['start_time', 'starttime', '开始时间'], vals)
      const endTime = get(['end_time', 'endtime', '结束时间'], vals)
      const remark = get(['remark', '备注'], vals)
      const adPlatform = get(['ad_platform', 'adplatform', '广告平台'], vals)
      const adType = get(['ad_type', 'adtype', '广告类型'], vals)
      const status = get(['status', '状态'], vals) || 'completed'

      // --- 新字段 ---
      const uvValue = parseFloat(get(['uv_value', 'uvvalue', 'uv价值', '单uv价值'], vals)) || 0
      const interactionRate = parseFloat(get(['interaction_rate', 'interactionrate', '互动率'], vals)) || 0
      const retentionRate = parseFloat(get(['retention_rate', 'retentionrate', '留存率'], vals)) || 0
      const newFans = parseInt(get(['new_fans', 'newfans', '新增粉丝'], vals)) || 0
      const gpm = parseFloat(get(['gpm', '千次观看gmv', '千次gmv'], vals)) || 0
      const avgOnline = parseInt(get(['avg_online', 'avgonline', '平均在线'], vals)) || 0
      const buyerCount = parseInt(get(['buyer_count', 'buyercount', '成交人数'], vals)) || 0
      const exposureViewRate = parseFloat(get(['exposure_view_rate', 'expviewrate', '曝光观看率'], vals)) || 0
      const viewFollowRate = parseFloat(get(['view_follow_rate', 'viewfollowrate', '关注率'], vals)) || 0
      const views = parseInt(get(['views', '观看次数'], vals)) || 0

      // --- 名称 → ID ---
      let roomId: number | null =
        parseInt(get(['room_id', 'roomid'], vals)) || null
      let anchorId: number | null =
        parseInt(get(['anchor_id', 'anchorid'], vals)) || null
      let operatorId: number | null =
        parseInt(get(['operator_id', 'operatorid'], vals)) || null

      if (!roomId) {
        const roomName = get(['room_name', 'roomname', '直播间'], vals)
        if (roomName) roomId = await resolveRoomId(pool, roomName, nameCache)
      }
      if (!anchorId) {
        const anchorName = get(['anchor_name', 'anchorname', '主播'], vals)
        if (anchorName) anchorId = await resolveAnchorId(pool, anchorName, nameCache)
      }
      if (!operatorId) {
        const operatorName = get(['operator_name', 'operatorname', '中控'], vals)
        if (operatorName) operatorId = await resolveOperatorId(pool, operatorName, nameCache)
      }

      await pool.query(
        `INSERT INTO live_sessions
           (room_id, anchor_id, operator_id, date, start_time, end_time,
            duration_min, title, gmv, gsv, orders, return_amount, online_peak,
            ad_platform, ad_type, ad_cost, ad_gsv, status, remark,
            uv_value, interaction_rate, retention_rate, new_fans, gpm,
            avg_online, buyer_count, exposure_view_rate, view_follow_rate, views)
         VALUES
           ($1,$2,$3,$4::date,$5::time,$6::time,$7,$8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,$19,
            $20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
        [
          roomId, anchorId, operatorId, date, startTime || null, endTime || null,
          durationMin, title, gmv, gsv, orders, returnAmount, onlinePeak,
          adPlatform || '', adType || '', adCost, adGsv, status, remark || '',
          uvValue, interactionRate, retentionRate, newFans, gpm,
          avgOnline, buyerCount, exposureViewRate, viewFollowRate, views,
        ],
      )
      imported++
    } catch (err: any) {
      errors.push(`行处理失败: ${err.message}`)
    }
  }

  return { imported, errors }
}

// ═══════════════════════════════════════════════════════════════
// 7. 数据校验
// ═══════════════════════════════════════════════════════════════

export interface ValidationIssue {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

const SUMMARY_NAMES = new Set(['整体', '较上周期', '同行同级优秀值'])

export function validateAnchorRows(rows: WorksheetRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  rows.forEach((row, i) => {
    if (!text(row['主播名称'])) {
      issues.push({ row: i + 1, field: '主播名称', message: '主播名称为空', severity: 'error' })
    } else if (SUMMARY_NAMES.has(text(row['主播名称']))) {
      issues.push({ row: i + 1, field: '主播名称', message: '汇总/对比行，跳过导入', severity: 'warning' })
    }
    if (text(row['直播间用户支付金额']) && parseNumeric(row['直播间用户支付金额']) === null) {
      issues.push({ row: i + 1, field: '直播间用户支付金额', message: '金额格式异常', severity: 'warning' })
    }
  })
  return issues
}

export function validateChannelRows(rows: WorksheetRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  rows.forEach((row, i) => {
    if (!text(row['渠道名称'])) {
      issues.push({ row: i + 1, field: '渠道名称', message: '渠道名称为空', severity: 'error' })
    } else if (SUMMARY_NAMES.has(text(row['渠道名称']))) {
      issues.push({ row: i + 1, field: '渠道名称', message: '汇总/对比行，跳过导入', severity: 'warning' })
    }
  })
  return issues
}

export function validateCsvRows(
  rows: string[][],
  get: ReturnType<typeof makeColumnGetter>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  rows.forEach((vals, i) => {
    const date = get(['date', '日期'], vals)
    const gmv = get(['gmv', 'gmv', '支付金额'], vals)
    if (!date) {
      issues.push({ row: i + 2, field: 'date', message: '日期为空', severity: 'error' })
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      issues.push({ row: i + 2, field: 'date', message: '日期格式应为 YYYY-MM-DD', severity: 'error' })
    }
    if (gmv && isNaN(parseFloat(gmv))) {
      issues.push({ row: i + 2, field: 'gmv', message: 'GMV 格式异常', severity: 'warning' })
    }
  })
  return issues
}

// ═══════════════════════════════════════════════════════════════
// 8. 预览构建
// ═══════════════════════════════════════════════════════════════

export interface PreviewData {
  detectedType: string | null
  businessDate: string | null
  totalRows: number
  validRows: number
  issues: ValidationIssue[]
  previewRows: Record<string, unknown>[]
  allAnchors?: { id: number; name: string }[]
  unmatchedAnchors?: string[]
}

export function validateFullSessionRows(): ValidationIssue[] {
  return [] // 整场数据不做逐行校验，由导入函数内部处理
}

// ═══════════════════════════════════════════════════════════════
// 9. 导入：整场数据 XLSX（多 Sheet 直播间详情页）
// ═══════════════════════════════════════════════════════════════

export interface XlsxWorkbook {
  SheetNames: string[]
  Sheets: Record<string, unknown>
}

/**
 * 导入整场数据，处理 6 个 Sheet
 * - Sheet "基本信息"         → session_live_basic_info
 * - Sheet "整体看板"         → session_overview_metrics
 * - Sheet "流量分析-流量转化"  → session_overview_metrics (漏斗字段)
 * - Sheet "流量分析-渠道分析"  → douyin_channel_daily_metrics
 * - Sheet "流量分析-短视频引流" → session_short_video_traffic
 * - Sheet "商品分析-商品明细"  → session_product_details + session_product_skus
 *
 * 忽略字段：达人头像、达人昵称、达人等级、抖音号or火山号、达人类型、所属机构、预估佣金支出
 */
export async function importFullSession(
  pool: Pool | PoolClient,
  workbook: XlsxWorkbook,
  businessDate: string,
  roomId: number | null,
  uploadId: number,
): Promise<ImportResult> {
  const errors: string[] = []
  let imported = 0

  // 尝试匹配 live_sessions
  let sessionId: number | null = null
  if (roomId) {
    const sr = await pool.query(
      `SELECT id FROM live_sessions WHERE date = $1::date AND room_id = $2 LIMIT 1`,
      [businessDate, roomId],
    )
    if (sr.rows.length > 0) sessionId = sr.rows[0].id
  }

  // ── Sheet 1: 基本信息 ──
  const sheet1 = workbook.Sheets[workbook.SheetNames.find((n: string) => n.includes('基本信息')) || '']
  if (sheet1) {
    const rows1 = (await import('xlsx')).utils.sheet_to_json(sheet1, { defval: '' }) as WorksheetRow[]
    if (rows1.length > 0) {
      const row = rows1[0]
      const liveDateStr = text(row['直播时间'])
      let liveDate = businessDate
      let startTime: string | null = null
      let endTime: string | null = null
      let durationMin = 0

      if (liveDateStr) {
        // 格式如 "2026/08/06 08:31-18:30"
        const dm = liveDateStr.match(/(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})/)
        if (dm) {
          const [_, datePart, s, e] = dm
          const [y, mo, d] = datePart.split('/')
          liveDate = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
          startTime = parseTimeStr(s)
          endTime = parseTimeStr(e)
        } else {
          // 仅日期，无时间范围
          const justDate = liveDateStr.match(/(\d{4}\/\d{2}\/\d{2})/)
          if (justDate) {
            const [y, mo, d] = justDate[1].split('/')
            liveDate = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
          }
        }
      }

      // 解析直播时长 "9小时59分钟"
      const durationRow = row['直播时长']
      if (durationRow) durationMin = parseDurationMin(durationRow) ?? 0

      // 开播平台
      const livePlatform = text(row['开播平台']) || '抖音'

      // 开播前一天粉丝数（如 "6.5万" → 65000）
      let fansBefore = 0
      const fansRaw = text(row['开播前一天粉丝数'])
      if (fansRaw) {
        const fansNum = parseNumeric(fansRaw) ?? 0
        fansBefore = fansRaw.includes('万') ? Math.round(fansNum * 10000) : fansNum
      }

      // 交易总览（忽略：预估佣金支出）
      const paymentAmount = parseNumeric(row['直播间用户支付金额']) ?? 0
      const gpm = parseNumeric(row['千次观看用户支付金额']) ?? 0
      const disposalCount = parseNumeric(row['处置次数']) ?? 0

      await pool.query(
        `INSERT INTO session_live_basic_info
           (session_id, room_id, business_date, fans_before_broadcast,
            live_date, live_start_time, live_end_time, live_duration_min,
            live_platform, payment_amount, gpm, disposal_count, upload_id)
         VALUES ($1,$2,$3::date,$4,$5::date,$6::time,$7::time,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (room_id, business_date) DO UPDATE SET
           session_id = EXCLUDED.session_id, fans_before_broadcast = EXCLUDED.fans_before_broadcast,
           live_date = EXCLUDED.live_date, live_start_time = EXCLUDED.live_start_time,
           live_end_time = EXCLUDED.live_end_time, live_duration_min = EXCLUDED.live_duration_min,
           live_platform = EXCLUDED.live_platform, payment_amount = EXCLUDED.payment_amount,
           gpm = EXCLUDED.gpm, disposal_count = EXCLUDED.disposal_count,
           upload_id = EXCLUDED.upload_id, updated_at = NOW()`,
        [sessionId, roomId, businessDate, fansBefore,
         liveDate, startTime, endTime, durationMin,
         livePlatform, paymentAmount, gpm, disposalCount, uploadId],
      )
      imported++
    }
  }

  // ── Sheet 2: 整体看板 ──
  const sheet2 = workbook.Sheets[workbook.SheetNames.find((n: string) => n.includes('整体看板')) || '']
  if (sheet2) {
    const rows2 = (await import('xlsx')).utils.sheet_to_json(sheet2, { defval: '' }) as WorksheetRow[]
    if (rows2.length > 0) {
      const row = rows2[0]
      await pool.query(
        `INSERT INTO session_overview_metrics
           (session_id, room_id, business_date,
            viewers, exposure_view_rate, avg_online, peak_online,
            product_click_users, product_exposure_click_rate,
            avg_watch_seconds, new_followers, view_follow_rate,
            interaction_rate, avg_comments_per_person,
            conversion_rate, product_click_deal_rate,
            avg_order_value, refund_amount, refund_orders, refund_users,
            upload_id)
         VALUES ($1,$2,$3::date,
           $4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (room_id, business_date) DO UPDATE SET
           session_id = EXCLUDED.session_id, viewers = EXCLUDED.viewers,
           exposure_view_rate = EXCLUDED.exposure_view_rate, avg_online = EXCLUDED.avg_online,
           peak_online = EXCLUDED.peak_online, product_click_users = EXCLUDED.product_click_users,
           product_exposure_click_rate = EXCLUDED.product_exposure_click_rate,
           avg_watch_seconds = EXCLUDED.avg_watch_seconds, new_followers = EXCLUDED.new_followers,
           view_follow_rate = EXCLUDED.view_follow_rate, interaction_rate = EXCLUDED.interaction_rate,
           avg_comments_per_person = EXCLUDED.avg_comments_per_person,
           conversion_rate = EXCLUDED.conversion_rate,
           product_click_deal_rate = EXCLUDED.product_click_deal_rate,
           avg_order_value = EXCLUDED.avg_order_value,
           refund_amount = EXCLUDED.refund_amount, refund_orders = EXCLUDED.refund_orders,
           refund_users = EXCLUDED.refund_users, upload_id = EXCLUDED.upload_id, updated_at = NOW()`,
        [sessionId, roomId, businessDate,
         parseNumeric(row['直播间观看人数']) ?? 0,
         parsePercentage(row['曝光-观看率']) ?? 0,
         parseNumeric(row['平均在线人数']) ?? 0,
         parseNumeric(row['最高在线人数']) ?? 0,
         parseNumeric(row['商品点击人数']) ?? 0,
         parsePercentage(row['商品曝光-点击率']) ?? 0,
         parseDurationSec(row['人均观看时长']) ?? 0,
         parseNumeric(row['新增粉丝数']) ?? 0,
         parsePercentage(row['观看-关注率']) ?? 0,
         parsePercentage(row['互动率']) ?? 0,
         parseNumeric(row['人均评论次数']) ?? 0,
         parsePercentage(row['成交率']) ?? 0,
         parsePercentage(row['商品点击-成交率']) ?? 0,
         parseNumeric(row['客单价']) ?? 0,
         parseNumeric(row['退款金额']) ?? 0,
         parseNumeric(row['退款订单数']) ?? 0,
         parseNumeric(row['退款人数']) ?? 0,
         uploadId],
      )
      imported++
    }
  }

  // ── Sheet 3: 流量分析-流量转化 ──
  const sheet3 = workbook.Sheets[workbook.SheetNames.find((n: string) => n.includes('流量转化')) || '']
  if (sheet3) {
    const rows3 = (await import('xlsx')).utils.sheet_to_json(sheet3, { defval: '' }) as WorksheetRow[]
    // 该 Sheet 只有两列：阶段名称 + 数值
    // "直播间曝光人数" → 1.59万
    const funnelMap: Record<string, number> = {}
    for (const r of rows3) {
      const keys = Object.keys(r)
      if (keys.length >= 2) {
        const name = text(r[keys[0]])
        const val = text(r[keys[1]])
        const num = parseNumeric(val) ?? 0
        const finalVal = val.includes('万') ? Math.round(num * 10000) : num
        funnelMap[name] = finalVal
      }
    }

    await pool.query(
      `UPDATE session_overview_metrics SET
         exposure_users = $1, enter_users = $2,
         product_exposure_users = $3, product_click_persons = $4,
         deal_users = $5, updated_at = NOW()
       WHERE room_id = $6 AND business_date = $7::date`,
      [
        funnelMap['直播间曝光人数'] || 0,
        funnelMap['进入直播间人数'] || 0,
        funnelMap['商品曝光人数'] || 0,
        funnelMap['商品点击人数'] || 0,
        funnelMap['成交人数'] || 0,
        roomId, businessDate,
      ],
    )
    imported++
  }

  // ── Sheet 4: 流量分析-渠道分析 → douyin_channel_daily_metrics ──
  const sheet4 = workbook.Sheets[workbook.SheetNames.find((n: string) => n.includes('渠道分析')) || '']
  if (sheet4) {
    const rows4 = (await import('xlsx')).utils.sheet_to_json(sheet4, { defval: '' }) as WorksheetRow[]
    const SUMMARY_NAMES = new Set(['整体', '较上周期', '同行同级优秀值'])
    for (const row of rows4) {
      const channelName = text(row['渠道名称'])
      if (!channelName || SUMMARY_NAMES.has(channelName)) continue

      await pool.query(
        `INSERT INTO douyin_channel_daily_metrics
           (business_date, channel_name, live_duration_seconds, avg_watch_seconds,
            impressions, viewers, interactions, new_followers,
            product_impressions, product_clicks, order_count, buyer_count,
            payment_amount, thousand_view_payment, avg_order_value, upload_id)
         VALUES ($1::date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (business_date, channel_name) DO UPDATE SET
           avg_watch_seconds = EXCLUDED.avg_watch_seconds,
           impressions = EXCLUDED.impressions, viewers = EXCLUDED.viewers,
           interactions = EXCLUDED.interactions, new_followers = EXCLUDED.new_followers,
           product_impressions = EXCLUDED.product_impressions,
           product_clicks = EXCLUDED.product_clicks,
           order_count = EXCLUDED.order_count, buyer_count = EXCLUDED.buyer_count,
           payment_amount = EXCLUDED.payment_amount,
           thousand_view_payment = EXCLUDED.thousand_view_payment,
           avg_order_value = EXCLUDED.avg_order_value,
           upload_id = EXCLUDED.upload_id, updated_at = NOW()`,
        [businessDate, channelName,
         parseDurationSec(row['直播时长']) ?? 0,
         parseDurationSec(row['人均观看时长']) ?? 0,
         parseNumeric(row['直播间曝光次数']) ?? 0,
         parseNumeric(row['直播间观看次数']) ?? 0,
         parseNumeric(row['直播间互动次数']) ?? 0,
         parseNumeric(row['新增粉丝数']) ?? 0,
         parseNumeric(row['商品曝光次数']) ?? 0,
         parseNumeric(row['商品点击次数']) ?? 0,
         parseNumeric(row['成交订单数']) ?? 0,
         parseNumeric(row['成交人数']) ?? 0,
         parseNumeric(row['用户支付金额']) ?? 0,
         parseNumeric(row['千次观看用户支付金额']) ?? 0,
         parseNumeric(row['笔单价']) ?? 0,
         uploadId],
      )
      imported++
    }
  }

  // ── Sheet 5: 流量分析-短视频引流 → session_short_video_traffic ──
  const sheet5 = workbook.Sheets[workbook.SheetNames.find((n: string) => n.includes('短视频')) || '']
  if (sheet5) {
    const rows5 = (await import('xlsx')).utils.sheet_to_json(sheet5, { defval: '' }) as WorksheetRow[]
    // 列名存在模板差异（如「短视频直播入口曝光次数」「短视频直播入口点击率(次数)」），
    // 统一用 findColumn 精确/模糊匹配
    const colVideoName = '短视频名称'
    const colPostTime = '投稿时间'
    const colImpressions = findColumn(rows5[0] ?? {}, ['短视频直播入口曝光次数', '直播入口曝光次数', '入口曝光次数', '曝光次数'])
    const colTraffic = findColumn(rows5[0] ?? {}, ['短视频引流直播间次数', '引流直播间次数', '引流直播间'])
    const colClickRate = findColumn(rows5[0] ?? {}, ['短视频直播入口点击率', '直播入口点击率', '入口点击率', '点击率'])
    for (const row of rows5) {
      const videoName = text(row[colVideoName] ?? row['视频名称'])
      if (!videoName) continue

      await pool.query(
        `INSERT INTO session_short_video_traffic
           (session_id, room_id, business_date, video_name, post_time,
            live_entry_impressions, traffic_to_live, entry_click_rate, upload_id)
         VALUES ($1,$2,$3::date,$4,$5::timestamptz,$6,$7,$8,$9)
         ON CONFLICT (room_id, business_date, video_name) DO UPDATE SET
           session_id = EXCLUDED.session_id,
           post_time = EXCLUDED.post_time,
           live_entry_impressions = EXCLUDED.live_entry_impressions,
           traffic_to_live = EXCLUDED.traffic_to_live,
           entry_click_rate = EXCLUDED.entry_click_rate,
           upload_id = EXCLUDED.upload_id, updated_at = NOW()`,
        [sessionId, roomId, businessDate, videoName,
         text(colPostTime ? row[colPostTime] : '') || null,
         parseNumeric(colImpressions ? row[colImpressions] : '') ?? 0,
         parseNumeric(colTraffic ? row[colTraffic] : '') ?? 0,
         parsePercentage(colClickRate ? row[colClickRate] : '') ?? 0,
         uploadId],
      )
      imported++
    }
  }

  // ── Sheet 6: 商品分析-商品明细 → session_product_details + session_product_skus ──
  // 该模板为「双表头」结构：每个商品块 = 商品主行 + 子表头行（商品名称="-"，各单元格声明 SKU 列名）+ 若干 SKU 数据行（商品名称为空）。
  // sheet_to_json 以首行（主表头）作键，因此 SKU 数据读取须用「子表头声明的列名 → 主表头键」映射。
  const sheet6 = workbook.Sheets[workbook.SheetNames.find((n: string) => n.includes('商品明细') || n.includes('商品分析')) || '']
  if (sheet6) {
    const rows6 = (await import('xlsx')).utils.sheet_to_json(sheet6, { defval: '' }) as WorksheetRow[]
    let productOrder = 0
    let currentProductId: number | null = null
    // SKU 列名 → 主表头键（子表头行解析所得，如 'sku名称' → '商品图片'）
    let skuFieldSource: Record<string, string> = {}

    for (const row of rows6) {
      const productName = text(row['商品名称'])

      // SKU 子表头行：商品名称为 "-"，其单元格值即 SKU 列名，记录对应主表头键
      if (productName === '-') {
        const next: Record<string, string> = {}
        for (const key of Object.keys(row)) {
          const label = text(row[key])
          if (key === '商品名称' || key === '商品ID' || !label) continue
          next[label] = key
        }
        skuFieldSource = next
        continue
      }

      // SKU 数据行：商品名称为空，位于 SKU 块内（有子表头映射）
      if (productName === '' && currentProductId && Object.keys(skuFieldSource).length > 0) {
        const skuName = text(row[skuFieldSource['sku名称'] ?? ''] || '')
        if (skuName) {
          await pool.query(
            `INSERT INTO session_product_skus
               (product_id, sku_name, sku_image, payment_amount,
                sold_count, buyer_count, order_count, upload_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (product_id, sku_name) DO UPDATE SET
               sku_image = EXCLUDED.sku_image, payment_amount = EXCLUDED.payment_amount,
               sold_count = EXCLUDED.sold_count, buyer_count = EXCLUDED.buyer_count,
               order_count = EXCLUDED.order_count, upload_id = EXCLUDED.upload_id`,
            [currentProductId, skuName,
             text(row[skuFieldSource['sku图片'] ?? ''] || ''),
             parseNumeric(row[skuFieldSource['用户支付金额'] ?? ''] ?? '') ?? 0,
             parseNumeric(row[skuFieldSource['成交件数'] ?? ''] ?? '') ?? 0,
             parseNumeric(row[skuFieldSource['成交人数'] ?? ''] ?? '') ?? 0,
             parseNumeric(row[skuFieldSource['成交订单数'] ?? ''] ?? '') ?? 0,
             uploadId],
          )
          imported++
        }
        continue
      }

      // 空行（块间分隔）等无意义行跳过
      if (!productName) continue

      // 商品主行
      productOrder++
      const productId = text(row['商品ID'] || '')

      const result = await pool.query(
        `INSERT INTO session_product_details
           (session_id, room_id, business_date, product_order, product_name,
            product_id, product_image, payment_amount, sold_count, buyer_count,
            order_count, pre_sale_orders, pre_sale_amount,
            exposure_users, click_users, exposure_click_rate, click_deal_rate,
            refund_users, refund_amount, refund_orders, upload_id)
         VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (room_id, business_date, product_id) DO UPDATE SET
           session_id = EXCLUDED.session_id, product_order = EXCLUDED.product_order,
           product_name = EXCLUDED.product_name, product_image = EXCLUDED.product_image,
           payment_amount = EXCLUDED.payment_amount, sold_count = EXCLUDED.sold_count,
           buyer_count = EXCLUDED.buyer_count, order_count = EXCLUDED.order_count,
           pre_sale_orders = EXCLUDED.pre_sale_orders, pre_sale_amount = EXCLUDED.pre_sale_amount,
           exposure_users = EXCLUDED.exposure_users, click_users = EXCLUDED.click_users,
           exposure_click_rate = EXCLUDED.exposure_click_rate,
           click_deal_rate = EXCLUDED.click_deal_rate,
           refund_users = EXCLUDED.refund_users, refund_amount = EXCLUDED.refund_amount,
           refund_orders = EXCLUDED.refund_orders, upload_id = EXCLUDED.upload_id,
           updated_at = NOW()
         RETURNING id`,
        [sessionId, roomId, businessDate, productOrder, productName,
         productId, text(row['商品图片'] || ''),
         parseNumeric(row['用户支付金额']) ?? 0,
         parseNumeric(row['成交件数']) ?? 0,
         parseNumeric(row['成交人数']) ?? 0,
         parseNumeric(row['成交订单数']) ?? 0,
         parseNumeric(row['预售订单数']) ?? 0,
         parseNumeric(row['预售全款金额']) ?? 0,
         parseNumeric(row['商品曝光人数']) ?? 0,
         parseNumeric(row['商品点击人数']) ?? 0,
         parsePercentage(row['曝光-点击率']) ?? 0,
         parsePercentage(row['点击-成交率']) ?? 0,
         parseNumeric(row['退款人数']) ?? 0,
         parseNumeric(row['退款金额']) ?? 0,
         parseNumeric(row['退款订单数']) ?? 0,
         uploadId],
      )
      currentProductId = result.rows[0]?.id ?? null
      imported++
    }
  }

  return { imported, errors }
}

export function buildPreview(
  type: string | null,
  rows: WorksheetRow[],
  date: string | null,
): PreviewData {
  const issues =
    type === TEMPLATES.ANCHOR
      ? validateAnchorRows(rows)
      : type === TEMPLATES.CHANNEL
        ? validateChannelRows(rows)
        : type === TEMPLATES.FULL_SESSION
          ? validateFullSessionRows()
          : []

  const validRows = rows.filter(
    (r) =>
      !SUMMARY_NAMES.has(text(r['主播名称'] ?? r['渠道名称'] ?? '')),
  ).length

  return {
    detectedType: type,
    businessDate: date,
    totalRows: rows.length,
    validRows,
    issues,
    previewRows: rows.slice(0, 10),
  }
}