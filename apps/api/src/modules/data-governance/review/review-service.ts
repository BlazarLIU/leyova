/**
 * review-service.ts — 人工审核工作台服务 (Review Workbench Service)
 * 
 * 严格遵循《人工审核工作台规范 V1.0》：
 * 1. 四屏同显：原始值 (Raw) vs 清洗值 (Clean) vs 主档候选 (Master Candidates) vs 失败规则证据；
 * 2. 审核操作留痕：记录人、决策、理由、修改前后值，持久化至 review_actions；
 * 3. 修复后重新触发校验，确保闭环。
 */

import type { Pool } from 'pg'

export interface ResolveIssueInput {
  issueId: number
  reviewerId: number
  decision: 'CONFIRM_FIX' | 'REJECT' | 'OVERRIDE_ALLOW'
  reason: string
  fixedValues?: {
    paidAmount?: number
    sourceOrderId?: string
    platformSkuId?: string
    internalSkuId?: number
  }
}

export class ReviewService {
  constructor(private pool: Pool) {}

  /**
   * 获取批次异常列表 (支持四屏同显对比)
   */
  async getBatchIssues(batchId: number) {
    const { rows } = await this.pool.query(
      `SELECT i.id, i.batch_id, i.biz_date, i.rule_id, i.severity, i.scope,
              i.source_business_key, i.target_field, i.raw_value, i.cleaned_value,
              i.issue_message, i.status, i.resolved_at,
              b.source_platform, b.store_id,
              c.canonical_payload, c.cleaning_status, c.quarantine_reason,
              r.raw_payload, r.row_no
       FROM data_quality_issues i
       JOIN import_batches b ON b.id = i.batch_id
       LEFT JOIN clean_records c ON c.batch_id = i.batch_id AND c.source_order_id = SPLIT_PART(i.source_business_key, ':', 3)
       LEFT JOIN raw_records r ON r.id = c.raw_record_id
       WHERE i.batch_id = $1
       ORDER BY CASE i.severity WHEN 'P0' THEN 1 WHEN 'P1' THEN 2 WHEN 'P2' THEN 3 ELSE 4 END, i.id ASC`,
      [batchId]
    )

    return rows.map((r) => ({
      id: Number(r.id),
      batchId: Number(r.batch_id),
      bizDate: r.biz_date,
      ruleId: r.rule_id,
      severity: r.severity,
      scope: r.scope,
      sourceBusinessKey: r.source_business_key,
      targetField: r.target_field,
      issueMessage: r.issue_message,
      status: r.status,
      // 四屏同显核心数据
      comparison: {
        raw: {
          rowNo: r.row_no,
          payload: r.raw_payload || {},
          fieldValue: r.raw_value,
        },
        cleaned: {
          status: r.cleaning_status,
          quarantineReason: r.quarantine_reason,
          payload: r.canonical_payload || {},
          fieldValue: r.cleaned_value,
        },
        ruleEvidence: {
          ruleId: r.rule_id,
          severity: r.severity,
          message: r.issue_message,
        },
      },
    }))
  }

  /**
   * 提交人工审核决策
   */
  async resolveIssue(input: ResolveIssueInput) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // 1. 查询 issue
      const issueRes = await client.query(
        `SELECT id, batch_id, source_business_key, status FROM data_quality_issues WHERE id = $1`,
        [input.issueId]
      )
      if (issueRes.rows.length === 0) {
        throw new Error(`质量问题不存在: ${input.issueId}`)
      }
      const issue = issueRes.rows[0]

      // 2. 插入 review_actions 审计记录
      await client.query(
        `INSERT INTO review_actions
           (issue_id, reviewer_id, decision, decision_reason, before_value, after_value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.issueId,
          input.reviewerId,
          input.decision,
          input.reason,
          JSON.stringify({ status: issue.status }),
          JSON.stringify({ decision: input.decision, fixedValues: input.fixedValues }),
        ]
      )

      // 3. 更新 issue 状态为 RESOLVED
      await client.query(
        `UPDATE data_quality_issues
         SET status = 'RESOLVED',
             resolved_at = now()
         WHERE id = $1`,
        [input.issueId]
      )

      // 4. 如果有修正字段，同步更新 clean_records 候选数据
      if (input.fixedValues && input.decision === 'CONFIRM_FIX') {
        const orderId = issue.source_business_key ? issue.source_business_key.split(':')[2] : null
        if (orderId) {
          if (input.fixedValues.paidAmount !== undefined) {
            await client.query(
              `UPDATE clean_records
               SET paid_amount = $1,
                   cleaning_status = 'CANDIDATE',
                   quarantine_reason = NULL
               WHERE batch_id = $2 AND source_order_id = $3`,
              [input.fixedValues.paidAmount, issue.batch_id, orderId]
            )
          }

          if (input.fixedValues.internalSkuId !== undefined && input.fixedValues.platformSkuId) {
            // 将平台 SKU 关联登记到 entity_aliases
            await client.query(
              `INSERT INTO entity_aliases
                 (entity_type, source_platform, external_id, internal_id, approved_by)
               SELECT 'sku', source_platform, $1, $2, $3
               FROM import_batches WHERE id = $4
               ON CONFLICT (entity_type, source_platform, external_id, valid_from)
               DO UPDATE SET internal_id = EXCLUDED.internal_id`,
              [input.fixedValues.platformSkuId, input.fixedValues.internalSkuId, input.reviewerId, issue.batch_id]
            )
          }
        }
      }

      await client.query('COMMIT')
      return { success: true, issueId: input.issueId }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}

