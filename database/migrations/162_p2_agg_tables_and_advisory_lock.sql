-- database/migrations/162_p2_agg_tables_and_advisory_lock.sql
-- Master Plan §7.4 & §9 P2: 核心汇总层 agg_* 建设（看板直读加速，解决裸扫明细 7s 瓶颈）
BEGIN;

-- 1. 平台/渠道每日交易汇总表 agg_trade_day_platform_channel
CREATE TABLE IF NOT EXISTS public.agg_trade_day_platform_channel (
  id BIGSERIAL PRIMARY KEY,
  biz_date DATE NOT NULL,
  platform_code VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  channel_name VARCHAR(100) NOT NULL DEFAULT 'main',
  shop_id BIGINT REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  total_gmv NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_pay_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_order_count INT NOT NULL DEFAULT 0,
  total_buyer_count INT NOT NULL DEFAULT 0,
  total_refund_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_sales NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ad_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  overall_roi NUMERIC(8,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agg_platform_channel UNIQUE (biz_date, platform_code, channel_name, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_agg_plat_channel_date ON public.agg_trade_day_platform_channel(biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_agg_plat_channel_plat ON public.agg_trade_day_platform_channel(platform_code, shop_id);

-- 2. 直播间/场次维度每日流量与产销汇总表 agg_traffic_day_live
CREATE TABLE IF NOT EXISTS public.agg_traffic_day_live (
  id BIGSERIAL PRIMARY KEY,
  biz_date DATE NOT NULL,
  platform_code VARCHAR(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
  room_id INT REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  shop_id BIGINT REFERENCES public.dim_shop(id) ON DELETE SET NULL,
  session_count INT NOT NULL DEFAULT 0,
  total_duration_min INT NOT NULL DEFAULT 0,
  total_views BIGINT NOT NULL DEFAULT 0,
  total_buyers INT NOT NULL DEFAULT 0,
  peak_online_max INT NOT NULL DEFAULT 0,
  avg_online INT NOT NULL DEFAULT 0,
  total_gmv NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_gpm NUMERIC(10,2) NOT NULL DEFAULT 0,
  new_fans INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agg_traffic_live_idx 
  ON public.agg_traffic_day_live (biz_date, COALESCE(platform_code, '__all__'), COALESCE(room_id, 0), COALESCE(shop_id, 0));

CREATE INDEX IF NOT EXISTS idx_agg_traffic_live_date ON public.agg_traffic_day_live(biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_agg_traffic_live_room ON public.agg_traffic_day_live(room_id);

-- 3. RLS 强制安全隔离策略
ALTER TABLE public.agg_trade_day_platform_channel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agg_trade_day_platform_channel FORCE ROW LEVEL SECURITY;

ALTER TABLE public.agg_traffic_day_live ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agg_traffic_day_live FORCE ROW LEVEL SECURITY;

-- 允许用户按平台与店铺数据范围读取
DROP POLICY IF EXISTS p_agg_platform_channel_select ON public.agg_trade_day_platform_channel;
CREATE POLICY p_agg_platform_channel_select ON public.agg_trade_day_platform_channel
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    rls_has_platform(platform_code) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_agg_platform_channel_write ON public.agg_trade_day_platform_channel;
CREATE POLICY p_agg_platform_channel_write ON public.agg_trade_day_platform_channel
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']) AND
    rls_has_platform(platform_code) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']) AND
    rls_has_platform(platform_code) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_agg_traffic_live_select ON public.agg_traffic_day_live;
CREATE POLICY p_agg_traffic_live_select ON public.agg_traffic_day_live
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_agg_traffic_live_write ON public.agg_traffic_day_live;
CREATE POLICY p_agg_traffic_live_write ON public.agg_traffic_day_live
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']) AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']) AND
    (platform_code IS NULL OR rls_has_platform(platform_code)) AND
    (shop_id IS NULL OR rls_can_access_shop(shop_id))
  );

-- 4. 首次全量回填（从已有的 fact_trade_daily, fact_ad_spend_daily, live_sessions 聚合入库）
-- 回填 agg_trade_day_platform_channel
INSERT INTO public.agg_trade_day_platform_channel (
  biz_date, platform_code, channel_name, shop_id,
  total_gmv, total_pay_amount, total_order_count, total_buyer_count,
  total_refund_amount, net_sales, total_ad_spend, overall_roi, updated_at
)
SELECT
  f.biz_date,
  f.platform_code,
  COALESCE(f.channel_name, 'main') AS channel_name,
  f.shop_id,
  COALESCE(SUM(f.gmv), 0) AS total_gmv,
  COALESCE(SUM(f.pay_amount), 0) AS total_pay_amount,
  COALESCE(SUM(f.paid_order_count), 0)::int AS total_order_count,
  COALESCE(SUM(f.paid_buyer_count), 0)::int AS total_buyer_count,
  COALESCE(SUM(f.refund_amount), 0) AS total_refund_amount,
  COALESCE(SUM(f.gmv), 0) - COALESCE(SUM(f.refund_amount), 0) AS net_sales,
  COALESCE(MAX(ad.ad_spend), 0) AS total_ad_spend,
  CASE WHEN COALESCE(MAX(ad.ad_spend), 0) > 0
       THEN ROUND(COALESCE(SUM(f.gmv), 0) / MAX(ad.ad_spend), 2)
       ELSE 0 END AS overall_roi,
  now()
FROM public.fact_trade_daily f
JOIN public.platform_caliber_config pcc 
  ON pcc.platform_code = f.platform_code AND pcc.metric_code = 'gmv' AND pcc.is_default = true AND f.amount_type = pcc.amount_type
LEFT JOIN (
  SELECT biz_date, platform_code, shop_id, SUM(ad_spend) AS ad_spend
  FROM public.fact_ad_spend_daily
  GROUP BY biz_date, platform_code, shop_id
) ad ON ad.biz_date = f.biz_date AND ad.platform_code = f.platform_code AND ad.shop_id = f.shop_id
GROUP BY f.biz_date, f.platform_code, COALESCE(f.channel_name, 'main'), f.shop_id
ON CONFLICT (biz_date, platform_code, channel_name, shop_id) DO UPDATE SET
  total_gmv = EXCLUDED.total_gmv,
  total_pay_amount = EXCLUDED.total_pay_amount,
  total_order_count = EXCLUDED.total_order_count,
  total_buyer_count = EXCLUDED.total_buyer_count,
  total_refund_amount = EXCLUDED.total_refund_amount,
  net_sales = EXCLUDED.net_sales,
  total_ad_spend = EXCLUDED.total_ad_spend,
  overall_roi = EXCLUDED.overall_roi,
  updated_at = now();

-- 回填 agg_traffic_day_live
INSERT INTO public.agg_traffic_day_live (
  biz_date, platform_code, room_id, shop_id,
  session_count, total_duration_min, total_views, total_buyers,
  peak_online_max, avg_online, total_gmv, avg_gpm, new_fans, updated_at
)
SELECT
  ls.date AS biz_date,
  ls.platform_code,
  ls.room_id,
  s.id AS shop_id,
  COUNT(*)::int AS session_count,
  COALESCE(SUM(ls.duration_min), 0)::int AS total_duration_min,
  COALESCE(SUM(ls.views), 0)::bigint AS total_views,
  COALESCE(SUM(ls.buyer_count), 0)::int AS total_buyers,
  COALESCE(MAX(ls.online_peak), 0)::int AS peak_online_max,
  COALESCE(AVG(ls.avg_online), 0)::int AS avg_online,
  COALESCE(SUM(ls.gmv), 0) AS total_gmv,
  COALESCE(AVG(ls.gpm), 0) AS avg_gpm,
  COALESCE(SUM(ls.new_fans), 0)::int AS new_fans,
  now()
FROM public.live_sessions ls
LEFT JOIN public.dim_shop s ON s.platform_code = ls.platform_code
GROUP BY ls.date, ls.platform_code, ls.room_id, s.id
ON CONFLICT (biz_date, COALESCE(platform_code, '__all__'), COALESCE(room_id, 0), COALESCE(shop_id, 0)) DO UPDATE SET
  session_count = EXCLUDED.session_count,
  total_duration_min = EXCLUDED.total_duration_min,
  total_views = EXCLUDED.total_views,
  total_buyers = EXCLUDED.total_buyers,
  peak_online_max = EXCLUDED.peak_online_max,
  avg_online = EXCLUDED.avg_online,
  total_gmv = EXCLUDED.total_gmv,
  avg_gpm = EXCLUDED.avg_gpm,
  new_fans = EXCLUDED.new_fans,
  updated_at = now();

COMMIT;
