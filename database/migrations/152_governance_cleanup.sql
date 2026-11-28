-- ============================================================================
-- 迁移 152：治理清理（P2）
-- ----------------------------------------------------------------------------
-- 处理三类历史遗留：
--   1. jd/pdd 孤儿配置数据（平台已下线，S0 只清了事实表，配置/维度层残留）
--   2. 死表（0 行 + 代码 0 引用）→ 改 _deprecated_ 前缀观察，不直接 DROP
--   3. session_products 伪活死表（模块码在用，表本身无 SQL 访问）
--
-- 策略：先改名观察一版，确认无副作用后再 DROP。不用 DROP 是为了可回滚。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 清理 jd / pdd 孤儿配置
-- ────────────────────────────────────────────────────────────────
-- 保留 system_platform_configs 里的 2 行（状态为停用，是**正确的软停用记录**）
DELETE FROM public.platform_source_mapping   WHERE platform_code IN ('jd','pdd');
DELETE FROM public.platform_sla_config       WHERE platform_code IN ('jd','pdd');
DELETE FROM public.order_status_config       WHERE platform_code IN ('jd','pdd');
DELETE FROM public.platform_caliber_config   WHERE platform_code IN ('jd','pdd');

-- ────────────────────────────────────────────────────────────────
-- 2. 死表降级（改前缀，不 DROP）
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'fact_jd_settlement_fees',
    'jd_purchase_order',
    'pdd_group_buy',
    'tenant_subscriptions',
    'session_products'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename = t
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename = '_deprecated_' || t
      ) THEN
        EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, '_deprecated_' || t);
        RAISE NOTICE '已降级: % -> _deprecated_%', t, t;
      ELSE
        -- 当 01_schema.sql 已包含 _deprecated_* 表时，早期幂等迁移（106/112/120）会重建原表名，此处清理冗余副本
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
      END IF;
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_deprecated_session_products') THEN
    EXECUTE 'COMMENT ON TABLE public._deprecated_session_products IS ''伪活死表：模块码 session_products 仍在使用（前端导航/权限），但本表自 S2 起无任何 SQL 访问。实际排品数据在 session_plans + session_plan_products。观察一版后可 DROP''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_deprecated_fact_jd_settlement_fees') THEN
    EXECUTE 'COMMENT ON TABLE public._deprecated_fact_jd_settlement_fees IS ''京东已下线（S0），表 0 行 0 引用''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_deprecated_jd_purchase_order') THEN
    EXECUTE 'COMMENT ON TABLE public._deprecated_jd_purchase_order IS ''京东已下线（S0），表 0 行 0 引用''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_deprecated_pdd_group_buy') THEN
    EXECUTE 'COMMENT ON TABLE public._deprecated_pdd_group_buy IS ''拼多多已下线（S0），表 0 行 0 引用''';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_deprecated_tenant_subscriptions') THEN
    EXECUTE 'COMMENT ON TABLE public._deprecated_tenant_subscriptions IS ''多租户订阅功能未落地，表 0 行 0 引用''';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 3. 死视图降级
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v text;
  views text[] := ARRAY['anchor_rankings', 'v_schedule_by_role'];
BEGIN
  FOREACH v IN ARRAY views
  LOOP
    IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname = v)
       AND NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname = '_deprecated_' || v) THEN
      EXECUTE format('ALTER VIEW public.%I RENAME TO %I', v, '_deprecated_' || v);
      RAISE NOTICE '已降级视图: % -> _deprecated_%', v, v;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 4. 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_jd int; v_dep int; v_view int;
BEGIN
  SELECT count(*) INTO v_jd FROM public.platform_source_mapping WHERE platform_code IN ('jd','pdd');
  SELECT count(*) INTO v_dep FROM pg_tables t
   WHERE t.schemaname='public' AND t.tablename LIKE '_deprecated_%';
  SELECT count(*) INTO v_view FROM pg_views WHERE schemaname='public' AND viewname LIKE '_deprecated_%';

  IF v_jd > 0 THEN RAISE EXCEPTION 'jd/pdd 孤儿未清干净'; END IF;
  RAISE NOTICE '治理清理完成：降级表 % 个，降级视图 % 个', v_dep, v_view;
END $$;

-- version: 152_governance_cleanup
