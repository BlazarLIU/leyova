-- ============================================================================
-- 迁移 127：视频号演示场次数据补齐
-- ----------------------------------------------------------------------------
-- 背景：迁移 125 只写了 fact_trade_daily（交易事实），但 BI 面板
--       （/api/v1/bi/dashboard）与复盘数据源是 session_live_basic_info +
--       session_overview_metrics。缺场次数据 → 视频号在 BI 中不可见。
--
-- 本迁移为视频号 2 个直播间补 14 天场次数据（is_demo 语义，幂等）：
--   - session_live_basic_info：每店每天 1 场，共 28 场
--   - session_overview_metrics：与场次 1:1
--   - live_sessions：场次主表（BI/复盘 join 需要）
--
-- 数据生成：确定性伪随机（基于 room_id + 日期），不用 random()，保证幂等可复现
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 0. 幂等：先删视频号已有演示场次（按 room_id + 日期范围）
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.session_overview_metrics om
 WHERE om.room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat')
   AND om.business_date >= CURRENT_DATE - 13;

DELETE FROM public.session_live_basic_info lb
 WHERE lb.room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat')
   AND lb.business_date >= CURRENT_DATE - 13;

DELETE FROM public.live_sessions ls
 WHERE ls.room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat')
   AND ls.date >= CURRENT_DATE - 13;

-- ────────────────────────────────────────────────────────────────
-- 1. live_sessions（场次主表）
--    必填列：title / date / status / gmv / orders / online_peak / duration_min
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.live_sessions
  (room_id, anchor_id, title, date, start_time, end_time, status,
   gmv, orders, online_peak, duration_min, platform_code, data_source)
SELECT
  r.id,
  a.id,
  '视频号直播 ' || to_char(d, 'YYYY-MM-DD'),
  d::date,
  TIME '19:00',
  TIME '22:00',
  'completed',
  ROUND(base.gmv * (1 + (EXTRACT(DAY FROM d)::int % 7) * 0.012), 2)  AS gmv,
  (base.orders + (EXTRACT(DAY FROM d)::int % 5) * 3)                  AS orders,
  ROUND(base.gmv / 900.0)::int + 120                                  AS online_peak,
  180,
  'wechat',
  'legacy'
FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d
CROSS JOIN public.live_rooms r
JOIN LATERAL (
  SELECT id FROM public.anchors
   WHERE platform_code = 'wechat'
   ORDER BY id LIMIT 1
) a ON true
JOIN (
  VALUES
    ('视频号品牌自播厅', 42000::numeric, 260),
    ('视频号达人带货厅', 26800::numeric, 180)
) AS base(room_name, gmv, orders) ON base.room_name = r.name
WHERE r.platform_code = 'wechat';

-- ────────────────────────────────────────────────────────────────
-- 2. session_live_basic_info（场次基础指标）
--    payment_amount 与迁移 125 的「视频号直播」渠道 GMV 对齐
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.session_live_basic_info
  (session_id, room_id, business_date, live_date, live_start_time, live_end_time,
   live_duration_min, live_platform, fans_before_broadcast, payment_amount, gpm, disposal_count)
SELECT
  ls.id,
  r.id,
  d::date,
  d::date,
  TIME '19:00',
  TIME '22:00',
  180,
  'wechat',
  8000 + ((EXTRACT(DAY FROM d)::int * 137) % 4000)          AS fans_before_broadcast,
  ROUND(base.gmv * (1 + (EXTRACT(DAY FROM d)::int % 7) * 0.012), 2) AS payment_amount,
  ROUND(base.gmv / 1000.0 * 0.85, 2)                         AS gpm,
  (base.orders + (EXTRACT(DAY FROM d)::int % 5) * 3)         AS disposal_count
FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d
CROSS JOIN public.live_rooms r
JOIN public.live_sessions ls
  ON ls.room_id = r.id AND ls.date = d::date
