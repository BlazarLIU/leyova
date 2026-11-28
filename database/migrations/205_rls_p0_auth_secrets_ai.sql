-- ============================================================================
-- 205_rls_p0_auth_secrets_ai.sql
--
-- P0 批次：认证 / RBAC、系统密钥与 AI 私有数据，共 22 张表启用 RLS。
--
-- 范围（docs/RLS-190-ENABLEMENT-PLAN.md §4 P0）：
--   F02 认证与 RBAC（10）
--     users, tenants, roles, role_modules, role_module_grants,
--     user_module_overrides, user_platform_permissions, user_sessions,
--     permission_requests, system_module_parameters
--   F03 系统配置与密钥（6）
--     ai_config, llm_provider_config, ai_model_providers,
--     content_providers, system_config, system_jobs
--   F04 AI 私有数据（6）
--     ai_analysis_runs, ai_analysis_steps, ai_context_bindings,
--     ai_conversations, ai_messages, ai_tool_logs
--
-- 原则：
--   - 本批只 ENABLE，不 FORCE（登录 / 初始化 / 定时任务仍走 owner 池）；
--   - 所有策略 fail-closed，未登录上下文不可见；
--   - 复用现有 11 个 GUC，不引入新上下文键；
--   - 幂等：先 DROP POLICY IF EXISTS，再 CREATE，再 ENABLE。
--
-- 两处基于实际调用链的收敛（与计划文本的差异，均更严格或等价）：
--   1. content_providers 读取需要覆盖内容生成路径（content/tasks 由
--      ops_staff 触发，服务端在 RLS 上下文内读取 provider 配置），
--      因此读取限定为内容写角色，写入限定为 super_admin / ops_director，
--      与路由 requireRole 保持一致；api_key 列不通过任何接口回显。
--   2. ai_conversations 的系统报表（cron 以 user_id=1 写入 daily-/patrol-/
--      review- 标题）需要对内部员工保持可见，否则总览日报 / 巡检面板会
--      回归为空；仅放行这三类标题，个人对话仍严格本人可见。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- F02 认证与 RBAC
-- ────────────────────────────────────────────────────────────

-- users：同租户可见 / 本人可见 / 超管全量；写仅超管
DROP POLICY IF EXISTS p_users_select ON public.users;
CREATE POLICY p_users_select ON public.users FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      tenant_id = public.rls_tenant_id()
      OR id = public.rls_user_id()
      OR public.rls_is_super_admin()
    )
  );

DROP POLICY IF EXISTS p_users_write ON public.users;
CREATE POLICY p_users_write ON public.users FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- tenants：仅本租户 / 超管；写仅超管
DROP POLICY IF EXISTS p_tenants_select ON public.tenants;
CREATE POLICY p_tenants_select ON public.tenants FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_tenants_write ON public.tenants;
CREATE POLICY p_tenants_write ON public.tenants FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- roles：登录用户可读（角色字典）；写仅超管
DROP POLICY IF EXISTS p_roles_select ON public.roles;
CREATE POLICY p_roles_select ON public.roles FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_roles_write ON public.roles;
CREATE POLICY p_roles_write ON public.roles FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- role_modules：登录用户可读；写仅超管
DROP POLICY IF EXISTS p_role_modules_select ON public.role_modules;
CREATE POLICY p_role_modules_select ON public.role_modules FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_role_modules_write ON public.role_modules;
CREATE POLICY p_role_modules_write ON public.role_modules FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- role_module_grants：登录用户可读；写仅超管（避免运营自行提权）
DROP POLICY IF EXISTS p_role_module_grants_select ON public.role_module_grants;
CREATE POLICY p_role_module_grants_select ON public.role_module_grants FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_role_module_grants_write ON public.role_module_grants;
CREATE POLICY p_role_module_grants_write ON public.role_module_grants FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- user_module_overrides：本人或超管可读；审批人（ops_director）可写
DROP POLICY IF EXISTS p_user_module_overrides_select ON public.user_module_overrides;
CREATE POLICY p_user_module_overrides_select ON public.user_module_overrides FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_user_module_overrides_write ON public.user_module_overrides;
CREATE POLICY p_user_module_overrides_write ON public.user_module_overrides FOR ALL TO public
  USING (public.rls_role() IN ('super_admin','ops_director'))
  WITH CHECK (public.rls_role() IN ('super_admin','ops_director'));

-- user_platform_permissions：本人或超管可读；写仅超管
DROP POLICY IF EXISTS p_user_platform_permissions_select ON public.user_platform_permissions;
CREATE POLICY p_user_platform_permissions_select ON public.user_platform_permissions FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_user_platform_permissions_write ON public.user_platform_permissions;
CREATE POLICY p_user_platform_permissions_write ON public.user_platform_permissions FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- user_sessions：仅本人 / 超管，禁止跨用户读取
DROP POLICY IF EXISTS p_user_sessions_select ON public.user_sessions;
CREATE POLICY p_user_sessions_select ON public.user_sessions FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_user_sessions_write ON public.user_sessions;
CREATE POLICY p_user_sessions_write ON public.user_sessions FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

