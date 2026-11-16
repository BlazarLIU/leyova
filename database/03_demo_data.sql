--
-- 【注意】本脚本已被 database/04_demo_data_v2.sql 和 database/04b_demo_data_v2_facts.sql 取代。
-- 保留本文件仅作历史归档与回滚参考，日常请通过 database/scripts/reset-demo-v2.sh 执行新版演示数据重建。
--
-- leyova 数据库演示数据（demo - 旧版）
--
-- 依赖：先执行 database/01_schema.sql 与 database/02_seed.sql
-- 用法：psql -d leyova -f database/03_demo_data.sql
--
-- 内容：全部为脚本生成的合成数据（虚构品牌、主播、商品），不含任何真实经营数据。
--       覆盖：运营人员 / 主播 / 直播间 / 场次 / 场次指标 / 渠道 / 商品 / 短视频引流 /
--             直播间健康度 / 日汇总 / 动态 / 告警 / 改进任务 / 大促 / 目标 / 数据上传导出 /
--             多直播间快照 / 竞品 / 话术库 / 问题库 / 主播能力与成长 / 培训 / 排期 /
--             抖音渠道与主播日报
--
-- 说明：本脚本会先清空上述演示表再重建，可重复执行（幂等）；
--       不会影响 users / roles / permissions / system_config 等基础数据。
--

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 0. 清理演示数据（按外键依赖从子到父顺序删除）
-- ════════════════════════════════════════════════════════════
DELETE FROM session_product_skus;
DELETE FROM session_product_details;
DELETE FROM session_short_video_traffic;
DELETE FROM session_channel_metrics;
DELETE FROM session_anchor_metrics;
DELETE FROM session_overview_metrics;
DELETE FROM session_live_basic_info;
DELETE FROM session_plan_products;
DELETE FROM session_plans;
DELETE FROM live_sessions;
DELETE FROM room_health;
DELETE FROM multi_room_status;
DELETE FROM anchor_capabilities;
DELETE FROM anchor_rankings;
DELETE FROM anchor_training_records;
DELETE FROM anchor_training_plans;
DELETE FROM anchor_script_templates;
DELETE FROM anchor_profiles;
DELETE FROM douyin_anchor_daily_metrics;
DELETE FROM douyin_channel_daily_metrics;
DELETE FROM competitor_price_data;
DELETE FROM competitor_brands;
DELETE FROM anchors;
DELETE FROM live_rooms;
DELETE FROM operators;
DELETE FROM overview_daily_stats;
DELETE FROM overview_activities;
DELETE FROM alert_events;
DELETE FROM improvement_tasks;
DELETE FROM promotions;
DELETE FROM goal_tracking;
DELETE FROM data_uploads;
DELETE FROM data_exports;

-- ════════════════════════════════════════════════════════════
-- 1. 运营人员（operators）
-- ════════════════════════════════════════════════════════════
INSERT INTO operators (id, name, employee_id, status)
SELECT g, (ARRAY['陈一鸣','李思远','王雨桐','赵子涵','周若彤',
                 '吴昊然','郑雅雯','孙嘉豪','黄梦洁','徐之远'])[g],
       'OP' || lpad(g::text, 4, '0'), 1
FROM generate_series(1, 10) g;

-- ════════════════════════════════════════════════════════════
-- 2. 主播（anchors）与主播档案（anchor_profiles）
-- ════════════════════════════════════════════════════════════
INSERT INTO anchors (id, name, platform, level, status)
SELECT g,
       (ARRAY['沈知夏','林清和','苏沐春','陆星野','叶南音',
              '顾清欢','唐不言','温以宁','程霜降','许知意',
              '何须臾','秦望舒','宋亦寒','方锦夕','梁听白',
              '韩星阑','裴云深','阮清秋','施南乔','卓未晞'])[g],
       '抖音',
       (ARRAY['A','B','B','C','C','B','A','B','C','D',
              'B','C','B','C','B','A','B','C','D','C'])[g],
       1
FROM generate_series(1, 20) g;

INSERT INTO anchor_profiles (id, level, followers, join_date, email, phone, tags)
SELECT a.id,
       a.level,
       20000 + a.id * 13700,
       CURRENT_DATE - (60 + a.id * 9),
       'anchor' || lpad(a.id::text, 2, '0') || '@example.com',
       '1380000' || lpad(a.id::text, 4, '0'),
       CASE WHEN a.level = 'A' THEN ARRAY['控场','转化']::text[]
            WHEN a.level = 'B' THEN ARRAY['亲和力','讲解']::text[]
            ELSE ARRAY['成长中']::text[] END
FROM anchors a;

-- ════════════════════════════════════════════════════════════
-- 3. 直播间（live_rooms）
-- ════════════════════════════════════════════════════════════
INSERT INTO live_rooms (id, name, platform, status)
SELECT g,
       (ARRAY['云梭旗舰店','云梭品质店','云梭甄选店','云梭服饰店',
              '云梭时尚店','云梭美妆店','云梭家电店','云梭食品店',
              '云梭母婴店','云梭数码店','云梭家居店','云梭运动店'])[g],
       '抖音',
       'active'
FROM generate_series(1, 12) g;

