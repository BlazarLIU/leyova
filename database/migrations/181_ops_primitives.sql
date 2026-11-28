-- ============================================================================
-- 181：运营三原语（W3）
-- ----------------------------------------------------------------------------
-- 1. biz_targets     目标原语：日/周/月/大促 × 公司/店铺/直播间/主播/商品 × 指标，版本化留痕
-- 2. decision_cases  决策案原语：证据 / ≥2 方案（含「不做」）/ 预期影响 / R0-R4 / 状态机
-- 3. improvement_tasks 扩展：decision_case_id / expected_impact / measure_at / outcome / outcome_status
-- 4. alert_events 扩展：ack_status / ack_by / ack_at / ack_note（告警确认落库，不再只有前端态）
--
-- 只新增原语与必要列，不复制已有表，不引入与现有约定冲突的结构。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 目标（Target）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.biz_targets (
  id            bigserial PRIMARY KEY,
  tenant_id     integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_type   text NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'campaign')),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  scope_type    text NOT NULL CHECK (scope_type IN ('company', 'shop', 'live_room', 'anchor', 'product')),
  scope_id      bigint,
  metric_code   text NOT NULL,
  target_value  numeric(18, 2) NOT NULL,
  currency      text NOT NULL DEFAULT 'CNY',
  version       integer NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  source        text NOT NULL DEFAULT 'manual',
  note          text,
  created_by    integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biz_targets_period_check CHECK (period_end >= period_start),
  CONSTRAINT biz_targets_scope_check CHECK (scope_type = 'company' OR scope_id IS NOT NULL)
);

-- 同一租户 / 期间 / 范围 / 指标，只允许一个 active 版本
CREATE UNIQUE INDEX IF NOT EXISTS uq_biz_targets_active
  ON public.biz_targets (tenant_id, period_type, period_start, scope_type, COALESCE(scope_id, 0), metric_code)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_biz_targets_lookup
  ON public.biz_targets (tenant_id, metric_code, period_start, period_end)
  WHERE status = 'active';

-- ────────────────────────────────────────────────────────────
-- 2. 决策案（Decision Case）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decision_cases (
  id                bigserial PRIMARY KEY,
  tenant_id         integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_no           text NOT NULL,
  title             text NOT NULL,
  problem_statement text NOT NULL DEFAULT '',
  domain            text NOT NULL DEFAULT 'live'
                      CHECK (domain IN ('live', 'ads', 'assortment', 'finance', 'hr', 'governance')),
  evidence          jsonb NOT NULL DEFAULT '[]'::jsonb,
  options           jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen_option     text,
  expected_impact   jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level        text NOT NULL DEFAULT 'R2' CHECK (risk_level IN ('R0', 'R1', 'R2', 'R3', 'R4')),
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'applied', 'measured', 'closed')),
  owner_user_id     integer REFERENCES public.users(id) ON DELETE SET NULL,
  owner_name        text,
  approved_by       integer REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  applied_at        timestamptz,
  measure_after     date NOT NULL DEFAULT (CURRENT_DATE + 7),
  outcome           jsonb,
  outcome_status    text NOT NULL DEFAULT 'pending'
                      CHECK (outcome_status IN ('pending', 'measured', 'inconclusive', 'failed')),
  fingerprint       text,
  created_by_agent  text,
  run_id            text,
  created_by        integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decision_cases_options_check
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2),
  CONSTRAINT decision_cases_evidence_check CHECK (jsonb_typeof(evidence) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_cases_no
  ON public.decision_cases (tenant_id, case_no);

-- 同一租户同一指纹只落一个决策案（AI/值守去重）
CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_cases_fingerprint
  ON public.decision_cases (tenant_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_cases_status
  ON public.decision_cases (tenant_id, status, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 3. 动作与效果（扩展现有 improvement_tasks）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.improvement_tasks
  ADD COLUMN IF NOT EXISTS decision_case_id bigint REFERENCES public.decision_cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_impact jsonb,
  ADD COLUMN IF NOT EXISTS measure_at date,
  ADD COLUMN IF NOT EXISTS outcome jsonb,
  ADD COLUMN IF NOT EXISTS outcome_status text
    CONSTRAINT improvement_tasks_outcome_status_check
    CHECK (outcome_status IS NULL OR outcome_status IN ('pending', 'measured', 'inconclusive', 'failed'));

CREATE INDEX IF NOT EXISTS idx_improvement_tasks_decision_case
  ON public.improvement_tasks (decision_case_id);
CREATE INDEX IF NOT EXISTS idx_improvement_tasks_measure_at
  ON public.improvement_tasks (measure_at)
  WHERE outcome_status = 'pending';

-- ────────────────────────────────────────────────────────────
-- 4. 告警确认
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.alert_events
  ADD COLUMN IF NOT EXISTS ack_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT alert_events_ack_status_check
    CHECK (ack_status IN ('pending', 'acknowledged', 'false_positive')),
  ADD COLUMN IF NOT EXISTS ack_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS ack_note text;


COMMIT;
