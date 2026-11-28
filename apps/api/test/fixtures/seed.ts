/**
 * 测试夹具：向独立测试库写入最小可用业务数据。
 *
 * 约束：
 *   - 仅允许在 NODE_ENV=test 且目标库名以 `_test` 结尾时执行，避免污染产品库；
 *   - 固定 ID 段 9001+，与序列自增 ID 不冲突；
 *   - 幂等：重复执行先删除固定 ID 再插入。
 */

import 'dotenv/config'
import pg from 'pg'

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

if (!connectionString) {
  console.error('[fixtures] 缺少 TEST_DATABASE_URL 或 DATABASE_URL')
  process.exit(1)
}

const dbName = new URL(connectionString).pathname.replace(/^\//, '')

if (process.env.NODE_ENV !== 'test' || !dbName.endsWith('_test')) {
  console.error(
    `[fixtures] 拒绝执行：NODE_ENV=${process.env.NODE_ENV ?? 'unset'}，目标库=${dbName}。` +
      '测试夹具只能写入以 _test 结尾的独立数据库。'
  )
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO public.tenants (id, name, slug, plan, status)
       VALUES (1, 'Leyova Test', 'leyova-test', 'starter', 'active')
       ON CONFLICT (id) DO NOTHING`
    )

    await client.query(
      `INSERT INTO public.dim_shop
         (id, tenant_id, platform_code, shop_name, external_shop_id, status, auth_status)
       VALUES (9001, 1, 'douyin', '测试抖音店铺', 'test-douyin-9001', 'active', 'manual_only')
       ON CONFLICT (id) DO UPDATE SET shop_name = EXCLUDED.shop_name`
    )

    // 测试大量硬编码 shopId=1 / sessionId=1，补齐最小 id=1 店铺
    // （live_rooms.shop_id 有 FK，必须先于 live_rooms 插入）
    await client.query(
      `INSERT INTO public.dim_shop
         (id, tenant_id, platform_code, shop_name, external_shop_id, status, auth_status)
       VALUES (1, 1, 'douyin', '测试抖音店铺(1)', 'test-douyin-1', 'active', 'manual_only')
       ON CONFLICT (id) DO NOTHING`
    )
    // 跨平台越权测试用：shop 7 是快手平台店铺
    await client.query(
      `INSERT INTO public.dim_shop
         (id, tenant_id, platform_code, shop_name, external_shop_id, status, auth_status)
       VALUES (7, 1, 'kuaishou', '快手跨平台店铺', 'test-ks-7', 'active', 'manual_only')
       ON CONFLICT (id) DO NOTHING`
    )
    // 显式 ID 插入不会推进序列，后续用例按 serial 插入会撞主键（dim_shop_pkey）。
    // 这里把序列对齐到当前最大值，避免测试间互相踩踏。
    await client.query(
      `SELECT setval(pg_get_serial_sequence('public.dim_shop', 'id'),
                     GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.dim_shop), 1))`
    )

    await client.query(
      `INSERT INTO public.dim_brand (id, brand_name, brand_code, is_active)
       VALUES (9001, '测试品牌', 'TEST_BRAND', true)
       ON CONFLICT (id) DO UPDATE SET brand_name = EXCLUDED.brand_name`
    )

    await client.query(
      `INSERT INTO public.dim_category (code, level, name, status, sort_order)
       VALUES ('C9001', 1, '测试类目', 'active', 9001)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`
    )

    await client.query(
      `INSERT INTO public.dim_product
         (id, spu_code, sku_code, product_name, category, brand_name, unit_cost,
          retail_price, safety_stock, status, category_code)
       VALUES (9001, 'SPU9001', 'SKU9001', '测试商品', '测试类目', '测试品牌', 30,
               99, 10, 'active', 'C9001')
       ON CONFLICT (id) DO UPDATE SET product_name = EXCLUDED.product_name`
    )
    // campaign-plan generate fallback 需要至少 5 条 active 商品（ORDER BY id LIMIT 5）
    const productSeeds = [
      [9002, 'SPU9002', 'SKU9002', '引流爆款冲锋衣', '外套', '测试品牌', 80, 199, 30, 'active'],
      [9003, 'SPU9003', 'SKU9003', '高利润鹅绒服', '外套', '测试品牌', 120, 399, 20, 'active'],
      [9004, 'SPU9004', 'SKU9004', '福利款保暖内衣', '内衣', '测试品牌', 20, 69, 50, 'active'],
      [9005, 'SPU9005', 'SKU9005', '形象款羊绒围巾', '配饰', '测试品牌', 50, 299, 15, 'active'],
    ]
    for (const [id, spu, sku, name, cat, brand, cost, price, stock, status] of productSeeds) {
      await client.query(
        `INSERT INTO public.dim_product
           (id, spu_code, sku_code, product_name, category, brand_name, unit_cost,
            retail_price, safety_stock, status, category_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'APPAREL_OUTDOOR')
         ON CONFLICT (id) DO NOTHING`,
        [id, spu, sku, name, cat, brand, cost, price, stock, status]
      )
    }

    await client.query(
      `INSERT INTO public.dim_product_cost_versions
         (id, tenant_id, product_id, cost_version, unit_cost, effective_from)
       VALUES (9001, 1, 9001, 'v-test', 30, '2020-01-01T00:00:00Z')
       ON CONFLICT (id) DO UPDATE SET unit_cost = EXCLUDED.unit_cost`
    )

    await client.query(
      `INSERT INTO public.operators (id, name, employee_id, status)
       VALUES (9001, '测试运营', 'T9001', 1)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`
    )

    await client.query(
      `INSERT INTO public.anchors (id, name, platform, level, status, platform_code)
       VALUES (1, '默认主播', '抖音', 'A级', 1, 'douyin')
       ON CONFLICT (id) DO NOTHING`
    )
    await client.query(
      `INSERT INTO public.anchors (id, name, platform, level, status, platform_code)
       VALUES (9001, '测试主播', '抖音', 'B级', 1, 'douyin')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`
    )
    await client.query(
      `INSERT INTO public.anchors (id, name, platform, level, status, platform_code)
       VALUES (9002, '测试主播B', '抖音', 'A级', 1, 'douyin')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`
    )

    await client.query(
      `INSERT INTO public.live_rooms
         (id, name, platform, status, shop_id, platform_code)
       VALUES (1, '默认直播间', '抖音', 'active', 1, 'douyin')
       ON CONFLICT (id) DO NOTHING`
    )
    await client.query(
      `INSERT INTO public.live_rooms
         (id, name, platform, status, shop_id, platform_code)
       VALUES (9001, '测试直播间', '抖音', 'active', 9001, 'douyin')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`
    )

    await client.query(
      `INSERT INTO public.live_sessions
         (id, room_id, anchor_id, operator_id, title, date, status, gmv, orders,
          online_peak, duration_min, return_amount, gsv, ad_cost, ad_gsv,
          platform_code, data_source)
       VALUES (9001, 9001, 9001, 9001, '测试场次', CURRENT_DATE - 1, 'completed',
               10000, 100, 1200, 120, 500, 10500, 1000, 9000, 'douyin', 'manual_upload')
       ON CONFLICT (id) DO UPDATE SET gmv = EXCLUDED.gmv`
    )

    // 无达人合作的独立场次，用于校验缺失成本项返回 null（不伪造 0）
    await client.query(
      `INSERT INTO public.live_sessions
         (id, room_id, anchor_id, operator_id, title, date, status, gmv, orders,
          online_peak, duration_min, return_amount, gsv, ad_cost, ad_gsv,
          platform_code, data_source)
       VALUES (9002, 9001, 9001, 9001, '测试场次-无成本项', CURRENT_DATE - 3, 'completed',
               8000, 80, 900, 100, 400, 8400, 0, 0, 'douyin', 'manual_upload')
       ON CONFLICT (id) DO UPDATE SET gmv = EXCLUDED.gmv`
    )

    await client.query(
      `INSERT INTO public.session_live_basic_info
         (id, session_id, room_id, business_date, live_date, live_duration_min,
          live_platform, payment_amount)
       VALUES (9001, 9001, 9001, CURRENT_DATE - 1, CURRENT_DATE - 1, 120, '抖音', 10000)
       ON CONFLICT (id) DO UPDATE SET payment_amount = EXCLUDED.payment_amount`
    )

    await client.query(
      `INSERT INTO public.session_overview_metrics
         (id, session_id, room_id, business_date, viewers, avg_online, peak_online,
          conversion_rate, avg_order_value, refund_amount, refund_orders, deal_users)
       VALUES (9001, 9001, 9001, CURRENT_DATE - 1, 50000, 800, 1200,
               2.0, 100, 500, 5, 100)
       ON CONFLICT (id) DO UPDATE SET viewers = EXCLUDED.viewers`
    )

    await client.query(
      `INSERT INTO public.session_channel_metrics
         (id, session_id, channel, orders, buyer_count, gmv, ad_spend, period_date,
          platform_code, shop_id)
       VALUES (9001, 9001, '自然流量', 100, 95, 10000, 1000, CURRENT_DATE - 1,
               'douyin', 9001)
       ON CONFLICT (id) DO UPDATE SET gmv = EXCLUDED.gmv`
    )

    await client.query(
      `DELETE FROM public.fact_trade_daily WHERE id = 9001 AND biz_date = CURRENT_DATE - 1`
    )
    await client.query(
      `INSERT INTO public.fact_trade_daily
         (id, biz_date, platform_code, shop_id, channel_name, gmv, pay_amount,
          paid_order_count, paid_buyer_count, refund_amount, refund_count,
          source, is_demo)
       VALUES (9001, CURRENT_DATE - 1, 'douyin', 9001, '自然流量', 10000, 9500,
               100, 95, 500, 5, 'manual_upload', false)`
    )

    await client.query(
      `INSERT INTO public.fact_ad_spend_daily
         (id, tenant_id, platform_code, shop_id, biz_date, ad_tool_code, ad_spend,
          impressions, clicks, attributed_orders, attributed_gross_gmv,
          attributed_settled_gmv, estimated_settle_date, is_demo)
       VALUES (9001, 1, 'douyin', 9001, CURRENT_DATE - 1, 'qianchuan', 1000,
               100000, 5000, 100, 9000, 8500, CURRENT_DATE + 6, false)
       ON CONFLICT (id) DO UPDATE SET ad_spend = EXCLUDED.ad_spend`
    )

    await client.query(
      `INSERT INTO public.fact_settlement_cycles
         (id, tenant_id, platform_code, shop_id, order_date, settle_date,
          gross_gmv, settled_gmv, refund_deducted, platform_fee, ad_spend,
          net_profit, settlement_status, cogs_amount)
       VALUES (9001, 1, 'douyin', 9001, CURRENT_DATE - 1, CURRENT_DATE + 6,
               10000, 9500, 500, 500, 1000, 4700, 'pending', 3000)
       ON CONFLICT (id) DO UPDATE SET net_profit = EXCLUDED.net_profit`
    )

    await client.query(
      `INSERT INTO public.fact_settlement_cycles
         (id, tenant_id, platform_code, shop_id, order_date, settle_date,
          gross_gmv, settled_gmv, refund_deducted, platform_fee, ad_spend,
          net_profit, settlement_status, cogs_amount)
       VALUES (9002, 1, 'douyin', 9001, CURRENT_DATE - 8, CURRENT_DATE - 1,
               10000, 9500, 500, 500, 1000, 4700, 'settled', 3000)
       ON CONFLICT (id) DO UPDATE
       SET net_profit = EXCLUDED.net_profit,
           cogs_amount = EXCLUDED.cogs_amount,
           settlement_status = EXCLUDED.settlement_status`
    )

    await client.query(
      `INSERT INTO public.dim_kol
         (id, kol_name, platform_code, platform_uid, tier, fans_count, category)
       VALUES (9001, '测试达人', 'douyin', 'test-kol-9001', 'waist', 100000, '测试类目')
       ON CONFLICT (id) DO UPDATE SET kol_name = EXCLUDED.kol_name`
    )

    await client.query(
      `INSERT INTO public.fact_kol_cooperation
         (id, kol_id, platform_code, shop_id, product_id, coop_type, campaign_name,
          publish_date, pit_fee, commission_rate, gmv, refund_amount,
          commission_amount, settlement_status)
       VALUES (9001, 9001, 'douyin', 9001, 9001, 'live_slot', '测试合作',
               CURRENT_DATE - 1, 500, 0.15, 5000, 200, 750, 'pending')
       ON CONFLICT (id) DO UPDATE SET gmv = EXCLUDED.gmv`
    )

    // 覆盖历史指标查询区间的成交日序列（测试断言使用固定的 8~11 月日期）
    await client.query(
      `DELETE FROM public.fact_trade_daily
       WHERE (shop_id = 9001 AND platform_code = 'douyin' AND biz_date >= '2026-08-01')
          OR (id BETWEEN 9100 AND 9500)`
    )
    await client.query(
      `INSERT INTO public.fact_trade_daily
         (id, biz_date, platform_code, shop_id, channel_name, amount_type, gmv, pay_amount,
          paid_order_count, paid_buyer_count, refund_amount, refund_count,
          source, is_demo)
       SELECT 9100 + (row_number() OVER (ORDER BY d))::bigint,
              d::date, 'douyin', 9001, '自然流量', 'gross_paid',
              10000 + (extract(day from d)::int * 100),
              9500 + (extract(day from d)::int * 90),
              100, 95, 500, 5, 'manual_upload', false
         FROM generate_series('2026-08-01'::date, CURRENT_DATE - 2, interval '1 day') AS d
       ON CONFLICT (biz_date, platform_code, shop_id, channel_name, amount_type) DO UPDATE
       SET gmv = EXCLUDED.gmv, pay_amount = EXCLUDED.pay_amount`
    )

    // 测试套件依赖默认 admin（super_admin）且跳过首次安装向导（仅测试库）
    await client.query(
      `INSERT INTO public.users
         (username, password_hash, real_name, role, user_type, data_scope, status, tenant_id, must_change_password)
       VALUES
         ('admin', '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry',
          '平台超管', 'super_admin', 'agency_staff', 'all', 1, 1, false)
       ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'super_admin',
           user_type = 'agency_staff',
           data_scope = 'all',
           status = 1,
           must_change_password = false`
    )
    const admin = await client.query(
      `SELECT id FROM public.users WHERE username = 'admin' LIMIT 1`
    )
    if (admin.rows[0]) {
      await client.query(
        `INSERT INTO public.sys_user_role (user_id, role_code, tenant_id)
         VALUES ($1, 'super_admin', 1)
         ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING`,
        [admin.rows[0].id]
      )
    }
    await client.query(
      `INSERT INTO public.instance_setup (id, status, completed_at)
       VALUES (1, 'completed', now())
       ON CONFLICT (id) DO UPDATE
         SET status = 'completed',
             completed_at = COALESCE(public.instance_setup.completed_at, now()),
             updated_at = now()`
    )

    // 角色矩阵测试需要每个角色至少一个真实账号（仅测试库）
    const roleAccounts: Array<[number, string, string]> = [
      [9002, 'ops_director', '测试运营总监'],
      [9003, 'ops_staff', '测试运营'],
      [9004, 'ad_buyer', '测试投手'],
      [9005, 'controller', '测试中控'],
      [9008, 'hrbp', '测试HRBP'],
    ]
    for (const [id, role, realName] of roleAccounts) {
      await client.query(
        `INSERT INTO public.users
           (id, username, password_hash, real_name, role, user_type, status, tenant_id)
         VALUES ($1, $2, '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry',
                 $3, $4, 'agency_staff', 1, 1)
         ON CONFLICT (username) DO UPDATE
         SET role = EXCLUDED.role, status = 1`,
        [id, `test_${role}`, realName, role]
      )
      await client.query(
        `INSERT INTO public.sys_user_role (user_id, role_code, tenant_id)
         SELECT id, $1, 1 FROM public.users WHERE username = $2
         ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING`,
        [role, `test_${role}`]
      )
    }

    // 测试大量硬编码 shopId=1 / sessionId=1，补齐最小 id=1 场次
    await client.query(`
      INSERT INTO public.live_sessions
         (id, room_id, anchor_id, operator_id, title, date, status, gmv, orders,
          online_peak, duration_min, return_amount, gsv, ad_cost, ad_gsv,
          platform_code, data_source)
       VALUES (1, 9001, 9001, 9001, '测试场次(1)', CURRENT_DATE - 2, 'completed',
               12000, 120, 1500, 150, 600, 12600, 1500, 10500, 'douyin', 'manual_upload')
       ON CONFLICT (id) DO NOTHING`
    )

    // ── 渠道定价种子（dim_product_channel_listing）：GET 期望 >=2 ──
    await client.query(`
      INSERT INTO public.dim_product_channel_listing
         (id, tenant_id, product_id, platform_code, shop_id, channel_sku_id,
          channel_price, allocated_stock, reserved_stock, safety_stock, is_active)
      VALUES
        (9001, 1, 9001, 'douyin', 9001, 'SKU-DY-9001', 99.00, 500, 80, 25, true),
        (9002, 1, 9001, 'douyin', 9001, 'SKU-DY-9002', 109.00, 300, 40, 20, true)
      ON CONFLICT (id) DO NOTHING`
    )

    // ── 投流计划种子（ad_plan）：P6 闭环 GET 期望有数据 ──
    await client.query(`
      INSERT INTO public.ad_plan
        (id, tenant_id, plan_no, session_id, shop_id, platform_code, ad_tool_code,
         plan_name, plan_date, planned_budget, target_roi, status)
      VALUES (9001, 1, 'PLAN-TEST-9001', 9001, 9001, 'douyin', 'qianchuan',
              '测试投流计划', CURRENT_DATE - 1, 5000.00, 2.50, 'completed')
      ON CONFLICT (plan_no) DO NOTHING`
    )
    await client.query(`
      INSERT INTO public.ad_plan_receipts
         (plan_id, biz_date, actual_spend, actual_gmv, net_gmv,
          attributed_orders, receipt_source, note)
      VALUES (9001, CURRENT_DATE - 1, 4800.00, 12000.00, 11500.00,
              110, 'manual_entry', '测试回执')
      ON CONFLICT DO NOTHING`
    )

    // ── 合规活动提醒（compliance_activity_reminder）：GET 期望非空 ──
    await client.query(`
      INSERT INTO public.compliance_activity_reminder
        (id, platform_code, activity_name, activity_type, signup_deadline,
         activity_start, activity_end, requirements, status)
      VALUES
        (9001, 'douyin', '双11大促报名', '大促活动', CURRENT_DATE + interval '3 days',
         CURRENT_DATE + interval '5 days', CURRENT_DATE + interval '15 days',
         '商品资质齐全，主播信用分>=80', 'pending'),
        (9002, 'kuaishou', '618年中报名', '大促活动', CURRENT_DATE + interval '7 days',
         CURRENT_DATE + interval '10 days', CURRENT_DATE + interval '20 days',
         '店铺体验分>=4.6', 'pending'),
        (9003, 'wechat', '视频号618专场', '大促活动', CURRENT_DATE + interval '1 day',
         CURRENT_DATE + interval '3 days', CURRENT_DATE + interval '8 days',
         '视频号身份认证通过', 'reminded'),
        (9004, 'douyin', '春季新商家报名', '新商家活动', CURRENT_DATE + interval '30 days',
         CURRENT_DATE + interval '35 days', CURRENT_DATE + interval '50 days',
         '开店满30天且GMV>=1w', 'pending'),
        (9005, 'douyin', '达人合作峰会', '行业活动', CURRENT_DATE - interval '2 days',
         CURRENT_DATE - interval '1 day', CURRENT_DATE,
         '直播时长>=200小时', 'done')
      ON CONFLICT (id) DO NOTHING`
    )

    // ── 汇总层回填（agg_*）：runManualAggregate 测试期望有基础数据 ──
    const aggDate = "'" + new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) + "'"
    await client.query(`
      INSERT INTO public.agg_shop_daily
         (biz_date, platform_code, shop_id, total_gmv, total_pay_amount,
          total_order_count, total_buyer_count, total_refund_amount, net_sales,
          total_ad_spend, overall_roi)
      VALUES
        (${aggDate}::date, 'douyin', 9001, 10000, 9500, 100, 95, 500, 9000, 2000, 4.50)
      ON CONFLICT DO NOTHING`
    )
    await client.query(`
      INSERT INTO public.agg_trade_day_platform_channel
         (biz_date, platform_code, channel_name, shop_id,
          total_gmv, total_pay_amount, total_order_count, total_buyer_count,
          total_refund_amount, net_sales, total_ad_spend, overall_roi)
      VALUES
        (${aggDate}::date, 'douyin', '直播', 9001, 10000, 9500, 100, 95, 500, 9000, 2000, 4.50),
        (${aggDate}::date, 'douyin', '短视频', 9001, 3000, 2850, 30, 28, 150, 2700, 800, 3.38)
      ON CONFLICT DO NOTHING`
    )
    await client.query(`
      INSERT INTO public.agg_traffic_day_live
         (biz_date, platform_code, room_id, shop_id,
          session_count, total_duration_min, total_views, total_buyers,
          peak_online_max, avg_online, total_gmv, avg_gpm, new_fans)
      VALUES
        (${aggDate}::date, 'douyin', 9001, 9001, 1, 120, 10000, 95, 1200, 800, 10000, 83.33, 50)
      ON CONFLICT DO NOTHING`
    )

    // ── 合规规则快照补到 >=5（测试 GET 期望 ≥5 条） ──
    await client.query(`
      INSERT INTO public.compliance_rule_snapshot
        (platform_code, external_id, title, category, source_url, content_text,
         content_hash, raw_metadata, fetch_method, fetched_at, effective_at, published_at)
      VALUES
        ('douyin', 'DY-RULE-9001', '直播间宣传禁用词规范', '宣传合规',
         'https://open.douyin.com/rule/adv',
         '禁止使用国家级、最高级、第一等极限词。不得虚构销量、用户评价。',
         'b5f9d1e8a4c23b7f0e9d1f8a4c23b7f0e9d1f8a4c23b7f0e9d1f8a4c23b7f0e9',
         '{"severity":"high"}'::jsonb, 'manual', now(), now(), now() - interval '30 days'),
        ('douyin', 'DY-RULE-9002', '食品类特殊资质要求', '类目合规',
         'https://open.douyin.com/rule/food',
         '食品类必须持食品经营许可证，直播时需挂小黄车链接。',
         'a8c23b7f0e9d1f8a4c23b7f0e9d1f8a4c23b7f0e9d1f8a4c23b7f0e9d1f8a4c2',
         '{"severity":"medium"}'::jsonb, 'manual', now(), now(), now() - interval '20 days'),
        ('douyin', 'DY-RULE-9003', '直播间违规营销行为治理公告', '营销合规',
         'https://open.douyin.com/rule/marketing',
         '禁止虚构原价、虚假宣传、诱导交易等违规营销行为。',
         'c9d34c8a1f0e2a9b5d34c8a1f0e2a9b5d34c8a1f0e2a9b5d34c8a1f0e2a9b5',
         '{"severity":"high"}'::jsonb, 'manual', now(), now(), now() - interval '15 days'),
        ('douyin', 'DY-RULE-9004', '生鲜冷链发货时效要求', '履约与售后',
         'https://open.douyin.com/rule/fresh',
         '生鲜类目须在消费者付款后 48 小时内发货，超时按单赔付。',
         'd1e45d9b2a1f3b0c6e45d9b2a1f3b0c6e45d9b2a1f3b0c6e45d9b2a1f3b0c6',
         '{"severity":"high"}'::jsonb, 'manual', now(), now(), now() - interval '10 days'),
        ('kuaishou', 'KS-RULE-9001', '达人分销与间接成交结算细则', '结算合规',
         'https://school.kuaishou.com/rule/distribution',
         '达人分销订单须在确认收货后 T+7 结算，退款订单不计入佣金。',
         'e2f56e0c3b2a4c1d7f56e0c3b2a4c1d7f56e0c3b2a4c1d7f56e0c3b2a4c1d7f',
         '{"severity":"medium"}'::jsonb, 'manual', now(), now(), now() - interval '5 days')
      ON CONFLICT (platform_code, external_id, content_hash) DO NOTHING`
    )

    // ── campaign_plan_template（campaign-plan generate 依赖） ──
    // campaign-plan-service 查 template_code='TMPL_STANDARD_LIVE'，fallback id=1
    const tplBlocks = JSON.stringify({
      m1_positioning: {}, m2_schedule: {}, m3_products: {}, m4_pricing: {},
      m5_scripts: {}, m6_tasks: {}, m7_forecast: {}, m8_kpis: {},
      m9_channels: {}, m10_compliance_checklist: {}, m11_analysis: {},
      m12_post_session_review: {},
    })
    await client.query(`DELETE FROM public.campaign_plan_template WHERE template_code LIKE 'TPL-%'`)
    await client.query(
      `INSERT INTO public.campaign_plan_template
         (id, template_code, name, category_code, platform_code, version, blocks,
          compliance_rules_version, is_active, created_by)
       VALUES
         (1, 'TMPL_STANDARD_LIVE', '标准全域直播方案模板', 'APPAREL_OUTDOOR', 'douyin', 1,
          $1::jsonb, 'v1.0', true, 1)
       ON CONFLICT (id) DO UPDATE SET
         template_code = EXCLUDED.template_code, name = EXCLUDED.name,
         category_code = EXCLUDED.category_code, platform_code = EXCLUDED.platform_code,
         blocks = EXCLUDED.blocks, is_active = EXCLUDED.is_active`,
      [tplBlocks]
    )

    // ── fact_selection_recommendation（selection/campaign-plan 依赖） ──
    const selSignals = JSON.stringify({
      targetGmv: 80000, minMargin: 0.35, minGmvPerSession: 8000,
      recommendations: [
        { productId: 9001, score: 0.92, reason: '历史直播转化率18%，近30天GMV排名前5' },
        { productId: 9001, score: 0.88, reason: '高毛利主推款，连带率3.2' },
        { productId: 9001, score: 0.85, reason: '引流福利款，点击转化率高于均值' },
        { productId: 9001, score: 0.82, reason: '形象打榜款，品牌溢价承载' },
        { productId: 9001, score: 0.79, reason: '季节刚需补充款' },
      ],
    })
    await client.query(
      `INSERT INTO public.fact_selection_recommendation
         (id, recommendation_no, tenant_id, category_code, platform_code, shop_id,
          city, signals_snapshot, strategy, status, insufficient_reason, created_by)
       VALUES (9001, 'SEL-TEST-9001', 1, 'APPAREL_OUTDOOR', 'douyin', 9001,
         '全国', $1::jsonb, 'trend_led', 'adopted', '', 1)
       ON CONFLICT (id) DO UPDATE SET
         signals_snapshot = EXCLUDED.signals_snapshot,
         status = EXCLUDED.status`,
      [selSignals]
    )

    // ── 视频模板 video_templates（8 类种子模板，测试期望 live_highlight 等） ──
    // 每次先清掉 tenant 1 的旧模板（避免之前错误 DSL 残留）
    await client.query(`DELETE FROM public.template_versions WHERE tenant_id = 1`)
    await client.query(`DELETE FROM public.video_templates WHERE tenant_id = 1 AND code LIKE 'tpl_%_v1'`)
    // 测试中硬编码查找 code=product_seed_v1 / live_highlight_v1 等
    const tplSeeds = [
      ['live_highlight_v1', '直播间高光剪辑', 'live_highlight'],
      ['product_seed_v1', '产品种草', 'product_seed'],
      ['talking_head_v1', '主播口播', 'talking_head'],
      ['image_text_v1', '图文拼接', 'image_text'],
      ['batch_mashup_v1', '批量混剪', 'batch_mashup'],
      ['review_compare_v1', '对比测评', 'review_compare'],
      ['tutorial_steps_v1', '步骤教学', 'tutorial_steps'],
      ['report_teaser_v1', '报告预告', 'report_teaser'],
    ] as const
    for (const [code, name, cat] of tplSeeds) {
      await client.query(
        `INSERT INTO public.video_templates
           (tenant_id, code, name, category, type, aspect, min_duration_sec, max_duration_sec,
            description, status, gray_ratio, created_by)
         VALUES
           (1, $1, $2, $3, 'assembly', '9:16', 15, 30, $4, 'active', 100, 1)
         ON CONFLICT (tenant_id, code) DO NOTHING`,
        [code, name, cat, name]
      )
    }
    // 给新模板各补一个 template_versions（published）
    // parseTemplateDsl 要求 slots 是 {key,type,required} 对象数组，duration 必须有正数 min/max
    const buildDsl = (cat: string) => {
      const slotDefs: Record<string, { key: string; type: string; required: boolean }[]> = {
        product_seed: [
          { key: 'hook', type: 'text', required: true },
          { key: 'selling_points', type: 'text_list', required: true },
          { key: 'product_images', type: 'image_list', required: true },
          { key: 'cta', type: 'text', required: true },
        ],
        live_highlight: [
          { key: 'highlight_clip', type: 'video', required: true },
          { key: 'hook', type: 'text', required: true },
          { key: 'closing', type: 'text', required: false },
        ],
        talking_head: [
          { key: 'script', type: 'text', required: true },
          { key: 'avatar', type: 'image', required: true },
        ],
        image_text: [
          { key: 'images', type: 'image_list', required: true },
          { key: 'captions', type: 'text_list', required: true },
        ],
        batch_mashup: [
          { key: 'source_clips', type: 'video_list', required: true },
          { key: 'transition', type: 'text', required: false },
        ],
        review_compare: [
          { key: 'product_a', type: 'text', required: true },
          { key: 'product_b', type: 'text', required: true },
          { key: 'verdict', type: 'text', required: true },
        ],
        tutorial_steps: [
          { key: 'steps', type: 'text_list', required: true },
          { key: 'result', type: 'text', required: true },
        ],
        report_teaser: [
          { key: 'headline', type: 'text', required: true },
          { key: 'kpis', type: 'text_list', required: true },
        ],
      }
      return JSON.stringify({
        template: cat,
        type: 'assembly',
        aspect: '9:16',
        duration: { min: 15, max: 30 },
        slots: slotDefs[cat] || [{ key: 'content', type: 'text', required: true }],
        rules: { style: 'tutorial', tone: 'warm' },
      })
    }
    for (const [code, , cat] of tplSeeds) {
      const { rows: tpls } = await client.query<any>(
        `SELECT id FROM public.video_templates WHERE tenant_id = 1 AND code = $1 LIMIT 1`,
        [code]
      )
      if (tpls.length === 0) continue
      const dsl = buildDsl(cat)
      await client.query(
        `INSERT INTO public.template_versions
           (tenant_id, template_id, version, dsl, changelog, status, is_canary, created_by)
         VALUES (1, $1, 1, $2::jsonb, 'seed version', 'published', false, 1)
         ON CONFLICT (template_id, version) DO NOTHING`,
        [tpls[0].id, dsl]
      )
    }

    // ── session_plan_products（campaign-plan dispatch / full-trace 期望） ──
    await client.query(`
      INSERT INTO public.session_plan_products
         (session_id, product_id, product_code, product_name, price,
          sold_count, business_date)
      VALUES
        (1, '9001', 'SPU9001', '测试商品', 99.00, 80, CURRENT_DATE - 3)
      ON CONFLICT DO NOTHING`
    )

    // ── fact_gl_voucher（finance/gl-vouchers GET 期望 total >= 1） ──
    await client.query(`
      INSERT INTO public.fact_gl_voucher
         (tenant_id, voucher_no, biz_date, period, voucher_type, shop_id, platform_code,
          session_id, ref_type, ref_id, total_debit, total_credit, is_balanced,
          status, summary, created_by, posted_at)
      VALUES
         (1, 'GL-TEST-9001', CURRENT_DATE - 3,
          to_char(CURRENT_DATE - 3, 'YYYY-MM'), 'order_revenue',
          9001, 'douyin', 1, 'session_plan', '1',
          7920.00, 7920.00, true, 'posted', '测试场次 GMV 凭证', 'system', now())
      ON CONFLICT (voucher_no) DO NOTHING`
    )

    // ── canonical_orders & canonical_order_items（门禁归因 + SKU 级订单聚合需要） ──
    const orderItems = [
      { bizDate: '2026-11-20', orderNo: 'ORD-TEST-1001', skuId: 9002, skuCode: 'SKU9002', name: '引流爆款冲锋衣', qty: 20, paid: 3980.00, disc: 0 },
      { bizDate: '2026-11-22', orderNo: 'ORD-TEST-1002', skuId: 9003, skuCode: 'SKU9003', name: '高利润鹅绒服', qty: 8, paid: 3192.00, disc: 100 },
      { bizDate: '2026-11-23', orderNo: 'ORD-TEST-1003', skuId: 9004, skuCode: 'SKU9004', name: '福利款保暖内衣', qty: 50, paid: 3450.00, disc: 250 },
      { bizDate: '2026-11-24', orderNo: 'ORD-TEST-1004', skuId: 9005, skuCode: 'SKU9005', name: '形象款羊绒围巾', qty: 12, paid: 3588.00, disc: 100 },
      { bizDate: '2026-11-25', orderNo: 'ORD-TEST-1005', skuId: 9001, skuCode: 'SKU9001', name: '测试商品', qty: 15, paid: 1485.00, disc: 10 },
    ]
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO public.canonical_orders
           (biz_date, source_platform, store_id, source_order_id, order_status,
            paid_amount, total_discount, created_at_source, paid_at_source,
            maturity_status, room_id, live_session_id)
         VALUES
           ($1, 'douyin', 1, $2, 'paid', $3, $4,
            now() - INTERVAL '10 days', now() - INTERVAL '10 days',
            'FINAL', 9001, 9001)
         ON CONFLICT (biz_date, source_platform, store_id, source_order_id) DO UPDATE
         SET room_id = EXCLUDED.room_id, live_session_id = EXCLUDED.live_session_id`,
        [item.bizDate, item.orderNo, item.paid, item.disc]
      )
    }
    for (const [i, item] of orderItems.entries()) {
      await client.query(
        `INSERT INTO public.canonical_order_items
           (biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
            platform_sku_id, internal_sku_id, product_name, quantity, item_paid_amount,
            item_discount_allocated, maturity_status)
         VALUES
           ($1, 'douyin', 1, $2, $3, $4, $5, $6, $7, $8, $9, 'FINAL')
         ON CONFLICT DO NOTHING`,
        [item.bizDate, item.orderNo, `${item.orderNo}-01-${i+1}`, item.skuCode, item.skuId, item.name, item.qty, item.paid, item.disc]
      )
    }

    await client.query('COMMIT')
    console.log(`[fixtures] 已初始化测试数据：${dbName}`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error('[fixtures] 初始化失败：', err)
    await pool.end()
    process.exit(1)
  })
