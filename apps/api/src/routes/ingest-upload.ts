import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { withRlsContext, withRlsPool } from '../lib/db.js'
import { requireRole } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { parseFileToRows, headerFingerprint } from '../lib/csv-parser.js'
import { ingestManualFacts, mapRowsToStandard, TRADE_COLUMN_ALIASES, TRAFFIC_COLUMN_ALIASES } from '../ingest/manual-mapper.js'
import { executeCleaningPipeline } from '../ingest/cleaner/engine.js'
import { UnifiedDataPipelineService } from '../services/data-pipeline.js'

/**
 * ingest 域拆分（P2-1）：手动上传正式导入
 * 原属 routes/ingest.ts，2026-11-17 拆出。
 */
export async function ingestManualUploadRoutes(app: FastifyInstance) {
  // ── POST /api/v1/ingest/manual-upload ── 正式导入（绑定模板+映射+规则集）
  app.post('/api/v1/ingest/manual-upload', { preHandler: [requireRole(['super_admin', 'ops_director', 'ops_staff'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = 'unknown'
      let platformCode = ''
      let shopId: number | null = null
      let dataType: 'trade' | 'traffic' = 'trade'
      let ruleSetId: number | null = null
      let bizDate = ''
      let mappingOverride: Record<string, string | null> | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) chunks.push(chunk as Buffer)
          fileBuffer = Buffer.concat(chunks)
          fileName = part.filename || 'unknown'
        } else if (part.fieldname === 'platform_code') {
          platformCode = String(part.value || '').trim()
        } else if (part.fieldname === 'shop_id') {
          const n = parseInt(String(part.value || ''), 10)
          if (Number.isFinite(n)) shopId = n
        } else if (part.fieldname === 'data_type') {
          const v = String(part.value || '').trim()
          if (v === 'traffic' || v === 'trade') dataType = v
        } else if (part.fieldname === 'rule_set_id') {
          const n = parseInt(String(part.value || ''), 10)
          if (Number.isFinite(n)) ruleSetId = n
        } else if (part.fieldname === 'business_date') {
          bizDate = String(part.value || '').trim()
        } else if (part.fieldname === 'column_mappings') {
          try { mappingOverride = JSON.parse(String(part.value)) } catch { /* ignore */ }
        }
      }

      if (!fileBuffer) return sendError(reply, 400, '未选择文件')
      if (fileBuffer.length > 20 * 1024 * 1024) return sendError(reply, 413, '文件大小超过限制 (最大 20MB)')
      if (!platformCode) return sendError(reply, 400, '缺少 platform_code')
      if (!shopId) return sendError(reply, 400, '缺少 shop_id')

      const { rows } = parseFileToRows(fileBuffer, fileName)
      if (rows.length === 0) return sendError(reply, 400, '文件解析后没有数据行')

      let workingRows = rows
      if (mappingOverride) {
        workingRows = rows.map((r) => {
          const out: Record<string, any> = {}
          for (const [targetField, sourceCol] of Object.entries(mappingOverride!)) {
            if (sourceCol && sourceCol in r) out[targetField] = r[sourceCol]
          }
          return { ...r, ...out }
        })
      }

      const ext = fileName.split('.').pop()?.toLowerCase() || 'xlsx'
      const prep = await withRlsContext(request, async (client) => {
        const shopCheck = await client.query(
          `SELECT id FROM dim_shop WHERE id = $1 AND platform_code = $2`,
          [shopId, platformCode],
        )
        if (shopCheck.rows.length === 0) {
          return { errStatus: 400 as const, errMsg: '店铺不存在或不属于该平台' }
        }

        let cleaned = workingRows
        if (ruleSetId) {
          const rs = await client.query(`SELECT rules FROM clean_rule_sets WHERE id = $1`, [ruleSetId])
          if (rs.rows.length === 0) {
            return { errStatus: 404 as const, errMsg: '清洗规则集不存在' }
          }
          const out = executeCleaningPipeline(workingRows, rs.rows[0].rules || [])
          cleaned = out.cleanedRows
        }

        const uploadIns = await client.query<{ id: number }>(
          `INSERT INTO data_uploads
             (file_name, file_type, file_size, status, row_count, data_type, business_date,
              platform_code, clean_rule_set_id, shop_id, tenant_id)
           VALUES ($1, $2, $3, 'processing', $4, $5, $6, $7, $8, $9,
                   (SELECT tenant_id FROM dim_shop WHERE id = $9))
           RETURNING id`,
          [
            fileName,
            ext.slice(0, 50),
            `${Math.max(1, Math.round(fileBuffer.length / 1024))}KB`,
            cleaned.length,
            dataType,
            bizDate || null,
            platformCode,
            ruleSetId ?? null,
            shopId,
          ],
        )
        return { uploadId: uploadIns.rows[0]?.id ?? null, cleanedRows: cleaned }
      })

      if ('errStatus' in prep && prep.errStatus !== undefined) {
        return sendError(reply, prep.errStatus, prep.errMsg)
      }

      const { uploadId, cleanedRows } = prep
      try {
        const gated = await withRlsContext(request, async (client) => {
          const mapped = mapRowsToStandard(cleanedRows, dataType, bizDate || undefined)

          // 缺整列拦截：文件必须至少包含一个有效指标列，否则必然把已有数据清零
          const valueFields = dataType === 'trade'
            ? ['gmv', 'pay_amount', 'paid_order_count', 'refund_amount']
            : ['impressions', 'clicks', 'visitors', 'avg_stay_seconds']
          if (!valueFields.some((f) => mapped.mapping[f] != null)) {
            const recognized = Object.entries(mapped.mapping)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join('、') || '无'
            return {
              gateFailed: true as const,
              reasons: [`未识别到任何有效的${dataType === 'trade' ? '交易' : '流量'}指标列（已识别：${recognized}）`],
            }
          }

          // 交易文件走统一质量门禁（与 API 同步 / 治理导入同一套规则）
          if (dataType === 'trade') {
            const batchNo = `MU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const batchIns = await client.query<{ id: number }>(
              `INSERT INTO import_batches
                 (batch_no, source_platform, store_id, dataset_type, source_channel,
                  status, total_raw_rows, clean_candidate_rows, created_by)
               VALUES ($1, $2, $3, $4, 'manual_upload', 'PROCESSING', $5, $6, $7)
               RETURNING id`,
              [batchNo, platformCode, shopId, dataType, mapped.rows.length, mapped.rows.length, (request as any).user?.id ?? null],
            )
            const batchId = batchIns.rows[0].id

            const stageRows = mapped.rows.map((r, i) => ({
              sourceOrderId: `MU-${batchNo}-${i + 1}`,
              orderStatus: 'PAID',
              paidAmount: Number(r.values.pay_amount ?? r.values.gmv ?? 0),
              orderDate: r.bizDate,
              storeId: shopId,
            }))
            const staged = await UnifiedDataPipelineService.stageBatchRows(
              client as any,
              String(batchId),
              stageRows,
              platformCode,
            )
            await client.query(
              `UPDATE import_batches SET validated_rows = $1 WHERE id = $2`,
              [Math.max(0, stageRows.length - staged.quarantinedCount), batchId],
            )

            const gate = await UnifiedDataPipelineService.evaluateQualityGates(client as any, batchId)
            // 跨表对账/金额守恒依赖 canonical_orders，手动聚合上传不适用；只拦截批次内可验证的规则
            const blocking = gate.gates.filter((g: any) => !g.passed && (
              g.severity === 'fatal' ||
              g.ruleCode === 'RULE_LINE_COUNT_CONSERVED' ||
              g.ruleCode === 'RULE_ENUM_LEGAL'
            ))
            if (blocking.length > 0) {
              const reasons = blocking.map((g: any) => `[${g.ruleCode}] ${g.message}`)
              await client.query(
                `UPDATE import_batches SET status = 'REJECTED', error_summary = $1 WHERE id = $2`,
                [reasons.join('; ').slice(0, 1000), batchId],
              )
              return { gateFailed: true as const, reasons }
            }
          }

          const res = await ingestManualFacts(client, {
            platformCode,
            shopId,
            dataType,
            rows: cleanedRows,
            defaultBizDate: bizDate || undefined,
            cleanRuleSetId: ruleSetId,
            uploadId,
          })

          if (uploadId) {
            await client.query(
              `UPDATE data_uploads SET status = 'completed', row_count = $1 WHERE id = $2`,
              [res.insertedRows, uploadId],
            )
          }
          return { result: res }
        })

        if ('gateFailed' in gated && gated.gateFailed) {
          const reasons = gated.reasons || []
          if (uploadId) {
            try {
              await withRlsContext(request, (client) =>
                client.query(
                  `UPDATE data_uploads SET status = 'failed', error_message = $1 WHERE id = $2`,
                  [reasons.join('; ').slice(0, 500), uploadId],
                ),
              )
            } catch (err) {
              request.log.warn({ err }, 'failed to persist upload gate rejection')
            }
          }
          return sendError(reply, 422, `质量门禁未通过：${reasons.join('；')}`)
        }

        const result = gated.result
        return sendOk(reply, {
          ...result,
          uploadId,
          fileName,
          inputRows: rows.length,
          cleanedRows: cleanedRows.length,
        }, `导入完成：成功 ${result.insertedRows} 行，拒绝 ${result.rejectedRows} 行`)
      } catch (err) {
        if (uploadId) {
          try {
            await withRlsContext(request, (client) =>
              client.query(
                `UPDATE data_uploads SET status = 'failed', error_message = $1 WHERE id = $2`,
                [String((err as Error)?.message || err).slice(0, 500), uploadId],
              ),
            )
          } catch (updateErr) {
            request.log.error({ err: updateErr }, 'failed to persist upload failure status')
          }
        }
        throw err
      }
    } catch (err) {
      request.log.error({ err }, 'ingest/manual-upload failed')
      return sendError(reply, 500, '手动上传导入失败')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // 平台模板（阶段 C）
  // ═══════════════════════════════════════════════════════════════
}
