-- ============================================================================
-- 207_rls_p1_partition_children.sql
--
-- P1 批次（第二部分）：7 个分区父表下的 76 张分区子表。
--
-- 背景：PostgreSQL 分区子表不继承父表的 RLS 策略，必须逐张 ENABLE 并逐张
-- 复制父表策略。本迁移：
--   1. 对 76 张子表 ENABLE ROW LEVEL SECURITY（不 FORCE）；
--   2. 逐张复制父表的所有策略（策略谓词只引用列名与 GUC，可原样复制）；
--   3. 断言每张子表已启用 RLS，且策略数与父表一致。
--
-- 父表：
--   canonical_orders / canonical_order_items / canonical_refund_events
--   fact_trade_daily / fact_traffic_daily / clean_records / raw_records
--
-- 幂等：重复执行会先 DROP POLICY IF EXISTS，再重新创建。
-- ============================================================================

BEGIN;

DO $$
DECLARE
  parent_name text;
  child_name text;
  pol record;
  v_using text;
  v_check text;
BEGIN
  FOREACH parent_name IN ARRAY ARRAY[
    'canonical_orders',
    'canonical_order_items',
    'canonical_refund_events',
    'fact_trade_daily',
    'fact_traffic_daily',
    'clean_records',
    'raw_records'
  ] LOOP
    FOR child_name IN
      SELECT c.relname
        FROM pg_inherits i
        JOIN pg_class c ON c.oid = i.inhrelid
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND p.relname = parent_name
       ORDER BY c.relname
    LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', child_name);

      FOR pol IN
        SELECT policyname, cmd, roles, qual, with_check
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = parent_name
         ORDER BY policyname
      LOOP
        -- pg_policies 会把父表列引用保存为 "父表.列名"（如 raw_records.batch_id），
        -- 复制到子表时必须替换为子表名，否则报 missing FROM-clause entry。
        v_using := replace(pol.qual, parent_name || '.', child_name || '.');
        v_check := replace(pol.with_check, parent_name || '.', child_name || '.');

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, child_name);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR %s TO %s %s %s',
          pol.policyname,
          child_name,
          pol.cmd,
          array_to_string(pol.roles, ','),
          CASE WHEN v_using IS NULL THEN '' ELSE format('USING (%s)', v_using) END,
          CASE WHEN v_check IS NULL THEN '' ELSE format('WITH CHECK (%s)', v_check) END
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 断言：76 张子表均已启用 RLS，且策略数与父表一致
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  parent_name text;
  child record;
  parent_pol int;
  child_pol int;
  child_rls boolean;
  n_children int := 0;
BEGIN
  FOREACH parent_name IN ARRAY ARRAY[
    'canonical_orders',
    'canonical_order_items',
    'canonical_refund_events',
    'fact_trade_daily',
    'fact_traffic_daily',
    'clean_records',
    'raw_records'
  ] LOOP
    SELECT count(*) INTO parent_pol
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = parent_name;

    FOR child IN
      SELECT c.relname
        FROM pg_inherits i
        JOIN pg_class c ON c.oid = i.inhrelid
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND p.relname = parent_name
    LOOP
      n_children := n_children + 1;

      SELECT c2.relrowsecurity INTO child_rls
        FROM pg_class c2 JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
       WHERE n2.nspname = 'public' AND c2.relname = child.relname;

      SELECT count(*) INTO child_pol
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = child.relname;

      IF NOT COALESCE(child_rls, false) THEN
        RAISE EXCEPTION '分区子表未启用 RLS: %', child.relname;
      END IF;
      IF child_pol <> parent_pol OR child_pol = 0 THEN
        RAISE EXCEPTION '分区子表策略数不一致: % (子表 %, 父表 %)',
          child.relname, child_pol, parent_pol;
      END IF;
    END LOOP;
  END LOOP;

  IF n_children <> 76 THEN
    RAISE EXCEPTION '分区子表数量异常：期望 76，实际 %', n_children;
  END IF;

  RAISE NOTICE '207 完成：76 张分区子表已启用 RLS 并复制父表策略';
END $$;

COMMIT;
