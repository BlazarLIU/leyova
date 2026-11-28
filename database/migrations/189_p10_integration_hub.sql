-- database/migrations/189_p10_integration_hub.sql
-- W8 Integration Hub：连接器、加密凭证、调用审计、Webhook 验签配置
-- 约束：凭证密文只进不出；调用日志脱敏；所有业务表按租户 RLS 隔离。
BEGIN;

-- ── 凭证（AES-256-GCM 密文，永不返回明文）──
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  platform VARCHAR(64) NOT NULL,
  label VARCHAR(64) NOT NULL DEFAULT 'default',
  secret_enc TEXT NOT NULL,
  secret_hint VARCHAR(32) NOT NULL DEFAULT '',
  key_version INT NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_by BIGINT NULL,
  rotated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_credential UNIQUE (tenant_id, platform, label),
  CONSTRAINT ck_integration_credential_status CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_platform
  ON public.integration_credentials (tenant_id, platform);

-- ── 连接（能力清单、鉴权状态、限流、健康态）──
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  platform VARCHAR(64) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'platform',
  auth_type VARCHAR(32) NOT NULL DEFAULT 'app_secret',
  auth_status VARCHAR(16) NOT NULL DEFAULT 'unconfigured',
  capability_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  credential_id UUID NULL REFERENCES public.integration_credentials(id) ON DELETE SET NULL,
  rate_limit_per_min INT NOT NULL DEFAULT 60,
  health_status VARCHAR(16) NOT NULL DEFAULT 'unknown',
  health_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_connection UNIQUE (tenant_id, platform),
  CONSTRAINT ck_integration_auth_status CHECK (auth_status IN ('unconfigured', 'configured', 'invalid')),
  CONSTRAINT ck_integration_health_status CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'unconfigured', 'down')),
  CONSTRAINT ck_integration_rate_limit CHECK (rate_limit_per_min BETWEEN 1 AND 6000)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant
  ON public.integration_connections (tenant_id, category, platform);

-- ── 调用日志（脱敏摘要、耗时、错误码、重试次数）──
CREATE TABLE IF NOT EXISTS public.integration_call_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1,
  connection_id UUID NULL REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  platform VARCHAR(64) NOT NULL,
  operation VARCHAR(100) NOT NULL,
  method VARCHAR(8) NOT NULL DEFAULT 'INTERNAL',
  request_summary TEXT NOT NULL DEFAULT '',
  response_summary TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'success',
  http_status INT NULL,
  error_code VARCHAR(64) NULL,
  latency_ms INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  actor_user_id BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_integration_call_status CHECK (status IN ('success', 'error', 'rate_limited', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_integration_call_logs_tenant_time
  ON public.integration_call_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_call_logs_platform
  ON public.integration_call_logs (tenant_id, platform, created_at DESC);

-- ── Webhook（验签密钥、幂等窗口、重放保护）──
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  platform VARCHAR(64) NOT NULL,
  secret_enc TEXT NOT NULL DEFAULT '',
  replay_window_sec INT NOT NULL DEFAULT 300,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_received_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_webhook UNIQUE (tenant_id, platform),
  CONSTRAINT ck_integration_webhook_window CHECK (replay_window_sec BETWEEN 30 AND 86400)
);

-- ── 默认连接器（能力清单在运行时由代码同步）──
INSERT INTO public.integration_connections
  (tenant_id, platform, display_name, category, auth_type, capability_keys)
VALUES
  (1, 'douyin_open', '抖音开放平台', 'platform', 'app_secret', '[]'::jsonb),
  (1, 'qianchuan', '巨量千川', 'advertising', 'oauth2', '[]'::jsonb),
  (1, 'doubao', '豆包（火山方舟）', 'llm', 'api_key', '[]'::jsonb),
  (1, 'dashscope', '通义千问（百炼）', 'llm', 'api_key', '[]'::jsonb)
ON CONFLICT (tenant_id, platform) DO NOTHING;

-- ── RLS：租户隔离，超管跨租户 ──
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_integration_credentials_tenant ON public.integration_credentials;
CREATE POLICY p_integration_credentials_tenant ON public.integration_credentials
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_integration_connections_tenant ON public.integration_connections;
CREATE POLICY p_integration_connections_tenant ON public.integration_connections
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

ALTER TABLE public.integration_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_integration_call_logs_tenant ON public.integration_call_logs;
CREATE POLICY p_integration_call_logs_tenant ON public.integration_call_logs
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_integration_webhooks_tenant ON public.integration_webhooks;
CREATE POLICY p_integration_webhooks_tenant ON public.integration_webhooks
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

COMMIT;
