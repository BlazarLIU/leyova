-- ============================================================================
-- 迁移 125：接入视频号（微信小店）平台
-- ----------------------------------------------------------------------------
-- 背景：Leyova 平台范围确定为 5 个直播带货平台，其中「视频号」为新增接入项
--       抖音 / 快手 / 视频号 / 淘宝·天猫 / 小红书
-- 内容：平台注册 + 口径 + SLA + 投放工具 + 演示店铺与最小演示事实
-- 幂等：全部 INSERT ... ON CONFLICT / WHERE NOT EXISTS，可重复执行
--
-- 说明：本迁移只铺「最小演示集」（14 天 × 2 店），
--       完整 90 天视频号数据需演示数据生成器（generate-demo-v2.mjs）支持后再补，
--       避免用假数据冒充完整数据集。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 平台注册
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.system_platform_configs (platform_code, platform_name, category, is_enabled, sort_order, icon)
VALUES ('wechat', '视频号小店', 'live', true, 3, 'MessageCircle')
ON CONFLICT (platform_code) DO UPDATE
  SET platform_name = EXCLUDED.platform_name,
      category      = EXCLUDED.category,
      sort_order    = EXCLUDED.sort_order,
      is_enabled    = true,
      updated_at    = now();

-- 其余平台顺延排序，保证「抖音 → 快手 → 视频号 → 淘宝 → 天猫 → 小红书」
UPDATE public.system_platform_configs SET sort_order = 4 WHERE platform_code = 'taobao';
UPDATE public.system_platform_configs SET sort_order = 5 WHERE platform_code = 'tmall';
UPDATE public.system_platform_configs SET sort_order = 6 WHERE platform_code = 'jd';
UPDATE public.system_platform_configs SET sort_order = 7 WHERE platform_code = 'pdd';
UPDATE public.system_platform_configs SET sort_order = 8 WHERE platform_code = 'xiaohongshu';

-- ────────────────────────────────────────────────────────────────
-- 2. 成交口径（微信小店只有单一实付口径，无抖快式多口径分层）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.platform_caliber_config
  (platform_code, metric_code, amount_type, attribution_window_hours, attribution_type, is_default, display_note)
VALUES
  ('wechat', 'gmv', 'gross_paid', NULL, 'last_click', true,
   '微信小店单一成交口径：订单实付金额，未剔除退款；视频号直播 / 视频号短视频 / 公众号 / 社群朋友圈全域成交合并统计')
ON CONFLICT (platform_code, metric_code, amount_type) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 3. 履约 SLA（微信小店为商家承诺制，平台无统一强制时效）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.platform_sla_config
  (platform_code, sla_type, sla_name, threshold_hours, business_hours_only, business_hour_start, business_hour_end,
   penalty_note, is_verified, pickup_threshold_hours, penalty_fixed_amount, penalty_rate, penalty_min_amount, penalty_max_amount)
VALUES
  ('wechat', 'ship', '视频号小店 48h 发货（商家承诺制）', 48, false, NULL, NULL,
   '微信小店无平台统一强制发货时效，以商家在商品/店铺页承诺时效为准；承诺 48h 的须在 48h 内出物流单号', false, 0, 0, 0, 0, 0),
  ('wechat', 'aftersale_only_refund_audit', '视频号仅退款审核时限', 48, false, NULL, NULL,
   '仅退款申请需在 48h 内完成商家自审，超时买家可申请平台介入', false, 0, 0, 0, 0, 0),
  ('wechat', 'aftersale_return_audit', '视频号退货退款审核时限', 72, false, NULL, NULL,
   '退货退款申请需在 72h 内响应，超时按平台默认规则处理', false, 0, 0, 0, 0, 0)
ON CONFLICT (platform_code, sla_type) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. 投放工具（微信广告 ADQ）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.ad_tool_dict
  (code, name, platform_code, default_attribution_hours, has_indirect, description,
   impression_window_hours, supported_windows, settlement_cycle_days, is_verified)
VALUES
  ('wechat_ad', '微信广告(ADQ)', 'wechat', 168, false,
   '视频号直播间与短视频投流，主投形式为直播预约、直播间引流与短视频加热；归因以 7 天点击为主',
   24, '7d点击 + 1d曝光', 30, false)
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 5. 演示店铺 / 直播间 / 主播（最小集，is_demo 语义）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.dim_shop
  (platform_code, shop_name, external_shop_id, status, auth_status, auth_token_info, extra,
   business_mode, shop_type, tenant_id)
SELECT 'wechat', '视频号品牌自播旗舰店', NULL, 'active', 'manual_only', '{}'::jsonb, '{}'::jsonb,
       'brand_self', 'wechat_flagship', 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.dim_shop WHERE platform_code = 'wechat' AND shop_name = '视频号品牌自播旗舰店'
);

INSERT INTO public.dim_shop
  (platform_code, shop_name, external_shop_id, status, auth_status, auth_token_info, extra,
   business_mode, shop_type, tenant_id)
SELECT 'wechat', '视频号达人带货专营店', NULL, 'active', 'manual_only', '{}'::jsonb, '{}'::jsonb,
       'kol_distribution', 'wechat_specialty', 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.dim_shop WHERE platform_code = 'wechat' AND shop_name = '视频号达人带货专营店'
);

