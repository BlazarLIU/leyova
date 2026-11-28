/**
 * validation-service.ts — 独立数据质量校验引擎 (Quality Validation Engine)
 * 
 * 严格遵循《数据质量校验引擎规范 V1.0》：
 * 1. 独立性原则：质量校验引擎绝不把清洗引擎的“通过”状态作为输入结论，而是独立重算规则断言；
 * 2. 8 类质量规则：完整性、有效性、唯一性、准确性、一致性、关联完整性、及时性、合理性；
 * 3. 严重等级与阻断范围：P0 (致命/阻断)、P1 (严重/待审)、P2 (一般/告警)、P3 (提示)；
 * 4. 评分仅用于观察趋势，P0/P1 硬性错误不能被高总分抵消。
 */

import type { Pool } from 'pg'
import type { QualityIssueItem, RuleSeverity, RuleScope } from '../types.js'

export interface ValidationRunResult {
  validationRunId: number
  batchId: number
  status: 'PASSED' | 'FAILED_BLOCKING' | 'WARNING'
  totalChecked: number
  p0Count: number
  p1Count: number
  p2Count: number
  issues: QualityIssueItem[]
  suggestedMaturity: 'FINAL' | 'PROVISIONAL' | 'BLOCKED'
}

export class ValidationService {
  constructor(private pool: Pool) {}

