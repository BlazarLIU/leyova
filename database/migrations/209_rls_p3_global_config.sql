-- ============================================================================
-- 209_rls_p3_global_config.sql
--
-- RLS 190 张表补齐计划 P3：平台配置、全局参考数据、全局聚合/运营（39 张）。
--
-- 设计要点（对应 docs/RLS-190-ENABLEMENT-PLAN.md 批次 P3）：
--   - 平台配置使用 T5：NULL / 空串视为全局配置；
--   - 全局字典使用 T1：所有登录用户可读，运营写角色可写；
--   - role_platform_permissions 读放开、写仅 super_admin；
--   - data_exports 仅运营写角色可读；
--   - fact_inventory_ledger 按 operator_id 或运营角色控制，不对 brand_viewer 开放；
--   - overview_daily_stats* 单租户阶段全员可读；
--   - 同步把仍以 owner 权限执行的 5 个视图改为 security_invoker。
--
-- 本批只 ENABLE，不 FORCE。全部 DROP POLICY IF EXISTS，可重复执行。
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '60s';

-- ────────────────────────────────────────────────────────────
-- T1 全局字典：所有登录用户可读，运营写角色可写
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'amount_type_dict','dict_items','dim_brand','dim_product','dim_traffic_source',
    'staff_role_dict','metric_definition','system_modules','setup_templates',
    'target_templates','issue_library','script_library'
  ] LOOP
    -- 仅处理真实存在的表（基线中部分字典表已下线）
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r', 'p')
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS p_%I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_select ON public.%I FOR SELECT TO public USING (public.rls_user_id() IS NOT NULL)',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS p_%I_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_write ON public.%I FOR ALL TO public USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer())',
      t, t
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- T5 平台配置：NULL / 空串视为全局，其余按平台授权
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  c text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_tool_dict','clean_rule_sets','entity_aliases','field_mapping_rules',
    'order_status_config','platform_caliber_config','platform_sla_config',
    'platform_source_mapping','upload_column_mappings',
    'dim_kol','system_platform_configs','platform_capability_matrix'
  ] LOOP
    c := CASE WHEN t IN ('entity_aliases','field_mapping_rules') THEN 'source_platform' ELSE 'platform_code' END;

    EXECUTE format('DROP POLICY IF EXISTS p_%I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_select ON public.%I FOR SELECT TO public USING (
         public.rls_user_id() IS NOT NULL
         AND (%3$I IS NULL OR %3$I = '''' OR public.rls_has_platform(%3$I))
       )',
      t, t, c
    );

    EXECUTE format('DROP POLICY IF EXISTS p_%I_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_write ON public.%I FOR ALL TO public USING (
         public.rls_is_ops_writer()
         AND (%3$I IS NULL OR %3$I = '''' OR public.rls_has_platform(%3$I))
       ) WITH CHECK (
         public.rls_is_ops_writer()
         AND (%3$I IS NULL OR %3$I = '''' OR public.rls_has_platform(%3$I))
       )',
      t, t, c
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 全局参考数据中的特殊写权限
-- ────────────────────────────────────────────────────────────

-- anchor_script_templates：全员可读，运营 / HR 可写（/scripts/templates 允许 hrbp）
DROP POLICY IF EXISTS p_anchor_script_templates_select ON public.anchor_script_templates;
CREATE POLICY p_anchor_script_templates_select ON public.anchor_script_templates FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_anchor_script_templates_write ON public.anchor_script_templates;
CREATE POLICY p_anchor_script_templates_write ON public.anchor_script_templates FOR ALL TO public
  USING (public.rls_is_ops_writer() OR public.rls_is_hr_writer())
  WITH CHECK (public.rls_is_ops_writer() OR public.rls_is_hr_writer());

ALTER TABLE public.anchor_script_templates ENABLE ROW LEVEL SECURITY;

-- operators：全员可读，运营 / HRBP 可写（/personnel/operators 允许 hrbp）
DROP POLICY IF EXISTS p_operators_select ON public.operators;
CREATE POLICY p_operators_select ON public.operators FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_operators_write ON public.operators;
CREATE POLICY p_operators_write ON public.operators FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    OR (public.rls_is_agency_staff() AND public.rls_role() = 'hrbp')
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    OR (public.rls_is_agency_staff() AND public.rls_role() = 'hrbp')
  );

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- F11 权限矩阵：读放开，写仅 super_admin（避免自行提权）
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS p_role_platform_permissions_select ON public.role_platform_permissions;
CREATE POLICY p_role_platform_permissions_select ON public.role_platform_permissions FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_role_platform_permissions_write ON public.role_platform_permissions;
CREATE POLICY p_role_platform_permissions_write ON public.role_platform_permissions FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

ALTER TABLE public.role_platform_permissions ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- F13 全局聚合 / 运营
-- ────────────────────────────────────────────────────────────

-- alert_events：内部员工可读，运营写角色可确认 / 写入
DROP POLICY IF EXISTS p_alert_events_select ON public.alert_events;
CREATE POLICY p_alert_events_select ON public.alert_events FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_alert_events_write ON public.alert_events;
CREATE POLICY p_alert_events_write ON public.alert_events FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

-- competitor_brands：竞品运营数据，不对 brand_viewer 开放
DROP POLICY IF EXISTS p_competitor_brands_select ON public.competitor_brands;
CREATE POLICY p_competitor_brands_select ON public.competitor_brands FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_competitor_brands_write ON public.competitor_brands;
CREATE POLICY p_competitor_brands_write ON public.competitor_brands FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.competitor_brands ENABLE ROW LEVEL SECURITY;

-- competitor_price_data：竞品价格，不对 brand_viewer 开放
DROP POLICY IF EXISTS p_competitor_price_data_select ON public.competitor_price_data;
CREATE POLICY p_competitor_price_data_select ON public.competitor_price_data FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_competitor_price_data_write ON public.competitor_price_data;
CREATE POLICY p_competitor_price_data_write ON public.competitor_price_data FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.competitor_price_data ENABLE ROW LEVEL SECURITY;

-- goal_tracking：内部员工可读，运营写角色可维护
DROP POLICY IF EXISTS p_goal_tracking_select ON public.goal_tracking;
CREATE POLICY p_goal_tracking_select ON public.goal_tracking FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_goal_tracking_write ON public.goal_tracking;
CREATE POLICY p_goal_tracking_write ON public.goal_tracking FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.goal_tracking ENABLE ROW LEVEL SECURITY;

-- promotions：内部员工可读，运营 / 投放可写（PROMO_WRITE_ROLES 含 ad_buyer）
DROP POLICY IF EXISTS p_promotions_select ON public.promotions;
CREATE POLICY p_promotions_select ON public.promotions FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_promotions_write ON public.promotions;
CREATE POLICY p_promotions_write ON public.promotions FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    OR (public.rls_is_agency_staff() AND public.rls_role() = 'ad_buyer')
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    OR (public.rls_is_agency_staff() AND public.rls_role() = 'ad_buyer')
  );

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- improvement_tasks：内部员工可读，运营写角色可维护
DROP POLICY IF EXISTS p_improvement_tasks_select ON public.improvement_tasks;
CREATE POLICY p_improvement_tasks_select ON public.improvement_tasks FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_improvement_tasks_write ON public.improvement_tasks;
CREATE POLICY p_improvement_tasks_write ON public.improvement_tasks FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.improvement_tasks ENABLE ROW LEVEL SECURITY;

-- staff_day_status：内部员工可读；排班写角色含 hrbp / ad_buyer
DROP POLICY IF EXISTS p_staff_day_status_select ON public.staff_day_status;
CREATE POLICY p_staff_day_status_select ON public.staff_day_status FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_is_agency_staff());

DROP POLICY IF EXISTS p_staff_day_status_write ON public.staff_day_status;
CREATE POLICY p_staff_day_status_write ON public.staff_day_status FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    OR (public.rls_is_agency_staff() AND public.rls_role() IN ('hrbp','ad_buyer'))
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    OR (public.rls_is_agency_staff() AND public.rls_role() IN ('hrbp','ad_buyer'))
  );

ALTER TABLE public.staff_day_status ENABLE ROW LEVEL SECURITY;

-- fact_inventory_ledger：库存流水，仅内部员工；本人或运营可见，不对 brand_viewer 开放
DROP POLICY IF EXISTS p_fact_inventory_ledger_select ON public.fact_inventory_ledger;
CREATE POLICY p_fact_inventory_ledger_select ON public.fact_inventory_ledger FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_is_agency_staff()
    AND (
      public.rls_is_ops_writer()
      OR operator_id = public.rls_user_id()
    )
  );

DROP POLICY IF EXISTS p_fact_inventory_ledger_write ON public.fact_inventory_ledger;
CREATE POLICY p_fact_inventory_ledger_write ON public.fact_inventory_ledger FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.fact_inventory_ledger ENABLE ROW LEVEL SECURITY;

-- data_exports：导出任务元数据，仅运营写角色可读 / 写
DROP POLICY IF EXISTS p_data_exports_select ON public.data_exports;
CREATE POLICY p_data_exports_select ON public.data_exports FOR SELECT TO public
  USING (public.rls_is_ops_writer());

DROP POLICY IF EXISTS p_data_exports_write ON public.data_exports;
CREATE POLICY p_data_exports_write ON public.data_exports FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

-- overview_activities / overview_daily_stats*：单租户阶段全员可读，运营写角色可写
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'overview_activities','overview_daily_stats','overview_daily_stats_archive'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_%I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_select ON public.%I FOR SELECT TO public USING (public.rls_user_id() IS NOT NULL)',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS p_%I_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_write ON public.%I FOR ALL TO public USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer())',
      t, t
    );

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 视图旁路收敛（与 P3 同步处理）
-- ────────────────────────────────────────────────────────────
ALTER VIEW public.metric_catalog        SET (security_invoker = true);
ALTER VIEW public.v_ad_plan_comparison  SET (security_invoker = true);
ALTER VIEW public.v_fact_trade_default  SET (security_invoker = true);
ALTER VIEW public.v_session_cost        SET (security_invoker = true);
ALTER VIEW public.v_staff_attendance    SET (security_invoker = true);

-- ────────────────────────────────────────────────────────────
-- 断言：39 张表全部启用 RLS 且至少 1 条策略；5 个视图已设置 security_invoker
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  v text;
  n int;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_tool_dict','clean_rule_sets','entity_aliases','field_mapping_rules','order_status_config',
    'platform_caliber_config','platform_sla_config','platform_source_mapping','role_platform_permissions','upload_column_mappings',
    'amount_type_dict','dict_items','dim_brand','dim_kol','dim_product','dim_traffic_source','staff_role_dict',
    'metric_definition','system_modules','system_platform_configs','platform_capability_matrix','setup_templates',
    'target_templates','issue_library','script_library','anchor_script_templates','operators',
    'alert_events','competitor_brands','competitor_price_data','goal_tracking','overview_activities',
    'overview_daily_stats','overview_daily_stats_archive','promotions','improvement_tasks','staff_day_status',
    'fact_inventory_ledger','data_exports'
  ] LOOP
    -- 基线中已下线的表跳过校验
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = t AND c.relkind IN ('r', 'p')
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = t AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS not enabled: %', t;
    END IF;

    SELECT count(*) INTO n FROM pg_policies WHERE schemaname = 'public' AND tablename = t;
    IF n = 0 THEN
      RAISE EXCEPTION 'RLS enabled without policy: %', t;
    END IF;
  END LOOP;

  FOREACH v IN ARRAY ARRAY[
    'metric_catalog','v_ad_plan_comparison','v_fact_trade_default','v_session_cost','v_staff_attendance'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = v
         AND 'security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[]))
    ) THEN
      RAISE EXCEPTION 'view missing security_invoker: %', v;
    END IF;
  END LOOP;

  RAISE NOTICE '209 完成：P3 39 张表已启用 RLS，5 个视图已设置 security_invoker';
END $$;

COMMIT;
