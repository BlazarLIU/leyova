-- database/migrations/157_p6_campaign_plan_dispatch.sql
-- P6 闭环补口：AI 运营方案审批后下游自动拆解支持字段
BEGIN;

ALTER TABLE public.campaign_plan
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatched_by INT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_campaign_plan_dispatched_at ON public.campaign_plan(dispatched_at);

COMMIT;
