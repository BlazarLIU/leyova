-- ============================================================================
-- 迁移 125：接入视频号（微信小店）平台
-- ----------------------------------------------------------------------------
-- 背景：Leyova 平台范围确定为 5 个直播带货平台，其中「视频号」为新增接入项
--       抖音 / 快手 / 视频号 / 淘宝·天猫 / 小红书
-- 内容：平台注册 + 口径 + SLA + 投放工具
-- 幂等：全部 INSERT ... ON CONFLICT，可重复执行
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


-- version: 125_wechat_video_channel
