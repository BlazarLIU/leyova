-- database/migrations/183_llm_provider_config.sql
-- 允许超管在界面配置 OpenAI / Anthropic 兼容协议的大模型（密钥 AES-256-GCM 加密存储）
BEGIN;

CREATE TABLE IF NOT EXISTS public.llm_provider_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  protocol VARCHAR(16) NOT NULL DEFAULT 'openai',
  api_base VARCHAR(500) NOT NULL,
  api_key_enc TEXT NOT NULL DEFAULT '',
  model VARCHAR(100) NOT NULL,
  updated_by BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
