-- Migration 165: P3 结构收敛 — 权限 8→3 收敛、通用 RLS Policy 函数与架构归一
-- Master Plan §3.2 #1, §3.2 #10, §4.1

BEGIN;

-- 1. 新建 Casbin / Medusa 风格统一三表
-- 1.1 角色主表 sys_role
CREATE TABLE IF NOT EXISTS public.sys_role (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.2 角色权限策略表 sys_role_permission (Casbin p rule: p, role, resource, action, effect)
CREATE TABLE IF NOT EXISTS public.sys_role_permission (
  id BIGSERIAL PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL REFERENCES public.sys_role(code) ON DELETE CASCADE,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL DEFAULT '*',
  effect VARCHAR(10) NOT NULL DEFAULT 'allow',
  scope_type VARCHAR(20) NOT NULL DEFAULT 'tenant',
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sys_role_perm UNIQUE(role_code, resource, action)
);

-- 1.3 用户角色归属表 sys_user_role (Casbin g rule: g, user, role)
CREATE TABLE IF NOT EXISTS public.sys_user_role (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_code VARCHAR(50) NOT NULL REFERENCES public.sys_role(code) ON DELETE CASCADE,
  tenant_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sys_user_role UNIQUE(user_id, role_code, tenant_id)
);

-- 2. 数据回填与同步
-- 2.1 从 roles 回填 sys_role
INSERT INTO public.sys_role (id, code, name, description, is_system, created_at, updated_at)
SELECT id, code, name, COALESCE(description, ''), (code IN ('super_admin', 'admin')), created_at, now()
FROM public.roles
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

SELECT setval('public.sys_role_id_seq', COALESCE((SELECT MAX(id) FROM public.sys_role), 1));

-- 2.2 从 role_module_grants 回填 sys_role_permission (显式 grant/deny)
INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type, created_at)
SELECT 
  rmg.role_code,
  'module:' || rmg.module_code,
  '*',
  rmg.effect,
  'tenant',
  rmg.created_at
FROM public.role_module_grants rmg
JOIN public.sys_role r ON r.code = rmg.role_code
ON CONFLICT (role_code, resource, action) DO UPDATE
SET effect = EXCLUDED.effect;

-- 2.3 从 role_modules 补充缺失模块为 allow
INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type, created_at)
SELECT 
  rm.role_code,
  'module:' || rm.module_code,
  '*',
  'allow',
  'tenant',
  now()
FROM public.role_modules rm
JOIN public.sys_role r ON r.code = rm.role_code
ON CONFLICT (role_code, resource, action) DO NOTHING;

-- 2.4 从 role_platform_permissions 回填平台权限
INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type, created_at)
SELECT 
  r.code,
  'platform:' || rpp.platform_code,
  '*',
  'allow',
  'tenant',
  COALESCE(rpp.created_at, now())
FROM public.role_platform_permissions rpp
JOIN public.roles r ON r.id = rpp.role_id
JOIN public.sys_role sr ON sr.code = r.code
ON CONFLICT (role_code, resource, action) DO NOTHING;

-- 2.5 super_admin 默认通配符 *
INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type, created_at)
VALUES ('super_admin', '*', '*', 'allow', 'all', now())
ON CONFLICT (role_code, resource, action) DO NOTHING;

-- 2.6 从 users 回填 sys_user_role
INSERT INTO public.sys_user_role (user_id, role_code, tenant_id, created_at)
SELECT u.id, u.role, COALESCE(u.tenant_id, 1), u.created_at
FROM public.users u
JOIN public.sys_role r ON r.code = u.role
ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING;

-- 3. 双向同步触发器（保障旧端点与旧测试在迁移期 100% 行为一致）
CREATE OR REPLACE FUNCTION public.sync_roles_to_sys_role()
RETURNS trigger
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sys_role (id, code, name, description, is_system, created_at, updated_at)
    VALUES (NEW.id, NEW.code, NEW.name, COALESCE(NEW.description, ''), (NEW.code IN ('super_admin', 'admin')), NEW.created_at, now())
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.sys_role
    SET code = NEW.code, name = NEW.name, description = COALESCE(NEW.description, ''), updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_role WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_roles_to_sys_role ON public.roles;
