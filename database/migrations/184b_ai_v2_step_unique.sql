-- database/migrations/184b_ai_v2_step_unique.sql
-- Run 断点续跑幂等：同一 run 的 step 序号唯一
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_v2_step_run_seq
  ON public.ai_v2_step (run_id, seq);

COMMIT;
