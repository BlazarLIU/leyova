-- 117_rbac_hardening_and_postgresql_rls.sql
-- Phase 2: 权限体系单源化收敛 + 平台权限默认补全 + 非超管应用角色 + PostgreSQL 真行级安全隔离 (RLS)

BEGIN;

-- ============================================================
-- 1. 补全多租户列 (dim_shop, cost_entries) 与审计索引
-- ============================================================
ALTER TABLE public.dim_shop
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_dim_shop_tenant_id
  ON public.dim_shop(tenant_id);

ALTER TABLE public.cost_entries
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_cost_entries_tenant_id
  ON public.cost_entries(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action
  ON public.audit_logs(actor_user_id, action, created_at DESC);

-- ============================================================
-- 2. 单源化收敛 role_modules（消除 ops_director < ops_staff 权限倒挂与 visible_to 裂脑）
-- ============================================================
-- 2.1 ops_staff 不应拥有系统全局配置 sys_config
DELETE FROM public.role_modules
WHERE role_code = 'ops_staff' AND module_code IN ('system_config', 'system_dict', 'system_users', 'system_ai');

-- 2.2 确保 ops_director 严格包含 ops_staff 与 operator 的全部经营/风控模块 + agency/system_rooms/system_multiroom
INSERT INTO public.role_modules (role_code, module_code)
SELECT 'ops_director', rm.module_code
FROM public.role_modules rm
WHERE rm.role_code IN ('ops_staff', 'operator')
  AND rm.module_code NOT IN ('system_config', 'system_dict', 'system_users', 'system_ai')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_modules (role_code, module_code)
VALUES
  ('ops_director', 'agency'),
  ('ops_director', 'system_rooms'),
  ('ops_director', 'system_multiroom'),
  ('ops_director', 'system_alerts'),
  ('ops_director', 'system_competitors'),
  ('ops_director', 'system_promotions'),
  ('ops_director', 'system_tasks')
ON CONFLICT DO NOTHING;

-- 2.3 清空过时的 system_modules.visible_to 硬编码提示，统一以 role_modules 为唯一权限真值来源
UPDATE public.system_modules
SET visible_to = '{}'::character varying[];

-- ============================================================
-- 3. 补全 role_platform_permissions（此前仅 super_admin 有记录）
-- ============================================================
-- super_admin / admin / ops_director / ops_staff / operator / finance / hrbp 默认拥有 7 大平台可见范围
INSERT INTO public.role_platform_permissions (role_id, platform_code, allowed_modules)
SELECT r.id, p.platform_code, '{}'::text[]
FROM public.roles r
CROSS JOIN public.system_platform_configs p
WHERE r.code IN ('super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'finance', 'hrbp')
ON CONFLICT (role_id, platform_code) DO NOTHING;

-- employee 与 controller 默认授予直播现场高频平台（抖音、快手），管理员可在后台调整
INSERT INTO public.role_platform_permissions (role_id, platform_code, allowed_modules)
SELECT r.id, p.platform_code, '{}'::text[]
FROM public.roles r
CROSS JOIN public.system_platform_configs p
WHERE r.code IN ('employee', 'controller')
  AND p.platform_code IN ('douyin', 'kuaishou')
ON CONFLICT (role_id, platform_code) DO NOTHING;

-- ============================================================
-- 4. 创建非超级管理员应用角色 leyova_app (NOSUPERUSER NOBYPASSRLS)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leyova_app') THEN
    CREATE ROLE leyova_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  ELSE
    ALTER ROLE leyova_app NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- 允许当前连接角色（及历史预设账号 leyova）在事务内 SET LOCAL ROLE leyova_app
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leyova') THEN
    GRANT leyova_app TO leyova;
  END IF;
  IF current_user <> 'leyova_app' THEN
    BEGIN
      EXECUTE format('GRANT leyova_app TO %I', current_user);
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
  GRANT USAGE ON SCHEMA public TO leyova_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leyova_app;
  GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO leyova_app;
END
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO leyova_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO leyova_app;

-- ============================================================
-- 5. PostgreSQL 行级安全上下文解析函数（全量 fail-closed）
-- ============================================================
CREATE OR REPLACE FUNCTION public.rls_user_id()
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(current_setting('app.user_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.user_id', true)::integer
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_role', true), ''), '');
$$;

CREATE OR REPLACE FUNCTION public.rls_user_type()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_type', true), ''), '');
$$;

CREATE OR REPLACE FUNCTION public.rls_tenant_id()
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(current_setting('app.tenant_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.tenant_id', true)::integer
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_anchor_id()
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(current_setting('app.anchor_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.anchor_id', true)::integer
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_brand_client_id()
RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(current_setting('app.brand_client_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.brand_client_id', true)::integer
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_can_view_cost()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(current_setting('app.can_view_cost', true), '') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.rls_can_view_anchors()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(current_setting('app.can_view_anchors', true), '') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.rls_allowed_project_ids()
RETURNS integer[]
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(NULLIF(current_setting('app.allowed_project_ids', true), ''), '') = ''
      THEN ARRAY[]::integer[]
    ELSE (
      SELECT COALESCE(array_agg(x::integer), ARRAY[]::integer[])
      FROM unnest(string_to_array(current_setting('app.allowed_project_ids', true), ',')) AS x
      WHERE x ~ '^[0-9]+$'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_has_project(proj_id integer)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT proj_id IS NOT NULL AND proj_id = ANY(public.rls_allowed_project_ids());
$$;

CREATE OR REPLACE FUNCTION public.rls_has_platform(p_code text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN public.rls_user_id() IS NULL THEN false
    WHEN COALESCE(current_setting('app.allowed_platforms', true), '') = '*' THEN true
    WHEN COALESCE(NULLIF(p_code, ''), '') = '' THEN true
    WHEN COALESCE(NULLIF(current_setting('app.allowed_platforms', true), ''), '') = '' THEN false
    ELSE p_code = ANY(string_to_array(current_setting('app.allowed_platforms', true), ','))
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_is_agency_staff()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT public.rls_user_id() IS NOT NULL AND public.rls_user_type() <> 'brand_viewer';
$$;

CREATE OR REPLACE FUNCTION public.rls_can_access_shop(s_id bigint)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT public.rls_user_id() IS NOT NULL AND (
    s_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.dim_shop ds
      WHERE ds.id = s_id
        AND (
          (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
          OR ds.tenant_id = public.rls_tenant_id()
        )
        AND public.rls_has_platform(ds.platform_code)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION
  public.rls_user_id(),
  public.rls_role(),
  public.rls_user_type(),
  public.rls_tenant_id(),
  public.rls_anchor_id(),
  public.rls_brand_client_id(),
  public.rls_can_view_cost(),
  public.rls_can_view_anchors(),
  public.rls_allowed_project_ids(),
  public.rls_has_project(integer),
  public.rls_has_platform(text),
  public.rls_is_agency_staff(),
  public.rls_can_access_shop(bigint)
TO leyova_app;

-- ============================================================
-- 6. 核心业务表启用 PostgreSQL Row-Level Security (RLS)
-- ============================================================

-- 6.1 agency_clients (多租户 + brand_viewer 只读本品牌客户)
ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_agency_clients_select ON public.agency_clients;
DROP POLICY IF EXISTS p_agency_clients_write ON public.agency_clients;

CREATE POLICY p_agency_clients_select ON public.agency_clients
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR (
        tenant_id = public.rls_tenant_id()
        AND (
          public.rls_is_agency_staff()
          OR id = public.rls_brand_client_id()
        )
      )
    )
  );

CREATE POLICY p_agency_clients_write ON public.agency_clients
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.2 agency_projects (多租户 + 平台权限 + brand_viewer project_ids 隔离)
ALTER TABLE public.agency_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_agency_projects_select ON public.agency_projects;
DROP POLICY IF EXISTS p_agency_projects_write ON public.agency_projects;

CREATE POLICY p_agency_projects_select ON public.agency_projects
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_has_platform(platform_code)
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR (
        tenant_id = public.rls_tenant_id()
        AND (
          public.rls_is_agency_staff()
          OR public.rls_has_project(id)
        )
      )
    )
  );

CREATE POLICY p_agency_projects_write ON public.agency_projects
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.3 agency_settlement_bills (多租户 + 财务角色隔离 + 品牌方仅看已发送账单)
ALTER TABLE public.agency_settlement_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_settlement_bills_select ON public.agency_settlement_bills;
DROP POLICY IF EXISTS p_settlement_bills_write ON public.agency_settlement_bills;

CREATE POLICY p_settlement_bills_select ON public.agency_settlement_bills
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR (
        tenant_id = public.rls_tenant_id()
        AND (
          (public.rls_is_agency_staff() AND public.rls_role() IN ('admin', 'finance', 'ops_director'))
          OR (
            public.rls_user_type() = 'brand_viewer'
            AND public.rls_has_project(project_id)
            AND status IN ('sent', 'confirmed', 'paid')
          )
        )
      )
    )
  );

CREATE POLICY p_settlement_bills_write ON public.agency_settlement_bills
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'finance')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'finance')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.4 agency_settlement_items
ALTER TABLE public.agency_settlement_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_settlement_items_select ON public.agency_settlement_items;
DROP POLICY IF EXISTS p_settlement_items_write ON public.agency_settlement_items;

CREATE POLICY p_settlement_items_select ON public.agency_settlement_items
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR (
        tenant_id = public.rls_tenant_id()
        AND (
          (public.rls_is_agency_staff() AND public.rls_role() IN ('admin', 'finance', 'ops_director'))
          OR (
            public.rls_user_type() = 'brand_viewer'
            AND EXISTS (
              SELECT 1 FROM public.agency_settlement_bills b
              WHERE b.id = bill_id
                AND b.tenant_id = public.rls_tenant_id()
                AND public.rls_has_project(b.project_id)
                AND b.status IN ('sent', 'confirmed', 'paid')
            )
          )
        )
      )
    )
  );

