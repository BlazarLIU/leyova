-- database/migrations/182_ai_v2_llm_call_telemetry.sql
-- X6: LLM 调用统一落库可观测（ai_v2_llm_call 扩展）
BEGIN;

ALTER TABLE public.ai_v2_llm_call
  ALTER COLUMN run_id DROP NOT NULL,
  ALTER COLUMN tenant_id SET DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'openai-compatible',
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS prompt_chars INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_chars INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_v2_llm_created
  ON public.ai_v2_llm_call (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_v2_llm_tenant
  ON public.ai_v2_llm_call (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_v2_llm_conv
  ON public.ai_v2_llm_call (conversation_id);

COMMIT;
