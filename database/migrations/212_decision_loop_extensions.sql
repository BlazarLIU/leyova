-- ============================================================================
-- 212：决策闭环扩展 (Decision Loop Extensions)
-- ----------------------------------------------------------------------------
-- 1. 扩展 decision_cases：增加场景键 scene_key、版本号、三态标记与归因等级
-- 2. 新增 decision_memo_versions：不可变的 Decision Memo 七段结构历史快照
-- 3. 新增 decision_evidence_items：结构化确定性证据项快照
-- 4. 新增 decision_case_events：追加式审计事件留痕
-- ============================================================================

BEGIN;

-- 1. 扩展既有 decision_cases
ALTER TABLE public.decision_cases
  ADD COLUMN IF NOT EXISTS scene_key text NOT NULL DEFAULT 'SCENE-A',
  ADD COLUMN IF NOT EXISTS memo_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metric_contract_version text NOT NULL DEFAULT 'v1.1-deterministic',
  ADD COLUMN IF NOT EXISTS amount_state text NOT NULL DEFAULT 'ESTIMATED' CHECK (amount_state IN ('ESTIMATED', 'SETTLEMENT_DERIVED', 'FINALIZED')),
  ADD COLUMN IF NOT EXISTS attribution_grade text NOT NULL DEFAULT 'OBSERVED' CHECK (attribution_grade IN ('OBSERVED', 'ADJUSTED', 'EXPERIMENTAL')),
  ADD COLUMN IF NOT EXISTS data_gate_status text NOT NULL DEFAULT 'PASS' CHECK (data_gate_status IN ('PASS', 'FAIL', 'NOT_EVALUABLE'));

-- 2. 决策备忘录不可变版本表 (Decision Memo Versions)
CREATE TABLE IF NOT EXISTS public.decision_memo_versions (
  id                  bigserial PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES public.decision_cases(id) ON DELETE CASCADE,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version             integer NOT NULL,
  question            text NOT NULL,
  facts               jsonb NOT NULL DEFAULT '[]'::jsonb,
  hypotheses          jsonb NOT NULL DEFAULT '[]'::jsonb,
  forecasts           jsonb NOT NULL DEFAULT '[]'::jsonb,
  options             jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_option  text,
  chosen_option       text,
  evidence_snapshot   jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by          integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_memo_version_per_case UNIQUE (case_id, version)
);

CREATE INDEX IF NOT EXISTS idx_memo_versions_case_tenant
  ON public.decision_memo_versions (tenant_id, case_id);

-- 3. 确定性计算证据项快照 (Decision Evidence Items)
CREATE TABLE IF NOT EXISTS public.decision_evidence_items (
  id                  bigserial PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES public.decision_cases(id) ON DELETE CASCADE,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_code         text NOT NULL,
  metric_name         text NOT NULL,
  metric_value        numeric(18, 4),
  unit                text NOT NULL DEFAULT '',
  time_window         text NOT NULL,
  source_batch_id     bigint,
  quality_status      text NOT NULL DEFAULT 'PASS' CHECK (quality_status IN ('PASS', 'FAIL', 'NOT_EVALUABLE')),
  calc_version        text NOT NULL DEFAULT 'v1.1-deterministic',
  evidence_hash       text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_case
  ON public.decision_evidence_items (tenant_id, case_id);

-- 4. 决策状态流转追加式审计事件 (Decision Case Events)
CREATE TABLE IF NOT EXISTS public.decision_case_events (
  id                  bigserial PRIMARY KEY,
  case_id             bigint NOT NULL REFERENCES public.decision_cases(id) ON DELETE CASCADE,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type          text NOT NULL,
  from_status         text,
  to_status           text NOT NULL,
  operator_id         integer REFERENCES public.users(id) ON DELETE SET NULL,
  operator_name       text,
  note                text,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_case_events_lookup
  ON public.decision_case_events (tenant_id, case_id, created_at DESC);

-- 启用 RLS
ALTER TABLE public.decision_memo_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_case_events ENABLE ROW LEVEL SECURITY;

COMMIT;