-- ════════════════════════════════════════════════════════════
-- 4. 直播场次（live_sessions）
--    4.1 已完结场次 120 场（12 个直播间 × 近 90 天各 10 场，同一直播间日期不重复）
-- ════════════════════════════════════════════════════════════
WITH base AS (
  SELECT (rr - 1) * 10 + dd + 1                                   AS id,
         rr                                                       AS room_id,
         1 + (((rr - 1) * 10 + dd + 1) * 7) % 20                  AS anchor_id,
         CURRENT_DATE - (1 + ((dd * 12 + rr) % 90))               AS d,
         120 + (((rr - 1) * 10 + dd + 1) * 37) % 181              AS dur
  FROM generate_series(1, 12) rr, generate_series(0, 9) dd
),
calc AS (
  SELECT *,
         (20000 + (id * 977) % 60001)::numeric AS gmv,
         ((id * 13) % 12)::numeric             AS refund_pct,
         ((id * 17) % 9)::numeric              AS ad_pct
  FROM base
),
fin AS (
  SELECT *,
         round(gmv * refund_pct / 100.0, 2)                          AS ret,
         GREATEST(1, round(gmv / (150 + (id * 11) % 120))::int)      AS ord,
         (200 + (id * 53) % 800)                                     AS peak
  FROM calc
)
INSERT INTO live_sessions (
  id, room_id, anchor_id, title, date, start_time, end_time, status,
  gmv, orders, online_peak, duration_min, operator_id, return_amount, gsv, remark,
  ad_platform, ad_type, ad_cost, ad_gsv, ad_status, gmv_per_hour, avg_item_price,
  buyer_count, avg_online, uv_value, exposure_view_rate, retention_rate, interaction_rate,
  new_fans, view_follow_rate, new_group_members, audience_profile, gpm, views
)
SELECT id, room_id, anchor_id,
       '日常直播 ' || to_char(d, 'MM-DD'),
       d,
       (time '18:00' + ((id % 8) * interval '30 min'))::time,
       (time '18:00' + ((id % 8) * interval '30 min') + make_interval(mins => dur))::time,
       'completed',
       gmv, ord, peak, dur,
       1 + (id % 10),
       ret, gmv - ret, '',
       '巨量千川', '直播间成交',
       round(gmv * ad_pct / 100.0, 2),
       round(gmv * 0.35, 2),
       1,
       round(gmv / (dur / 60.0), 2),
       round(gmv / ord, 2),
       round(ord * 0.92)::int,
       round(peak * 0.55)::int,
       round(gmv / (peak * (25 + id % 20)), 2),
       (15 + (id * 7) % 25)::numeric(5,2),
       (10 + (id * 3) % 20)::numeric(5,2),
       (3 + (id * 5) % 15)::numeric(5,2),
       50 + (id * 13) % 400,
       (1 + (id * 3) % 6)::numeric(5,2),
       10 + (id * 7) % 90,
       '女性 25-34 岁为主，一二线城市占比约 62%',
       round(gmv / (peak * (25 + id % 20)) * 1000, 2),
       peak * (25 + id % 20)
FROM fin;

-- 4.2 进行中场次 6 场（今日）
INSERT INTO live_sessions (
  id, room_id, anchor_id, title, date, start_time, end_time, status,
  gmv, orders, online_peak, duration_min, operator_id, return_amount, gsv, remark,
  ad_platform, ad_type, ad_cost, ad_gsv, ad_status, gmv_per_hour, avg_item_price,
  buyer_count, avg_online, uv_value, exposure_view_rate, retention_rate, interaction_rate,
  new_fans, view_follow_rate, new_group_members, audience_profile, gpm, views
)
SELECT 120 + r, r, r,
       '今日直播 · 进行中',
       CURRENT_DATE, time '18:00', NULL, 'live',
       3000 + r * 1500, 20 + r * 8, 300 + r * 40, 90,
       r,
       0, 3000 + r * 1500, '',
       '巨量千川', '直播间成交',
       round((3000 + r * 1500) * 0.08, 2),
       round((3000 + r * 1500) * 0.35, 2),
       1,
       round((3000 + r * 1500) / 1.5, 2),
       round((3000 + r * 1500) / (20 + r * 8), 2),
       round((20 + r * 8) * 0.9)::int,
       round((300 + r * 40) * 0.5)::int,
       12.50,
       (20 + r)::numeric(5,2),
       12::numeric(5,2),
       6::numeric(5,2),
       30 + r * 3,
       2::numeric(5,2),
       15 + r,
       '女性 25-34 岁为主',
       50.00,
       (300 + r * 40) * 30
FROM generate_series(1, 6) r;

-- 4.3 待开播场次 18 场（明日 12 场 + 后日 6 场）
INSERT INTO live_sessions (id, room_id, anchor_id, title, date, start_time, end_time, status, duration_min)
SELECT 126 + r, r, r, '排期直播 ' || to_char(CURRENT_DATE + 1, 'MM-DD'),
       CURRENT_DATE + 1, time '19:00', time '23:00', 'scheduled', 240
FROM generate_series(1, 12) r;

INSERT INTO live_sessions (id, room_id, anchor_id, title, date, start_time, end_time, status, duration_min)
SELECT 138 + r, r, r + 6, '排期直播 ' || to_char(CURRENT_DATE + 2, 'MM-DD'),
       CURRENT_DATE + 2, time '19:00', time '23:00', 'scheduled', 240
FROM generate_series(1, 6) r;

-- ════════════════════════════════════════════════════════════
-- 5. 场次基础信息（session_live_basic_info）
--    与 live_sessions 一一对应（已完结 + 进行中），(room_id, business_date) 唯一
-- ════════════════════════════════════════════════════════════
INSERT INTO session_live_basic_info (
  id, session_id, room_id, business_date, fans_before_broadcast, live_date,
  live_start_time, live_end_time, live_duration_min, live_platform,
  payment_amount, gpm, disposal_count
)
SELECT ls.id, ls.id, ls.room_id, ls.date,
       5000 + ls.id * 137,
       ls.date, ls.start_time, ls.end_time, ls.duration_min, '抖音',
       ls.gmv, ls.gpm, ls.orders
