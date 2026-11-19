#!/usr/bin/env node
/**
 * database/demo/reset.mjs — 清空全部演示数据
 *
 * 用于：用户接入真实数据后，把演示数据清掉，回到干净状态。
 *
 * 设计：
 *   - 只清 `is_demo = true` 标注的业务表 + 演示生成的结构表；
 *   - 保留 users / roles / permissions / system_config / dim_shop / tenants 等基础数据；
 *   - 按外键依赖顺序删除，失败即回滚；
 *   - 幂等：可重复执行。
 *
 * 用法：node database/demo/reset.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const pgRequire = createRequire(path.join(rootDir, 'apps/api/package.json'))
const pg = pgRequire('pg')

// ── 环境变量（与 init.mjs 同源）──────────────────────────────────
function loadEnv() {
  const envPath = path.join(rootDir, 'apps/api/.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv()

const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 55432),
  user: process.env.DB_USER || 'leyova',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'leyova',
})

const log = (...a) => console.log('[demo-reset]', ...a)

/** 按 FK 依赖顺序：子表在前，主表在后 */
const DEMO_TABLES = [
  // 引用主数据的子表
  'fact_order_rma_item', 'fact_selection_item',
  'session_plan_products', 'session_plans', 'session_short_video_traffic',
  'session_anchor_metrics', 'session_channel_metrics', 'session_overview_metrics',
  'session_live_basic_info', 'session_staff_assignments', 'staff_day_status',
  'live_registrations', 'live_sessions', 'anchor_capabilities', 'anchor_profiles',
  'anchor_training_plans', 'anchor_training_records', 'anchor_script_templates',
  'anchors', 'operators', 'live_rooms', 'room_health', 'multi_room_status',
  'dim_sku_mapping', 'dim_product_channel_listing',
  'fact_inventory_reservation', 'fact_inventory_stock', 'fact_inventory_ledger',
  'dim_product',
  'fact_trade_daily', 'fact_traffic_daily', 'fact_ad_spend_daily',
  'canonical_order_items', 'canonical_orders', 'canonical_refund_events',
  'compliance_activity_reminder', 'video_metrics',
  'competitor_brands', 'competitor_price_data',
  'goal_tracking', 'issue_library', 'pricing_rules', 'promotions', 'script_library',
  'agg_shop_daily', 'agg_trade_day_platform_channel', 'agg_traffic_day_live',
  'fact_fulfillment_waybill', 'fact_after_sale_tickets', 'fact_kol_cooperation',
  'fact_search_keyword_daily', 'fact_content_daily', 'content_attribution_ledger',
  'fact_cs_session', 'content_schedules', 'content_tasks', 'content_projects',
  'fact_settlement_cycles', 'compliance_events', 'campaign_plan',
  'ad_plan', 'ad_plan_receipts', 'alert_events',
]

/** 明确保留的基础数据（不删） */
const PRESERVED = [
  'users', 'roles', 'role_modules', 'role_platform_permissions', 'user_module_overrides',
  'user_platform_permissions', 'user_sessions', 'sys_role', 'sys_role_permission',
  'sys_user_role', 'system_config', 'system_modules', 'system_platform_configs',
  'dim_shop', 'tenants', 'platform_caliber_config', 'platform_capability_matrix',
  'dim_category', 'staff_role_dict', 'ad_tool_dict', 'amount_type_dict', 'signal_source',
  'schema_migrations',
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    log(`准备清空 ${DEMO_TABLES.length} 张演示数据表…`)
    let total = 0
    for (const t of DEMO_TABLES) {
      try {
        const { rowCount } = await client.query(`DELETE FROM ${t}`)
        if (rowCount > 0) {
          log(`  ${t}: ${rowCount} 行`)
          total += rowCount
        }
      } catch (err) {
        if (err.code === '42P01') {
          log(`  ${t}: （表不存在，跳过）`)
        } else {
          throw err
        }
      }
    }

    // 重置自增序列，保证用户后续插入不会主键冲突
    for (const t of DEMO_TABLES) {
      try {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'),
                         COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`,
          [t],
        )
      } catch {
        // 无序列的表跳过
      }
    }

    await client.query('COMMIT')
    log(`✓ 演示数据已清空（共 ${total} 行），序列已重置`)
    log('')
    log(`保留的基础数据（${PRESERVED.length} 类）：账号 / 角色 / 权限 / 系统配置 / 平台配置 / 店铺 / 租户 / 字典`)
    log('')
    log('下一步（数据由用户自己接入）：')
    log('  A. 用户手动上传：前端「数据管理 → 上传」')
    log('  B. 官方平台 API：前端「系统配置 → 平台授权」配置店铺凭证')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[demo-reset] 失败，已回滚：', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
