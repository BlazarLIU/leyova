-- database/migrations/191_p10_openai_compatible_connector.sql
-- 通用 OpenAI 兼容连接器：支持任意提供 /chat/completions 与 /embeddings 的厂商
BEGIN;

INSERT INTO public.integration_connections
  (tenant_id, platform, display_name, category, auth_type, capability_keys, config, rate_limit_per_min)
VALUES
  (1, 'openai_compatible', 'OpenAI 兼容（自定义）', 'llm', 'api_key', '[]'::jsonb,
   '{"baseUrl": "", "model": "", "embeddingModel": ""}'::jsonb, 120)
ON CONFLICT (tenant_id, platform) DO NOTHING;

COMMIT;