CREATE POLICY p_settlement_items_write ON public.agency_settlement_items
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'finance')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'finance')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.5 brand_viewer_permissions
ALTER TABLE public.brand_viewer_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_bvp_select ON public.brand_viewer_permissions;
DROP POLICY IF EXISTS p_bvp_write ON public.brand_viewer_permissions;

CREATE POLICY p_bvp_select ON public.brand_viewer_permissions
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR (
        tenant_id = public.rls_tenant_id()
        AND (
          (public.rls_is_agency_staff() AND public.rls_role() IN ('admin', 'ops_director'))
          OR user_id = public.rls_user_id()
        )
      )
    )
  );

CREATE POLICY p_bvp_write ON public.brand_viewer_permissions
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.6 dim_shop (多租户 + 平台权限)
ALTER TABLE public.dim_shop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_dim_shop_select ON public.dim_shop;
DROP POLICY IF EXISTS p_dim_shop_write ON public.dim_shop;

CREATE POLICY p_dim_shop_select ON public.dim_shop
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_has_platform(platform_code)
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR tenant_id = public.rls_tenant_id()
    )
  );

CREATE POLICY p_dim_shop_write ON public.dim_shop
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.7 cost_entries (敏感财务成本：仅 super_admin/admin/finance 或显式授权的 brand_viewer)
ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_cost_entries_select ON public.cost_entries;
DROP POLICY IF EXISTS p_cost_entries_write ON public.cost_entries;