-- permission_requests：租户内，本人或审批人可见 / 可写
DROP POLICY IF EXISTS p_permission_requests_select ON public.permission_requests;
CREATE POLICY p_permission_requests_select ON public.permission_requests FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (user_id = public.rls_user_id() OR public.rls_role() IN ('super_admin','ops_director'))
  );

DROP POLICY IF EXISTS p_permission_requests_write ON public.permission_requests;
CREATE POLICY p_permission_requests_write ON public.permission_requests FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (user_id = public.rls_user_id() OR public.rls_role() IN ('super_admin','ops_director'))
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
    AND (user_id = public.rls_user_id() OR public.rls_role() IN ('super_admin','ops_director'))
  );

-- system_module_parameters：登录用户可读；写仅超管
DROP POLICY IF EXISTS p_system_module_parameters_select ON public.system_module_parameters;
CREATE POLICY p_system_module_parameters_select ON public.system_module_parameters FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_system_module_parameters_write ON public.system_module_parameters;
CREATE POLICY p_system_module_parameters_write ON public.system_module_parameters FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- ────────────────────────────────────────────────────────────
-- F03 系统配置与密钥
-- ────────────────────────────────────────────────────────────

-- ai_config：仅超管（知识库 / AI 配置）
DROP POLICY IF EXISTS p_ai_config_select ON public.ai_config;
CREATE POLICY p_ai_config_select ON public.ai_config FOR SELECT TO public
  USING (public.rls_is_super_admin());

DROP POLICY IF EXISTS p_ai_config_write ON public.ai_config;
CREATE POLICY p_ai_config_write ON public.ai_config FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- llm_provider_config：仅超管（API Key）
DROP POLICY IF EXISTS p_llm_provider_config_select ON public.llm_provider_config;
CREATE POLICY p_llm_provider_config_select ON public.llm_provider_config FOR SELECT TO public
  USING (public.rls_is_super_admin());

DROP POLICY IF EXISTS p_llm_provider_config_write ON public.llm_provider_config;
CREATE POLICY p_llm_provider_config_write ON public.llm_provider_config FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- ai_model_providers：租户隔离 + 超管
DROP POLICY IF EXISTS p_ai_model_providers_select ON public.ai_model_providers;
CREATE POLICY p_ai_model_providers_select ON public.ai_model_providers FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_ai_model_providers_write ON public.ai_model_providers;
CREATE POLICY p_ai_model_providers_write ON public.ai_model_providers FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- content_providers：内容写角色可读（生成链路依赖）；写仅超管 / 运营总监
DROP POLICY IF EXISTS p_content_providers_select ON public.content_providers;
CREATE POLICY p_content_providers_select ON public.content_providers FOR SELECT TO public
  USING (public.rls_is_content_writer());

DROP POLICY IF EXISTS p_content_providers_write ON public.content_providers;
CREATE POLICY p_content_providers_write ON public.content_providers FOR ALL TO public
  USING (public.rls_role() IN ('super_admin','ops_director'))
  WITH CHECK (public.rls_role() IN ('super_admin','ops_director'));

-- system_config：登录用户可读；写仅超管
DROP POLICY IF EXISTS p_system_config_select ON public.system_config;
CREATE POLICY p_system_config_select ON public.system_config FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_system_config_write ON public.system_config;
CREATE POLICY p_system_config_write ON public.system_config FOR ALL TO public
  USING (public.rls_is_super_admin())
  WITH CHECK (public.rls_is_super_admin());

-- system_jobs：登录用户可读；运营写角色可写
DROP POLICY IF EXISTS p_system_jobs_select ON public.system_jobs;
CREATE POLICY p_system_jobs_select ON public.system_jobs FOR SELECT TO public
  USING (public.rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_system_jobs_write ON public.system_jobs;
CREATE POLICY p_system_jobs_write ON public.system_jobs FOR ALL TO public
  USING (public.rls_is_ops_writer())
  WITH CHECK (public.rls_is_ops_writer());

-- ────────────────────────────────────────────────────────────
-- F04 AI 私有数据
-- ────────────────────────────────────────────────────────────

-- ai_analysis_runs：仅本人 / 超管
DROP POLICY IF EXISTS p_ai_analysis_runs_select ON public.ai_analysis_runs;
CREATE POLICY p_ai_analysis_runs_select ON public.ai_analysis_runs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_ai_analysis_runs_write ON public.ai_analysis_runs;
CREATE POLICY p_ai_analysis_runs_write ON public.ai_analysis_runs FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

-- ai_analysis_steps：通过父 run 继承可见性
DROP POLICY IF EXISTS p_ai_analysis_steps_select ON public.ai_analysis_steps;
CREATE POLICY p_ai_analysis_steps_select ON public.ai_analysis_steps FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_analysis_runs r
       WHERE r.id = run_id
    )
  );

