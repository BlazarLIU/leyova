-- database/migrations/188_p9_shadow_suggestions.sql
-- W7 Shadow Mode：域 Agent 建议只记录不执行，人工采纳/忽略并统计采纳率
-- 约束：suggested → adopted | rejected 单向流转；同一 Run 只产生一条建议。
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_v2_shadow_suggestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  run_id VARCHAR(64) REFERENCES public.ai_v2_run(id) ON DELETE SET NULL,
  agent_key VARCHAR(64) NOT NULL,
  suggestion_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'suggested',
  reviewed_by BIGINT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_shadow_status CHECK (status IN ('suggested', 'adopted', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_v2_shadow_run
  ON public.ai_v2_shadow_suggestion (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_v2_shadow_tenant_status
  ON public.ai_v2_shadow_suggestion (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_v2_shadow_agent
  ON public.ai_v2_shadow_suggestion (tenant_id, agent_key);

ALTER TABLE public.ai_v2_shadow_suggestion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ai_v2_shadow_tenant ON public.ai_v2_shadow_suggestion;
CREATE POLICY p_ai_v2_shadow_tenant ON public.ai_v2_shadow_suggestion
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

COMMIT;