CREATE TRIGGER trg_sync_roles_to_sys_role
AFTER INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.sync_roles_to_sys_role();

-- 3.2 角色模块与权限同步触发器
CREATE OR REPLACE FUNCTION public.sync_role_modules_to_sys_perm()
RETURNS trigger
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type)
    VALUES (NEW.role_code, 'module:' || NEW.module_code, '*', 'allow', 'tenant')
    ON CONFLICT (role_code, resource, action) DO UPDATE SET effect = 'allow';
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_role_permission
    WHERE role_code = OLD.role_code AND resource = 'module:' || OLD.module_code;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_role_modules_to_sys_perm ON public.role_modules;
CREATE TRIGGER trg_sync_role_modules_to_sys_perm
AFTER INSERT OR DELETE ON public.role_modules
FOR EACH ROW EXECUTE FUNCTION public.sync_role_modules_to_sys_perm();

-- 3.3 角色授权变更同步
CREATE OR REPLACE FUNCTION public.sync_role_grants_to_sys_perm()
RETURNS trigger
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type)
    VALUES (NEW.role_code, 'module:' || NEW.module_code, '*', NEW.effect, 'tenant')
    ON CONFLICT (role_code, resource, action) DO UPDATE SET effect = NEW.effect;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_role_permission
    WHERE role_code = OLD.role_code AND resource = 'module:' || OLD.module_code;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_role_grants_to_sys_perm ON public.role_module_grants;
CREATE TRIGGER trg_sync_role_grants_to_sys_perm
AFTER INSERT OR UPDATE OR DELETE ON public.role_module_grants
FOR EACH ROW EXECUTE FUNCTION public.sync_role_grants_to_sys_perm();

-- 3.4 用户角色变更同步
CREATE OR REPLACE FUNCTION public.sync_user_to_sys_user_role()
RETURNS trigger
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL THEN
      INSERT INTO public.sys_user_role (user_id, role_code, tenant_id)
      VALUES (NEW.id, NEW.role, COALESCE(NEW.tenant_id, 1))
      ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      DELETE FROM public.sys_user_role WHERE user_id = OLD.id;
      IF NEW.role IS NOT NULL THEN
        INSERT INTO public.sys_user_role (user_id, role_code, tenant_id)
        VALUES (NEW.id, NEW.role, COALESCE(NEW.tenant_id, 1))
        ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_user_role WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_to_sys_user_role ON public.users;
CREATE TRIGGER trg_sync_user_to_sys_user_role
AFTER INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_to_sys_user_role();