FROM live_sessions ls
WHERE ls.status IN ('completed', 'live');

-- ════════════════════════════════════════════════════════════
-- 6. 场次总览指标（session_overview_metrics）
-- ════════════════════════════════════════════════════════════
INSERT INTO session_overview_metrics (
  id, session_id, room_id, business_date, viewers, exposure_view_rate, avg_online, peak_online,
  product_click_users, product_exposure_click_rate, avg_watch_seconds, new_followers, view_follow_rate,
  interaction_rate, avg_comments_per_person, conversion_rate, product_click_deal_rate,
  avg_order_value, refund_amount, refund_orders, refund_users, exposure_users, enter_users,
  product_exposure_users, product_click_persons, deal_users
)
SELECT ls.id, ls.id, ls.room_id, ls.date,
       ls.views,
       ls.exposure_view_rate,
       ls.avg_online,
       ls.online_peak,
       round(ls.views * 0.08)::int,
       (8 + (ls.id * 3) % 7)::numeric(8,4),
       45 + (ls.id * 11) % 120,
       ls.new_fans,
       ls.view_follow_rate::numeric(8,4),
       ls.interaction_rate::numeric(8,4),
       (2 + (ls.id % 5))::numeric(8,2),
       round(ls.orders * 100.0 / GREATEST(ls.views, 1), 4),
       (15 + (ls.id * 2) % 10)::numeric(8,4),
       ls.avg_item_price,
       ls.return_amount,
       round(ls.orders * ((ls.id * 13) % 12) / 100.0)::int,
       round(ls.orders * ((ls.id * 13) % 12) / 100.0 * 0.95)::int,
       ls.views * 2,
       round(ls.views * 1.2)::int,
       round(ls.views * 1.5)::int,
       round(ls.views * 0.08)::int,
       ls.orders
FROM live_sessions ls
WHERE ls.status IN ('completed', 'live');

-- ════════════════════════════════════════════════════════════
-- 7. 渠道流量指标（session_channel_metrics）
--    唯一约束为 (period_date, channel)：每天每个渠道一行（全站汇总）
--    4 个渠道：自然流量 / 付费流量 / 短视频 / 搜索
-- ════════════════════════════════════════════════════════════
INSERT INTO session_channel_metrics (
  id, session_id, channel, avg_watch_sec, impressions, views, exposure_view_rate,
  interactions, view_interaction_rate, new_fans, product_impressions, product_clicks,
  product_click_rate, product_deal_rate, orders, buyer_count, gmv, item_count, gpm,
  avg_order_value, ad_spend, period_date
)
WITH agg AS (
  SELECT ls.date AS period_date,
         SUM(ls.views)::numeric AS views,
         SUM(ls.new_fans)::int AS new_fans,
         SUM(ls.orders)::int AS orders,
         SUM(ls.buyer_count)::int AS buyers,
         SUM(ls.gmv)::numeric AS gmv,
         SUM(COALESCE(ls.ad_cost, 0))::numeric AS ad_cost
  FROM live_sessions ls
  WHERE ls.status = 'completed'
  GROUP BY ls.date
), day_rows AS (
  SELECT a.period_date::date AS d,
         (SELECT ls2.id FROM live_sessions ls2
           WHERE ls2.date = a.period_date AND ls2.status = 'completed'
           ORDER BY ls2.id LIMIT 1) AS session_id,
         a.views, a.new_fans, a.orders, a.buyers, a.gmv, a.ad_cost
  FROM agg a
)
SELECT (d.d - DATE '2000-01-01') * 4 + c.n,
       d.session_id,
       c.channel,
       round(d.views * c.share * 0.02)::int,
       round(d.views * c.share * 3.2)::int,
       round(d.views * c.share)::int,
       (20 + c.n * 3)::numeric(5,2),
       round(d.views * c.share * 0.06)::int,
       (5 + c.n)::numeric(5,2),
       round(d.new_fans * c.share)::int,
       round(d.views * c.share * 1.8)::int,
       round(d.views * c.share * 0.09)::int,
       (9 - c.n)::numeric(5,2),
       (18 + c.n * 2)::numeric(5,2),
       GREATEST(1, round(d.orders * c.share)::int),
       GREATEST(1, round(d.buyers * c.share)::int),
       round(d.gmv * c.share, 2),
       6,
       round(d.gmv * c.share / GREATEST(d.views * c.share, 1) * 1000, 2),
       round(d.gmv * c.share / GREATEST(d.orders * c.share, 1), 2),
       round(d.ad_cost * c.share, 2),
       d.d
FROM day_rows d
CROSS JOIN (VALUES (1, '自然流量', 0.40::numeric),
                   (2, '付费流量', 0.30::numeric),
                   (3, '短视频',   0.20::numeric),
                   (4, '搜索',     0.10::numeric)) AS c(n, channel, share);

-- ════════════════════════════════════════════════════════════
-- 8. 场次商品明细（session_product_details）
--    每个已完结场次 6 个商品
-- ════════════════════════════════════════════════════════════
INSERT INTO session_product_details (
  id, session_id, room_id, business_date, product_order, product_name, product_id,
  payment_amount, sold_count, buyer_count, order_count, exposure_users, click_users,
  exposure_click_rate, click_deal_rate, refund_users, refund_amount, refund_orders
)
SELECT (ls.id - 1) * 6 + p.n,
       ls.id, ls.room_id, ls.date, p.n, p.name,
       'P' || lpad(((ls.id - 1) * 6 + p.n)::text, 5, '0'),
       round(ls.gmv * p.share, 2),
       GREATEST(1, round(ls.gmv * p.share / p.price)::int),
       GREATEST(1, round(ls.gmv * p.share / p.price * 0.9)::int),
       GREATEST(1, round(ls.gmv * p.share / p.price)::int),
       round(ls.views * 0.6)::int,
       round(ls.views * 0.05)::int,
       (8 + p.n)::numeric(8,4),
       (15 + p.n * 2)::numeric(8,4),
       GREATEST(0, round(ls.gmv * p.share / p.price * 0.05)::int),
       round(ls.gmv * p.share * 0.05, 2),
       GREATEST(0, round(ls.gmv * p.share / p.price * 0.05)::int)