-- 直播间（每个店 1 个）
INSERT INTO public.live_rooms (name, platform, platform_code, shop_id, status)
SELECT '视频号品牌自播厅', 'wechat', 'wechat', s.id, 'active'
FROM public.dim_shop s
WHERE s.platform_code = 'wechat' AND s.shop_name = '视频号品牌自播旗舰店'
  AND NOT EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.platform_code = 'wechat' AND r.name = '视频号品牌自播厅');

INSERT INTO public.live_rooms (name, platform, platform_code, shop_id, status)
SELECT '视频号达人带货厅', 'wechat', 'wechat', s.id, 'active'
FROM public.dim_shop s
WHERE s.platform_code = 'wechat' AND s.shop_name = '视频号达人带货专营店'
  AND NOT EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.platform_code = 'wechat' AND r.name = '视频号达人带货厅');

-- 主播
INSERT INTO public.anchors (name, platform, platform_code, level, status)
SELECT '沈知微', 'wechat', 'wechat', 'A级', 1
WHERE NOT EXISTS (SELECT 1 FROM public.anchors WHERE platform_code = 'wechat' AND name = '沈知微');

INSERT INTO public.anchors (name, platform, platform_code, level, status)
SELECT '顾南舟', 'wechat', 'wechat', 'B级', 1
WHERE NOT EXISTS (SELECT 1 FROM public.anchors WHERE platform_code = 'wechat' AND name = '顾南舟');

-- ────────────────────────────────────────────────────────────────
-- 6. 最小演示交易事实（14 天 × 2 店 × 4 场景，is_demo = true）
--    先删后插，保证幂等
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.fact_trade_daily
 WHERE platform_code = 'wechat' AND is_demo = true;

INSERT INTO public.fact_trade_daily
  (biz_date, platform_code, shop_id, channel_name, gmv, pay_amount, paid_order_count, paid_buyer_count,
   refund_amount, refund_count, source, amount_type, is_demo)
SELECT
  d::date,
  'wechat',
  s.id,
  ch.channel_name,
  ROUND(ch.base_gmv * (1 + (EXTRACT(DAY FROM d)::int % 7) * 0.012), 2) AS gmv,
  ROUND(ch.base_gmv * (1 + (EXTRACT(DAY FROM d)::int % 7) * 0.012) * 0.92, 2) AS pay_amount,
  (ch.base_orders + (EXTRACT(DAY FROM d)::int % 5) * 3) AS paid_order_count,
  (ch.base_orders + (EXTRACT(DAY FROM d)::int % 5) * 2) AS paid_buyer_count,
  ROUND(ch.base_gmv * ch.refund_ratio, 2) AS refund_amount,
  GREATEST(1, ROUND(ch.base_orders * ch.refund_ratio)) AS refund_count,
  'api',
  'gross_paid',
  true
FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, interval '1 day') AS d
CROSS JOIN (
  VALUES
    ('视频号品牌自播旗舰店', '视频号直播',   42000::numeric, 260, 0.062, 0.00),
    ('视频号品牌自播旗舰店', '视频号短视频', 12500::numeric,  95, 0.048, 0.00),
    ('视频号品牌自播旗舰店', '公众号',        4200::numeric,  34, 0.031, 0.00),
    ('视频号品牌自播旗舰店', '社群/朋友圈',   8800::numeric,  71, 0.055, 0.00),
    ('视频号达人带货专营店', '视频号直播',   26800::numeric, 180, 0.088, 0.00),
    ('视频号达人带货专营店', '视频号短视频',  9600::numeric,  78, 0.074, 0.00),
    ('视频号达人带货专营店', '公众号',        2600::numeric,  22, 0.042, 0.00),
    ('视频号达人带货专营店', '社群/朋友圈',   5400::numeric,  46, 0.067, 0.00)
) AS ch(shop_name, channel_name, base_gmv, base_orders, refund_ratio, _pad)
JOIN public.dim_shop s
  ON s.platform_code = 'wechat' AND s.shop_name = ch.shop_name;

-- ────────────────────────────────────────────────────────────────
-- 7. 事务内自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_platform int;
  v_shop int;
  v_fact int;
BEGIN
  SELECT count(*) INTO v_platform FROM public.system_platform_configs WHERE platform_code = 'wechat';
  IF v_platform <> 1 THEN
    RAISE EXCEPTION '视频号平台注册失败（system_platform_configs 行数=%）', v_platform;
  END IF;

  SELECT count(*) INTO v_shop FROM public.dim_shop WHERE platform_code = 'wechat';
  IF v_shop < 2 THEN
    RAISE EXCEPTION '视频号演示店铺不足 2 家（实际=%）', v_shop;
  END IF;

  SELECT count(*) INTO v_fact FROM public.fact_trade_daily WHERE platform_code = 'wechat' AND is_demo = true;
  IF v_fact < 100 THEN
    RAISE EXCEPTION '视频号演示交易事实不足（实际=%）', v_fact;
  END IF;
END $$;

-- version: 125_wechat_video_channel
