-- ============================================================================
-- 206_rls_p1_shop_facts_and_ingest.sql
--
-- P1 批次（第一部分）：店铺事实表、内容/客服维度、数据导入与治理链路，
-- 以及 clean_records / raw_records 两个分区父表的策略与 RLS 启用。
--
-- 范围：25 张表
--   F05 店铺事实与维度（15）
--     alert_rules, content_projects, data_uploads, dim_cs_agent,
--     dim_sku_mapping, fact_content_daily, fact_inventory_stock,
--     import_batches, ingest_sync_jobs, kuaishou_fans_ops, live_rooms,
--     session_channel_metrics, taobao_order_hierarchy, video_metrics, xhs_note
--   F06 数据治理（8）
--     cleaning_runs, validation_runs, data_quality_issues, review_actions,
--     reconciliation_runs, publish_runs, publish_reversals, import_files
--   F00 分区父表（2）
--     clean_records, raw_records
--
-- 约定：
--   - 事实表读：登录 + 平台严格 + 店铺严格（无 platform_code 的表仅校验店铺）；
--   - 事实表写：rls_is_ops_writer() + 同样的范围谓词；
--   - 治理链路：通过父表 EXISTS 继承可见性，写入额外要求运营写角色；
--   - 配置/告警类可空维度按「NULL 视为全局」放行读，写仍要求运营写角色；
--   - 本批只 ENABLE，不 FORCE。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- F05 店铺事实与维度
-- ────────────────────────────────────────────────────────────

-- alert_rules：6 行均为全局规则（platform/shop 为 NULL），NULL 必须可读可写
DROP POLICY IF EXISTS p_alert_rules_select ON public.alert_rules;
CREATE POLICY p_alert_rules_select ON public.alert_rules FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_alert_rules_write ON public.alert_rules;
CREATE POLICY p_alert_rules_write ON public.alert_rules FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

-- content_projects：内部项目容器，NULL 平台/店铺视为全局；写为内容角色
DROP POLICY IF EXISTS p_content_projects_select ON public.content_projects;
CREATE POLICY p_content_projects_select ON public.content_projects FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_content_projects_write ON public.content_projects;
CREATE POLICY p_content_projects_write ON public.content_projects FOR ALL TO public
  USING (
    public.rls_is_content_writer()
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    public.rls_is_content_writer()
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

-- data_uploads：租户隔离 + 平台/店铺（NULL 视为全局）；写为运营角色
DROP POLICY IF EXISTS p_data_uploads_select ON public.data_uploads;
CREATE POLICY p_data_uploads_select ON public.data_uploads FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_data_uploads_write ON public.data_uploads;
CREATE POLICY p_data_uploads_write ON public.data_uploads FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (platform_code IS NULL OR platform_code = '' OR public.rls_has_platform(platform_code))
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

-- dim_cs_agent：平台 + 店铺严格
DROP POLICY IF EXISTS p_dim_cs_agent_select ON public.dim_cs_agent;
CREATE POLICY p_dim_cs_agent_select ON public.dim_cs_agent FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_dim_cs_agent_write ON public.dim_cs_agent;
CREATE POLICY p_dim_cs_agent_write ON public.dim_cs_agent FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- dim_sku_mapping：平台 + 店铺严格
DROP POLICY IF EXISTS p_dim_sku_mapping_select ON public.dim_sku_mapping;
CREATE POLICY p_dim_sku_mapping_select ON public.dim_sku_mapping FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_dim_sku_mapping_write ON public.dim_sku_mapping;
CREATE POLICY p_dim_sku_mapping_write ON public.dim_sku_mapping FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- fact_content_daily：平台 + 店铺严格
DROP POLICY IF EXISTS p_fact_content_daily_select ON public.fact_content_daily;
CREATE POLICY p_fact_content_daily_select ON public.fact_content_daily FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_fact_content_daily_write ON public.fact_content_daily;
CREATE POLICY p_fact_content_daily_write ON public.fact_content_daily FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- fact_inventory_stock：无 platform_code；库存按「商品 + 仓库」建档，
-- shop_id 可空（NULL = 租户级总仓库存），因此允许 NULL，非空时校验店铺范围。
DROP POLICY IF EXISTS p_fact_inventory_stock_select ON public.fact_inventory_stock;
CREATE POLICY p_fact_inventory_stock_select ON public.fact_inventory_stock FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

DROP POLICY IF EXISTS p_fact_inventory_stock_write ON public.fact_inventory_stock;
CREATE POLICY p_fact_inventory_stock_write ON public.fact_inventory_stock FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND (shop_id IS NULL OR public.rls_can_access_shop(shop_id))
  );

-- import_batches：source_platform + store_id 严格
DROP POLICY IF EXISTS p_import_batches_select ON public.import_batches;
CREATE POLICY p_import_batches_select ON public.import_batches FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(source_platform)
    AND public.rls_shop_strict(store_id)
  );

DROP POLICY IF EXISTS p_import_batches_write ON public.import_batches;
CREATE POLICY p_import_batches_write ON public.import_batches FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(source_platform)
    AND public.rls_shop_strict(store_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(source_platform)
    AND public.rls_shop_strict(store_id)
  );