FROM live_sessions ls
CROSS JOIN (VALUES (1, '云感棉柔基础T恤',    129::numeric, 0.30::numeric),
                   (2, '轻盈保暖羽绒外套',   399::numeric, 0.25::numeric),
                   (3, '极简通勤长袖衬衫',   199::numeric, 0.18::numeric),
                   (4, '舒适直筒休闲长裤',   159::numeric, 0.12::numeric),
                   (5, '百搭羊毛针织开衫',   219::numeric, 0.10::numeric),
                   (6, '经典低帮帆布鞋',      89::numeric, 0.05::numeric)) AS p(n, name, price, share)
WHERE ls.status = 'completed';

-- ════════════════════════════════════════════════════════════
-- 9. 短视频引流（session_short_video_traffic）
--    每个已完结场次 2 条视频
-- ════════════════════════════════════════════════════════════
INSERT INTO session_short_video_traffic (
  id, session_id, room_id, business_date, video_name, post_time,
  live_entry_impressions, traffic_to_live, entry_click_rate
)
SELECT (ls.id - 1) * 2 + v.n,
       ls.id, ls.room_id, ls.date,
       '短视频素材' || chr(64 + v.n) || ' · ' || to_char(ls.date, 'MM-DD'),
       (ls.date::timestamp + (v.n * 3) * interval '1 hour'),
       round(ls.views * 0.35 * v.share)::bigint,
       round(ls.views * 0.12 * v.share)::int,
       (6 + v.n)::numeric(8,4)
FROM live_sessions ls
CROSS JOIN (VALUES (1, 0.6::numeric), (2, 0.4::numeric)) AS v(n, share)
WHERE ls.status = 'completed';

-- ════════════════════════════════════════════════════════════
-- 10. 主播历史场次指标（session_anchor_metrics）
--     独立历史区间（120~150 天前），与 live_sessions 区间不重叠，避免重复统计
-- ════════════════════════════════════════════════════════════
INSERT INTO session_anchor_metrics (
  id, date, anchor_id, room_id, duration_min, gmv, gmv_per_hour, online_peak, avg_online,
  avg_item_price, exposure_view_rate, retention_rate, interaction_rate, new_fans,
  view_follow_rate, new_group_members, uv_value, buyer_count, audience_profile, gpm, views, title
)
SELECT (a - 1) * 30 + d,
       CURRENT_DATE - (120 + d),
       a,
       1 + ((a + d) % 12),
       180,
       (18000 + ((a * 31 + d * 97) % 40000))::numeric(12,2),
       round((18000 + ((a * 31 + d * 97) % 40000)) / 3.0, 2),
       250 + ((a * 17 + d * 13) % 700),
       round((250 + ((a * 17 + d * 13) % 700)) * 0.55)::int,
       round((18000 + ((a * 31 + d * 97) % 40000)) / (80 + (a + d) % 60), 2),
       (14 + (a + d) % 26)::numeric(5,2),
       (9 + (a * 2 + d) % 18)::numeric(5,2),
       (3 + (a + d * 2) % 12)::numeric(5,2),
       40 + (a * 7 + d * 3) % 300,
       (1 + (a + d) % 5)::numeric(5,2),
       8 + (a * 5 + d) % 60,
       round((18000 + ((a * 31 + d * 97) % 40000)) / ((250 + ((a * 17 + d * 13) % 700)) * 30), 2),
       round((18000 + ((a * 31 + d * 97) % 40000)) / (80 + (a + d) % 60) * 0.9)::int,
       '女性 25-34 岁为主',
       round((18000 + ((a * 31 + d * 97) % 40000)) / ((250 + ((a * 17 + d * 13) % 700)) * 30) * 1000, 2),
       (250 + ((a * 17 + d * 13) % 700)) * 30,
       '历史场次 · ' || to_char(CURRENT_DATE - (120 + d), 'MM-DD')
FROM generate_series(1, 20) a, generate_series(1, 30) d;

-- ════════════════════════════════════════════════════════════
-- 11. 直播间健康度（room_health）
-- ════════════════════════════════════════════════════════════
INSERT INTO room_health (
  id, room_id, health_score, interaction_score, conversion_score,
  content_score, traffic_score, status, evaluated_at
)
SELECT r,
       r,
       s.score,
       GREATEST(30, s.score - (r * 3) % 12)::smallint,
       GREATEST(30, s.score + (r * 5) % 9)::smallint,
       GREATEST(30, s.score - (r * 2) % 8)::smallint,
       GREATEST(30, s.score + (r * 4) % 11)::smallint,
       CASE WHEN s.score >= 75 THEN 'healthy'
            WHEN s.score >= 60 THEN 'warning'
            ELSE 'critical' END,
       CURRENT_DATE
FROM generate_series(1, 12) r
CROSS JOIN LATERAL (SELECT (58 + (r * 7) % 30)::int AS score) s;