CREATE POLICY p_cost_entries_select ON public.cost_entries
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_can_access_shop(shop_id)
    AND public.rls_has_platform(platform_code)
    AND (
      (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
      OR (
        tenant_id = public.rls_tenant_id()
        AND (
          (public.rls_is_agency_staff() AND public.rls_role() IN ('admin', 'finance'))
          OR (public.rls_user_type() = 'brand_viewer' AND public.rls_can_view_cost())
        )
      )
    )
  );

CREATE POLICY p_cost_entries_write ON public.cost_entries
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'finance')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'finance')
    AND (public.rls_role() = 'super_admin' OR tenant_id = public.rls_tenant_id())
  );

-- 6.8 live_sessions (主播/员工行级自隔离 + 品牌方项目隔离 + 平台隔离)
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_live_sessions_select ON public.live_sessions;
DROP POLICY IF EXISTS p_live_sessions_write ON public.live_sessions;

CREATE POLICY p_live_sessions_select ON public.live_sessions
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND public.rls_has_platform(platform_code)
    AND (
      (
        public.rls_user_type() = 'brand_viewer'
        AND project_id IS NOT NULL
        AND public.rls_has_project(project_id)
      )
      OR (
        public.rls_is_agency_staff()
        AND (
          public.rls_role() <> 'employee'
          OR anchor_id = public.rls_anchor_id()
          OR (public.rls_anchor_id() IS NULL AND operator_id = public.rls_user_id())
        )
      )
    )
  );

CREATE POLICY p_live_sessions_write ON public.live_sessions
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND (
      public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'controller')
      OR (
        public.rls_role() = 'employee'
        AND (
          anchor_id = public.rls_anchor_id()
          OR (public.rls_anchor_id() IS NULL AND operator_id = public.rls_user_id())
        )
      )
    )
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND (
      public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'controller')
      OR (
        public.rls_role() = 'employee'
        AND (
          anchor_id = public.rls_anchor_id()
          OR (public.rls_anchor_id() IS NULL AND operator_id = public.rls_user_id())
        )
      )
    )
  );

