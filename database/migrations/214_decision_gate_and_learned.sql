-- 214_decision_gate_and_learned.sql
-- 1) 扩展 decision_cases 状态机约束，加入 LEARNED 终态
-- 2) 为 decision_cases 增加 learned_at, learning_summary
-- 3) 新建 decision_data_gates 分层结构表 (GATE_1_HARD, GATE_2_CONFIDENCE, GATE_3_EXTENDED)
-- 4) 补齐 RLS 租户隔离策略

BEGIN;

-- 1. 更新状态机 CHECK 约束，增加 LEARNED
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.decision_cases'::regclass
       AND contype = 'c'
       AND conname = 'decision_cases_status_check'
  LOOP
    EXECUTE format('ALTER TABLE public.decision_cases DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.decision_cases
  ADD CONSTRAINT decision_cases_status_check CHECK (status IN (
    'DRAFT', 'INVESTIGATING', 'PROPOSED', 'AWAITING_APPROVAL', 'APPROVED',
    'EXECUTING', 'AWAITING_REVIEW', 'REVIEWED', 'LEARNED', 'ARCHIVED',
    'DATA_INSUFFICIENT', 'BLOCKED', 'REJECTED', 'CANCELLED'
  ));

-- 2. 增加学习沉淀字段
ALTER TABLE public.decision_cases
  ADD COLUMN IF NOT EXISTS learned_at timestamptz,
  ADD COLUMN IF NOT EXISTS learning_summary text;

-- 3. 分层数据 Gate 结构表 (Gate 1 硬性 / Gate 2 可信度 / Gate 3 扩展)
CREATE TABLE IF NOT EXISTS public.decision_data_gates (
  id                  bigserial PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES public.decision_cases(id) ON DELETE CASCADE,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gate_tier           text NOT NULL CHECK (gate_tier IN ('GATE_1_HARD', 'GATE_2_CONFIDENCE', 'GATE_3_EXTENDED')),
  check_item          text NOT NULL,
  status              text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'NOT_EVALUABLE')),
  failure_action      text NOT NULL CHECK (failure_action IN ('BLOCK', 'REDUCE_CONFIDENCE', 'WARN')),
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_gate_item_per_case UNIQUE (case_id, check_item)
);

CREATE INDEX IF NOT EXISTS idx_decision_data_gates_lookup
  ON public.decision_data_gates (tenant_id, case_id);

-- 4. 启用 RLS
ALTER TABLE public.decision_data_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_data_gates_tenant_isolation ON public.decision_data_gates;
CREATE POLICY decision_data_gates_tenant_isolation ON public.decision_data_gates
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

COMMIT;