-- 4. 通用 RLS Policy 函数与通用 Scope 判定
CREATE OR REPLACE FUNCTION public.rls_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.rls_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION public.rls_check_permission(
  p_resource text,
  p_action text DEFAULT '*'
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN public.rls_user_id() IS NULL THEN false
      WHEN public.rls_role() = 'super_admin' THEN true
      ELSE (
        NOT EXISTS (
          SELECT 1 FROM public.sys_role_permission
          WHERE role_code = public.rls_role()
            AND (resource = p_resource OR resource = '*' OR p_resource LIKE resource || ':%')
            AND (action = p_action OR action = '*')
            AND effect = 'deny'
        )
        AND (
          EXISTS (
            SELECT 1 FROM public.sys_role_permission
            WHERE role_code = public.rls_role()
              AND (resource = p_resource OR resource = '*' OR p_resource LIKE resource || ':%')
              AND (action = p_action OR action = '*')
              AND effect = 'allow'
          )
          OR public.rls_is_agency_staff()
        )
      )
    END;
$$;

CREATE OR REPLACE FUNCTION public.rls_check_scope(
  p_resource text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_shop_id int DEFAULT NULL,
  p_tenant_id int DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_super_admin()
      OR (
        (
          p_tenant_id IS NULL
          OR public.rls_tenant_id() = 0
          OR p_tenant_id = public.rls_tenant_id()
        )
        AND (
          p_platform IS NULL
          OR public.rls_has_platform(p_platform)
        )
        AND (
          p_shop_id IS NULL
          OR public.rls_can_access_shop(p_shop_id)
        )
        AND (
          p_resource IS NULL
          OR public.rls_check_permission(p_resource, 'read')
        )
      )
    );
$$;

-- 5. 标注 30 张空表 (Master Plan §3.2 #10)
COMMENT ON TABLE public.data_uploads IS 'planned: unified ingestion pipeline staging';
COMMENT ON TABLE public.import_files IS 'planned: raw import file metadata registry';
COMMENT ON TABLE public.data_exports IS 'planned: async export task tracking';
COMMENT ON TABLE public.validation_runs IS 'planned: automated data validation run log';
COMMENT ON TABLE public.publish_runs IS 'planned: data publish run receipt';
COMMENT ON TABLE public.publish_reversals IS 'planned: data publish rollback receipt';
COMMENT ON TABLE public.reconciliation_runs IS 'planned: financial reconciliation batch run';
COMMENT ON TABLE public.data_quality_issues IS 'planned: historical quality issue registry';
COMMENT ON TABLE public.review_actions IS 'planned: review action item audit';
COMMENT ON TABLE public.improvement_tasks IS 'planned: governance improvement task tracking';
COMMENT ON TABLE public.content_assets IS 'planned: content studio digital asset';
COMMENT ON TABLE public.content_providers IS 'planned: external creator / MCN registry';
COMMENT ON TABLE public.content_tasks IS 'planned: content production workflow task';
COMMENT ON TABLE public.upload_column_mappings IS 'planned: platform header mapping template';
COMMENT ON TABLE public.field_mapping_rules IS 'planned: data pipeline field transformation rules';
COMMENT ON TABLE public.entity_aliases IS 'planned: cross-platform entity matching aliases';
COMMENT ON TABLE public.overview_activities IS 'planned: dashboard activity timeline feed';
COMMENT ON TABLE public.overview_daily_stats_archive IS 'planned: cold storage archive for daily stats';
COMMENT ON TABLE public.video_metrics IS 'planned: video playback performance metrics';

-- 6. 权限赋予
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sys_role TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sys_role_permission TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sys_user_role TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.sys_role_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.sys_role_permission_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.sys_user_role_id_seq TO leyova_app;
GRANT EXECUTE ON FUNCTION public.rls_is_super_admin() TO leyova_app;
GRANT EXECUTE ON FUNCTION public.rls_check_permission(text, text) TO leyova_app;
GRANT EXECUTE ON FUNCTION public.rls_check_scope(text, text, int, int) TO leyova_app;

-- 启用 RLS
ALTER TABLE public.sys_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_user_role ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_sys_role_select ON public.sys_role;
CREATE POLICY p_sys_role_select ON public.sys_role FOR SELECT USING (true);
DROP POLICY IF EXISTS p_sys_role_modify ON public.sys_role;
CREATE POLICY p_sys_role_modify ON public.sys_role FOR ALL
USING (public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_role() = 'admin'))
WITH CHECK (public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_role() = 'admin'));

DROP POLICY IF EXISTS p_sys_role_perm_select ON public.sys_role_permission;
CREATE POLICY p_sys_role_perm_select ON public.sys_role_permission FOR SELECT USING (true);
DROP POLICY IF EXISTS p_sys_role_perm_modify ON public.sys_role_permission;
CREATE POLICY p_sys_role_perm_modify ON public.sys_role_permission FOR ALL
USING (public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_role() = 'admin'))
WITH CHECK (public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_role() = 'admin'));

DROP POLICY IF EXISTS p_sys_user_role_select ON public.sys_user_role;
CREATE POLICY p_sys_user_role_select ON public.sys_user_role FOR SELECT
USING (tenant_id = public.rls_tenant_id() OR public.rls_is_super_admin());
DROP POLICY IF EXISTS p_sys_user_role_modify ON public.sys_user_role;
CREATE POLICY p_sys_user_role_modify ON public.sys_user_role FOR ALL
USING (public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_role() = 'admin'))
WITH CHECK (public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_role() = 'admin'));

COMMIT;