-- 6.9 anchor_rankings 已下线，跳过其 RLS 配置
ALTER TABLE public.anchor_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_anchor_capabilities_select ON public.anchor_capabilities;
DROP POLICY IF EXISTS p_anchor_capabilities_write ON public.anchor_capabilities;

CREATE POLICY p_anchor_capabilities_select ON public.anchor_capabilities
  FOR SELECT
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      (
        public.rls_is_agency_staff()
        AND (
          public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'hrbp', 'finance')
          OR (public.rls_role() IN ('employee', 'controller') AND anchor_id = public.rls_anchor_id())
        )
      )
      OR (
        public.rls_user_type() = 'brand_viewer'
        AND public.rls_can_view_anchors()
        AND EXISTS (
          SELECT 1 FROM public.live_sessions ls
          WHERE ls.anchor_id = anchor_capabilities.anchor_id
            AND public.rls_has_project(ls.project_id)
        )
      )
    )
  );

CREATE POLICY p_anchor_capabilities_write ON public.anchor_capabilities
  FOR ALL
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'hrbp')
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'hrbp')
  );

-- 6.10 全渠道店铺事实表与汇总表（平台维度 + dim_shop 租户边界 + brand_viewer 只读）
-- Partitioned parent tables & standard fact tables using shop_id + platform_code
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'fact_trade_daily',
    'fact_traffic_daily',
    'fact_ad_daily',
    'agg_shop_daily',
    'fact_fulfillment_waybill',
    'fact_after_sale_tickets',
    'fact_kol_cooperation',
    'fact_cs_session'
  ]
  LOOP
    -- 视图无法启用 RLS，且其安全边界由底层表保证；仅对真实表生效
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relkind IN ('r', 'p')
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_select ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_write ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY p_%I_select ON public.%I FOR SELECT USING (
        public.rls_user_id() IS NOT NULL
        AND public.rls_has_platform(platform_code)
        AND public.rls_can_access_shop(shop_id)
      )',
      tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY p_%I_write ON public.%I FOR ALL
       USING (
         public.rls_is_agency_staff()
         AND public.rls_role() IN (''super_admin'',''admin'',''ops_director'',''ops_staff'',''operator'',''finance'')
         AND public.rls_has_platform(platform_code)
         AND public.rls_can_access_shop(shop_id)
       )
       WITH CHECK (
         public.rls_is_agency_staff()
         AND public.rls_role() IN (''super_admin'',''admin'',''ops_director'',''ops_staff'',''operator'',''finance'')
         AND public.rls_has_platform(platform_code)
         AND public.rls_can_access_shop(shop_id)
       )',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- canonical_orders & canonical_refund_events use source_platform + store_id
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['canonical_orders', 'canonical_refund_events']
  LOOP
    -- 视图无法启用 RLS，且其安全边界由底层表保证；仅对真实表生效
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relkind IN ('r', 'p')
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_select ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_write ON public.%I', tbl, tbl);

    EXECUTE format(
      'CREATE POLICY p_%I_select ON public.%I FOR SELECT USING (
        public.rls_user_id() IS NOT NULL
        AND public.rls_has_platform(source_platform)
        AND public.rls_can_access_shop(store_id)
      )',
      tbl, tbl
    );

    EXECUTE format(
      'CREATE POLICY p_%I_write ON public.%I FOR ALL
       USING (
         public.rls_is_agency_staff()
         AND public.rls_role() IN (''super_admin'',''admin'',''ops_director'',''ops_staff'',''operator'',''finance'')
         AND public.rls_has_platform(source_platform)
         AND public.rls_can_access_shop(store_id)
       )
       WITH CHECK (
         public.rls_is_agency_staff()
         AND public.rls_role() IN (''super_admin'',''admin'',''ops_director'',''ops_staff'',''operator'',''finance'')
         AND public.rls_has_platform(source_platform)
         AND public.rls_can_access_shop(store_id)
       )',
      tbl, tbl
    );
  END LOOP;
END
$$;

-- 6.11 audit_logs (任何已登录操作可写入，仅 super_admin/admin 可查阅，全局不可删改)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS p_audit_logs_select ON public.audit_logs;

CREATE POLICY p_audit_logs_insert ON public.audit_logs
  FOR INSERT
  WITH CHECK (public.rls_user_id() IS NOT NULL);

CREATE POLICY p_audit_logs_select ON public.audit_logs
  FOR SELECT
  USING (
    public.rls_is_agency_staff()
    AND public.rls_role() IN ('super_admin', 'admin')
  );

COMMIT;

