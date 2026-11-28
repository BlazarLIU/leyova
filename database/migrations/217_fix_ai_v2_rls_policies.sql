-- Migration 217: 统一 ai_v2_* 系列表的 RLS 策略，对齐 rls_tenant_id() 与 rls_role()

DROP POLICY IF EXISTS p_ai_v2_run_tenant ON public.ai_v2_run;
CREATE POLICY p_ai_v2_run_tenant ON public.ai_v2_run
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

DROP POLICY IF EXISTS p_ai_v2_step_tenant ON public.ai_v2_step;
CREATE POLICY p_ai_v2_step_tenant ON public.ai_v2_step
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

DROP POLICY IF EXISTS p_ai_v2_evidence_tenant ON public.ai_v2_evidence;
CREATE POLICY p_ai_v2_evidence_tenant ON public.ai_v2_evidence
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

DROP POLICY IF EXISTS p_ai_v2_claim_tenant ON public.ai_v2_claim;
CREATE POLICY p_ai_v2_claim_tenant ON public.ai_v2_claim
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');