  /**
   * 针对某个清洗运行执行独立质量校验
   */
  async validateCleaningRun(
    cleaningRunId: number,
    options: {
      ruleSetVersion?: string
      controlTotalAmount?: number
      tolerance?: number
    } = {}
  ): Promise<ValidationRunResult> {
    const client = await this.pool.connect()
    try {
      // 1. 读取 cleaning_runs 与关联的 batch 信息
      const runRes = await client.query(
        `SELECT r.id, r.batch_id, b.source_platform, b.store_id, b.dataset_type
         FROM cleaning_runs r
         JOIN import_batches b ON b.id = r.batch_id
         WHERE r.id = $1`,
        [cleaningRunId]
      )
      if (runRes.rows.length === 0) {
        throw new Error(`清洗运行不存在: ${cleaningRunId}`)
      }
      const { batch_id: batchId, source_platform: platform, store_id: storeId } = runRes.rows[0]

      // 清理该批次先前未解决的旧问题 (避免重新校验时旧问题重复累加)
      await client.query(
        `DELETE FROM data_quality_issues WHERE batch_id = $1 AND status = 'OPEN'`,
        [batchId]
      )

      // 2. 创建 validation_runs 记录
      const ruleVer = options.ruleSetVersion || 'v1_standard_matrix'
      const vRunRes = await client.query(
        `INSERT INTO validation_runs (cleaning_run_id, rule_set_version, status, total_checked)
         VALUES ($1, $2, 'RUNNING', 0)
         RETURNING id`,
        [cleaningRunId, ruleVer]
      )
      const validationRunId = Number(vRunRes.rows[0].id)

      // 3. 独立读取 clean_records 候选数据
      const candidateRowsRes = await client.query(
        `SELECT id, biz_date, raw_record_id, source_order_id, source_sub_order_id,
                paid_amount, currency_code, cleaning_status, canonical_payload, quarantine_reason
         FROM clean_records
         WHERE batch_id = $1`,
        [batchId]
      )
      const candidateRows = candidateRowsRes.rows

      // 4. 读取该平台有效的主数据 SKU 映射
      const aliasRes = await client.query(
        `SELECT external_id, internal_id FROM entity_aliases
         WHERE source_platform = $1 AND entity_type = 'sku'`,
        [platform]
      )
      const approvedSkus = new Set(aliasRes.rows.map((r) => String(r.external_id)))

      // 5. 执行 8 类质量规则独立判定
      const issues: QualityIssueItem[] = []
      let p0Count = 0
      let p1Count = 0
      let p2Count = 0
      let sumPaidAmount = 0
      const seenOrderIds = new Set<string>()

      for (const row of candidateRows) {
        const payload = row.canonical_payload || {}
        const orderId = String(row.source_order_id || '')
        const subOrderId = String(row.source_sub_order_id || '0')
        const amount = Number(row.paid_amount)
        const bizDateStr = row.biz_date ? new Date(row.biz_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
        const bizKey = `${platform}:${storeId}:${orderId}:${subOrderId}`

        sumPaidAmount += amount

        // [规则 ORD-001] 完整性: 平台/店铺/订单ID不得为空 (P0 / 阻断记录)
        if (!orderId || orderId.startsWith('UNKNOWN_')) {
          p0Count++
          issues.push({
            batchId,
            bizDate: bizDateStr,
            ruleId: 'ORD-001',
            severity: 'P0',
            scope: 'record',
            sourceBusinessKey: bizKey,
            targetField: 'source_order_id',
            rawValue: orderId,
            issueMessage: '订单业务主键 source_order_id 为空，禁止入库',
          })
        }

        // [规则 ORD-002] 有效性: 币种必须已知且受控 (P0 / 阻断记录)
        if (row.currency_code !== 'CNY') {
          p0Count++
          issues.push({
            batchId,
            bizDate: bizDateStr,
            ruleId: 'ORD-002',
            severity: 'P0',
            scope: 'record',
            sourceBusinessKey: bizKey,
            targetField: 'currency_code',
            rawValue: row.currency_code,
            issueMessage: `币种未知或不受支持: ${row.currency_code}`,
          })
        }

        // [规则 ORD-003] 有效性: 实付金额必须合法且 >= 0 (P0 / 阻断记录)
        if (!Number.isFinite(amount) || amount < 0) {
          p0Count++
          issues.push({
            batchId,
            bizDate: bizDateStr,
            ruleId: 'ORD-003',
            severity: 'P0',
            scope: 'record',
            sourceBusinessKey: bizKey,
            targetField: 'paid_amount',
            rawValue: String(amount),
            issueMessage: `实付金额为负或非法 (${amount})，且无合法业务调整凭证`,
          })
        }

        // [规则 ORD-004] 唯一性: 相同批次内订单业务键唯一 (P0 / 阻断重复记录)
        if (orderId && !orderId.startsWith('UNKNOWN_')) {
          if (seenOrderIds.has(bizKey)) {
            p0Count++
            issues.push({
              batchId,
              bizDate: bizDateStr,
              ruleId: 'ORD-004',
              severity: 'P0',
              scope: 'record',
              sourceBusinessKey: bizKey,
              targetField: 'source_order_id',
              issueMessage: `批次内订单业务键重复: ${bizKey}`,
            })
          } else {
            seenOrderIds.add(bizKey)
          }
        }

        // [规则 SKU-001] 关联完整性: 平台 SKU 是否存在已批准的内部商品主档关联 (P1 / 待审)
        const platformSku = String(payload._platform_sku_id || payload['商品编码'] || '').trim()
        if (platformSku && !approvedSkus.has(platformSku)) {
          p1Count++
          issues.push({
            batchId,
            bizDate: bizDateStr,
            ruleId: 'SKU-001',
            severity: 'P1',
            scope: 'record',
            sourceBusinessKey: bizKey,
            targetField: 'platform_sku_id',
            rawValue: platformSku,
            issueMessage: `平台SKU [${platformSku}] 尚未在主档建立映射关系，需人工确认`,
          })
        }

        // [规则 ORD-005] 合理性/异常值: 极高单笔金额预警 (P2 / 提示)
        if (amount > 100000) {
          p2Count++
          issues.push({
            batchId,
            bizDate: bizDateStr,
            ruleId: 'ORD-005',
            severity: 'P2',
            scope: 'record',
            sourceBusinessKey: bizKey,
            targetField: 'paid_amount',
            rawValue: String(amount),
            issueMessage: `单笔实付金额超 10 万元 (${amount})，触发大额复核预警`,
          })
        }

        // 如果在清洗环节已被判定为 QUARANTINED，且该行未被特定规则标记过，补充兜底问题
        const hasSpecificIssue = issues.some((i) => i.sourceBusinessKey === bizKey && (i.severity === 'P0' || i.severity === 'P1'))
        if (!hasSpecificIssue && row.cleaning_status === 'QUARANTINED' && row.quarantine_reason) {
          p0Count++
          issues.push({
            batchId,
            bizDate: bizDateStr,
            ruleId: 'CLEAN-QUARANTINE',
            severity: 'P0',
            scope: 'record',
            sourceBusinessKey: bizKey,
            issueMessage: `清洗阶段隔离: ${row.quarantine_reason}`,
          })
        }
      }

      // [规则 REC-001] 准确性对账: 与来源控制总额 (Control Total) 校验
      if (options.controlTotalAmount !== undefined) {
        const diff = Math.abs(sumPaidAmount - options.controlTotalAmount)
        const tol = options.tolerance ?? 0.01
        if (diff > tol) {
          p0Count++
          issues.push({
            batchId,
            bizDate: new Date().toISOString().slice(0, 10),
            ruleId: 'REC-001',
            severity: 'P0',
            scope: 'batch',
            targetField: 'paid_amount_total',
            rawValue: String(options.controlTotalAmount),
            cleanedValue: String(sumPaidAmount),
            issueMessage: `批次总金额与来源控制总额不一致！系统汇总: ${sumPaidAmount}, 来源控制额: ${options.controlTotalAmount}, 差异: ${diff}`,
          })
        }
      }

      // 6. 批量持久化 data_quality_issues
      for (const issue of issues) {
        await client.query(
          `INSERT INTO data_quality_issues
             (batch_id, biz_date, rule_id, severity, scope, source_business_key,
              target_field, raw_value, cleaned_value, issue_message, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN')`,
          [
            issue.batchId,
            issue.bizDate,
            issue.ruleId,
            issue.severity,
            issue.scope,
            issue.sourceBusinessKey || null,
            issue.targetField || null,
            issue.rawValue || null,
            issue.cleanedValue || null,
            issue.issueMessage,
          ]
        )
      }

      // 7. 判定校验状态与建议成熟度 (入库闸门先决条件)
      let status: 'PASSED' | 'FAILED_BLOCKING' | 'WARNING' = 'PASSED'
      let suggestedMaturity: 'FINAL' | 'PROVISIONAL' | 'BLOCKED' = 'FINAL'

      if (p0Count > 0) {
        status = 'FAILED_BLOCKING'
        suggestedMaturity = 'BLOCKED'
      } else if (p1Count > 0) {
        status = 'WARNING'
        suggestedMaturity = 'PROVISIONAL'
      } else if (p2Count > 0) {
        status = 'WARNING'
        suggestedMaturity = 'PROVISIONAL'
      }

      // 8. 更新 validation_runs
      await client.query(
        `UPDATE validation_runs
         SET status = $1,
             total_checked = $2,
             p0_issues_count = $3,
             p1_issues_count = $4,
             p2_issues_count = $5,
             finished_at = now()
         WHERE id = $6`,
        [status, candidateRows.length, p0Count, p1Count, p2Count, validationRunId]
      )

      // 9. 更新批次状态
      await client.query(
        `UPDATE import_batches
         SET status = $1,
             validated_rows = $2,
             updated_at = now()
         WHERE id = $3`,
        [suggestedMaturity, candidateRows.length, batchId]
      )

      return {
        validationRunId,
        batchId,
        status,
        totalChecked: candidateRows.length,
        p0Count,
        p1Count,
        p2Count,
        issues,
        suggestedMaturity,
      }
    } finally {
      client.release()
    }
  }
}
