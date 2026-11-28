-- database/migrations/187_p9_assistant_memory.sql
-- W6 切片 2：助手三类记忆（L1 会话摘要 / L2 个人偏好 / L3 组织术语）
-- 硬规则：个人记忆不跨用户、角色记忆限本角色、组织知识只读、冲突不自动覆盖、无来源不写。
BEGIN;

CREATE TABLE IF NOT EXISTS public.assistant_memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id integer NOT NULL,
  scope text NOT NULL CHECK (scope IN ('session', 'personal', 'role', 'org')),
  owner_user_id integer,          -- personal / session 归属用户
  role_key text,                  -- role 归属角色
  memory_key text NOT NULL,       -- 去重 / 冲突检测键
  content text NOT NULL,
  confidence numeric(3, 2) NOT NULL DEFAULT 0.70,
  sensitivity text NOT NULL DEFAULT 'normal',
  source_type text NOT NULL,      -- 无来源不写
  source_id text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  supersedes_id uuid REFERENCES public.assistant_memory_items(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'superseded', 'deleted')),
  retention_class text,
  created_by integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 同一归属下同一 memory_key 只允许一条 active，冲突候选以 pending 并存等待确认
CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_memory_active
  ON public.assistant_memory_items (
    tenant_id,
    scope,
    COALESCE(owner_user_id, 0),
    COALESCE(role_key, ''),
    memory_key
  )
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_assistant_memory_scope
  ON public.assistant_memory_items (tenant_id, scope, owner_user_id, role_key, status);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_key
  ON public.assistant_memory_items (tenant_id, memory_key);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_created
  ON public.assistant_memory_items (tenant_id, created_at DESC);

ALTER TABLE public.assistant_memory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_assistant_memory_items_tenant ON public.assistant_memory_items;
CREATE POLICY p_assistant_memory_items_tenant ON public.assistant_memory_items
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

CREATE TABLE IF NOT EXISTS public.assistant_memory_audit (
  id BIGSERIAL PRIMARY KEY,
  tenant_id integer NOT NULL,
  memory_id uuid,
  action text NOT NULL,
  actor_user_id integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_memory_audit_memory
  ON public.assistant_memory_audit (tenant_id, memory_id, created_at DESC);

ALTER TABLE public.assistant_memory_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_assistant_memory_audit_tenant ON public.assistant_memory_audit;
CREATE POLICY p_assistant_memory_audit_tenant ON public.assistant_memory_audit
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

COMMIT;