-- ════════════════════════════════════════════════════════════
-- 12. 总览日汇总（overview_daily_stats）—— 近 90 天
-- ════════════════════════════════════════════════════════════
WITH cal AS (
  SELECT (CURRENT_DATE - gs)::date AS d FROM generate_series(0, 89) gs
),
agg AS (
  SELECT date AS d, SUM(gmv) AS gmv, SUM(orders)::int AS orders,
         COUNT(*)::int AS rooms, SUM(online_peak)::int AS online
  FROM live_sessions WHERE status = 'completed' GROUP BY date
),
merged AS (
  SELECT c.d,
         COALESCE(a.gmv, 0)::numeric(12,2) AS gmv,
         COALESCE(a.orders, 0) AS orders,
         COALESCE(a.rooms, 0) AS rooms,
         COALESCE(a.online, 0) AS online
  FROM cal c LEFT JOIN agg a ON a.d = c.d
)
INSERT INTO overview_daily_stats (date, today_gmv, today_orders, active_rooms, online_viewers, growth_rate)
SELECT d, gmv, orders, rooms, online,
       CASE WHEN lag(gmv) OVER (ORDER BY d) > 0
            THEN round(((gmv - lag(gmv) OVER (ORDER BY d)) / lag(gmv) OVER (ORDER BY d) * 100)::numeric, 1)
            ELSE 0 END
FROM merged
ORDER BY d;

-- ════════════════════════════════════════════════════════════
-- 13. 总览动态（overview_activities）
-- ════════════════════════════════════════════════════════════
INSERT INTO overview_activities (title, time_desc, activity_type, created_at)
SELECT (ARRAY[
         '云梭旗舰店 GMV 突破 ¥50,000',
         '云梭品质店 新增订单 128 笔',
         '云梭甄选店 在线人数峰值 1,860',
         '场次「日常直播」已完结并生成复盘',
         '系统检测到退款率异常，已生成告警',
         '云梭服饰店 新主播完成首播',
         '大促「年货节」活动已创建',
         '改进任务「优化开场话术」已完成',
         '云梭美妆店 货盘已更新 6 个商品',
         '今日数据日报已上传'
       ])[1 + (g % 10)],
       (CASE WHEN g < 5 THEN g || ' 分钟前'
             WHEN g < 12 THEN (g - 4) || ' 小时前'
             ELSE (g - 11) || ' 天前' END),
       (ARRAY['gmv_milestone','order_placed','viewer_peak','session_update',
              'system_notify','info'])[1 + (g % 6)],
       now() - (g * interval '47 min')
FROM generate_series(0, 19) g;

-- ════════════════════════════════════════════════════════════
-- 14. 告警事件（alert_events）
-- ════════════════════════════════════════════════════════════
INSERT INTO alert_events (severity, title, description, event_time, status)
SELECT (ARRAY['critical','warning','info'])[1 + (g % 3)],
       (ARRAY[
         '直播间退款率超过阈值',
         '主播小时产出大幅下降',
         '当日主播分析日报未上传',
         '直播间在线人数异常波动',
         '商品库存风险提示',
         '千川投放 ROI 低于目标',
         '直播间健康度评分下降',
         '场次数据缺失，请补录'
       ])[1 + (g % 8)],
       '系统自动检测生成（演示数据）',
       now() - (g * interval '5 hour'),
       (ARRAY['pending','processing','resolved'])[1 + (g % 3)]
FROM generate_series(0, 23) g;

-- ════════════════════════════════════════════════════════════
-- 15. 改进任务（improvement_tasks）
-- ════════════════════════════════════════════════════════════
INSERT INTO improvement_tasks (title, description, assignee, priority, source, due_date, progress, status)
SELECT (ARRAY[
         '优化开场 5 分钟留人话术',
         '调整付费流量投放时段',
         '补齐直播间主推品讲解脚本',
         '提升中控上下架节奏',
         '降低退款率专项复盘',
         '完善场次数据登记流程',
         '主播镜头表现力专项训练',
         '优化商品组合与排品顺序',
         '建立竞品价格监控机制',
         '直播间背景与灯光优化'
       ])[1 + (g % 10)],
       '由复盘结论自动生成的改进事项（演示数据）',
       (ARRAY['陈一鸣','王雨桐','赵子涵','周若彤','吴昊然'])[1 + (g % 5)],
       (ARRAY['high','medium','low'])[1 + (g % 3)],
       'manual',
       CURRENT_DATE + (g % 14),
       (g * 13) % 101,
       (ARRAY['pending','in_progress','completed'])[1 + (g % 3)]
FROM generate_series(0, 17) g;

-- ════════════════════════════════════════════════════════════
-- 16. 大促（promotions）
-- ════════════════════════════════════════════════════════════
INSERT INTO promotions (
  name, type, content, start_date, end_date, applicable_rooms, applicable_anchors,
  target_gmv, current_gmv, status
) VALUES
  ('年货节专场', '满减&满赠', '满 299 减 30，满 599 赠礼盒', CURRENT_DATE - 5, CURRENT_DATE + 15,
   '[1,2,3,4,5]'::jsonb, '[1,2,3,4,5,6]'::jsonb, 800000, 320000, 'ongoing'),
  ('春季新品首发', '新品折扣', '新品首降 8 折', CURRENT_DATE + 10, CURRENT_DATE + 30,
   '[1,2,3]'::jsonb, '[1,2,3]'::jsonb, 500000, 0, 'preparing'),
  ('会员日专享', '会员价', '会员额外 95 折', CURRENT_DATE - 40, CURRENT_DATE - 10,
   '[1,2,3,4,5,6]'::jsonb, '[1,2,3,4,5,6,7,8]'::jsonb, 300000, 286000, 'ended');

