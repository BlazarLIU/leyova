/**
 * catalog/index.ts — 系统级指标注册表（Metric Catalog）真值源
 * 
 * 作用：
 *  1. 提供所有经营指标的统一表达式与口径，杜绝同一指标手写计算 17 遍。
 *  2. 所有取数只能经由此注册表获取 SQL 聚合表达式。
 *  3. 支持从数据库 `metric_catalog` 动态热重载与本地内存快速访问。
 */

import { getPool, type DbExecutor } from '../lib/db.js'
import { canAccessAdSpend } from '../lib/guard.js'
import type { MetricDefinition, DimensionDefinition, MetricAccessOptions } from './types.js'

// 静态基准指标目录（与 migration 155 对齐，提供零延迟内存基准）
export const SYSTEM_METRICS: Record<string, MetricDefinition> = {
  gmv: {
    code: 'gmv',
    name: '成交总额',
    unit: '元',
    category: 'trade',
    expr: 'COALESCE(SUM(f.gmv), 0)::numeric',
    factTable: 'trade',
    isAdditive: true,
    description: '总订单销售金额（含退款）',
  },
  pay_amount: {
    code: 'pay_amount',
    name: '买家实付金额',
    unit: '元',
    category: 'trade',
    expr: 'COALESCE(SUM(f.pay_amount), 0)::numeric',
    factTable: 'trade',
    isAdditive: true,
    description: '买家实际支付金额',
  },
  net_sales: {
    code: 'net_sales',
    name: '净成交额',
    unit: '元',
    category: 'trade',
    expr: '(COALESCE(SUM(f.gmv), 0) - COALESCE(SUM(f.refund_amount), 0))::numeric',
    factTable: 'trade',
    isAdditive: true,
    description: '成交总额减去退款金额',
  },
  paid_order_count: {
    code: 'paid_order_count',
    name: '支付订单数',
    unit: '单',
    category: 'trade',
    expr: 'COALESCE(SUM(f.paid_order_count), 0)::int',
    factTable: 'trade',
    isAdditive: true,
    description: '完成支付的订单笔数',
  },
  paid_buyer_count: {
    code: 'paid_buyer_count',
    name: '支付买家数',
    unit: '人',
    category: 'trade',
    expr: 'COALESCE(SUM(f.paid_buyer_count), 0)::int',
    factTable: 'trade',
    isAdditive: false,
    description: '独立支付买家数',
  },
  avg_order_value: {
    code: 'avg_order_value',
    name: '客单价',
    unit: '元',
    category: 'trade',
    expr: 'CASE WHEN SUM(f.paid_order_count) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.paid_order_count), 2) ELSE 0 END',
    factTable: 'trade',
    isAdditive: false,
    description: '客单价（GMV / 支付订单数）',
  },
  refund_amount: {
    code: 'refund_amount',
    name: '退款金额',
    unit: '元',
    category: 'aftersale',
    expr: 'COALESCE(SUM(f.refund_amount), 0)::numeric',
    factTable: 'trade',
    isAdditive: true,
    description: '已发生退款的金额',
  },
  refund_count: {
    code: 'refund_count',
    name: '退款订单数',
    unit: '单',
    category: 'aftersale',
    expr: 'COALESCE(SUM(f.refund_count), 0)::int',
    factTable: 'trade',
    isAdditive: true,
    description: '发生退款的订单笔数',
  },
  refund_rate: {
    code: 'refund_rate',
    name: '退款率',
    unit: '%',
    category: 'aftersale',
    expr: 'CASE WHEN SUM(f.gmv) > 0 THEN ROUND(SUM(f.refund_amount) / SUM(f.gmv) * 100, 2) ELSE 0 END',
    factTable: 'trade',
    isAdditive: false,
    description: '退款金额 / GMV * 100',
  },
  impressions: {
    code: 'impressions',
    name: '曝光展现量',
    unit: '次',
    category: 'traffic',
    expr: 'COALESCE(SUM(f.impressions), 0)::bigint',
    factTable: 'traffic',
    isAdditive: true,
    description: '商品或场次曝光次数',
  },
  clicks: {
    code: 'clicks',
    name: '点击量',
    unit: '次',
    category: 'traffic',
    expr: 'COALESCE(SUM(f.clicks), 0)::bigint',
    factTable: 'traffic',
    isAdditive: true,
    description: '曝光点击进入次数',
  },
  visitors: {
    code: 'visitors',
    name: '访客数',
    unit: '人',
    category: 'traffic',
    expr: 'COALESCE(SUM(f.visitors), 0)::bigint',
    factTable: 'traffic',
    isAdditive: true,
    description: '独立访客数 UV',
  },
  ctr: {
    code: 'ctr',
    name: '点击率',
    unit: '%',
    category: 'traffic',
    expr: 'CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.clicks)::numeric / SUM(f.impressions) * 100, 2) ELSE 0 END',
    factTable: 'traffic',
    isAdditive: false,
    description: '点击量 / 展现量 * 100',
  },
  gpm: {
    code: 'gpm',
    name: '千次展现成交',
    unit: '元',
    category: 'traffic',
    expr: 'CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.impressions) * 1000, 2) ELSE 0 END',
    factTable: 'traffic',
    isAdditive: false,
    description: '每千次曝光成交额 (GMV / Impressions * 1000)',
  },
  ad_spend: {
    code: 'ad_spend',
    name: '投流花费',
    unit: '元',
    category: 'ad',
    expr: 'COALESCE(SUM(f.cost), 0)::numeric',
    factTable: 'ad',
    isAdditive: true,
    description: '商业化广告投放总消耗',
  },
  roi: {
    code: 'roi',
    name: '综合投产比 (ROI)',
    unit: '',
    category: 'ad',
    expr: 'CASE WHEN SUM(f.cost) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.cost), 2) ELSE 0 END',
    factTable: 'ad',
    isAdditive: false,
    description: 'GMV / 投流花费',
  },
  net_roi: {
    code: 'net_roi',
    name: '净利润投产比 (Net ROI)',
    unit: '',
    category: 'ad',
    expr: 'CASE WHEN SUM(f.cost) > 0 THEN ROUND((SUM(f.gmv) - SUM(f.refund_amount)) / SUM(f.cost), 2) ELSE 0 END',
    factTable: 'ad',
    isAdditive: false,
    description: '净成交额 / 投流花费',
  },
}

// 统一维度定义表
export const SYSTEM_DIMENSIONS: Record<string, DimensionDefinition> = {
  date: { code: 'date', name: '日期', expr: 'f.biz_date' },
  platform: { code: 'platform', name: '平台', expr: 'f.platform_code' },
  shop_id: { code: 'shop_id', name: '店铺ID', expr: 'f.shop_id' },
  channel: { code: 'channel', name: '渠道来源', expr: "COALESCE(f.source_code, 'other')" },
  hour: { code: 'hour', name: '小时', expr: 'EXTRACT(HOUR FROM f.created_at)' },
}

/**
 * 获取可访问的指标列表
 */
export function listAllowedMetrics(access?: MetricAccessOptions): MetricDefinition[] {
  const allowAd = access ? canAccessAdSpend({ role: access.role, userType: access.userType }) : true
  return Object.values(SYSTEM_METRICS).filter((m) => allowAd || m.category !== 'ad')
}

/**
 * 校验指定指标码是否存在
 */
export function getMetricDefinition(code: string): MetricDefinition | undefined {
  return SYSTEM_METRICS[code]
}
