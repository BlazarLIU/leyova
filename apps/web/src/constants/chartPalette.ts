/**
 * 图表统一色板
 * 品牌橙红为主序列，荧光绿做次级强调，其余为语义色；
 * 全部选用中等明度色值，在浅色（#F6F6F3）与深色（#101010）画布上都能保证可读性。
 */
export const CHART_SERIES = [
  '#F42902', // Orange Red — 主指标
  '#4FD64B', // Yellow Punk（深化）— AI / 增长
  '#E0A008', // Amber — 预警 / 次指标
  '#2563EB', // Blue — 对照渠道
  '#0EA5A5', // Teal — 辅助维度
  '#9B9B96', // Stone — 中性基准
] as const

/** 网格线：两种主题下都保持弱对比 */
export const CHART_GRID = 'rgba(155, 155, 150, 0.28)'

/** 坐标轴 / 刻度文字 */
export const CHART_AXIS = '#9B9B96'

/** 浅色/深色通用的中性填充 */
export const CHART_NEUTRAL_FILL = 'rgba(155, 155, 150, 0.35)'
