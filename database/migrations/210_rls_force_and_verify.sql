-- ============================================================================
-- 210_rls_force_and_verify.sql
--
-- RLS 190 张表补齐计划第 210 号迁移：FORCE 白名单 + 覆盖校验视图 + 回滚说明。
--
-- 访问路径审计结论（2026-11-22）：
--   - 仅经 withRlsContext / withSystemRlsContext 访问，纳入 FORCE 白名单：
--       content_tasks, session_plan_products, import_batches, publish_runs,
--       canonical_orders, canonical_order_items, canonical_refund_events
--   - 仍存在 getPool() owner 直连，本批保持 ENABLE 不 FORCE（登记技术债）：
--       content_assets     -> apps/api/src/media/service.ts
--       data_uploads       -> apps/api/src/cron/detect-anomalies.ts
--       fact_trade_daily   -> cron/aggregate-facts.ts, ingest/douyin-bridge.ts,
--                             ai/semantic-layer.ts, platform/*-analytics.ts
--       fact_traffic_daily -> cron/aggregate-facts.ts, ingest/douyin-bridge.ts,
--                             ai/semantic-layer.ts, platform/*-analytics.ts
--   - 分区子表随父表一并 FORCE，避免「父表强制、子表可绕过」。
--
-- 豁免表 instance_setup 为登录前初始化向导专用，回收 leyova_app 权限。
--
-- 回滚：
--   ALTER TABLE public.<t> NO FORCE ROW LEVEL SECURITY;
--   DROP VIEW IF EXISTS public.v_rls_force_coverage;
--   GRANT ALL ON public.instance_setup TO leyova_app;   -- 如需恢复
--
-- 本迁移幂等，可重复执行。
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ────────────────────────────────────────────────────────────
-- 1) 前置断言：白名单表必须已 ENABLE 且至少一条策略
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  v_rls boolean;
  v_pol int;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_tasks','session_plan_products','import_batches','publish_runs',
    'canonical_orders','canonical_order_items','canonical_refund_events'
  ] LOOP
    SELECT c.relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    IF v_rls IS NOT TRUE THEN
      RAISE EXCEPTION 'FORCE 前置检查失败：% 未启用 RLS', t;
    END IF;

    SELECT count(*) INTO v_pol
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;

    IF v_pol = 0 THEN
      RAISE EXCEPTION 'FORCE 前置检查失败：% 没有任何策略', t;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2) FORCE 白名单（含 canonical_* 的分区子表）
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  ch text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_tasks','session_plan_products','import_batches','publish_runs',
    'canonical_orders','canonical_order_items','canonical_refund_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;

  FOR ch IN
    SELECT c.relname
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND p.relname = ANY (ARRAY['canonical_orders','canonical_order_items','canonical_refund_events'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', ch);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3) 后置断言：白名单及分区子表必须 relforcerowsecurity = true
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  v_force boolean;
BEGIN
  FOR t IN
    SELECT w.tablename
      FROM unnest(ARRAY[
        'content_tasks','session_plan_products','import_batches','publish_runs',
        'canonical_orders','canonical_order_items','canonical_refund_events'
      ]) AS w(tablename)
    UNION
    SELECT c.relname
      FROM pg_inherits i
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND p.relname = ANY (ARRAY['canonical_orders','canonical_order_items','canonical_refund_events'])
  LOOP
    SELECT c.relforcerowsecurity INTO v_force
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    IF v_force IS NOT TRUE THEN
      RAISE EXCEPTION 'FORCE 后置检查失败：% 未强制 RLS', t;
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4) 覆盖校验视图：白名单 + 分区子表的 RLS/策略状态
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_rls_force_coverage AS
WITH whitelist(tablename) AS (
  VALUES
    ('content_tasks'), ('session_plan_products'), ('import_batches'), ('publish_runs'),
    ('canonical_orders'), ('canonical_order_items'), ('canonical_refund_events')
),
expected(tablename) AS (
  SELECT tablename FROM whitelist
  UNION
  SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN whitelist w ON w.tablename = p.relname
   WHERE n.nspname = 'public'
),
actual AS (
  SELECT c.relname AS tablename,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS force_enabled,
         (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
)
SELECT e.tablename,
       coalesce(a.rls_enabled, false)   AS rls_enabled,
       coalesce(a.force_enabled, false) AS force_enabled,
       coalesce(a.policy_count, 0)      AS policy_count,
       (coalesce(a.rls_enabled, false)
        AND coalesce(a.force_enabled, false)
        AND coalesce(a.policy_count, 0) > 0) AS ok
  FROM expected e
  LEFT JOIN actual a USING (tablename)
 ORDER BY e.tablename;

ALTER VIEW public.v_rls_force_coverage SET (security_invoker = true);
GRANT SELECT ON public.v_rls_force_coverage TO leyova_app;

-- ────────────────────────────────────────────────────────────
-- 5) 豁免表：初始化向导仅走 owner 连接，回收应用角色权限
-- ────────────────────────────────────────────────────────────
REVOKE ALL ON public.instance_setup FROM leyova_app;

COMMIT;
