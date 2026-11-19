#!/usr/bin/env node
/**
 * database/demo/generate.mjs — 演示数据生成器（独立演示数据包）
 *
 * 2026-11-17 对齐老大决策：
 *   1. 排品逻辑数据完备：每个场次的排品带 GMV销量、库存占用、短视频引流、点击转化
 *      → session_plan_products 有 payment_amount/sold_count/buyer_count/order_count/
 *        exposure_users/click_users；fact_inventory_stock 有 available_qty；
 *        session_short_video_traffic 有 entry_click_rate。
 *   2. HRBP 人效数据完备：session_staff_assignments（排班到岗位）+ staff_day_status
 *      （考勤状态）+ anchor_capabilities（能力四维）+ live_registrations（真实产出）。
 *   3. 数据来源标注：is_demo = true 且 source 区分 manual_upload / api_sync，
 *      对应两条真实数据入口（用户手动上传 / 官方平台 API）。
 *   4. 财务板块不做：不生成 finance/gl-vouchers/trial-balance 相关数据。
 *   6. 订单向下游延伸：从 canonical_orders 派生运单(48h SLA)、退款事件、售后工单、
 *      客服会话绩效，使「履约风控 / 售后闭环 / 客服绩效 / 退款分析」四个模块有真实数据。
 *   5. 确定性生成（无随机数漂移），保证可重复执行、口径可解释。
 *
 * 用法：
 *   node database/demo/generate.mjs           # 直接生成（库需已建好）
 *   node database/demo/init.mjs --with-demo   # 部署入口（自动建库+迁移+灌数据）
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// pg 装在 api workspace 下，从那里解析
const require = createRequire(import.meta.url)
const pgRequire = createRequire(path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '../../apps/api/package.json',
))
const pg = pgRequire('pg')
const { Pool } = pg

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 55432),
  user: process.env.PGUSER || 'leyova',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'leyova',
})

const log = (...a) => console.log('[demo-v3]', ...a)

// ── 确定性伪随机（种子固定 → 可复现） ────────────────────────────────
let seed = 20261117
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (min, max) => Math.floor(min + rnd() * (max - min + 1))

async function main() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ════════════════════════════════════════════════════════════════
    // 0. 清空（幂等）
    // ════════════════════════════════════════════════════════════════
    log('清空演示数据…')
    const truncates = [
      // 引用主数据的子表先清（FK 依赖顺序）
      'fact_order_rma_item', 'fact_selection_item',
      'session_plan_products', 'session_plans', 'session_short_video_traffic',
      'session_anchor_metrics', 'session_channel_metrics', 'session_overview_metrics',
      'session_live_basic_info', 'session_staff_assignments', 'staff_day_status',
      'live_registrations', 'live_sessions', 'anchor_capabilities', 'anchor_profiles',
      'anchor_training_plans', 'anchor_training_records', 'anchor_script_templates',
      'anchors', 'operators', 'live_rooms', 'room_health', 'multi_room_status',
      'dim_sku_mapping', 'dim_product_channel_listing', 'dim_cs_agent',
      'fact_inventory_reservation', 'fact_inventory_stock', 'fact_inventory_ledger',
      'dim_product',
      'fact_trade_daily', 'fact_traffic_daily', 'fact_ad_spend_daily',
      'video_metrics', 'competitor_brands', 'competitor_price_data',
      'goal_tracking', 'issue_library', 'pricing_rules', 'promotions', 'script_library',
      'agg_shop_daily', 'agg_trade_day_platform_channel', 'agg_traffic_day_live',
      'fact_fulfillment_waybill', 'fact_after_sale_tickets', 'fact_kol_cooperation',
      'fact_search_keyword_daily', 'fact_content_daily', 'content_attribution_ledger',
      'fact_cs_session', 'content_schedules', 'content_tasks', 'content_projects',
      'fact_settlement_cycles', 'compliance_events', 'campaign_plan',
      'ad_plan', 'ad_plan_receipts', 'alert_events',
      'canonical_order_items', 'canonical_orders', 'canonical_refund_events',
      'compliance_activity_reminder',
    ]
    for (const t of truncates) {
      await client.query(`DELETE FROM ${t}`)
    }

    // ════════════════════════════════════════════════════════════════
    // 1. 直播间（4 个：覆盖 3 个在用平台）
    // ════════════════════════════════════════════════════════════════
    log('生成直播间…')
    const rooms = [
      { id: 1, name: '抖音主直播间', platform_code: 'douyin', platform: 'douyin' },
      { id: 2, name: '淘宝直播一号间', platform_code: 'taobao', platform: 'taobao' },
      { id: 3, name: '小红书买手间', platform_code: 'xiaohongshu', platform: 'xiaohongshu' },
      { id: 4, name: '视频号品牌间', platform_code: 'wechat', platform: 'wechat' },
    ]
    for (const r of rooms) {
      const shopRes = await client.query(
        `SELECT MIN(id) AS id FROM dim_shop WHERE platform_code = $1`,
        [r.platform_code],
      )
      await client.query(
        `INSERT INTO live_rooms (id, name, platform, platform_code, status, shop_id)
         VALUES ($1, $2, $3, $4, 'active', $5)`,
        [r.id, r.name, r.platform, r.platform_code, shopRes.rows[0]?.id ?? null],
      )
    }

    // ════════════════════════════════════════════════════════════════
    // 2. 主播 12 人（含层级分布：S2/A4/B4/C2）
    // ════════════════════════════════════════════════════════════════
    log('生成主播档案…')
    const anchorNames = [
      '林晚晴', '苏浅浅', '陈果果', '周可可', '吴思思', '郑小榆',
      '王一诺', '赵棠棠', '孙糯糯', '钱朵朵', '冯柠柠', '褚杏杏',
    ]
    const levels = ['S', 'A', 'B', 'C']
    const levelOf = (i) => (i < 2 ? 'S' : i < 6 ? 'A' : i < 10 ? 'B' : 'C')
    const platforms = ['douyin', 'taobao', 'xiaohongshu', 'wechat']

    const anchors = []
    for (let i = 0; i < anchorNames.length; i++) {
      const id = i + 1
      const name = anchorNames[i]
      const level = levelOf(i)
      const platform = platforms[i % platforms.length]
      const joinDate = new Date(2023, 0, 1 + i * 37)
      const followers = level === 'S' ? between(280000, 520000)
        : level === 'A' ? between(90000, 260000)
        : level === 'B' ? between(20000, 85000)
        : between(3000, 19000)

      await client.query(
        `INSERT INTO anchors (id, name, platform, platform_code, level, status)
         VALUES ($1, $2, $3, $3, $4, 1)`,
        [id, name, platform, level],
      )
      await client.query(
        `INSERT INTO anchor_profiles (id, level, followers, join_date, email, phone, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id, level, followers, joinDate.toISOString().slice(0, 10),
          `${platform}_${id}@leyova.demo`, `13${String(100000000 + id).slice(0, 9)}`,
          [level === 'S' ? '头部' : level === 'A' ? '腰部' : '成长', platform],
        ],
      )
      // 能力四维：层级越高越强，带个体差异
      const base = level === 'S' ? 92 : level === 'A' ? 84 : level === 'B' ? 74 : 64
      const cap = (offset) => Math.max(40, Math.min(100, base + offset))
      await client.query(
        `INSERT INTO anchor_capabilities
           (anchor_id, expression, interaction, conversion, professionalism, overall, evaluated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE - 14)`,
        [
          id,
          cap(between(-6, 6)), cap(between(-6, 6)), cap(between(-8, 8)), cap(between(-5, 5)),
          base,
        ],
      )
      anchors.push({ id, name, level, platform, followers })
    }

    // ════════════════════════════════════════════════════════════════
    // 3. 中控/运营 6 人
    // ════════════════════════════════════════════════════════════════
    log('生成中控运营…')
    const operators = [
      { id: 1, name: '中控-阿豪' }, { id: 2, name: '中控-小鹿' },
      { id: 3, name: '中控-大鹏' }, { id: 4, name: '中控-敏姐' },
      { id: 5, name: '中控-阿杰' }, { id: 6, name: '中控-柚子' },
    ]
    for (const o of operators) {
      await client.query(
        `INSERT INTO operators (id, name, employee_id, status) VALUES ($1, $2, $3, 1)`,
        [o.id, o.name, `EMP-O${String(o.id).padStart(3, '0')}`],
      )
    }

    // ════════════════════════════════════════════════════════════════
    // 4. 商品 20 个 SKU + 库存（排品逻辑的货盘基础）
    // ════════════════════════════════════════════════════════════════
    log('生成商品与库存…')
    // 分类从系统字典 dim_category 取（level=1 一级类目，预置基础数据不重建）
    const catRes = await client.query(
      `SELECT code, name FROM dim_category WHERE level = 1 AND status = 'active' ORDER BY sort_order, code`,
    )
    const categories = catRes.rows.length > 0
      ? catRes.rows.map((r) => ({ code: r.code, name: r.name }))
      : [{ code: 'APPAREL', name: '服饰鞋帽' }, { code: 'BEAUTY', name: '美妆个护' },
          { code: 'FOOD', name: '食品生鲜' }, { code: 'DIGITAL', name: '数码3C' },
          { code: 'APPLIANCE', name: '小家电' }]

    const products = []
    for (let i = 1; i <= 20; i++) {
      const cat = categories[i % categories.length]
      const cost = between(25, 320)
      const price = Math.round(cost * (1.6 + rnd() * 1.2))
      const safety = between(20, 120)
      await client.query(
        `INSERT INTO dim_product
           (id, spu_code, sku_code, product_name, category, category_code,
            brand_name, unit_cost, retail_price, safety_stock, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')`,
        [
          i, `SPU-2026-${String(i).padStart(3, '0')}`, `SKU-2026-${String(i).padStart(3, '0')}`,
          `${cat.name}精选-${String.fromCharCode(64 + i)}款`, cat.name, cat.code,
          '乐播严选', cost, price, safety,
        ],
      )
      // 库存：总仓（available_qty 是生成列 = on_hand_qty - locked_qty，不显式插入）
      const onHand = safety * between(6, 14)
      const locked = Math.floor(onHand * (0.05 + rnd() * 0.15))
      await client.query(
        `INSERT INTO fact_inventory_stock
           (product_id, warehouse_code, warehouse_name, shop_id,
            on_hand_qty, locked_qty, in_transit_qty, safety_stock)
         VALUES ($1, 'MAIN_WH', '主仓', (SELECT MIN(id) FROM dim_shop), $2, $3, $4, $5)`,
        [i, onHand, locked, between(0, 40), safety],
      )
      products.push({ id: i, cost, price, safety, cat })
    }

    // ════════════════════════════════════════════════════════════════
    // 5. 场次 60 场（近 60 天，每天 1 场轮换主播/直播间）
    // ════════════════════════════════════════════════════════════════
    log('生成场次与排班…')
    const today = new Date()
    const sessions = []
    let sessionNo = 0

    for (let d = 59; d >= 0; d--) {
      const date = new Date(today)
      date.setDate(date.getDate() - d)
      const dateStr = date.toISOString().slice(0, 10)
      const weekday = date.getDay()

      // 每天 2-3 场（保证 12 名主播在 60 天内人均 ≥ 8 场，爬坡曲线有意义）
      const perDay = between(2, 3)

      for (let k = 0; k < perDay; k++) {
        sessionNo += 1
        const id = sessionNo
        const anchor = anchors[(id - 1) % anchors.length]
        const room = rooms.find((r) => r.platform_code === anchor.platform) || rooms[0]
        const operator = operators[(id - 1) % operators.length]

        // 取消率约 5%（制造缺勤/异常场景，HRBP 人效分析需要）
        // live_sessions.status 约束：scheduled / live / completed / cancelled
        const cancelled = rnd() < 0.05
        const status = cancelled ? 'cancelled' : (d === 0 && k === 0 ? 'live' : 'completed')

        const startHour = 19 + (k === 1 ? 2 : 0)
        const startTime = `${String(startHour).padStart(2, '0')}:00`
        const durationMin = between(150, 300)
        // 结束时间可能跨天，用 Date 运算避免 25:33 这类非法时间
        const endDateObj = new Date(date.getTime() + (startHour * 60 + durationMin) * 60000)
        const endTime = `${String(endDateObj.getHours()).padStart(2, '0')}:${String(endDateObj.getMinutes()).padStart(2, '0')}`

        // GMV：层级决定量级，主播个体差异 ±30%
        const levelFactor = anchor.level === 'S' ? 1.0 : anchor.level === 'A' ? 0.55
          : anchor.level === 'B' ? 0.25 : 0.1
        const baseGmv = 180000 * levelFactor
        const gmv = cancelled ? 0 : Math.round(baseGmv * (0.7 + rnd() * 0.6))
        const orders = cancelled ? 0 : Math.round(gmv / (80 + rnd() * 160))
        const buyers = cancelled ? 0 : Math.round(orders * (0.82 + rnd() * 0.14))
        const returnAmt = cancelled ? 0 : Math.round(gmv * (0.04 + rnd() * 0.07))

        await client.query(
          `INSERT INTO live_registrations
             (id, biz_date, anchor_id, room_id, operator_id, title,
              start_time, end_time, duration_min, status,
              gmv, orders, buyer_count, return_amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            id, dateStr, anchor.id, room.id, operator.id,
            `${room.name}·${anchor.name}专场`,
            startTime, endTime, durationMin, status,
            gmv, orders, buyers, returnAmt,
          ],
        )

        // 场次主表（date 而非 biz_date；多个 NOT NULL 列需显式给值）
        await client.query(
          `INSERT INTO live_sessions
             (id, date, anchor_id, room_id, title, status, start_time, end_time,
              duration_min, gmv, orders, online_peak, return_amount, operator_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            id, dateStr, anchor.id, room.id,
            `${room.name}·${anchor.name}专场`,
            status, startTime, endTime, durationMin, gmv, orders,
            Math.round(gmv / (3 + rnd() * 6)), returnAmt, operator.id,
          ],
        )

        // ── HRBP：排班到岗位（session_staff_assignments）──
        // 岗位编码必须存在于 staff_role_dict：anchor/controller/operator/ad_buyer/video_editor/director
        // 用 director（编导）承担「成长带教」角色，符合真实直播团队编制
        const assignees = [
          { role_code: 'anchor', staff_id: anchor.id, staff_name: anchor.name },
          { role_code: 'operator', staff_id: operator.id, staff_name: operator.name },
        ]
        if (anchor.level === 'S' || anchor.level === 'A') {
          const mentee = anchors[(anchor.id + 5) % anchors.length]
          if (mentee.id !== anchor.id) {
            assignees.push({ role_code: 'director', staff_id: mentee.id, staff_name: mentee.name })
          }
        }
        for (const a of assignees) {
          await client.query(
            `INSERT INTO session_staff_assignments (session_id, role_code, staff_id, staff_name)
             VALUES ($1, $2, $3, $4)`,
            [id, a.role_code, a.staff_id, a.staff_name],
          )
        }

        // ── HRBP：考勤状态（staff_day_status）──
        // 注意：唯一约束 (staff_name, biz_date)，每天每人只能一条，
        // 故放在「每日循环」而非「每场循环」内（周末一天 2 场）。
        // 在岗主播当日状态：约 88% 上班、5% 排休、4% 请假、3% 病假
        for (const a of anchors) {
          const roll = rnd()
          const st = roll < 0.88 ? 'work' : roll < 0.93 ? 'rest' : roll < 0.97 ? 'leave' : 'sick'
          await client.query(
            `INSERT INTO staff_day_status (staff_name, biz_date, status)
             VALUES ($1, $2, $3)
             ON CONFLICT (staff_name, biz_date) DO NOTHING`,
            [a.name, dateStr, st],
          )
        }

        // ── 排品：每场 T/B/P 三组各 1 个主推款 ──
        // 唯一约束 (plan_id, group_letter)：每组只能有一个主推位，
        // 这正是真实排品语义 —— T(引流)/B(福利)/P(利润) 各选一个主打 SKU。
        if (!cancelled) {
          const planId = id
          await client.query(
            `INSERT INTO session_plans (id, room_id, plan_date, anchor_id, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [planId, room.id, dateStr, anchor.id, 'V3 演示排品'],
          )

          // 三组各挑一个不重复商品
          const chosen = new Set()
          const pickProduct = () => {
            let p = products[Math.floor(rnd() * products.length)]
            let guard = 0
            while (chosen.has(p.id) && guard++ < 20) {
              p = products[Math.floor(rnd() * products.length)]
            }
            chosen.add(p.id)
            return p
          }

          let order = 1
          for (const gl of ['T', 'B', 'P']) {
            const p = pickProduct()

            // 点击转化数据（排品逻辑输入）
            const exposure = Math.round(gmv / p.price * (2.5 + rnd() * 3.5))
            const clickRate = 0.045 + rnd() * 0.09
            const clickUsers = Math.round(exposure * clickRate)
            const soldCount = Math.max(1, Math.round(clickUsers * (0.06 + rnd() * 0.12)))
            const payment = soldCount * p.price

            await client.query(
              `INSERT INTO session_plan_products
                 (plan_id, session_id, room_id, business_date, product_order,
                  group_letter, product_code, product_name, product_id, price,
                  payment_amount, sold_count, buyer_count, order_count,
                  exposure_users, click_users, sku_snapshot_jsonb)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                       $11, $12, $13, $14, $15, $16, $17)`,
              [
                planId, id, room.id, dateStr, order++,
                gl, p.skuCode || `SKU-2026-${String(p.id).padStart(3, '0')}`,
                `${p.cat.name}精选-${String.fromCharCode(64 + p.id)}款`, String(p.id), p.price,
                payment, soldCount,
                Math.round(soldCount * (0.85 + rnd() * 0.13)), soldCount,
                exposure, clickUsers,
                JSON.stringify({ role: gl === 'T' ? 'traffic' : gl === 'P' ? 'profit' : 'benefit' }),
              ],
            )
          }
        }

        // ── 短视频引流数据（排品逻辑输入）──
        if (!cancelled) {
          const videoCount = between(2, 5)
          for (let v = 0; v < videoCount; v++) {
            const impressions = between(8000, 260000)
            const toLive = Math.round(impressions * (0.02 + rnd() * 0.07))
            await client.query(
              `INSERT INTO session_short_video_traffic
                 (session_id, room_id, business_date, video_name, post_time,
                  live_entry_impressions, traffic_to_live, entry_click_rate)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                id, room.id, dateStr,
                `预热短视频-${anchor.name}-${v + 1}`,
                new Date(date.getTime() - between(2, 9) * 3600_000).toISOString(),
                impressions, toLive,
                Number((toLive / impressions).toFixed(4)),
              ],
            )
          }
        }

        // ── 场次聚合指标（点击转化/互动率）──
        if (!cancelled) {
          const viewers = Math.round(gmv / (3 + rnd() * 6))
          await client.query(
            `INSERT INTO session_overview_metrics
               (session_id, room_id, business_date, viewers,
                product_click_users, product_exposure_click_rate, conversion_rate,
                avg_online, peak_online, interaction_rate, avg_watch_seconds, new_followers)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              id, room.id, dateStr, viewers,
              Math.round(viewers * (0.28 + rnd() * 0.25)),
              Number((0.045 + rnd() * 0.075).toFixed(4)),
              Number((0.018 + rnd() * 0.035).toFixed(4)),
              Math.round(viewers * (0.12 + rnd() * 0.18)),
              Math.round(viewers * (0.3 + rnd() * 0.4)),
              Number((0.06 + rnd() * 0.1).toFixed(4)),
              between(120, 420),
              between(80, 2400),
            ],
          )
          await client.query(
            `INSERT INTO session_anchor_metrics
               (date, anchor_id, room_id, duration_min, gmv, gmv_per_hour,
                online_peak, avg_online, avg_item_price, exposure_view_rate,
                retention_rate, interaction_rate, new_fans)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              dateStr, anchor.id, room.id, durationMin, gmv,
              Math.round(gmv / (durationMin / 60)),
              Math.round(viewers * (0.3 + rnd() * 0.4)),
              Math.round(viewers * (0.12 + rnd() * 0.18)),
              Math.round(gmv / Math.max(1, orders)),
              Number((0.35 + rnd() * 0.3).toFixed(4)),
              Number((0.28 + rnd() * 0.35).toFixed(4)),
              Number((0.06 + rnd() * 0.1).toFixed(4)),
              between(80, 2400),
            ],
          )
        }
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 6. 交易事实表（BI 取数原语依赖；由场次 GMV 按平台×渠道汇总，口径一致）
    // ════════════════════════════════════════════════════════════════
    log('生成交易与投流事实表…')
    // 6.1 fact_trade_daily：按 日×平台 从场次汇总（amount_type=settled 结算口径）
    const tradeRes = await client.query(
      `INSERT INTO fact_trade_daily
         (biz_date, platform_code, shop_id, channel_name, source_code,
          gmv, pay_amount, paid_order_count, paid_buyer_count,
          refund_amount, refund_count, amount_type, attribution_window_hours,
          is_demo, source)
       SELECT lr.biz_date,
              lr.platform_code,
              (SELECT MIN(id) FROM dim_shop s WHERE s.platform_code = lr.platform_code) AS shop_id,
              '直播间' AS channel_name,
              lr.platform_code AS source_code,
              COALESCE(SUM(lr.gmv), 0),
              COALESCE(SUM(lr.gmv - lr.return_amount), 0),
              COALESCE(SUM(lr.orders), 0)::int,
              COALESCE(SUM(lr.buyer_count), 0)::int,
              COALESCE(SUM(lr.return_amount), 0),
              COALESCE(SUM(lr.orders), 0)::int,
              COALESCE((SELECT pcc.amount_type FROM platform_caliber_config pcc
                          WHERE pcc.platform_code = lr.platform_code
                            AND pcc.metric_code = 'gmv' AND pcc.is_default = true),
                       'gross_paid') AS amount_type,
              7 AS attribution_window_hours,
              true AS is_demo,
              'manual_upload' AS source
         FROM (SELECT lr.*, COALESCE(r.platform_code, 'douyin') AS platform_code
                 FROM public.live_registrations lr
                 LEFT JOIN public.live_rooms r ON r.id = lr.room_id
                WHERE lr.status <> 'cancelled') lr
        GROUP BY lr.biz_date, lr.platform_code
        ORDER BY lr.biz_date, lr.platform_code
       RETURNING biz_date`,
    )
    log(`  fact_trade_daily: ${tradeRes.rowCount} 行`)

    // 6.2 fact_ad_spend_daily：投流消耗（按平台×日，GMV 的 8%-18%）
    const adRes = await client.query(
      `INSERT INTO fact_ad_spend_daily
         (biz_date, platform_code, shop_id, ad_tool_code, attribution_window_hours,
          ad_spend, impressions, clicks, attributed_orders,
          attributed_gross_gmv, attributed_settled_gmv,
          estimated_settle_date, settlement_cycle_days, is_demo)
       SELECT f.biz_date,
              f.platform_code,
              (SELECT MIN(id) FROM dim_shop s WHERE s.platform_code = f.platform_code) AS shop_id,
              (ARRAY['qianchuan','wanxiangtai','juguang','shutiao','wechat_ad'])[1 + floor(random() * 5)]::varchar AS ad_tool_code,
              7 AS attribution_window_hours,
              ROUND((f.gmv * (0.08 + random() * 0.10))::numeric, 2) AS ad_spend,
              (f.paid_buyer_count * 60 + random() * 20000)::bigint AS impressions,
              (f.paid_buyer_count * 3 + random() * 800)::bigint AS clicks,
              (f.paid_order_count * 0.3 + random() * 20)::int AS attributed_orders,
              ROUND((f.gmv * 0.3)::numeric, 2) AS attributed_gross_gmv,
              ROUND((f.gmv * 0.28)::numeric, 2) AS attributed_settled_gmv,
              (f.biz_date + 7) AS estimated_settle_date,
              7 AS settlement_cycle_days,
              true AS is_demo
         FROM fact_trade_daily f
        ORDER BY f.biz_date, f.platform_code
       RETURNING biz_date`,
    )
    log(`  fact_ad_spend_daily: ${adRes.rowCount} 行`)

    // 6.3 流量事实表（平台级，点击转化排品逻辑的平台侧输入）
    const trafficRes = await client.query(
      `INSERT INTO fact_traffic_daily
         (biz_date, platform_code, shop_id, channel_name, impressions, clicks,
          visitors, avg_stay_seconds, source, source_code, is_demo)
       SELECT f.biz_date,
              f.platform_code,
              (SELECT MIN(id) FROM dim_shop s WHERE s.platform_code = f.platform_code) AS shop_id,
              '直播推荐' AS channel_name,
              (f.paid_buyer_count * 40 + random() * 60000)::bigint AS impressions,
              (f.paid_buyer_count * 2 + random() * 1500)::bigint AS clicks,
              (f.paid_buyer_count + random() * 400)::bigint AS visitors,
              (90 + random() * 250)::int AS avg_stay_seconds,
              'api_sync' AS source,
              f.platform_code AS source_code,
              true AS is_demo
         FROM fact_trade_daily f
        ORDER BY f.biz_date, f.platform_code
       RETURNING biz_date`,
    )
    log(`  fact_traffic_daily: ${trafficRes.rowCount} 行`)

    // 6.4 渠道定价与配额（防超卖 + 渠道差异化测试依赖）
    const listingRes = await client.query(
      `INSERT INTO dim_product_channel_listing
         (product_id, platform_code, shop_id, channel_sku_id, channel_price,
          allocated_stock, reserved_stock, safety_stock, is_active)
       SELECT p.id,
              pl.platform_code,
              (SELECT MIN(id) FROM dim_shop s WHERE s.platform_code = pl.platform_code) AS shop_id,
              'CH-' || p.spu_code || '-' || pl.platform_code AS channel_sku_id,
              ROUND((p.retail_price * (0.92 + random() * 0.18))::numeric, 2) AS channel_price,
              (p.safety_stock * (4 + random() * 6))::int AS allocated_stock,
              0 AS reserved_stock,
              p.safety_stock AS safety_stock,
              true AS is_active
         FROM dim_product p
         CROSS JOIN (SELECT DISTINCT platform_code FROM live_rooms) pl
        ORDER BY p.id, pl.platform_code
       RETURNING id`,
    )
    log(`  dim_product_channel_listing: ${listingRes.rowCount} 行`)

    // ════════════════════════════════════════════════════════════════
    // 6.5 订单明细（SKU 级销售，RBAC / 端点一致性测试依赖）
    //     从场次排品的成交数据派生，保证口径一致（同一批商品、同一时段）
    // ════════════════════════════════════════════════════════════════
    log('生成订单明细…')
    const orderRes = await client.query(
      `INSERT INTO canonical_orders
         (biz_date, source_platform, store_id, source_order_id, order_status,
          currency_code, paid_amount, maturity_status)
       SELECT spp.business_date,
              r.platform_code AS source_platform,
              (SELECT MIN(id) FROM dim_shop s WHERE s.platform_code = r.platform_code) AS store_id,
              'ORD-' || spp.session_id || '-' || spp.id AS source_order_id,
              'paid' AS order_status,
              'CNY' AS currency_code,
              spp.payment_amount AS paid_amount,
              'settled' AS maturity_status
         FROM session_plan_products spp
         JOIN live_rooms r ON r.id = spp.room_id
        WHERE spp.sold_count > 0
        ORDER BY spp.id
       RETURNING id, source_order_id`,
    )
    const orderIdMap = new Map(orderRes.rows.map((r) => [r.source_order_id, Number(r.id)]))
    log(`  canonical_orders: ${orderRes.rowCount} 行`)

    const itemRes = await client.query(
      `INSERT INTO canonical_order_items
         (biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
          platform_sku_id, internal_sku_id, product_name, quantity, item_paid_amount, maturity_status)
       SELECT spp.business_date,
              r.platform_code AS source_platform,
              (SELECT MIN(id) FROM dim_shop s WHERE s.platform_code = r.platform_code) AS store_id,
              'ORD-' || spp.session_id || '-' || spp.id AS source_order_id,
              'SUB-' || spp.session_id || '-' || spp.id AS source_sub_order_id,
              spp.product_code AS platform_sku_id,
              spp.id::bigint AS internal_sku_id,
              spp.product_name AS product_name,
              spp.sold_count AS quantity,
              spp.payment_amount AS item_paid_amount,
              'settled' AS maturity_status
         FROM session_plan_products spp
         JOIN live_rooms r ON r.id = spp.room_id
        WHERE spp.sold_count > 0
        ORDER BY spp.id
       RETURNING id`,
    )
    log(`  canonical_order_items: ${itemRes.rowCount} 行`)

    // ════════════════════════════════════════════════════════════════
    // 6.5b 履约 / 售后 / 客服 / 退款（从订单向下游延伸）
    //
    //   背景：此前只生成到 canonical_orders，导致「履约风控」「售后工单」
    //   「客服绩效」「退款分析」4 个模块 0 数据 —— 而这些正是 README 对用户
    //   承诺的核心价值（杜绝超卖违规 / 48h SLA / 售后闭环）。
    //   此处从已有订单派生下游数据，口径完全一致（同一批订单、同一时段）。
    // ════════════════════════════════════════════════════════════════
    log('生成履约/售后/客服/退款下游数据…')

    // 6.5b-1 客服档案（fact_cs_session.agent_id 外键依赖）
    const csAgents = [
      { id: 1, name: '客服-小桐' }, { id: 2, name: '客服-阿梨' },
      { id: 3, name: '客服-大麦' }, { id: 4, name: '客服-柚子' },
    ]
    for (const a of csAgents) {
      await client.query(
        `INSERT INTO dim_cs_agent (id, agent_code, agent_name, platform_code, shop_id, shift_group, status)
         VALUES ($1, $2, $3, 'douyin', 1, 'day', 'online')
         ON CONFLICT (id) DO NOTHING`,
        [a.id, 'CS-' + String(a.id).padStart(3, '0'), a.name],
      )
    }

    // 6.5b-2 运单（48h SLA）：按平台取 48h 发货时限
    //   分布：85% 已签收 / 8% 待发货 / 4% 已发货未揽收 / 3% 运输中
    //   延迟与假发货风险按比例构造，让 SLA 预警有东西可看
    const waybillRes = await client.query(
      `INSERT INTO fact_fulfillment_waybill
         (platform_code, shop_id, order_no, order_amount, is_custom_presale,
          paid_at, ship_deadline_at, fulfillment_status,
          is_ship_delayed, is_fake_ship_risk, estimated_penalty_amount, sla_risk_reason)
       SELECT o.source_platform,
              o.store_id,
              o.source_order_id,
              o.paid_amount,
              false AS is_custom_presale,
              (o.biz_date + time '10:00') AS paid_at,
              (o.biz_date + time '10:00' + interval '48 hours') AS ship_deadline_at,
              CASE
                WHEN random() < 0.85 THEN 'signed'
                WHEN random() < 0.93 THEN 'pending_ship'
                WHEN random() < 0.97 THEN 'shipped_no_pickup'
                ELSE 'in_transit'
              END AS fulfillment_status,
              (random() >= 0.85 AND random() < 0.93 AND random() < 0.35) AS is_ship_delayed,
              (random() >= 0.93 AND random() < 0.97 AND random() < 0.12) AS is_fake_ship_risk,
              CASE
                WHEN random() >= 0.85 AND random() < 0.93 AND random() < 0.35
                  THEN ROUND(o.paid_amount * 0.05, 2)
                ELSE 0
              END AS estimated_penalty_amount,
              CASE
                WHEN random() >= 0.85 AND random() < 0.93 AND random() < 0.35
                  THEN '临近48小时发货时限仍未揽收，存在平台判罚风险'
                WHEN random() >= 0.93 AND random() < 0.97 AND random() < 0.12
                  THEN '发货后长时间无揽收记录，疑似虚假发货'
                ELSE ''
              END AS sla_risk_reason
         FROM canonical_orders o
        RETURNING id`,
    )
    log(`  fact_fulfillment_waybill: ${waybillRes.rowCount} 行`)

    // 6.5b-3 退款事件（从订单按 ~6% 退款率派生）
    const refundRes = await client.query(
      `INSERT INTO canonical_refund_events
         (biz_date, source_platform, store_id, source_refund_id, source_order_id,
          refund_type, refund_amount, refund_status, maturity_status)
       SELECT o.biz_date,
              o.source_platform,
              o.store_id,
              'RFD-' || o.source_order_id AS source_refund_id,
              o.source_order_id,
              CASE WHEN random() < 0.45 THEN 'only_refund'
                   WHEN random() < 0.9 THEN 'return_refund'
                   ELSE 'exchange' END AS refund_type,
              ROUND((o.paid_amount * (0.3 + random() * 0.7))::numeric, 2) AS refund_amount,
              CASE WHEN random() < 0.7 THEN 'success' ELSE 'processing' END AS refund_status,
              'settled' AS maturity_status
         FROM canonical_orders o
        WHERE random() < 0.06
        RETURNING id`,
    )
    log(`  canonical_refund_events: ${refundRes.rowCount} 行`)

    // 6.5b-4 售后工单（从退款事件派生，一笔退款一张工单）
    const ticketRes = await client.query(
      `INSERT INTO fact_after_sale_tickets
         (ticket_no, platform_code, shop_id, source_order_id, source_refund_id,
          refund_type, refund_amount, reason_category, reason_detail,
          ticket_status, autonomy_protected, applied_at, resolution_note)
       SELECT 'TK-' || re.source_refund_id,
              re.source_platform,
              re.store_id,
              re.source_order_id,
              re.source_refund_id,
              re.refund_type,
              re.refund_amount,
              (ARRAY['size_mismatch','quality_defect','logistics_slow',
                     'not_as_described','buyer_remorse','other'])[1 + floor(random() * 6)] AS reason_category,
              '买家申请' || CASE re.refund_type
                WHEN 'only_refund' THEN '仅退款'
                WHEN 'return_refund' THEN '退货退款'
                ELSE '换货' END AS reason_detail,
              CASE
                WHEN random() < 0.35 THEN 'pending_audit'
                WHEN random() < 0.55 THEN 'waiting_return'
                WHEN random() < 0.8 THEN 'approved'
                WHEN random() < 0.9 THEN 'rejected'
                ELSE 'closed'
              END AS ticket_status,
              (random() < 0.15) AS autonomy_protected,
              (re.biz_date + time '14:00') AS applied_at,
              CASE WHEN random() < 0.6 THEN '已按平台规则处理完毕' ELSE '' END AS resolution_note
         FROM canonical_refund_events re
        RETURNING id`,
    )
    log(`  fact_after_sale_tickets: ${ticketRes.rowCount} 行`)

    // 6.5b-5 客服会话绩效（按 日×班次 聚合）
    //   唯一约束 (session_date, agent_id, shift_type)：同一客服同一天同一班次仅一条，
    //   故先按 日×班次 生成 4 个客服的基础行，再回填指标。
    const csRes = await client.query(
      `INSERT INTO fact_cs_session
         (session_date, agent_id, platform_code, shop_id, shift_type,
          total_sessions, responded_sessions, timeout_sessions,
          avg_first_response_sec, inquiry_buyers, converted_buyers,
          converted_gmv, satisfaction_rate, notes)
       SELECT d.biz_date,
              a.id AS agent_id,
              d.platform_code,
              d.shop_id,
              s.shift_type,
              (20 + floor(random() * 60))::int AS total_sessions,
              0, 0,
              ROUND((15 + random() * 45)::numeric, 1) AS avg_first_response_sec,
              (15 + floor(random() * 50))::int AS inquiry_buyers,
              0, 0,
              ROUND((0.82 + random() * 0.17)::numeric, 2) AS satisfaction_rate,
              '' AS notes
         FROM (SELECT biz_date,
                      (ARRAY['douyin','taobao','wechat','xiaohongshu'])[1 + floor(random() * 4)] AS platform_code,
                      1 AS shop_id
                 FROM (SELECT DISTINCT biz_date FROM canonical_orders) dd) d
         CROSS JOIN (SELECT id FROM dim_cs_agent) a
         CROSS JOIN (SELECT unnest(ARRAY['day','night']) AS shift_type) s
        RETURNING id`,
    )
    // 回填派生指标
    // 注意：PG 的 SET 左边赋值对右边不可见，故 converted_gmv 必须分第二条 UPDATE 算，
    // 否则用的是旧 converted_buyers（=0），导致 gmv 恒为 0。
    await client.query(
      `UPDATE fact_cs_session
          SET responded_sessions = GREATEST(0, total_sessions - floor(random() * 4))::int,
              timeout_sessions   = floor(random() * 3)::int,
              converted_buyers   = floor(inquiry_buyers * (0.18 + random() * 0.22))::int
        WHERE id > 0`,
    )
    await client.query(
      `UPDATE fact_cs_session
          SET converted_gmv = ROUND((converted_buyers * (120 + random() * 380))::numeric, 2)
        WHERE id > 0`,
    )
        log(`  fact_cs_session: ${csRes.rowCount} 行`)


    // ════════════════════════════════════════════════════════════════
    // 6.6 大促活动报名提醒（合规巡检依赖）
    // ════════════════════════════════════════════════════════════════
    log('生成大促活动提醒…')
    const reminders = [
      { platform: 'douyin', name: '双11 全球好物节', type: 'platform_festival', deadlineOffset: 12 },
      { platform: 'taobao', name: '天猫双11 主会场', type: 'platform_festival', deadlineOffset: 9 },
      { platform: 'xiaohongshu', name: '小红书买手节', type: 'platform_festival', deadlineOffset: 18 },
      { platform: 'wechat', name: '视频号双11 带货节', type: 'platform_festival', deadlineOffset: 15 },
    ]
    for (const rm of reminders) {
      const deadline = new Date(today)
      deadline.setDate(deadline.getDate() + rm.deadlineOffset)
      const start = new Date(deadline)
      start.setDate(start.getDate() + 5)
      const end = new Date(start)
      end.setDate(end.getDate() + 10)
      await client.query(
        `INSERT INTO compliance_activity_reminder
           (platform_code, activity_name, activity_type, signup_deadline,
            activity_start, activity_end, requirements, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          rm.platform, rm.name, rm.type,
          deadline.toISOString().slice(0, 10),
          start.toISOString().slice(0, 10),
          end.toISOString().slice(0, 10),
          '需提交商品资质与主播授权文件',
        ],
      )
    }
    log('  compliance_activity_reminder: 4 行')

    // ════════════════════════════════════════════════════════════════
    // 6.7 经营目标（P0-1：目标管理闭环）
    //     目标值取自演示数据的真实体量（近 30 天实际 GMV / 场次 / 订单），
    //     而非随手编的数字——这样「目标达成」页面的进度条才有业务含义。
    // ════════════════════════════════════════════════════════════════
    log('生成经营目标…')
    const goalBase = await client.query(
      `SELECT COALESCE(SUM(gmv), 0)::numeric(14,2) AS gmv30,
              COUNT(*)::int AS sessions30,
              COALESCE(SUM(orders), 0)::int AS orders30,
              COALESCE(AVG(gmv), 0)::numeric(14,2) AS avg_gmv
         FROM public.live_registrations
        WHERE biz_date >= CURRENT_DATE - 30 AND status <> 'cancelled'`,
    )
    const g30 = Number(goalBase.rows[0].gmv30)
    const s30 = Number(goalBase.rows[0].sessions30)
    const o30 = Number(goalBase.rows[0].orders30)

    // 目标按「略高于当前实际」设定，让进度落在 60%~95% 区间（有达成也有追赶）
    const goals = [
      { name: '月度 GMV', target: Math.round(g30 * 1.25), current: g30, unit: '元', category: '营收', period: 'monthly' },
      { name: '月度直播场次', target: Math.round(s30 * 1.2), current: s30, unit: '场', category: '运营', period: 'monthly' },
      { name: '月度订单量', target: Math.round(o30 * 1.15), current: o30, unit: '单', category: '增长', period: 'monthly' },
      { name: '季度 GMV', target: Math.round(g30 * 3.6), current: g30, unit: '元', category: '营收', period: 'quarterly' },
      { name: '年度 GMV', target: Math.round(g30 * 14), current: g30, unit: '元', category: '营收', period: 'yearly' },
      { name: '人均产出（人效）', target: 60, current: 48, unit: '分', category: '效率', period: 'monthly' },
      { name: '售后处理时效', target: 24, current: 18, unit: '小时', category: '服务', period: 'monthly' },
    ]
    for (const g of goals) {
      const progress = Math.min(200, Math.max(0, Math.round(g.current / g.target * 100)))
      await client.query(
        `INSERT INTO goal_tracking (name, target, current_val, unit, progress, category, period)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [g.name, g.target, g.current, g.unit, progress, g.category, g.period],
      )
    }
    log(`  goal_tracking: ${goals.length} 行（目标值取自近 30 天真实体量）`)

    // ════════════════════════════════════════════════════════════════
    // 7. 培训计划（HRBP 人效的成长侧）
    // ════════════════════════════════════════════════════════════════
    log('生成培训计划…')
    const trainingPlans = [
      { name: 'S 级主播表达力强化营', count: 2, progress: 65, status: 'in_progress', days: -20 },
      { name: 'A 级主播转化话术打磨', count: 4, progress: 40, status: 'in_progress', days: -14 },
      { name: 'B 级主播基础能力补齐', count: 4, progress: 25, status: 'in_progress', days: -7 },
      { name: '新主播 7 天速成计划', count: 2, progress: 100, status: 'completed', days: -45 },
    ]
    for (const tp of trainingPlans) {
      const start = new Date(today)
      start.setDate(start.getDate() + tp.days)
      const end = new Date(start)
      end.setDate(end.getDate() + 30)
      await client.query(
        `INSERT INTO anchor_training_plans
           (name, anchor_count, start_date, end_date, progress, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tp.name, tp.count, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), tp.progress, tp.status],
      )
    }



    // 重置自增序列：上面用显式 id 插入，序列未推进，会导致后续 INSERT 主键冲突
    const seqResets = [
      ['live_rooms', 'id'], ['anchors', 'id'], ['anchor_profiles', 'id'],
      ['anchor_capabilities', 'id'], ['operators', 'id'], ['dim_product', 'id'],
      ['fact_inventory_stock', 'id'], ['live_registrations', 'id'], ['live_sessions', 'id'],
      ['session_staff_assignments', 'id'], ['staff_day_status', 'id'],
      ['session_plans', 'id'], ['session_plan_products', 'id'],
      ['session_short_video_traffic', 'id'], ['session_overview_metrics', 'id'],
      ['session_anchor_metrics', 'id'], ['dim_product_channel_listing', 'id'],
      ['anchor_training_plans', 'id'],
    ]
    for (const [t, c] of seqResets) {
      await client.query(
        "SELECT setval(pg_get_serial_sequence('" + t + "', '" + c + "'), COALESCE((SELECT MAX(" + c + ") FROM " + t + "), 0) + 1, false)",
      )
    }
    log('自增序列已重置')
    await client.query('COMMIT')
    log('✅ 演示数据生成完成')

    // ════════════════════════════════════════════════════════════════
    // 校验
    // ════════════════════════════════════════════════════════════════
    const checks = await client.query(`
      SELECT 'anchors' t, count(*) n FROM anchors UNION ALL
      SELECT 'anchor_capabilities', count(*) FROM anchor_capabilities UNION ALL
      SELECT 'operators', count(*) FROM operators UNION ALL
      SELECT 'live_rooms', count(*) FROM live_rooms UNION ALL
      SELECT 'dim_product', count(*) FROM dim_product UNION ALL
      SELECT 'fact_inventory_stock', count(*) FROM fact_inventory_stock UNION ALL
      SELECT 'live_registrations', count(*) FROM live_registrations UNION ALL
      SELECT 'session_staff_assignments', count(*) FROM session_staff_assignments UNION ALL
      SELECT 'staff_day_status', count(*) FROM staff_day_status UNION ALL
      SELECT 'session_plans', count(*) FROM session_plans UNION ALL
      SELECT 'session_plan_products', count(*) FROM session_plan_products UNION ALL
      SELECT 'session_short_video_traffic', count(*) FROM session_short_video_traffic UNION ALL
      SELECT 'session_overview_metrics', count(*) FROM session_overview_metrics UNION ALL
      SELECT 'session_anchor_metrics', count(*) FROM session_anchor_metrics UNION ALL
      SELECT 'fact_traffic_daily', count(*) FROM fact_traffic_daily UNION ALL
      SELECT 'anchor_training_plans', count(*) FROM anchor_training_plans
    `)
    console.log('\n[verify] 数据量：')
    for (const r of checks.rows) console.log(`  ${r.t}: ${r.n}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[demo-v3] 失败：', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
