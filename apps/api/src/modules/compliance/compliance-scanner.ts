import type { PoolClient } from 'pg'
import { getAllCollectors, type RulePage } from './collector/index.js'

export interface ScanResult {
  locked: boolean
  scannedCount: number
  newCount: number
  revisedCount: number
  durationMs: number
}

function assessSeverity(text: string, title: string): 'critical' | 'high' | 'medium' | 'low' {
  const combined = `${title} ${text}`
  if (/绝对化|第一|封号|掐断|清退|违禁词|严重违规/.test(combined)) {
    return 'critical'
  }
  if (/赔付|处罚|扣分|限制|超时|SLA|48小时/.test(combined)) {
    return 'high'
  }
  if (/售后|退款|质保|退货|账期/.test(combined)) {
    return 'medium'
  }
  return 'low'
}

/**
 * 运行全平台合规巡检扫描
 * 支持并发咨询锁、变更检测（new/revised）与自动风险评估生成
 */
export async function runComplianceScan(client: PoolClient): Promise<ScanResult> {
  const startTime = Date.now()

  // 1. 获取 DB 咨询锁，防止重复并发运行
  const lockRes = await client.query(`SELECT pg_try_advisory_lock(hashtext('compliance_scan')) AS acquired`)
  if (!lockRes.rows[0]?.acquired) {
    return { locked: false, scannedCount: 0, newCount: 0, revisedCount: 0, durationMs: Date.now() - startTime }
  }

  let scannedCount = 0
  let newCount = 0
  let revisedCount = 0

  try {
    // 检查系统当前支持并启用的平台，严格避免外键约束违规
    const pfRes = await client.query(
      `SELECT platform_code FROM public.system_platform_configs WHERE is_enabled = true`
    )
    const enabledPlatforms = new Set<string>(pfRes.rows.map((r: { platform_code: string }) => r.platform_code))

    const collectors = getAllCollectors()

    for (const collector of collectors) {
      if (!enabledPlatforms.has(collector.platformCode)) {
        continue
      }

      try {
        const discoveries = await collector.discover()

        for (const item of discoveries) {
          scannedCount++

          // 12 小时内已抓过的规则直接跳过，避免每日 3 次巡检重复渲染同一批详情页
          const recentRes = await client.query(
            `SELECT 1 FROM public.compliance_rule_snapshot
              WHERE platform_code = $1 AND external_id = $2
                AND fetched_at > now() - interval '12 hours'
              LIMIT 1`,
            [collector.platformCode, item.externalId],
          )
          if (recentRes.rows.length > 0) continue

          const page = await collector.fetch(item.url, item.externalId)
          if (!page || !enabledPlatforms.has(page.platformCode)) continue

          // 使用 SAVEPOINT 保护事务，即使单条规则写入失败也不导致整个事务 Abort
          await client.query('SAVEPOINT rule_item_sp')
          try {
            // 2. 检查 DB 中该规则的历史快照
            const existingRes = await client.query(
              `SELECT id, content_hash, title FROM public.compliance_rule_snapshot
               WHERE platform_code = $1 AND external_id = $2
               ORDER BY fetched_at DESC LIMIT 1`,
              [page.platformCode, page.externalId],
            )

            if (existingRes.rows.length === 0) {
              // 新规则录入 (new)
              const insSnap = await client.query(
                `INSERT INTO public.compliance_rule_snapshot (
                  platform_code, external_id, title, category, source_url,
                  published_at, effective_at, fetch_method, content_text, content_hash, raw_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id`,
                [
                  page.platformCode,
                  page.externalId,
                  page.title,
                  page.category || '通用规则',
                  page.sourceUrl,
                  page.publishedAt,
                  page.effectiveAt,
                  page.fetchMethod,
                  page.contentText,
                  page.contentHash,
                  JSON.stringify(page.rawMetadata || {}),
                ],
              )
              const snapId = insSnap.rows[0].id
              newCount++

              const severity = assessSeverity(page.contentText, page.title)
              const insChange = await client.query(
                `INSERT INTO public.compliance_rule_change (
                  snapshot_id, platform_code, external_id, change_type, diff_summary, severity, is_read
                ) VALUES ($1, $2, $3, 'new', $4, $5, false)
                RETURNING id`,
                [snapId, page.platformCode, page.externalId, `监测到平台发布全新合规规则《${page.title}》`, severity],
              )
              const changeId = insChange.rows[0].id

              // 生成风险评估
              await client.query(
                `INSERT INTO public.compliance_risk_assessment (
                  change_id, risk_summary, operational_impact, recommended_actions, evidence_refs
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                  changeId,
                  `【新规生效预警】${page.title}`,
                  `本规则涉及 ${page.category}，可能对所辖 ${page.platformCode} 店铺日常播报与履约带来经营合规影响。`,
                  [`组织相关运营与主播团队研读新规全文`, `排查违禁词库与履约SLA流程`, `在运营方案生成前引入红线校验`],
                  JSON.stringify([{ source: page.externalId, url: page.sourceUrl }]),
                ],
              )
            } else if (existingRes.rows[0].content_hash !== page.contentHash) {
              // 规则内容变更 (revised)
              const insSnap = await client.query(
                `INSERT INTO public.compliance_rule_snapshot (
                  platform_code, external_id, title, category, source_url,
                  published_at, effective_at, fetch_method, content_text, content_hash, raw_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id`,
                [
                  page.platformCode,
                  page.externalId,
                  page.title,
                  page.category || '通用规则',
                  page.sourceUrl,
                  page.publishedAt,
                  page.effectiveAt,
                  page.fetchMethod,
                  page.contentText,
                  page.contentHash,
                  JSON.stringify(page.rawMetadata || {}),
                ],
              )
              const snapId = insSnap.rows[0].id
              revisedCount++

              const severity = assessSeverity(page.contentText, page.title)
              const insChange = await client.query(
                `INSERT INTO public.compliance_rule_change (
                  snapshot_id, platform_code, external_id, change_type, diff_summary, severity, is_read
                ) VALUES ($1, $2, $3, 'revised', $4, $5, false)
                RETURNING id`,
                [
                  snapId,
                  page.platformCode,
                  page.externalId,
                  `平台对既有规则《${page.title}》进行了修订，文本指纹发生变更`,
                  severity,
                ],
              )
              const changeId = insChange.rows[0].id

              await client.query(
                `INSERT INTO public.compliance_risk_assessment (
                  change_id, risk_summary, operational_impact, recommended_actions, evidence_refs
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                  changeId,
                  `【规则修订差量】${page.title}`,
                  `平台条款产生修订，需警惕老旧业务流程或话术模板未及时同步导致的违规风险。`,
                  [`对比新旧版本规则差异`, `更新主播提词器与合规审查清单`],
                  JSON.stringify([{ source: page.externalId, url: page.sourceUrl }]),
                ],
              )
            }
            await client.query('RELEASE SAVEPOINT rule_item_sp')
          } catch (itemErr) {
            await client.query('ROLLBACK TO SAVEPOINT rule_item_sp')
            console.error(`[ComplianceScanner] Error saving rule ${page.platformCode}/${page.externalId}:`, itemErr)
          }
        }
      } catch (err) {
        // 单平台失败隔离，不中断其它平台
        console.error(`[ComplianceScanner] Collector error for ${collector.platformCode}:`, err)
      }
    }
  } finally {
    // 3. 释放咨询锁
    try {
      await client.query(`SELECT pg_advisory_unlock(hashtext('compliance_scan'))`)
    } catch {
      // 避免锁释放因事务状态问题产生次生报错
    }
  }

  return {
    locked: true,
    scannedCount,
    newCount,
    revisedCount,
    durationMs: Date.now() - startTime,
  }
}
