-- ============================================================================
-- Migration: 103_ai_analysis.sql
-- Description: AI 分析助手四阶编排（P4）
--   1. ai_analysis_runs     分析运行记录（问题、计划、结论、校验结果）
--   2. ai_analysis_steps    每步执行明细（planner/executor/critic/reporter）
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_analysis_runs (
    id bigserial PRIMARY KEY,
    conversation_id bigint REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
    user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
    mode varchar(30) NOT NULL DEFAULT 'S1_query',
    question text NOT NULL,
    plan jsonb DEFAULT '{}'::jsonb,
    status varchar(20) DEFAULT 'completed' NOT NULL,  -- completed | needs_review | failed
    verdict jsonb DEFAULT '{}'::jsonb,
    duration_ms integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_conv ON public.ai_analysis_runs (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_user ON public.ai_analysis_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_analysis_steps (
    id bigserial PRIMARY KEY,
    run_id bigint NOT NULL REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE,
    seq integer NOT NULL,
    role varchar(20) NOT NULL,             -- planner | executor | critic | reporter
    tool_name varchar(60) NOT NULL,
    input jsonb DEFAULT '{}'::jsonb,
    output_ref jsonb DEFAULT '{}'::jsonb,
    snapshot_hash varchar(64),
    row_count integer DEFAULT 0,
    duration_ms integer DEFAULT 0,
    status varchar(20) DEFAULT 'ok' NOT NULL,
    error text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_steps_run ON public.ai_analysis_steps (run_id, seq);

INSERT INTO public.schema_migrations (version, name)
VALUES ('103_ai_analysis', 'AI analysis orchestration runs and steps')
ON CONFLICT (version) DO NOTHING;