DROP POLICY IF EXISTS p_ai_analysis_steps_write ON public.ai_analysis_steps;
CREATE POLICY p_ai_analysis_steps_write ON public.ai_analysis_steps FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_analysis_runs r
       WHERE r.id = run_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_analysis_runs r
       WHERE r.id = run_id
    )
  );

-- ai_context_bindings：仅本人 / 超管
DROP POLICY IF EXISTS p_ai_context_bindings_select ON public.ai_context_bindings;
CREATE POLICY p_ai_context_bindings_select ON public.ai_context_bindings FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

DROP POLICY IF EXISTS p_ai_context_bindings_write ON public.ai_context_bindings;
CREATE POLICY p_ai_context_bindings_write ON public.ai_context_bindings FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

-- ai_conversations：
--   读：本人 / 超管 / 内部员工可读系统报表（daily- patrol- review-）
--   写：仅本人 / 超管，禁止改写系统报表
DROP POLICY IF EXISTS p_ai_conversations_select ON public.ai_conversations;
CREATE POLICY p_ai_conversations_select ON public.ai_conversations FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      user_id = public.rls_user_id()
      OR public.rls_is_super_admin()
      OR (
        user_id = 1
        AND public.rls_is_agency_staff()
        AND (
          title LIKE 'daily-%'
          OR title LIKE 'patrol-%'
          OR title LIKE 'review-%'
        )
      )
    )
  );

DROP POLICY IF EXISTS p_ai_conversations_write ON public.ai_conversations;
CREATE POLICY p_ai_conversations_write ON public.ai_conversations FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (user_id = public.rls_user_id() OR public.rls_is_super_admin())
  );

-- ai_messages：通过会话继承可见性；写入要求会话归属本人 / 超管
DROP POLICY IF EXISTS p_ai_messages_select ON public.ai_messages;
CREATE POLICY p_ai_messages_select ON public.ai_messages FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
       WHERE c.id = conversation_id
    )
  );

DROP POLICY IF EXISTS p_ai_messages_write ON public.ai_messages;
CREATE POLICY p_ai_messages_write ON public.ai_messages FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
       WHERE c.id = conversation_id
         AND (c.user_id = public.rls_user_id() OR public.rls_is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
       WHERE c.id = conversation_id
         AND (c.user_id = public.rls_user_id() OR public.rls_is_super_admin())
    )
  );

-- ai_tool_logs：本人 / 超管 / 运营总监（审批与审计）
DROP POLICY IF EXISTS p_ai_tool_logs_select ON public.ai_tool_logs;
CREATE POLICY p_ai_tool_logs_select ON public.ai_tool_logs FOR SELECT TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      actor_user_id = public.rls_user_id()
      OR public.rls_is_super_admin()
      OR public.rls_role() = 'ops_director'
    )
  );

DROP POLICY IF EXISTS p_ai_tool_logs_write ON public.ai_tool_logs;
CREATE POLICY p_ai_tool_logs_write ON public.ai_tool_logs FOR ALL TO public
  USING (
    public.rls_user_id() IS NOT NULL
    AND (
      actor_user_id = public.rls_user_id()
      OR public.rls_is_super_admin()
      OR public.rls_role() = 'ops_director'
    )
  )
  WITH CHECK (
    public.rls_user_id() IS NOT NULL
    AND (
      actor_user_id = public.rls_user_id()
      OR public.rls_is_super_admin()
      OR public.rls_role() = 'ops_director'
    )
  );

-- ────────────────────────────────────────────────────────────
-- 启用 RLS（不 FORCE）
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_modules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_module_grants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_overrides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_platform_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_module_parameters   ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_config                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_provider_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_providers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_jobs                ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_analysis_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_steps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_context_bindings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_logs               ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- F00 豁免：instance_setup 回收应用角色权限（初始化向导走 owner）
-- ────────────────────────────────────────────────────────────
REVOKE ALL ON public.instance_setup FROM leyova_app;
REVOKE ALL ON public.instance_setup FROM PUBLIC;

-- ────────────────────────────────────────────────────────────
-- 断言：22 张表均已启用 RLS 且至少 1 条策略
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  n_pol int;
  rls_on boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','tenants','roles','role_modules','role_module_grants',
    'user_module_overrides','user_platform_permissions','user_sessions',
    'permission_requests','system_module_parameters',
    'ai_config','llm_provider_config','ai_model_providers','content_providers',
    'system_config','system_jobs',
    'ai_analysis_runs','ai_analysis_steps','ai_context_bindings',
    'ai_conversations','ai_messages','ai_tool_logs'
  ] LOOP
    SELECT c.relrowsecurity INTO rls_on
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = t;

    SELECT count(*) INTO n_pol
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = t;

    IF NOT COALESCE(rls_on, false) THEN
      RAISE EXCEPTION 'P0 表未启用 RLS: %', t;
    END IF;
    IF n_pol = 0 THEN
      RAISE EXCEPTION 'P0 表已启用 RLS 但缺少策略: %', t;
    END IF;
  END LOOP;

  RAISE NOTICE '205 完成：P0 22 张表已启用 RLS 并覆盖策略';
END $$;

COMMIT;