-- ingest_sync_jobs：平台 + 店铺严格
DROP POLICY IF EXISTS p_ingest_sync_jobs_select ON public.ingest_sync_jobs;
CREATE POLICY p_ingest_sync_jobs_select ON public.ingest_sync_jobs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_ingest_sync_jobs_write ON public.ingest_sync_jobs;
CREATE POLICY p_ingest_sync_jobs_write ON public.ingest_sync_jobs FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- kuaishou_fans_ops：无 platform_code，仅店铺严格
DROP POLICY IF EXISTS p_kuaishou_fans_ops_select ON public.kuaishou_fans_ops;
CREATE POLICY p_kuaishou_fans_ops_select ON public.kuaishou_fans_ops FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_shop_strict(shop_id));

DROP POLICY IF EXISTS p_kuaishou_fans_ops_write ON public.kuaishou_fans_ops;
CREATE POLICY p_kuaishou_fans_ops_write ON public.kuaishou_fans_ops FOR ALL TO public
  USING (public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id))
  WITH CHECK (public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id));

-- live_rooms：平台 + 店铺严格
DROP POLICY IF EXISTS p_live_rooms_select ON public.live_rooms;
CREATE POLICY p_live_rooms_select ON public.live_rooms FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_live_rooms_write ON public.live_rooms;
CREATE POLICY p_live_rooms_write ON public.live_rooms FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- session_channel_metrics：平台 + 店铺严格
DROP POLICY IF EXISTS p_session_channel_metrics_select ON public.session_channel_metrics;
CREATE POLICY p_session_channel_metrics_select ON public.session_channel_metrics FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_session_channel_metrics_write ON public.session_channel_metrics;
CREATE POLICY p_session_channel_metrics_write ON public.session_channel_metrics FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- taobao_order_hierarchy：无 platform_code，仅店铺严格
DROP POLICY IF EXISTS p_taobao_order_hierarchy_select ON public.taobao_order_hierarchy;
CREATE POLICY p_taobao_order_hierarchy_select ON public.taobao_order_hierarchy FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_shop_strict(shop_id));

DROP POLICY IF EXISTS p_taobao_order_hierarchy_write ON public.taobao_order_hierarchy;
CREATE POLICY p_taobao_order_hierarchy_write ON public.taobao_order_hierarchy FOR ALL TO public
  USING (public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id))
  WITH CHECK (public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id));

-- video_metrics：平台 + 店铺严格
DROP POLICY IF EXISTS p_video_metrics_select ON public.video_metrics;
CREATE POLICY p_video_metrics_select ON public.video_metrics FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

DROP POLICY IF EXISTS p_video_metrics_write ON public.video_metrics;
CREATE POLICY p_video_metrics_write ON public.video_metrics FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(platform_code)
    AND public.rls_shop_strict(shop_id)
  );

-- xhs_note：无 platform_code，仅店铺严格
DROP POLICY IF EXISTS p_xhs_note_select ON public.xhs_note;
CREATE POLICY p_xhs_note_select ON public.xhs_note FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL AND public.rls_shop_strict(shop_id));

DROP POLICY IF EXISTS p_xhs_note_write ON public.xhs_note;
CREATE POLICY p_xhs_note_write ON public.xhs_note FOR ALL TO public
  USING (public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id))
  WITH CHECK (public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id));

-- ────────────────────────────────────────────────────────────
-- F06 数据治理（通过父表继承）
-- ────────────────────────────────────────────────────────────

-- cleaning_runs：batch_id → import_batches
DROP POLICY IF EXISTS p_cleaning_runs_select ON public.cleaning_runs;
CREATE POLICY p_cleaning_runs_select ON public.cleaning_runs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

DROP POLICY IF EXISTS p_cleaning_runs_write ON public.cleaning_runs;
CREATE POLICY p_cleaning_runs_write ON public.cleaning_runs FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

-- validation_runs：cleaning_run_id → cleaning_runs → import_batches
DROP POLICY IF EXISTS p_validation_runs_select ON public.validation_runs;
CREATE POLICY p_validation_runs_select ON public.validation_runs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.cleaning_runs cr WHERE cr.id = cleaning_run_id)
  );

DROP POLICY IF EXISTS p_validation_runs_write ON public.validation_runs;
CREATE POLICY p_validation_runs_write ON public.validation_runs FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.cleaning_runs cr WHERE cr.id = cleaning_run_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.cleaning_runs cr WHERE cr.id = cleaning_run_id)
  );

-- data_quality_issues：batch_id → import_batches
DROP POLICY IF EXISTS p_data_quality_issues_select ON public.data_quality_issues;
CREATE POLICY p_data_quality_issues_select ON public.data_quality_issues FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

DROP POLICY IF EXISTS p_data_quality_issues_write ON public.data_quality_issues;
CREATE POLICY p_data_quality_issues_write ON public.data_quality_issues FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

