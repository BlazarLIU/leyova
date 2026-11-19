-- ============================================================================
-- 迁移 124：移除京东（jd）与拼多多（pdd）平台
-- ----------------------------------------------------------------------------
-- 背景：Leyova 定位收敛为「只做直播电商」，平台范围精简为
--       抖音 douyin / 快手 kuaishou / 淘宝 taobao / 天猫 tmall / 小红书 xiaohongshu
-- 影响：代码侧（路由/平台注册/治理适配器/合规采集器/前端页面）已于同批移除
-- 本迁移只负责数据侧清理，全程幂等，可重复执行
--
-- 安全前提（执行前必须为 0，否则停止）：
--   SELECT count(*) FROM fact_trade_daily
--    WHERE platform_code IN ('jd','pdd') AND is_demo = false;
--
-- 备份：/home/leyova/.backup/jd_pdd_pre_remove_<TS>.dump
-- ============================================================================

-- 事务由执行器管理（migrate.js 自带 BEGIN/COMMIT；psql 手工执行请加 -1）

-- ────────────────────────────────────────────────────────────────
-- 0. 幂等保护：若存在非 demo 真实数据则中止整个事务
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_non_demo bigint;
BEGIN
  SELECT count(*) INTO v_non_demo
    FROM public.fact_trade_daily
   WHERE platform_code IN ('jd','pdd') AND is_demo = false;

  IF v_non_demo > 0 THEN
    RAISE EXCEPTION
      '检测到 jd/pdd 的非 demo 真实交易数据 % 行，已中止迁移。请先人工确认归档策略。', v_non_demo;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 1. 平台专属表整表清空
-- ────────────────────────────────────────────────────────────────
-- 2026-11-17：jd/pdd 专属表在更早的 schema 收敛中已删除，加 DO 块做存在性保护，
-- 使本迁移可重复执行（reset-demo-v2.sh 每次都会跑它）。
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='jd_purchase_order') THEN
    TRUNCATE TABLE public.jd_purchase_order;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='pdd_group_buy') THEN
    TRUNCATE TABLE public.pdd_group_buy;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='fact_jd_settlement_fees') THEN
    TRUNCATE TABLE public.fact_jd_settlement_fees;
  END IF;
END $guard$;

-- ────────────────────────────────────────────────────────────────
-- 2. 按 platform_code 清理事实表（分区父表 DELETE 自动路由到分区）
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.fact_trade_daily           WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_traffic_daily         WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_ad_spend_daily        WHERE platform_code IN ('jd','pdd');
-- 注：fact_ad_daily 是视图（基于 fact_ad_spend_daily），删除基表数据后自动为空，不可直接 DELETE。
DELETE FROM public.fact_search_keyword_daily  WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_settlement_cycles     WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_fulfillment_waybill   WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_after_sale_tickets    WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_cs_session            WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_kol_cooperation       WHERE platform_code IN ('jd','pdd');
DELETE FROM public.fact_content_daily         WHERE platform_code IN ('jd','pdd');
DELETE FROM public.platform_members_summary   WHERE platform_code IN ('jd','pdd');
DELETE FROM public.content_attribution_ledger WHERE platform_code IN ('jd','pdd');
DELETE FROM public.content_schedules          WHERE platform_code IN ('jd','pdd');
DELETE FROM public.agg_shop_daily             WHERE platform_code IN ('jd','pdd');
DELETE FROM public.pricing_rules              WHERE platform_code IN ('jd','pdd');
-- 2026-11-17：以下表在 schema 收敛中已删除，加存在性保护使迁移可重复执行。
DO $guard2$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='cost_entries') THEN
    DELETE FROM public.cost_entries WHERE platform_code IN ('jd','pdd');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='compliance_rule_snapshot') THEN
    DELETE FROM public.compliance_rule_snapshot WHERE platform_code IN ('jd','pdd');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='compliance_rule_change') THEN
    DELETE FROM public.compliance_rule_change WHERE platform_code IN ('jd','pdd');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='compliance_activity_reminder') THEN
    DELETE FROM public.compliance_activity_reminder WHERE platform_code IN ('jd','pdd');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='dim_sku_mapping') THEN
    DELETE FROM public.dim_sku_mapping WHERE platform_code IN ('jd','pdd');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='dim_cs_agent') THEN
    DELETE FROM public.dim_cs_agent WHERE platform_code IN ('jd','pdd');
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='dim_kol') THEN
    DELETE FROM public.dim_kol WHERE platform_code IN ('jd','pdd');
  END IF;
