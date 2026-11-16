-- ============================================================================
-- 迁移 135（修正版）：补视频号渠道指标 + 清理 session_* 孤儿行（S7-B）
-- ----------------------------------------------------------------------------
-- 实测发现两处关键事实：
--   1. `session_channel_metrics` 360 行**全部是孤儿**（session_id 指向不存在的场次）
--   2. 该表唯一约束是 `UNIQUE (period_date, channel)` —— **不含 session_id**
--      → 表的语义是「天 × 渠道」，不是「场次 × 渠道」
--      → 一天多场直播时，渠道指标必须按天聚合，不能按场次逐条插入
--
-- 处理：
--   ① 清理全部孤儿渠道指标
--   ② 视频号按「日期 × 渠道」聚合补齐（14 天 × 5 渠道 = 70 行）
--      渠道结构体现视频号特征：
--        视频号推荐=公域 / 朋友点赞=社交裂变 / 社群+朋友圈+公众号=私域
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 清理孤儿渠道指标
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.session_channel_metrics scm
 WHERE NOT EXISTS (
   SELECT 1 FROM public.live_sessions s WHERE s.id = scm.session_id
 );

-- ────────────────────────────────────────────────────────────────
-- 2. 补视频号渠道指标（日期 × 渠道）
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.session_channel_metrics
 WHERE session_id IN (
   SELECT s.id FROM public.live_sessions s
     JOIN public.live_rooms r ON r.id = s.room_id
    WHERE r.platform_code = 'wechat'
 )
 OR period_date IN (
   SELECT DISTINCT s.date FROM public.live_sessions s
     JOIN public.live_rooms r ON r.id = s.room_id
    WHERE r.platform_code = 'wechat'
      AND s.date >= CURRENT_DATE - 13
 );

INSERT INTO public.session_channel_metrics
  (session_id, channel, avg_watch_sec, impressions, views, exposure_view_rate,
   interactions, view_interaction_rate, new_fans,
   product_impressions, product_clicks, product_click_rate, product_deal_rate,
   orders, buyer_count, gmv, item_count, gpm, avg_order_value, ad_spend, period_date)
SELECT
  day.session_id,
  ch.channel,
  ROUND(day.gmv / 3600.0)::int + ch.base_watch_sec                     AS avg_watch_sec,
  ROUND(day.gmv / ch.imp_divisor)::bigint                              AS impressions,
  ROUND(day.gmv / ch.view_divisor)::bigint                             AS views,
  ROUND(100.0 / ch.imp_divisor * 3.5, 2)                               AS exposure_view_rate,
  ROUND(day.gmv / 1200.0)::int                                         AS interactions,
  ch.interact_rate                                                     AS view_interaction_rate,
  ROUND(day.gmv / 2400.0 * ch.gmv_ratio)::int                          AS new_fans,
  ROUND(day.gmv / 96.0)::bigint                                        AS product_impressions,
  ROUND(day.gmv / 420.0 * ch.gmv_ratio)::bigint                        AS product_clicks,
  ROUND(100.0 / 12 * ch.gmv_ratio, 2)                                  AS product_click_rate,
  ROUND(100.0 / 30, 2)                                                 AS product_deal_rate,
  GREATEST(1, ROUND(day.orders * ch.gmv_ratio))::int                   AS orders,
  GREATEST(1, ROUND(day.orders * ch.gmv_ratio * 0.92))::int            AS buyer_count,
  ROUND(day.gmv * ch.gmv_ratio, 2)                                     AS gmv,
  GREATEST(1, ROUND(day.orders * ch.gmv_ratio))::int                   AS item_count,
  ROUND(day.gmv * ch.gmv_ratio / 1000.0 * 0.85, 2)                     AS gpm,
  ROUND(day.gmv * ch.gmv_ratio / GREATEST(day.orders * ch.gmv_ratio, 1), 2) AS avg_order_value,
  0                                                                    AS ad_spend,
  day.biz_date                                                         AS period_date
FROM (
  -- 按日期聚合视频号全部场次
  SELECT lb.business_date                       AS biz_date,
         MIN(lb.session_id)                      AS session_id,
         COALESCE(SUM(lb.payment_amount), 0)     AS gmv,
         COALESCE(SUM(lb.disposal_count), 0)     AS orders
    FROM public.session_live_basic_info lb
    JOIN public.live_sessions s ON s.id = lb.session_id
    JOIN public.live_rooms r ON r.id = s.room_id
   WHERE r.platform_code = 'wechat'
     AND lb.business_date >= CURRENT_DATE - 13
   GROUP BY lb.business_date
) AS day
CROSS JOIN (VALUES
  ('视频号推荐', 0.42::numeric, 48.0, 118.0, 92,  4.20::numeric),
  ('朋友点赞',   0.24::numeric, 60.0, 145.0, 138, 6.80::numeric),
  ('社群',       0.16::numeric, 72.0, 160.0, 165, 8.10::numeric),
  ('朋友圈',     0.11::numeric, 80.0, 175.0, 121, 5.60::numeric),
  ('公众号',     0.07::numeric, 96.0, 210.0, 108, 3.40::numeric)
) AS ch(channel, gmv_ratio, imp_divisor, view_divisor, base_watch_sec, interact_rate)
ON CONFLICT (period_date, channel) DO UPDATE
  SET session_id = EXCLUDED.session_id,
      gmv = EXCLUDED.gmv,
      views = EXCLUDED.views,
      impressions = EXCLUDED.impressions,
      orders = EXCLUDED.orders,
      buyer_count = EXCLUDED.buyer_count,
      avg_watch_sec = EXCLUDED.avg_watch_sec;

-- ────────────────────────────────────────────────────────────────
-- 3. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_orphan bigint;
  v_wechat bigint;
  v_channels int;
BEGIN
  SELECT count(*) INTO v_orphan FROM public.session_channel_metrics scm
    LEFT JOIN public.live_sessions s ON s.id = scm.session_id WHERE s.id IS NULL;
  IF v_orphan > 0 THEN
    RAISE EXCEPTION '渠道指标仍有孤儿行 % 条', v_orphan;
  END IF;

  SELECT count(*) INTO v_wechat
    FROM public.session_channel_metrics scm
    JOIN public.live_sessions s ON s.id = scm.session_id
    JOIN public.live_rooms r ON r.id = s.room_id
   WHERE r.platform_code = 'wechat';
  IF v_wechat < 60 THEN
    RAISE EXCEPTION '视频号渠道指标不足（实际 %，预期 70）', v_wechat;
  END IF;

  SELECT count(DISTINCT scm.channel) INTO v_channels
    FROM public.session_channel_metrics scm
    JOIN public.live_sessions s ON s.id = scm.session_id
    JOIN public.live_rooms r ON r.id = s.room_id
   WHERE r.platform_code = 'wechat';

  RAISE NOTICE 'S7-B 完成：孤儿已清，视频号渠道指标 % 条、覆盖 % 个渠道', v_wechat, v_channels;
END $$;

-- version: 135_wechat_channel_metrics
