-- ============================================================================
-- 174：W0 安全基线（P0）
-- ----------------------------------------------------------------------------
-- 1. 统一 RLS GUC 键名为 app.tenant_id / app.user_role（与 rls.ts 一致），
--    并复用 117 号迁移创建的 rls_tenant_id() / rls_role() 辅助函数。
-- 2. 修复 164 号迁移中 6 条 USING (true) 的 AI 策略，改为租户隔离 + fail-closed。
-- 3. 回填并收紧 tenant_id：users、ai_v2_run、子表、评测表、审批表。
-- 4. 审批表补 payload_digest / tenant_id，支撑审批前重校验与防篡改。
--
-- 原则：tenant_id 为空视为「无租户上下文」，一律不可见（fail-closed），
--       不再用 tenant_id IS NULL 放行跨租户数据。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. 兜底默认租户
-- ────────────────────────────────────────────────────────────
INSERT INTO public.tenants (id, name, slug, plan)
VALUES (1, '默认租户', 'default', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 1. users.tenant_id：回填 → 默认值 → NOT NULL → FK → 索引
-- ────────────────────────────────────────────────────────────
UPDATE public.users SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE public.users ALTER COLUMN tenant_id SET DEFAULT 1;
ALTER TABLE public.users ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);

-- ────────────────────────────────────────────────────────────
-- 2. ai_v2_run：回填 → NOT NULL → 索引
-- ────────────────────────────────────────────────────────────
UPDATE public.ai_v2_run SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE public.ai_v2_run ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_v2_run_tenant
  ON public.ai_v2_run(tenant_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 3. AI 子表补 tenant_id，并从 run 回填
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_v2_step', 'ai_v2_evidence', 'ai_v2_claim', 'ai_v2_llm_call']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id INT', t);
    EXECUTE format(
      'UPDATE public.%I c SET tenant_id = r.tenant_id FROM public.ai_v2_run r
       WHERE c.run_id = r.id AND c.tenant_id IS NULL', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = 1 WHERE tenant_id IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant ON public.%I(tenant_id)', t, t);
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_tenant_id_fkey');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id)
       REFERENCES public.tenants(id) ON DELETE RESTRICT', t, t || '_tenant_id_fkey');
  END LOOP;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 4. 评测表补 tenant_id
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_eval_case ADD COLUMN IF NOT EXISTS tenant_id INT DEFAULT 1;
UPDATE public.ai_eval_case SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE public.ai_eval_case ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_eval_case_tenant ON public.ai_eval_case(tenant_id);

ALTER TABLE public.ai_eval_run ADD COLUMN IF NOT EXISTS tenant_id INT;
UPDATE public.ai_eval_run er
  SET tenant_id = COALESCE(c.tenant_id, 1)
  FROM public.ai_eval_case c
  WHERE er.case_id = c.id AND er.tenant_id IS NULL;
UPDATE public.ai_eval_run SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE public.ai_eval_run ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_eval_run_tenant ON public.ai_eval_run(tenant_id, batch_id);

-- ────────────────────────────────────────────────────────────
-- 5. 审批表：tenant_id + payload_digest
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_action_approvals ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE public.ai_action_approvals ADD COLUMN IF NOT EXISTS payload_digest VARCHAR(64);

UPDATE public.ai_action_approvals a
  SET tenant_id = COALESCE(u.tenant_id, 1)
  FROM public.users u
  WHERE a.requested_by = u.id AND a.tenant_id IS NULL;
UPDATE public.ai_action_approvals SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE public.ai_action_approvals ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_action_approvals_tenant
  ON public.ai_action_approvals(tenant_id, status);

-- ────────────────────────────────────────────────────────────
-- 6. 重写 164 的 AI RLS 策略：租户隔离 + fail-closed
--    注意：dropped 旧策略后统一使用 rls_tenant_id() / rls_role()
-- ────────────────────────────────────────────────────────────

-- 6.1 ai_v2_run
DROP POLICY IF EXISTS p_ai_v2_run_tenant ON public.ai_v2_run;
CREATE POLICY p_ai_v2_run_tenant ON public.ai_v2_run
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

-- 6.2 子表（step / evidence / claim / llm_call）
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

DROP POLICY IF EXISTS p_ai_v2_llm_tenant ON public.ai_v2_llm_call;
CREATE POLICY p_ai_v2_llm_tenant ON public.ai_v2_llm_call
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

-- 6.3 评测表
DROP POLICY IF EXISTS p_ai_eval_case_read ON public.ai_eval_case;
CREATE POLICY p_ai_eval_case_read ON public.ai_eval_case
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

DROP POLICY IF EXISTS p_ai_eval_run_read ON public.ai_eval_run;
CREATE POLICY p_ai_eval_run_read ON public.ai_eval_run
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

-- 6.4 审批表（此前无策略，新增加固）
ALTER TABLE public.ai_action_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ai_action_approvals_tenant ON public.ai_action_approvals;
CREATE POLICY p_ai_action_approvals_tenant ON public.ai_action_approvals
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

COMMIT;
