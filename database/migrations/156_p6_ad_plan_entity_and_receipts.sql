-- database/migrations/156_p6_ad_plan_entity_and_receipts.sql
-- P6 闭环补口：投流计划实体 ad_plan、回执表与三列可比视图
BEGIN;

-- 1. 投流计划实体表 ad_plan
CREATE TABLE IF NOT EXISTS public.ad_plan (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_no VARCHAR(64) NOT NULL UNIQUE,
  session_id INT REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  shop_id BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  platform_code VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  ad_tool_code VARCHAR(50) NOT NULL REFERENCES public.ad_tool_dict(code) ON DELETE RESTRICT,
  plan_name VARCHAR(150) NOT NULL,
  plan_date DATE NOT NULL,
  planned_budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_roi NUMERIC(6,2) NOT NULL DEFAULT 2.00,
  pre_heat_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.20,
  live_peak_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.60,
  tail_push_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.20,
  targeting_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  bid_strategy VARCHAR(50) NOT NULL DEFAULT 'auto_bid',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'completed', 'cancelled')),
  created_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_plan_shop_date ON public.ad_plan(shop_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_ad_plan_session ON public.ad_plan(session_id);
CREATE INDEX IF NOT EXISTS idx_ad_plan_status ON public.ad_plan(status);

-- 2. 投流回执与执行对账表 ad_plan_receipts
CREATE TABLE IF NOT EXISTS public.ad_plan_receipts (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES public.ad_plan(id) ON DELETE CASCADE,
  biz_date DATE NOT NULL,
  actual_spend NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_gmv NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_gmv NUMERIC(14,2) NOT NULL DEFAULT 0,
  attributed_orders INT NOT NULL DEFAULT 0,
  receipt_source VARCHAR(50) NOT NULL DEFAULT 'manual_entry' CHECK (receipt_source IN ('manual_entry', 'fact_sync', 'api_push')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ad_plan_receipts_plan_date UNIQUE(plan_id, biz_date)
);

-- 3. 投流计划 vs 实际消耗 vs 净 ROI 三列可比视图 v_ad_plan_comparison
CREATE OR REPLACE VIEW public.v_ad_plan_comparison AS
SELECT
  p.id AS plan_id,
  p.plan_no,
  p.tenant_id,
  p.session_id,
  p.shop_id,
  ds.shop_name,
  p.platform_code,
  sp.platform_name,
  p.ad_tool_code,
  atd.name AS ad_tool_name,
  p.plan_name,
  p.plan_date,
  p.planned_budget,
  p.target_roi,
  p.status,
  COALESCE(r.actual_spend, a.ad_spend, 0)::numeric(14,2) AS actual_spend,
  COALESCE(r.actual_gmv, a.attributed_gross_gmv, 0)::numeric(14,2) AS actual_gross_gmv,
  COALESCE(r.net_gmv, a.net_gmv, 0)::numeric(14,2) AS net_gmv,
  CASE
    WHEN COALESCE(r.actual_spend, a.ad_spend, 0) > 0 THEN
      ROUND(COALESCE(r.actual_gmv, a.attributed_gross_gmv, 0) / COALESCE(r.actual_spend, a.ad_spend), 2)
    ELSE 0
  END AS actual_roi,
  CASE
    WHEN COALESCE(r.actual_spend, a.ad_spend, 0) > 0 THEN
      ROUND(COALESCE(r.net_gmv, a.net_gmv, 0) / COALESCE(r.actual_spend, a.ad_spend), 2)
    ELSE 0
  END AS net_roi,
  CASE
    WHEN p.planned_budget > 0 THEN
      ROUND(COALESCE(r.actual_spend, a.ad_spend, 0) / p.planned_budget * 100, 2)
    ELSE 0
  END AS budget_utilization_pct,
  p.created_at,
  p.updated_at
FROM public.ad_plan p
JOIN public.dim_shop ds ON ds.id = p.shop_id
LEFT JOIN public.system_platform_configs sp ON sp.platform_code = p.platform_code
LEFT JOIN public.ad_tool_dict atd ON atd.code = p.ad_tool_code
LEFT JOIN public.ad_plan_receipts r ON r.plan_id = p.id
LEFT JOIN LATERAL (
  SELECT SUM(ad_spend) AS ad_spend,
         SUM(attributed_gross_gmv) AS attributed_gross_gmv,
         SUM(net_gmv) AS net_gmv
  FROM public.fact_ad_spend_daily
  WHERE shop_id = p.shop_id AND biz_date = p.plan_date AND ad_tool_code = p.ad_tool_code
) a ON true;

-- 4. 权限与 RLS 配置
ALTER TABLE public.ad_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_plan FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ad_plan_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_plan_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_ad_plan_select ON public.ad_plan;
CREATE POLICY p_ad_plan_select ON public.ad_plan FOR SELECT
  USING (
    rls_can_access_shop(shop_id) AND (
      (rls_is_agency_staff() AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator'])))
      OR ((rls_user_type() = 'brand_viewer') AND rls_can_view_cost())
    )
  );

DROP POLICY IF EXISTS p_ad_plan_write ON public.ad_plan;
CREATE POLICY p_ad_plan_write ON public.ad_plan FOR ALL
  USING (
    rls_is_agency_staff() AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']))
  )
  WITH CHECK (
    rls_is_agency_staff() AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']))
  );

DROP POLICY IF EXISTS p_ad_plan_receipts_select ON public.ad_plan_receipts;
CREATE POLICY p_ad_plan_receipts_select ON public.ad_plan_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_plan p
      WHERE p.id = ad_plan_receipts.plan_id AND rls_can_access_shop(p.shop_id)
    ) AND (
      (rls_is_agency_staff() AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator'])))
      OR ((rls_user_type() = 'brand_viewer') AND rls_can_view_cost())
    )
  );

DROP POLICY IF EXISTS p_ad_plan_receipts_write ON public.ad_plan_receipts;
CREATE POLICY p_ad_plan_receipts_write ON public.ad_plan_receipts FOR ALL
  USING (
    rls_is_agency_staff() AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']))
  )
  WITH CHECK (
    rls_is_agency_staff() AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ad_buyer', 'operator']))
  );

COMMIT;
