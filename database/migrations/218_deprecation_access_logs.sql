-- Migration 218: 30 天废弃路由访问观测与下线审计表

CREATE TABLE IF NOT EXISTS public.sys_deprecation_access_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT,
  user_id INT,
  user_role VARCHAR(64),
  method VARCHAR(16) NOT NULL,
  route_path VARCHAR(255) NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(64),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deprecations_route ON public.sys_deprecation_access_logs(route_path, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deprecations_accessed ON public.sys_deprecation_access_logs(accessed_at DESC);

ALTER TABLE public.sys_deprecation_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_sys_deprecation_logs_tenant ON public.sys_deprecation_access_logs;
CREATE POLICY p_sys_deprecation_logs_tenant ON public.sys_deprecation_access_logs
  FOR ALL
  USING (tenant_id IS NULL OR tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id IS NULL OR tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');