-- ════════════════════════════════════════════════════════════
-- 17. 目标跟踪（goal_tracking）
-- ════════════════════════════════════════════════════════════
INSERT INTO goal_tracking (name, target, current_val, unit, progress, category, period) VALUES
  ('月度 GMV 目标',      3000000, 1860000, '元', 62, '营收', 'monthly'),
  ('月度订单目标',         12000,    7400, '单', 62, '营收', 'monthly'),
  ('新增粉丝目标',         20000,   13500, '人', 68, '增长', 'monthly'),
  ('退款率控制目标',         10,      6.8, '%',  68, '质量', 'monthly');

-- ════════════════════════════════════════════════════════════
-- 18. 数据上传 / 导出（data_uploads / data_exports）
-- ════════════════════════════════════════════════════════════
INSERT INTO data_uploads (file_name, file_type, file_size, upload_time, status, row_count, data_type, business_date)
SELECT (CASE WHEN g % 2 = 0 THEN '主播分析日报' ELSE '渠道分析日报' END)
         || '_' || to_char(CURRENT_DATE - g, 'YYYYMMDD') || '.xlsx',
       'xlsx', '128KB',
       (CURRENT_DATE - g)::timestamp + time '09:12',
       'completed',
       20 + (g * 3) % 40,
       CASE WHEN g % 2 = 0 THEN 'anchor_analysis' ELSE 'channel_analysis' END,
       CURRENT_DATE - g
FROM generate_series(0, 11) g;

INSERT INTO data_exports (export_name, format, status, row_count, requested_at, completed_at)
SELECT '经营数据导出_' || to_char(CURRENT_DATE - g * 3, 'YYYYMMDD'),
       'xlsx', 'completed', 200 + g * 37,
       (CURRENT_DATE - g * 3)::timestamp + time '15:30',
       (CURRENT_DATE - g * 3)::timestamp + time '15:36'
FROM generate_series(0, 5) g;

-- ════════════════════════════════════════════════════════════
-- 19. 多直播间实时快照（multi_room_status）
-- ════════════════════════════════════════════════════════════
INSERT INTO multi_room_status (
  room_id, online_users, realtime_gmv, total_views, status, conversion_rate,
  avg_order_value, snapshot_at
)
SELECT r,
       200 + r * 37,
       round(2000 + r * 850.5, 2),
       (300 + r * 40) * 30,
       CASE WHEN r <= 6 THEN 'live' ELSE 'offline' END,
       (2.5 + (r % 5) * 0.4)::numeric(5,2),
       (120 + r * 8)::numeric(10,2),
       now()
FROM generate_series(1, 12) r;

-- ════════════════════════════════════════════════════════════
-- 20. 竞品（competitor_brands / competitor_price_data）
-- ════════════════════════════════════════════════════════════
INSERT INTO competitor_brands (id, brand, industry, monitored_products, avg_price, estimated_sales, trend)
SELECT g,
       (ARRAY['品牌甲','品牌乙','品牌丙','品牌丁','品牌戊','品牌己'])[g],
       '服饰鞋包',
       8 + g * 2,
       (150 + g * 25) || ' 元',
       (1500 + g * 320) || ' 件/日',
       (ARRAY['up','stable','down'])[1 + (g % 3)]
FROM generate_series(1, 6) g;

INSERT INTO competitor_price_data (brand_id, label, ours, theirs, data_type)
SELECT b.g,
       (ARRAY['主推款 A','主推款 B','引流款','利润款'])[p.n],
       (129 + b.g * 10 + p.n * 5)::numeric(10,2),
       (139 + b.g * 9 + p.n * 6)::numeric(10,2),
       'price'
FROM generate_series(1, 6) b(g), generate_series(1, 4) p(n);

-- ════════════════════════════════════════════════════════════
-- 21. 话术库 / 问题库 / 主播话术模板
-- ════════════════════════════════════════════════════════════
INSERT INTO script_library (title, category, content, use_count, likes)
SELECT (ARRAY[
         '开场留人话术', '产品卖点讲解模板', '价格锚点话术', '催单话术',
         '互动引导话术', '整点抽奖话术', '下场预告话术', '售后保障话术',
         '新品首发话术', '清库存话术'
       ])[g],
       (ARRAY['开场','讲解','转化','互动'])[1 + (g % 4)],
       '这是一个演示话术模板，可根据实际业务场景替换。',
       10 + g * 7, 3 + g * 2
FROM generate_series(1, 10) g;

INSERT INTO issue_library (title, category, solution, occurrence_count, detailed_solution)
SELECT (ARRAY[
         '直播间突然掉流量', '商品链接点击率低', '退款率偏高', '观众停留时间短',
         '下单转化率低', '评论区负面反馈', '主播状态不佳', '直播间违规提示'
       ])[g],
       (ARRAY['流量','转化','售后','内容'])[1 + (g % 4)],
       '演示解决方案：排查原因并调整运营策略。',
       3 + g * 2,
       '演示详细方案：1）定位问题；2）制定对策；3）复盘验证。'
FROM generate_series(1, 8) g;

INSERT INTO anchor_script_templates (category, title, scenario, content, usage_count, last_used)
SELECT (ARRAY['开场','讲解','转化','互动'])[1 + (g % 4)],
       '主播话术模板 ' || lpad(g::text, 2, '0'),
       '日常直播场景',
       '演示话术内容，可替换为真实话术。',
       5 + g * 3,
       CURRENT_DATE - g
FROM generate_series(1, 8) g;

