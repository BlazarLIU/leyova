-- ============================================================================
-- 185：W5 治理与模型网关
-- ----------------------------------------------------------------------------
-- 1. 审批增强：对外 UUID、八态状态机、payload 摘要、执行回执、重放保护
-- 2. 工具 Policy 表：租户级 R0-R4 分级与 allow / require_approval / deny
-- 3. 模型 Profile 表：多档位路由（主 / 备用）+ 超时 / 并发限制
-- 4. Run 级 Token 预算与成本聚合；LLM 流水补 profile / fallback 血缘
--
-- 原则：
--   - 全部使用 IF NOT EXISTS / 可重复执行，不破坏既有数据。
--   - 默认策略保持现有行为（读自动、写审批、管理员专属），不做静默放行。
--   - R4（资金 / 密钥）一律拒绝，任何配置都不能放行。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 审批表增强
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_action_approvals
  ADD COLUMN IF NOT EXISTS public_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS receipt jsonb,
  ADD COLUMN IF NOT EXISTS decision_reason text,
  ADD COLUMN IF NOT EXISTS requested_risk text,
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS executed_by int;

UPDATE public.ai_action_approvals
   SET public_id = gen_random_uuid()
 WHERE public_id IS NULL;

ALTER TABLE public.ai_action_approvals
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_action_approvals_public_id
  ON public.ai_action_approvals(public_id);

-- 八态状态机：pending → approved → executing → executed / failed
--               ↘ rejected / expired / cancelled
ALTER TABLE public.ai_action_approvals
  DROP CONSTRAINT IF EXISTS ai_action_approvals_status_check;

ALTER TABLE public.ai_action_approvals
  ADD CONSTRAINT ai_action_approvals_status_check
  CHECK (status::text = ANY (ARRAY[
    'pending'::text, 'approved'::text, 'executing'::text, 'executed'::text,
    'failed'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_ai_action_approvals_status_expires
  ON public.ai_action_approvals(status, expires_at);

-- ────────────────────────────────────────────────────────────
-- 2. 工具 Policy 表
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_tool_policy (
  id serial PRIMARY KEY,
  tenant_id int NOT NULL DEFAULT 1,
  tool_name text NOT NULL,
  risk_tier text NOT NULL DEFAULT 'R2'
    CHECK (risk_tier IN ('R0', 'R1', 'R2', 'R3', 'R4')),
  effect text NOT NULL DEFAULT 'inherit'
    CHECK (effect IN ('inherit', 'allow', 'require_approval', 'deny')),
  required_permission text,
  max_calls_per_run int,
  note text DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tool_policy_tenant_tool_key UNIQUE (tenant_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_policy_tenant
  ON public.ai_tool_policy(tenant_id, is_enabled);

-- 默认租户策略：写工具显式审批，读工具自动执行；R4 类别禁止
INSERT INTO public.ai_tool_policy (tenant_id, tool_name, risk_tier, effect, note)
VALUES
  (1, 'create_improvement_task', 'R2', 'require_approval', '改进任务需人工确认'),
  (1, 'update_task_status',      'R2', 'require_approval', '任务状态变更需人工确认')
ON CONFLICT (tenant_id, tool_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. 模型 Profile 表（主 / 备用路由）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_model_profile (
  id serial PRIMARY KEY,
  tenant_id int NOT NULL DEFAULT 1,
  profile_key text NOT NULL,
  name text NOT NULL,
  protocol text NOT NULL DEFAULT 'openai'
    CHECK (protocol IN ('openai', 'anthropic')),
  api_base text NOT NULL,
  api_key_enc text DEFAULT '',
  model text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  timeout_ms int NOT NULL DEFAULT 60000,
  max_output_tokens int NOT NULL DEFAULT 2000,
  requests_per_minute int NOT NULL DEFAULT 60,
  is_fallback boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_profile_tenant_key UNIQUE (tenant_id, profile_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_profile_route
  ON public.ai_model_profile(tenant_id, is_enabled, priority);

-- ────────────────────────────────────────────────────────────
-- 4. Run 级 Token 预算 / 成本 / 降级标记
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_v2_run
  ADD COLUMN IF NOT EXISTS token_budget int NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS tokens_used int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_cny numeric(12, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false;

ALTER TABLE public.ai_v2_llm_call
  ADD COLUMN IF NOT EXISTS profile_key text,
  ADD COLUMN IF NOT EXISTS is_fallback boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- 5. 新表 RLS（与既有 AI 表一致：租户隔离，超管可见全部）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ai_tool_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ai_tool_policy_tenant ON public.ai_tool_policy;
CREATE POLICY p_ai_tool_policy_tenant ON public.ai_tool_policy
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

ALTER TABLE public.ai_model_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ai_model_profile_tenant ON public.ai_model_profile;
CREATE POLICY p_ai_model_profile_tenant ON public.ai_model_profile
  FOR ALL
  USING (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin')
  WITH CHECK (tenant_id = public.rls_tenant_id() OR public.rls_role() = 'super_admin');

COMMIT;
