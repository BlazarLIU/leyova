-- database/migrations/184_p9_assistant_run_engine.sql
-- W4 助手内核：Run 状态机 / 断点恢复 / 事件表 / Agent 配置
BEGIN;

-- 1. ai_v2_run 扩展为可恢复的 Run 状态机
ALTER TABLE public.ai_v2_run
  ADD COLUMN IF NOT EXISTS user_id INT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_key VARCHAR(64) NOT NULL DEFAULT 'business_analyst',
  ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(32) NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160),
  ADD COLUMN IF NOT EXISTS cursor INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_v2_run_idempotency
  ON public.ai_v2_run (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_v2_run_status
  ON public.ai_v2_run (status, updated_at);

-- 2. 事件表：seq 单调递增，支持 cursor 补发与断线重连
CREATE TABLE IF NOT EXISTS public.ai_v2_event (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES public.ai_v2_run(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  type VARCHAR(48) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  tenant_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_event_run_seq
  ON public.ai_v2_event (run_id, seq);

ALTER TABLE public.ai_v2_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ai_v2_event_tenant ON public.ai_v2_event;
CREATE POLICY p_ai_v2_event_tenant ON public.ai_v2_event
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

-- 3. Agent 即配置：prompt + 工具白名单 + 风险上限
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_key VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  tool_allowlist TEXT[] NOT NULL DEFAULT '{}',
  risk_ceiling VARCHAR(8) NOT NULL DEFAULT 'R2',
  output_contract JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, agent_key)
);

ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_agent_configs_tenant ON public.agent_configs;
CREATE POLICY p_agent_configs_tenant ON public.agent_configs
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

-- 4. 默认五域 Agent（工具白名单为空 = 仅允许只读工具）
INSERT INTO public.agent_configs (tenant_id, agent_key, name, description, system_prompt, tool_allowlist, risk_ceiling)
VALUES
  (1, 'business_analyst', '经营分析师', '跨域问答、归因、复盘与经营诊断', '你是 Leyova 经营分析师。只使用受控工具取数，结论必须绑定证据。', '{}', 'R2'),
  (1, 'live_ops', '直播运营', '场次、盯盘、排班与话术', '你是直播运营助手，聚焦场次执行与实时异常。', '{}', 'R2'),
  (1, 'ads_ops', '投放优化', '预算、出价与 ROI 诊断', '你是投放优化助手，所有预算变更必须走审批。', '{}', 'R2'),
  (1, 'merchandising', '选品', '货盘结构、坑产与库存风险', '你是选品助手，聚焦货盘结构与库存风险。', '{}', 'R2'),
  (1, 'finance', '财务', '净利口径、结算与成本', '你是财务助手，只读口径，不发起写操作。', '{}', 'R1')
ON CONFLICT (tenant_id, agent_key) DO NOTHING;

COMMIT;