END $guard2$;

-- ────────────────────────────────────────────────────────────────
-- 2b. 直播间 / 主播（jd/pdd 的场次 platform_code 为 NULL，必须先按 room_id 清场次）
--     顺序：先清 NO ACTION 外键子表 → 再删场次（子表自动 CASCADE / SET NULL）
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.session_anchor_metrics
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('jd','pdd'))
    OR anchor_id IN (SELECT id FROM public.anchors WHERE platform_code IN ('jd','pdd'));

DELETE FROM public.session_plans
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('jd','pdd'));

DELETE FROM public.live_sessions
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('jd','pdd'));

DELETE FROM public.live_registrations
 WHERE room_id IN (SELECT id FROM public.live_rooms WHERE platform_code IN ('jd','pdd'))
    OR anchor_id IN (SELECT id FROM public.anchors WHERE platform_code IN ('jd','pdd'));

-- jd/pdd 主播：不删除（demo 数据中存在跨平台排班，live_sessions.anchor_id 仍引用它们）
-- 置 status=0 后，所有列表查询（a.status = 1）自然隐藏
UPDATE public.anchors SET status = 0 WHERE platform_code IN ('jd','pdd');

DELETE FROM public.live_rooms WHERE platform_code IN ('jd','pdd');

-- ────────────────────────────────────────────────────────────────
-- 3. 按 store_id / shop_id 清理（这些表无 platform_code 列）
--    注意：必须在 dim_shop 改为 inactive 之前完成，否则子查询取不到 id
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.canonical_order_items
 WHERE store_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('jd','pdd'));

DELETE FROM public.canonical_orders
 WHERE store_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('jd','pdd'));

DELETE FROM public.fact_inventory_stock
 WHERE shop_id IN (SELECT id FROM public.dim_shop WHERE platform_code IN ('jd','pdd'));

-- 注：fact_inventory_ledger 无 shop_id/platform_code 维度（仅 product_id + warehouse_code），
--     随 dim_sku_mapping 与 dim_product 的清理自然失去 jd/pdd 语义，不单独删除。

-- ────────────────────────────────────────────────────────────────
-- 4. 授权清理
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.role_platform_permissions WHERE platform_code IN ('jd','pdd');
DELETE FROM public.user_platform_permissions WHERE platform_code IN ('jd','pdd');

-- ────────────────────────────────────────────────────────────────
-- 5. dim_shop 停用而不删除
--    原因：22 张表以 ON DELETE CASCADE 引用 dim_shop，物理删除会连带清空
-- ────────────────────────────────────────────────────────────────
UPDATE public.dim_shop
   SET status = 'inactive'
 WHERE platform_code IN ('jd','pdd');

-- ────────────────────────────────────────────────────────────────
-- 6. 平台配置停用而不删除
--    原因：dim_shop.platform_code 有外键指向 system_platform_configs(platform_code)
-- ────────────────────────────────────────────────────────────────
UPDATE public.system_platform_configs
   SET is_enabled = false
 WHERE platform_code IN ('jd','pdd');

-- ────────────────────────────────────────────────────────────────
-- 7. 事务内自校验：任何残留都会让迁移失败
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left bigint;
BEGIN
  SELECT count(*) INTO v_left FROM public.fact_trade_daily WHERE platform_code IN ('jd','pdd');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'fact_trade_daily 仍残留 jd/pdd % 行', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.fact_traffic_daily WHERE platform_code IN ('jd','pdd');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'fact_traffic_daily 仍残留 jd/pdd % 行', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.role_platform_permissions WHERE platform_code IN ('jd','pdd');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'role_platform_permissions 仍残留 jd/pdd % 行', v_left;
  END IF;
END $$;


-- 迁移记录（migrate.js 会自行写入，此处保留说明以便手工执行时可查）
-- version: 124_remove_jd_pdd
