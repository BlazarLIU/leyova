-- ============================================================================
-- 迁移 220：彻底下线五平台（淘宝 taobao、天猫 tmall、小红书 xiaohongshu、京东 jd、拼多多 pdd）
-- ----------------------------------------------------------------------------
-- 目标：仅保留核心三平台（抖音 douyin、快手 kuaishou、视频号 wechat）
-- 覆盖范围：专属表清空、各事实表/子依赖清理、店铺与直播间下线、全动态遍历清理、平台配置收敛
-- ============================================================================

-- 0. 专属配置/中间表整表清空与守卫
DO $guard$
BEGIN
  IF to_regclass('public.taobao_order_hierarchy') IS NOT NULL THEN
    TRUNCATE TABLE public.taobao_order_hierarchy;
  END IF;
  IF to_regclass('public.xhs_note') IS NOT NULL THEN
    TRUNCATE TABLE public.xhs_note;
  END IF;
END $guard$;

-- 1. 先按平台与受限推广工具清理核心事实表（防止外键 RESTRICT）
DELETE FROM public.fact_ad_spend_daily
 WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo')
    OR ad_tool_code IN (SELECT code FROM public.ad_tool_dict WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

DELETE FROM public.fact_trade_daily WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_traffic_daily WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_search_keyword_daily WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_settlement_cycles WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_fulfillment_waybill WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_after_sale_tickets WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_cs_session WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_kol_cooperation WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_content_daily WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');
DELETE FROM public.fact_inventory_stock WHERE shop_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));
DELETE FROM public.fact_inventory_reservation WHERE shop_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));
DELETE FROM public.canonical_order_items WHERE store_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));
DELETE FROM public.canonical_orders WHERE store_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

-- 2. 清理场次、直播间、主播
DELETE FROM public.session_anchor_metrics
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'))
    OR anchor_id IN (SELECT id FROM public.anchors WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

DELETE FROM public.session_channel_metrics
 WHERE session_id IN (SELECT id FROM public.live_sessions WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo')));

DELETE FROM public.session_plans
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

DELETE FROM public.live_sessions
 WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo')
    OR room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

DELETE FROM public.live_registrations
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'))
    OR anchor_id IN (SELECT id FROM public.anchors WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

DELETE FROM public.live_rooms
 WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo')
    OR shop_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo'));

DELETE FROM public.anchors
 WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo') OR platform IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');

-- 3. 动态清理所有依赖 dim_shop 的其余表
DO $shop_dep$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_name, c.column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('shop_id', 'store_id')
      AND t.table_name NOT IN ('dim_shop')
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE %I IN (SELECT id FROM public.dim_shop WHERE platform_code IN (''taobao'',''tmall'',''xiaohongshu'',''淘宝'',''天猫'',''小红书'',''jd'',''pdd'',''jingdong'',''pinduoduo''))',
      r.table_name, r.column_name
    );
  END LOOP;
END $shop_dep$;

-- 4. 彻底物理删除 dim_shop 中的五平台店铺
DELETE FROM public.dim_shop
 WHERE platform_code IN ('taobao','tmall','xiaohongshu','淘宝','天猫','小红书','jd','pdd','jingdong','pinduoduo');

-- 5. 动态遍历 public schema 下所有含有 platform_code 或 platform 列的 BASE TABLE
DO $dyn$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_name, c.column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('platform_code', 'platform')
      AND t.table_name NOT IN ('system_platform_configs', 'dim_platform')
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE %I IN (''taobao'',''tmall'',''xiaohongshu'',''淘宝'',''天猫'',''小红书'',''jd'',''pdd'',''jingdong'',''pinduoduo'')',
      r.table_name, r.column_name
    );
  END LOOP;
END $dyn$;

-- 6. 清理权限表与平台系统配置
DELETE FROM public.role_platform_permissions WHERE platform_code NOT IN ('douyin', 'kuaishou', 'wechat');
DELETE FROM public.user_platform_permissions WHERE platform_code NOT IN ('douyin', 'kuaishou', 'wechat');
DELETE FROM public.system_platform_configs WHERE platform_code NOT IN ('douyin', 'kuaishou', 'wechat');

DO $dim_plat$
BEGIN
  IF to_regclass('public.dim_platform') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.dim_platform WHERE code NOT IN (''douyin'', ''kuaishou'', ''wechat'')';
  END IF;
END $dim_plat$;