JOIN (
  VALUES
    ('视频号品牌自播厅', 42000::numeric, 260),
    ('视频号达人带货厅', 26800::numeric, 180)
) AS base(room_name, gmv, orders) ON base.room_name = r.name
WHERE r.platform_code = 'wechat';

-- ────────────────────────────────────────────────────────────────
-- 3. session_overview_metrics（场次转化指标）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.session_overview_metrics
  (session_id, room_id, business_date,
   viewers, exposure_users, enter_users, avg_online, peak_online,
   product_exposure_users, product_click_users, product_click_persons, deal_users,
   avg_watch_seconds, avg_order_value, conversion_rate, product_click_deal_rate,
   refund_amount, refund_orders, new_followers)
SELECT
  lb.session_id,
  lb.room_id,
  lb.business_date,
  ROUND(lb.payment_amount / 62.0)::int                       AS viewers,
  ROUND(lb.payment_amount / 48.0)::int                       AS exposure_users,
  ROUND(lb.payment_amount / 118.0)::int                      AS enter_users,
  ROUND(lb.payment_amount / 3600.0)::int                     AS avg_online,
  ROUND(lb.payment_amount / 900.0)::int                      AS peak_online,
  ROUND(lb.payment_amount / 96.0)::int                       AS product_exposure_users,
  ROUND(lb.payment_amount / 420.0)::int                      AS product_click_users,
  ROUND(lb.payment_amount / 450.0)::int                      AS product_click_persons,
  lb.disposal_count                                          AS deal_users,
  115 + ((EXTRACT(DAY FROM lb.business_date)::int * 7) % 45) AS avg_watch_seconds,
  ROUND(lb.payment_amount / GREATEST(lb.disposal_count, 1), 2) AS avg_order_value,
  ROUND(lb.disposal_count::numeric * 100.0 / GREATEST(ROUND(lb.payment_amount / 118.0), 1), 2) AS conversion_rate,
  ROUND(lb.disposal_count::numeric * 100.0 / GREATEST(ROUND(lb.payment_amount / 420.0), 1), 2) AS product_click_deal_rate,
  ROUND(lb.payment_amount * 0.062, 2)                        AS refund_amount,
  GREATEST(1, ROUND(lb.disposal_count * 0.062))              AS refund_orders,
  ROUND(lb.payment_amount / 2400.0)::int                     AS new_followers
FROM public.session_live_basic_info lb
WHERE lb.room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat')
  AND lb.business_date >= CURRENT_DATE - 13;

-- ────────────────────────────────────────────────────────────────
-- 4. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sessions int;
  v_basic int;
  v_metrics int;
  v_orphan int;
BEGIN
  SELECT count(*) INTO v_sessions FROM public.live_sessions
   WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat');

  SELECT count(*) INTO v_basic FROM public.session_live_basic_info
   WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat')
     AND business_date >= CURRENT_DATE - 13;

  SELECT count(*) INTO v_metrics FROM public.session_overview_metrics
   WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code = 'wechat')
     AND business_date >= CURRENT_DATE - 13;

  SELECT count(*) INTO v_orphan FROM public.session_live_basic_info lb
    LEFT JOIN public.live_rooms r ON r.id = lb.room_id WHERE r.id IS NULL;

  RAISE NOTICE '视频号场次：sessions=%, basic=%, metrics=%', v_sessions, v_basic, v_metrics;

  IF v_sessions < 26 THEN
    RAISE EXCEPTION '视频号场次不足（实际 %，预期 28）', v_sessions;
  END IF;
  IF v_basic <> v_metrics THEN
    RAISE EXCEPTION '视频号场次基础表与指标表行数不一致（basic=%, metrics=%）', v_basic, v_metrics;
  END IF;
  IF v_orphan > 0 THEN
    RAISE EXCEPTION '清理后又出现孤儿行 % 条', v_orphan;
  END IF;
END $$;

-- version: 127_wechat_session_demo
