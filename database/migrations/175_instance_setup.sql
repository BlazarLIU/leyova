-- ============================================================================
-- 175：首次部署初始化（W1）
-- ----------------------------------------------------------------------------
-- 1. instance_setup 单例表：记录初始化状态、一次性安装凭证、方案快照。
-- 2. ai_model_providers / setup_templates：初始化与后续模型网关共用。
-- 3. users.must_change_password：首次登录强制改密。
-- 4. 已有部署（已存在 super_admin）自动标记 completed，永久关闭安装入口，
--    避免升级后被重新初始化劫持。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. instance_setup
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.instance_setup (
  id                       smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  status                   text NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'in_progress', 'completed', 'locked')),
  install_token_hash       text,
  install_token_expires_at timestamptz,
  setup_source             text CHECK (setup_source IN ('manual', 'ai')),
  plan_snapshot            jsonb,
  ai_profile               jsonb,
  health_score             smallint,
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.instance_setup (id, status, completed_at)
SELECT 1,
       CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin')
            THEN 'completed' ELSE 'pending' END,
       CASE WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin')
            THEN now() ELSE NULL END
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. 模型 Provider（Setup 与后续 Model Gateway 共用）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_model_providers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile        text NOT NULL DEFAULT 'fast-chat',
  provider       text NOT NULL,
  base_url       text NOT NULL,
  model_name     text NOT NULL,
  api_key_enc    text,
  enabled        boolean NOT NULL DEFAULT true,
  is_default     boolean NOT NULL DEFAULT false,
  last_test_ok   boolean,
  last_tested_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_providers_tenant
  ON public.ai_model_providers(tenant_id, profile);

-- 每个 profile 只允许一个默认
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_model_providers_default
  ON public.ai_model_providers(tenant_id, profile)
  WHERE is_default;

-- ────────────────────────────────────────────────────────────
-- 3. 配置模板
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setup_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  biz_type   text NOT NULL,
  name       text NOT NULL,
  version    integer NOT NULL DEFAULT 1,
  plan       jsonb NOT NULL,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  is_public  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setup_templates_biz
  ON public.setup_templates(biz_type, version DESC);

-- ────────────────────────────────────────────────────────────
-- 4. 首次登录强制改密
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMIT;
