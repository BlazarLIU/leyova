export interface MetricConfig {
  key: string
  label: string
  direction: 'higher_is_better' | 'lower_is_better' | 'neutral'
  unit: string
  precision: number
}

export const reviewMetrics: Record<string, MetricConfig> = {
  gmv: { key: 'gmv', label: 'GMV', direction: 'higher_is_better', unit: '元', precision: 2 },
  orders: { key: 'orders', label: '成交订单数', direction: 'higher_is_better', unit: '单', precision: 0 },
  gpm: { key: 'gpm', label: 'GPM', direction: 'higher_is_better', unit: '元/千次', precision: 2 },
  avg_order_value: { key: 'avg_order_value', label: '客单价', direction: 'higher_is_better', unit: '元', precision: 2 },
  views: { key: 'views', label: '直播间观看次数', direction: 'higher_is_better', unit: '次', precision: 0 },
  exposure_view_rate: { key: 'exposure_view_rate', label: '曝光-观看率', direction: 'higher_is_better', unit: '%', precision: 2 },
  product_deal_rate: { key: 'product_deal_rate', label: '商品点击-成交率', direction: 'higher_is_better', unit: '%', precision: 2 },
  new_fans: { key: 'new_fans', label: '新增粉丝数', direction: 'higher_is_better', unit: '人', precision: 0 },
  interaction_rate: { key: 'interaction_rate', label: '观看-互动率', direction: 'higher_is_better', unit: '%', precision: 2 },
  retention_rate: { key: 'retention_rate', label: '留存率', direction: 'higher_is_better', unit: '%', precision: 2 },
  uv_value: { key: 'uv_value', label: '单UV价值', direction: 'higher_is_better', unit: '元', precision: 2 },
  gmv_per_hour: { key: 'gmv_per_hour', label: '单小时GMV', direction: 'higher_is_better', unit: '元', precision: 2 },
  avg_item_price: { key: 'avg_item_price', label: '平均件单价', direction: 'higher_is_better', unit: '元', precision: 2 },
  buyer_count: { key: 'buyer_count', label: '成交人数', direction: 'higher_is_better', unit: '人', precision: 0 },
  online_peak: { key: 'online_peak', label: '最高在线', direction: 'higher_is_better', unit: '人', precision: 0 },
  avg_online: { key: 'avg_online', label: '平均在线', direction: 'higher_is_better', unit: '人', precision: 0 },
  view_follow_rate: { key: 'view_follow_rate', label: '观看-关注率', direction: 'higher_is_better', unit: '%', precision: 2 },
  new_group_members: { key: 'new_group_members', label: '新加团人数', direction: 'higher_is_better', unit: '人', precision: 0 },
  impressions: { key: 'impressions', label: '直播间曝光次数', direction: 'neutral', unit: '次', precision: 0 },
  product_impressions: { key: 'product_impressions', label: '商品曝光次数', direction: 'neutral', unit: '次', precision: 0 },
  product_clicks: { key: 'product_clicks', label: '商品点击次数', direction: 'neutral', unit: '次', precision: 0 },
  duration_min: { key: 'duration_min', label: '开播时长', direction: 'neutral', unit: '分钟', precision: 0 },
  ad_spend: { key: 'ad_spend', label: '投放消耗', direction: 'neutral', unit: '元', precision: 2 },
}

export function formatMetricValue(key: string, value: number): string {
  const config = reviewMetrics[key]
  if (!config) return String(value)
  const formatted = value.toFixed(config.precision)
  return config.unit ? `${formatted}${config.unit}` : formatted
}

export function getMetricDirection(key: string): 'higher_is_better' | 'lower_is_better' | 'neutral' {
  return reviewMetrics[key]?.direction ?? 'neutral'
}