-- ════════════════════════════════════════════════════════════
-- 22. 主播能力与成长（anchor_capabilities / anchor_rankings）
-- ════════════════════════════════════════════════════════════
INSERT INTO anchor_capabilities (
  anchor_id, expression, interaction, conversion, professionalism, overall, evaluated_at
)
SELECT a, s.e, s.i, s.c, s.p, round((s.e + s.i + s.c + s.p) / 4.0)::smallint, CURRENT_DATE
FROM generate_series(1, 20) a
CROSS JOIN LATERAL (
  SELECT (60 + (a * 7) % 35)::smallint AS e,
         (58 + (a * 5) % 38)::smallint AS i,
         (55 + (a * 11) % 40)::smallint AS c,
         (62 + (a * 3) % 33)::smallint AS p
) s;

INSERT INTO anchor_rankings (
  anchor_id, overall, expression, interaction, conversion, professionalism, rank_date
)
SELECT ac.anchor_id, ac.overall, ac.expression, ac.interaction, ac.conversion,
       ac.professionalism, CURRENT_DATE
FROM anchor_capabilities ac;

-- ════════════════════════════════════════════════════════════
-- 23. 主播培训（anchor_training_plans / anchor_training_records）
-- ════════════════════════════════════════════════════════════
INSERT INTO anchor_training_plans (id, name, anchor_count, start_date, end_date, progress, status) VALUES
  (1, '新人主播 21 天成长营', 6, CURRENT_DATE - 14, CURRENT_DATE + 7,  65, 'in_progress'),
  (2, '大促冲刺话术特训',     8, CURRENT_DATE - 3,  CURRENT_DATE + 10, 30, 'in_progress'),
  (3, '主播镜头表现力进阶',   4, CURRENT_DATE - 45, CURRENT_DATE - 15, 100, 'completed');

INSERT INTO anchor_training_records (plan_id, anchor_name, date, project, duration_hours, completion, score)
SELECT 1 + (g % 3),
       (ARRAY['沈知夏','林清和','苏沐春','陆星野','叶南音','顾清欢'])[1 + (g % 6)],
       CURRENT_DATE - (g % 20),
       (ARRAY['开场留人训练','产品讲解演练','逼单转化演练','互动控场训练'])[1 + (g % 4)],
       (1.5 + (g % 3))::numeric(4,1),
       (ARRAY['full','partial','absent'])[1 + (g % 3)],
       60 + (g * 7) % 40
FROM generate_series(0, 11) g;

-- ════════════════════════════════════════════════════════════
-- 24. 场次排期（session_plans / session_plan_products）
-- ════════════════════════════════════════════════════════════
INSERT INTO session_plans (id, room_id, plan_date, anchor_id, notes)
SELECT (r - 1) * 7 + d, r, CURRENT_DATE + d, r + (d % 3),
       '演示排期备注'
FROM generate_series(1, 3) r, generate_series(1, 7) d;

INSERT INTO session_plan_products (plan_id, group_letter, product_code, price)
SELECT sp.id, p.letter, 'P' || lpad((sp.id * 10 + p.n)::text, 5, '0'),
       (99 + p.n * 40)::numeric(10,2)
FROM session_plans sp
CROSS JOIN (VALUES (1, 'A'), (2, 'B'), (3, 'C'), (4, 'D')) AS p(n, letter);

-- ════════════════════════════════════════════════════════════
-- 25. 抖音渠道 / 主播日报（douyin_channel_daily_metrics / douyin_anchor_daily_metrics）
--     近 30 天
-- ════════════════════════════════════════════════════════════
INSERT INTO douyin_channel_daily_metrics (
  business_date, channel_name, live_duration_seconds, avg_watch_seconds, impressions, viewers,
  interactions, new_followers, product_impressions, product_clicks, order_count, buyer_count,
  payment_amount, item_count, thousand_view_payment, avg_order_value,
  ad_cost_bound, ad_cost_promoted
)
SELECT CURRENT_DATE - d,
       c.channel,
       7200,
       50 + (d * 3 + c.n) % 60,
       (20000 + d * 150 + c.n * 3000)::bigint,
       (8000 + d * 90 + c.n * 1200)::bigint,
       (1200 + d * 20 + c.n * 200)::bigint,
       40 + (d + c.n) % 60,
       (15000 + d * 120 + c.n * 2000)::bigint,
       (1500 + d * 15 + c.n * 150)::bigint,
       40 + (d * 2 + c.n * 3) % 60,
       35 + (d + c.n * 2) % 50,
       (12000 + d * 260 + c.n * 1800)::numeric(14,2),
       6,
       (12000 + d * 260 + c.n * 1800)::numeric(14,2) / 40,
       (12000 + d * 260 + c.n * 1800)::numeric(14,2) / GREATEST(40 + (d * 2 + c.n * 3) % 60, 1),
       (2000 + d * 30)::numeric(14,2),
       (1500 + d * 20)::numeric(14,2)
FROM generate_series(0, 29) d
CROSS JOIN (VALUES (1, '自然流量'), (2, '付费流量'), (3, '短视频'), (4, '搜索')) AS c(n, channel);

