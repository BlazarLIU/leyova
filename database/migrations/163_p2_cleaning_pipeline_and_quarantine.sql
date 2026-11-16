-- database/migrations/163_p2_cleaning_pipeline_and_quarantine.sql
-- Master Plan §8: 七段数据清洗管道、跨分区去重哨兵表 (land_raw_dedup) 与质量隔离区 (dq_quarantine)
BEGIN;

-- 1. 跨分区去重哨兵表 land_raw_dedup (解决 PG 范围分区无法建全局唯一索引的限制)
CREATE TABLE IF NOT EXISTS public.land_raw_dedup (
  id BIGSERIAL PRIMARY KEY,
  source_platform VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  payload_hash CHAR(64) NOT NULL,
  batch_id BIGINT REFERENCES public.import_batches(id) ON DELETE CASCADE,
  biz_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_raw_dedup_hash UNIQUE (source_platform, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_land_dedup_date ON public.land_raw_dedup(biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_land_dedup_batch ON public.land_raw_dedup(batch_id);

-- 2. 高性能 UNLOGGED 暂存表 stg_order_import (免 WAL 开销，单机支持 5~20万行/秒高速暂存与集合清洗)
CREATE UNLOGGED TABLE IF NOT EXISTS public.stg_order_import (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_num INT NOT NULL,
  source_platform VARCHAR(32) NOT NULL,
  store_id BIGINT NOT NULL,
  source_order_id VARCHAR(100) NOT NULL,
  source_sub_order_id VARCHAR(100) NOT NULL DEFAULT '',
  order_status VARCHAR(50) NOT NULL,
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  order_date DATE NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  raw_json JSONB NOT NULL DEFAULT '{}',
  validation_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'passed', 'quarantined'
  quarantine_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stg_order_batch ON public.stg_order_import(batch_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_stg_order_bizkey ON public.stg_order_import(batch_id, source_platform, store_id, source_order_id);

-- 3. 数据质量隔离区表 dq_quarantine (8条门禁拦截的不合格行在此留痕，支持修复或驳回)
CREATE TABLE IF NOT EXISTS public.dq_quarantine (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_num INT NOT NULL,
  rule_code VARCHAR(50) NOT NULL CHECK (
    rule_code IN (
      'RULE_LINE_COUNT_CONSERVED',
      'RULE_AMOUNT_CONSERVED',
      'RULE_BATCH_KEY_UNIQUE',
      'RULE_ENUM_LEGAL',
      'RULE_TIME_CONTINUOUS',
      'RULE_CROSS_TABLE_RECONCILE',
      'RULE_PLATFORM_RECONCILE',
      'RULE_FRESHNESS_SLA'
    )
  ),
  severity VARCHAR(20) NOT NULL DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'fatal')),
  raw_payload JSONB NOT NULL DEFAULT '{}',
  failure_reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined', 'resolved', 'ignored')),
  resolved_by VARCHAR(64) NOT NULL DEFAULT '',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quarantine_batch ON public.dq_quarantine(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_quarantine_rule ON public.dq_quarantine(rule_code, severity);

-- 4. RLS 强制隔离策略
ALTER TABLE public.land_raw_dedup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_raw_dedup FORCE ROW LEVEL SECURITY;

ALTER TABLE public.stg_order_import ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stg_order_import FORCE ROW LEVEL SECURITY;

ALTER TABLE public.dq_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dq_quarantine FORCE ROW LEVEL SECURITY;

-- 允许认证用户按平台查询
DROP POLICY IF EXISTS p_land_dedup_select ON public.land_raw_dedup;
CREATE POLICY p_land_dedup_select ON public.land_raw_dedup
  FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(source_platform));

DROP POLICY IF EXISTS p_land_dedup_write ON public.land_raw_dedup;
CREATE POLICY p_land_dedup_write ON public.land_raw_dedup
  FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']));

DROP POLICY IF EXISTS p_stg_import_select ON public.stg_order_import;
CREATE POLICY p_stg_import_select ON public.stg_order_import
  FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(source_platform) AND rls_can_access_shop(store_id));

DROP POLICY IF EXISTS p_stg_import_write ON public.stg_order_import;
CREATE POLICY p_stg_import_write ON public.stg_order_import
  FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']));

DROP POLICY IF EXISTS p_dq_quarantine_select ON public.dq_quarantine;
CREATE POLICY p_dq_quarantine_select ON public.dq_quarantine
  FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_dq_quarantine_write ON public.dq_quarantine;
CREATE POLICY p_dq_quarantine_write ON public.dq_quarantine
  FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']));

COMMIT;