-- review_actions：issue_id → data_quality_issues → import_batches
DROP POLICY IF EXISTS p_review_actions_select ON public.review_actions;
CREATE POLICY p_review_actions_select ON public.review_actions FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.data_quality_issues i WHERE i.id = issue_id)
  );

DROP POLICY IF EXISTS p_review_actions_write ON public.review_actions;
CREATE POLICY p_review_actions_write ON public.review_actions FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.data_quality_issues i WHERE i.id = issue_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.data_quality_issues i WHERE i.id = issue_id)
  );

-- reconciliation_runs：batch_id → import_batches
DROP POLICY IF EXISTS p_reconciliation_runs_select ON public.reconciliation_runs;
CREATE POLICY p_reconciliation_runs_select ON public.reconciliation_runs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

DROP POLICY IF EXISTS p_reconciliation_runs_write ON public.reconciliation_runs;
CREATE POLICY p_reconciliation_runs_write ON public.reconciliation_runs FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

-- publish_runs：batch_id → import_batches
DROP POLICY IF EXISTS p_publish_runs_select ON public.publish_runs;
CREATE POLICY p_publish_runs_select ON public.publish_runs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

DROP POLICY IF EXISTS p_publish_runs_write ON public.publish_runs;
CREATE POLICY p_publish_runs_write ON public.publish_runs FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

-- publish_reversals：publish_run_id → publish_runs → import_batches
DROP POLICY IF EXISTS p_publish_reversals_select ON public.publish_reversals;
CREATE POLICY p_publish_reversals_select ON public.publish_reversals FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.publish_runs pr WHERE pr.id = publish_run_id)
  );

DROP POLICY IF EXISTS p_publish_reversals_write ON public.publish_reversals;
CREATE POLICY p_publish_reversals_write ON public.publish_reversals FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.publish_runs pr WHERE pr.id = publish_run_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.publish_runs pr WHERE pr.id = publish_run_id)
  );

-- import_files：batch_id → import_batches
DROP POLICY IF EXISTS p_import_files_select ON public.import_files;
CREATE POLICY p_import_files_select ON public.import_files FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

DROP POLICY IF EXISTS p_import_files_write ON public.import_files;
CREATE POLICY p_import_files_write ON public.import_files FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

-- ────────────────────────────────────────────────────────────
-- 分区父表：clean_records / raw_records
-- ────────────────────────────────────────────────────────────

-- clean_records：source_platform + store_id 严格（与 canonical_* 一致）
DROP POLICY IF EXISTS p_clean_records_select ON public.clean_records;
CREATE POLICY p_clean_records_select ON public.clean_records FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_platform_strict(source_platform)
    AND public.rls_shop_strict(store_id)
  );

DROP POLICY IF EXISTS p_clean_records_write ON public.clean_records;
CREATE POLICY p_clean_records_write ON public.clean_records FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(source_platform)
    AND public.rls_shop_strict(store_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND public.rls_platform_strict(source_platform)
    AND public.rls_shop_strict(store_id)
  );

-- raw_records：batch_id → import_batches
DROP POLICY IF EXISTS p_raw_records_select ON public.raw_records;
CREATE POLICY p_raw_records_select ON public.raw_records FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

DROP POLICY IF EXISTS p_raw_records_write ON public.raw_records;
CREATE POLICY p_raw_records_write ON public.raw_records FOR ALL TO public
  USING (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  )
  WITH CHECK (
    public.rls_is_ops_writer()
    AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id)
  );

-- ────────────────────────────────────────────────────────────
-- 启用 RLS（不 FORCE）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.alert_rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_projects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_uploads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_cs_agent             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_sku_mapping          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_content_daily       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_inventory_stock     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_sync_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kuaishou_fans_ops        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_rooms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_channel_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taobao_order_hierarchy   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_metrics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xhs_note                 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cleaning_runs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_issues      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_actions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_reversals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_files             ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_records              ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 断言：25 张表均已启用 RLS 且至少 1 条策略
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  n_pol int;
  rls_on boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alert_rules','content_projects','data_uploads','dim_cs_agent',
    'dim_sku_mapping','fact_content_daily','fact_inventory_stock',
    'import_batches','ingest_sync_jobs','kuaishou_fans_ops','live_rooms',
    'session_channel_metrics','taobao_order_hierarchy','video_metrics','xhs_note',
    'cleaning_runs','validation_runs','data_quality_issues','review_actions',
    'reconciliation_runs','publish_runs','publish_reversals','import_files',
    'clean_records','raw_records'
  ] LOOP
    SELECT c.relrowsecurity INTO rls_on
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    SELECT count(*) INTO n_pol
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;

    IF NOT COALESCE(rls_on, false) THEN
      RAISE EXCEPTION 'P1 表未启用 RLS: %', t;
    END IF;
    IF n_pol = 0 THEN
      RAISE EXCEPTION 'P1 表已启用 RLS 但缺少策略: %', t;
    END IF;
  END LOOP;

  RAISE NOTICE '206 完成：P1 第一批 25 张表已启用 RLS 并覆盖策略';
END $$;

COMMIT;
