/**
 * types.ts — 数据治理与清洗校验引擎核心类型定义
 * 
 * 严格遵循《数据清洗引擎与数据质量校验引擎规范 V1.0》
 */

export type DatasetType = 'orders' | 'refunds' | 'traffic' | 'ad_spend' | 'live_sessions'
export type SourceChannel = 'api' | 'manual_file'

/** 数据成熟度状态流转 */
export type MaturityStatus =
  | 'PROCESSING'   // 正在解析/清洗/校验中
  | 'PROVISIONAL'  // 记录级通过，但对账未完成或数据窗口未关闭（暂定）
  | 'FINAL'        // 校验通过、对账一致且数据窗口已关闭（最终正式数据）
  | 'PARTIAL'      // 部分发布，部分隔离待审
  | 'BLOCKED'      // 存在 P0/P1 阻塞性错误，禁止发布
  | 'SUPERSEDED'   // 被更新版本或修正批次替代

/** 质量规则严重级别 */
export type RuleSeverity = 'P0' | 'P1' | 'P2' | 'P3'

/** 质量规则影响范围 */
export type RuleScope = 'record' | 'partition' | 'batch' | 'metric'

/** 质量问题状态 */
export type IssueStatus = 'OPEN' | 'RESOLVED' | 'IGNORED'

/** 规范订单实体 (Canonical Order) */
export interface CanonicalOrderRecord {
  bizDate: string
  sourcePlatform: string
  storeId: number
  sourceOrderId: string
  orderStatus: string
  rawStatus?: string
  currencyCode: string
  paidAmount: number
  totalDiscount: number
  freightFee: number
  buyerUserId?: string
  createdAtSource?: string
  paidAtSource?: string
  sourceUpdatedAt?: string
  batchId?: number
  maturityStatus?: MaturityStatus
  items: CanonicalOrderItemRecord[]
}

/** 规范订单明细行 (Canonical Order Item) */
export interface CanonicalOrderItemRecord {
  bizDate: string
  sourcePlatform: string
  storeId: number
  sourceOrderId: string
  sourceSubOrderId: string
  platformSkuId?: string
  internalSkuId?: number
  productName?: string
  quantity: number
  itemPaidAmount: number
  itemDiscountAllocated: number
  maturityStatus?: MaturityStatus
}

/** 规范退款事件 (Canonical Refund Event) */
export interface CanonicalRefundRecord {
  bizDate: string
  sourcePlatform: string
  storeId: number
  sourceRefundId: string
  sourceOrderId: string
  sourceSubOrderId?: string
  refundType: 'only_refund' | 'return_and_refund'
  refundAmount: number
  refundStatus: string
  refundedAtSource?: string
  batchId?: number
  maturityStatus?: MaturityStatus
}

/** 质量校验问题项 */
export interface QualityIssueItem {
  id?: number
  batchId: number
  bizDate: string
  ruleId: string
  severity: RuleSeverity
  scope: RuleScope
  sourceBusinessKey?: string
  targetField?: string
  rawValue?: string
  cleanedValue?: string
  issueMessage: string
  evidence?: Record<string, any>
  status?: IssueStatus
}

/** 质量规则执行契约 */
export interface QualityValidationRule {
  ruleId: string
  domain: DatasetType
  severity: RuleSeverity
  scope: RuleScope
  description: string
  evaluate: (
    record: any,
    context: {
      allRecords: any[]
      aliasesMap: Map<string, number>
      controlTotals?: Record<string, number>
    }
  ) => QualityIssueItem | null
}

/** 对账运行结果 */
export interface ReconciliationItem {
  batchId: number
  reconcileLevel: 'file' | 'record' | 'amount' | 'grouped' | 'metric'
  metricCode: string
  sourceControlValue: number
  systemCalculatedValue: number
  difference: number
  tolerance: number
  status: 'MATCHED' | 'PROVISIONAL_DIFF' | 'MISMATCH_BLOCKED'
}