INSERT INTO douyin_anchor_daily_metrics (
  business_date, account_name, anchor_name, anchor_id, live_duration_seconds, payment_amount,
  hourly_payment, peak_online, avg_online, avg_item_price, exposure_view_rate, retention_rate,
  interaction_rate, new_followers, watch_follow_rate, group_joiners, uv_value,
  buyers, strategy_audience_top3, gender_top3, age_top3, city_tier_top3, region_top3
)
SELECT CURRENT_DATE - d,
       '云梭官方账号',
       a.name,
       a.id,
       7200 + d * 60,
       (8000 + ((a.id * 53 + d * 71) % 20000))::numeric(14,2),
       round((8000 + ((a.id * 53 + d * 71) % 20000)) / 2.5, 2),
       260 + (a.id * 13 + d * 7) % 600,
       round((260 + (a.id * 13 + d * 7) % 600) * 0.55)::int,
       (120 + (a.id * 7 + d) % 80)::numeric(14,2),
       ((14 + (a.id + d) % 26) / 100.0)::numeric(8,6),
       ((9 + (a.id * 2 + d) % 18) / 100.0)::numeric(8,6),
       ((3 + (a.id + d * 2) % 12) / 100.0)::numeric(8,6),
       20 + (a.id * 5 + d * 3) % 120,
       ((1 + (a.id + d) % 5) / 100.0)::numeric(8,6),
       5 + (a.id * 3 + d) % 30,
       round((8000 + ((a.id * 53 + d * 71) % 20000)) / (260 + (a.id * 13 + d * 7) % 600) / 30, 2),
       round((8000 + ((a.id * 53 + d * 71) % 20000)) / (120 + (a.id * 7 + d) % 80) * 0.9)::int,
       '都市白领,精致妈妈,新锐青年',
       '女性 78%,男性 22%',
       '25-34 岁 46%,18-24 岁 24%,35-44 岁 20%',
       '一线 32%,新一线 28%,二线 22%',
       '广东 18%,浙江 12%,江苏 10%'
FROM generate_series(0, 29) d
CROSS JOIN anchors a;

-- ════════════════════════════════════════════════════════════
-- 26. 重置自增序列
-- ════════════════════════════════════════════════════════════
SELECT setval('operators_id_seq',                  (SELECT COALESCE(MAX(id), 1) FROM operators));
SELECT setval('anchors_id_seq',                     (SELECT COALESCE(MAX(id), 1) FROM anchors));
SELECT setval('live_rooms_id_seq',                  (SELECT COALESCE(MAX(id), 1) FROM live_rooms));
SELECT setval('live_sessions_id_seq',               (SELECT COALESCE(MAX(id), 1) FROM live_sessions));
SELECT setval('session_live_basic_info_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM session_live_basic_info));
SELECT setval('session_overview_metrics_id_seq',    (SELECT COALESCE(MAX(id), 1) FROM session_overview_metrics));
SELECT setval('session_channel_metrics_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM session_channel_metrics));
SELECT setval('session_product_details_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM session_product_details));
SELECT setval('session_short_video_traffic_id_seq', (SELECT COALESCE(MAX(id), 1) FROM session_short_video_traffic));
SELECT setval('session_anchor_metrics_id_seq',      (SELECT COALESCE(MAX(id), 1) FROM session_anchor_metrics));
SELECT setval('room_health_id_seq',                 (SELECT COALESCE(MAX(id), 1) FROM room_health));
SELECT setval('overview_daily_stats_id_seq',        (SELECT COALESCE(MAX(id), 1) FROM overview_daily_stats));
SELECT setval('overview_activities_id_seq',         (SELECT COALESCE(MAX(id), 1) FROM overview_activities));
SELECT setval('alert_events_id_seq',                (SELECT COALESCE(MAX(id), 1) FROM alert_events));
SELECT setval('improvement_tasks_id_seq',           (SELECT COALESCE(MAX(id), 1) FROM improvement_tasks));
SELECT setval('promotions_id_seq',                  (SELECT COALESCE(MAX(id), 1) FROM promotions));
SELECT setval('goal_tracking_id_seq',               (SELECT COALESCE(MAX(id), 1) FROM goal_tracking));
SELECT setval('data_uploads_id_seq',                (SELECT COALESCE(MAX(id), 1) FROM data_uploads));
SELECT setval('data_exports_id_seq',                (SELECT COALESCE(MAX(id), 1) FROM data_exports));
SELECT setval('multi_room_status_id_seq',           (SELECT COALESCE(MAX(id), 1) FROM multi_room_status));
SELECT setval('competitor_brands_id_seq',           (SELECT COALESCE(MAX(id), 1) FROM competitor_brands));
SELECT setval('competitor_price_data_id_seq',       (SELECT COALESCE(MAX(id), 1) FROM competitor_price_data));
SELECT setval('script_library_id_seq',              (SELECT COALESCE(MAX(id), 1) FROM script_library));
SELECT setval('issue_library_id_seq',               (SELECT COALESCE(MAX(id), 1) FROM issue_library));
SELECT setval('anchor_script_templates_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM anchor_script_templates));
SELECT setval('anchor_capabilities_id_seq',         (SELECT COALESCE(MAX(id), 1) FROM anchor_capabilities));
SELECT setval('anchor_rankings_id_seq',             (SELECT COALESCE(MAX(id), 1) FROM anchor_rankings));
SELECT setval('anchor_training_plans_id_seq',       (SELECT COALESCE(MAX(id), 1) FROM anchor_training_plans));
SELECT setval('anchor_training_records_id_seq',     (SELECT COALESCE(MAX(id), 1) FROM anchor_training_records));
SELECT setval('session_plans_id_seq',               (SELECT COALESCE(MAX(id), 1) FROM session_plans));
SELECT setval('session_plan_products_id_seq',       (SELECT COALESCE(MAX(id), 1) FROM session_plan_products));
SELECT setval('douyin_channel_daily_metrics_id_seq',(SELECT COALESCE(MAX(id), 1) FROM douyin_channel_daily_metrics));
SELECT setval('douyin_anchor_daily_metrics_id_seq', (SELECT COALESCE(MAX(id), 1) FROM douyin_anchor_daily_metrics));

COMMIT;
