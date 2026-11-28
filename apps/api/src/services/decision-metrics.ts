/**
 * decision-metrics.ts
 *
 * 统一经营决策指标计算服务 (Deterministic Decision Metrics Service)
 * 职责：
 * 1. 消除 semantic-layer 与 net-roi 路由之间的口径漂移
 * 2. 彻底废除 (attributed_gross_gmv - attributed_orders) 量纲错误与 0.78/0.85 魔数
 * 3. 区分指标状态：FACT (已确认事实) / ASSUMPTION (标注假设) / NOT_EVALUABLE (缺失不可评估)
 */

export type MetricEvaluationStatus = 'FACT' | 'ASSUMPTION' | 'NOT_EVALUABLE'

export interface MetricContractResult<T = number | null> {
  metricCode: string
  metricName: string
  value: T
  unit: string
  status: MetricEvaluationStatus
  formulaVersion: string
  missingInputs?: string[]
  message?: string
}

export class DecisionMetricsService {
  static readonly FORMULA_VERSION = 'v1.1-deterministic'

  /**
   * 结算成交广告消耗比 (原误称为 net_roi，现正名为 settled_gmv_ad_ratio)
   * 公式：settled_gmv / ad_spend (ad_spend > 0)
   */
  static calculateSettledGmvAdRatio(settledGmv: number, adSpend: number): MetricContractResult<number | null> {
    if (adSpend <= 0) {
      return {
        metricCode: 'settled_gmv_ad_ratio',
        metricName: '结算成交广告比',
        value: null,
        unit: '',
        status: 'NOT_EVALUABLE',
        formulaVersion: this.FORMULA_VERSION,
        missingInputs: ['ad_spend > 0'],
        message: '广告消耗为零或未提供，无法评估广告产出比',
      }
    }
    const val = Number((settledGmv / adSpend).toFixed(2))
    return {
      metricCode: 'settled_gmv_ad_ratio',
      metricName: '结算成交广告比',
      value: val,
      unit: '',
      status: 'FACT',
      formulaVersion: this.FORMULA_VERSION,
    }
  }

  /**
   * 广告投资回报率 (ROAS)
   * 公式：gmv / ad_spend (ad_spend > 0)
   */
  static calculateRoas(gmv: number, adSpend: number): MetricContractResult<number | null> {
    if (adSpend <= 0) {
      return {
        metricCode: 'roas',
        metricName: '广告投资回报率 (ROAS)',
        value: null,
        unit: 'x',
        status: 'NOT_EVALUABLE',
        formulaVersion: this.FORMULA_VERSION,
        missingInputs: ['ad_spend > 0'],
        message: '广告消耗为零或未提供，无法评估 ROAS',
      }
    }
    const val = Number((gmv / adSpend).toFixed(2))
    return {
      metricCode: 'roas',
      metricName: '广告投资回报率 (ROAS)',
      value: val,
      unit: 'x',
      status: 'FACT',
      formulaVersion: this.FORMULA_VERSION,
    }
  }

  /**
   * 真实净利润投产比 (True Net Profit ROI)
   * 必须在收入、广告消耗、商品成本、平台佣金、履约物流全部齐备时才计算。
   * 公式：(revenue - ad_spend - cogs - platform_fee - fulfillment_cost - other_costs) / ad_spend
   */
  static calculateNetRoi(params: {
    revenue: number
    adSpend: number
    cogs?: number | null
    platformFee?: number | null
    fulfillmentCost?: number | null
    /** 其他已确认成本（如达人佣金、坑位费）；缺省按 0 处理，显式 null 表示该成本项缺失 */
    otherCosts?: number | null
  }): MetricContractResult<number | null> {
    const missing: string[] = []
    if (params.adSpend === undefined || params.adSpend === null || params.adSpend <= 0) {
      missing.push('adSpend')
    }
    if (params.cogs === undefined || params.cogs === null) {
      missing.push('cogs (商品销售成本)')
    }
    if (params.platformFee === undefined || params.platformFee === null) {
      missing.push('platformFee (平台手续费/佣金)')
    }
    if (params.fulfillmentCost === undefined || params.fulfillmentCost === null) {
      missing.push('fulfillmentCost (履约仓储物流成本)')
    }
    if (params.otherCosts === null) {
      missing.push('otherCosts (达人佣金/坑位费)')
    }

    if (missing.length > 0) {
      return {
        metricCode: 'net_roi',
        metricName: '净利润投产比',
        value: null,
        unit: '',
        status: 'NOT_EVALUABLE',
        formulaVersion: this.FORMULA_VERSION,
        missingInputs: missing,
        message: `缺少计算真实净利润必需的关键成本项: ${missing.join(', ')}，拒绝伪造数值`,
      }
    }

    const netProfit =
      params.revenue -
      params.adSpend -
      params.cogs! -
      params.platformFee! -
      params.fulfillmentCost! -
      (params.otherCosts ?? 0)
    const netRoi = Number((netProfit / params.adSpend).toFixed(2))

    return {
      metricCode: 'net_roi',
      metricName: '净利润投产比',
      value: netRoi,
      unit: '',
      status: 'FACT',
      formulaVersion: this.FORMULA_VERSION,
    }
  }
}
