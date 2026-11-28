-- ============================================================================
-- 迁移 225：下线冗余内置角色（P1）
-- ----------------------------------------------------------------------------
-- 决策：内置角色只保留 6 个核心岗位，其余 9 个角色全部下线：
--   video_editor / cs_agent / admin / operator / employee
--   brand_viewer / floor_manager / director / warehouse
--
-- 需要自定义角色的用户走「角色管理」页自建（POST /api/v1/system/roles），
-- 不再预置一批没人用的岗位。
--
-- 本迁移做四件事：
--   1. 清掉所有无 FK 约束的残留引用（role_workbenches / kb_acl / ...）
--   2. 删除 roles 中 9 个角色行（FK CASCADE + 触发器自动清 sys_role / 授权表）
--   3. 收敛 RLS 策略与 helper 函数里的角色字面量（去掉死常量）
--   4. 收敛 sync_roles_to_sys_role 的 is_system 判定
--
-- 保留项：
--   · users.user_type = 'brand_viewer' 是「账号类型」不是角色，全部保留
--   · staff_role_dict（场次岗位字典 anchor/controller/operator/...）不涉及
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. 待下线角色清单
-- ────────────────────────────────────────────────────────────
CREATE TEMP TABLE tmp_obsolete_roles (code varchar(64) PRIMARY KEY) ON COMMIT DROP;
INSERT INTO tmp_obsolete_roles (code) VALUES
  ('video_editor'), ('cs_agent'), ('admin'), ('operator'), ('employee'),
  ('brand_viewer'), ('floor_manager'), ('director'), ('warehouse');

-- ────────────────────────────────────────────────────────────
-- 1. 无 FK 约束的残留引用（需显式清理）
-- ────────────────────────────────────────────────────────────

-- 1.1 工作台：role_key 是 varchar，无 FK
DELETE FROM public.role_workbenches
 WHERE role_key IN (SELECT code FROM tmp_obsolete_roles);

-- 1.2 知识库 ACL：role_code 是 varchar，无 FK
DELETE FROM public.kb_acl
 WHERE role_code IN (SELECT code FROM tmp_obsolete_roles);

-- 1.3 知识库分块 ACL：acl_roles 是 jsonb 数组
UPDATE public.kb_chunks
   SET acl_roles = COALESCE((
         SELECT jsonb_agg(elem)
           FROM jsonb_array_elements(COALESCE(kb_chunks.acl_roles, '[]'::jsonb)) elem
          WHERE elem #>> '{}' <> ALL (SELECT code FROM tmp_obsolete_roles)
       ), '[]'::jsonb)
 WHERE EXISTS (
       SELECT 1
         FROM jsonb_array_elements(COALESCE(kb_chunks.acl_roles, '[]'::jsonb)) elem
        WHERE elem #>> '{}' IN (SELECT code FROM tmp_obsolete_roles)
     );

-- 1.4 助手记忆：role_key 是 text，无 FK
DELETE FROM public.assistant_memory_items
 WHERE role_key IN (SELECT code FROM tmp_obsolete_roles);

-- 1.5 AI 运行痕迹里的角色标记（varchar / text，无 FK）
DELETE FROM public.ai_messages
 WHERE role IN (SELECT code FROM tmp_obsolete_roles);

DELETE FROM public.ai_analysis_steps
 WHERE role IN (SELECT code FROM tmp_obsolete_roles);

DELETE FROM public.ai_v2_step
 WHERE role IN (SELECT code FROM tmp_obsolete_roles);

DELETE FROM public.ai_context_bindings
 WHERE knowledge_role_workspace IN (SELECT code FROM tmp_obsolete_roles);

DELETE FROM public.sys_deprecation_access_logs
 WHERE user_role IN (SELECT code FROM tmp_obsolete_roles);

-- 1.6 占用这些角色的账号无法再登录（users.role 是 NOT NULL 且 FK RESTRICT），
--     按「角色下线」语义清理账号：先把所有指向 users 的 NO ACTION / RESTRICT 外键置 NULL
DO $$
DECLARE
  v_fk record;
  v_cnt int;
BEGIN
  FOR v_fk IN
    SELECT con.conrelid::regclass AS tbl,
           (SELECT attname FROM pg_attribute
             WHERE attrelid = con.conrelid AND attnum = con.conkey[1]) AS col
      FROM pg_constraint con
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.users'::regclass
       AND con.confdeltype IN ('n', 'r')
       AND con.conrelid <> 'public.users'::regclass
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET %I = NULL WHERE %I IN (SELECT id FROM public.users WHERE role IN (SELECT code FROM tmp_obsolete_roles))',
      v_fk.tbl, v_fk.col, v_fk.col);
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    IF v_cnt > 0 THEN
      RAISE NOTICE '已置空 %.%（% 行）', v_fk.tbl, v_fk.col, v_cnt;
    END IF;
  END LOOP;
END $$;

DELETE FROM public.user_sessions
 WHERE user_id IN (SELECT id FROM public.users WHERE role IN (SELECT code FROM tmp_obsolete_roles));

DELETE FROM public.users
 WHERE role IN (SELECT code FROM tmp_obsolete_roles);

-- ────────────────────────────────────────────────────────────
-- 2. 删除角色主表行
--    FK CASCADE 会带走 role_modules / role_module_grants / role_platform_permissions，
--    触发器 trg_sync_roles_to_sys_role 会带走 sys_role，
--    sys_role 的 CASCADE 会带走 sys_role_permission / sys_user_role
-- ────────────────────────────────────────────────────────────
DELETE FROM public.roles WHERE code IN (SELECT code FROM tmp_obsolete_roles);

-- ────────────────────────────────────────────────────────────
-- 3. 收敛 RLS 策略里的角色字面量
--    策略形态只有两种：
--      a) rls_role() = ANY (ARRAY['x'::text, ...])  → 从数组里剔除死角色
--      b) rls_role() = 'admin'::text                 → 整条替换为 rls_is_super_admin()
--    剔除后数组仍至少保留 1 个真实角色，= ANY(ARRAY[...]) 语义不变。
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_rec record;
  v_qual text;
  v_check text;
  v_code text;
  v_stmt text;
BEGIN
  FOR v_rec IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
  LOOP
    v_qual  := v_rec.qual;
    v_check := v_rec.with_check;

    -- 形态 a：从 ANY(ARRAY[...]) 里剔除死角色
    -- 注意：brand_viewer 不在此列表 —— 它在策略里只以 user_type 形态出现
    --（rls_user_type() = 'brand_viewer'），那是账号类型不是角色，必须保留
    FOREACH v_code IN ARRAY ARRAY['video_editor','cs_agent','admin','operator',
                                   'employee','floor_manager','director','warehouse']
    LOOP
      IF v_qual IS NOT NULL THEN
        v_qual := replace(v_qual, quote_literal(v_code) || '::text, ', '');
        v_qual := replace(v_qual, ', ' || quote_literal(v_code) || '::text', '');
      END IF;
      IF v_check IS NOT NULL THEN
        v_check := replace(v_check, quote_literal(v_code) || '::text, ', '');
        v_check := replace(v_check, ', ' || quote_literal(v_code) || '::text', '');
      END IF;
    END LOOP;

    -- 形态 b：rls_role() = 'admin'::text → 只留超管
    IF v_qual  IS NOT NULL AND v_qual  LIKE '%rls_role() = ''admin''%' THEN
      v_qual := replace(v_qual, 'rls_role() = ''admin''::text', 'rls_is_super_admin()');
    END IF;
    IF v_check IS NOT NULL AND v_check LIKE '%rls_role() = ''admin''%' THEN
      v_check := replace(v_check, 'rls_role() = ''admin''::text', 'rls_is_super_admin()');
    END IF;

    IF v_qual IS NOT DISTINCT FROM v_rec.qual AND v_check IS NOT DISTINCT FROM v_rec.with_check THEN
      CONTINUE;
    END IF;

    -- 剔除后数组不得为空（否则 = ANY(ARRAY[]) 会把整表锁死）
    IF v_qual  IS NOT NULL AND v_qual  LIKE '%= ANY (ARRAY[])%' THEN
      RAISE EXCEPTION '策略 %.% 的 USING 剔除后角色数组为空，需人工处理', v_rec.tablename, v_rec.policyname;
    END IF;
    IF v_check IS NOT NULL AND v_check LIKE '%= ANY (ARRAY[])%' THEN
      RAISE EXCEPTION '策略 %.% 的 WITH CHECK 剔除后角色数组为空，需人工处理', v_rec.tablename, v_rec.policyname;
    END IF;

    -- 组装 ALTER POLICY：SELECT 策略只能 USING，INSERT 只能 WITH CHECK，
    -- 其余（ALL / UPDATE / DELETE）按各自原有部分改写
    v_stmt := 'ALTER POLICY ' || quote_ident(v_rec.policyname)
              || ' ON ' || quote_ident(v_rec.schemaname) || '.' || quote_ident(v_rec.tablename);
    IF v_rec.cmd = 'SELECT' THEN
      v_stmt := v_stmt || ' USING (' || v_qual || ')';
    ELSIF v_rec.cmd = 'INSERT' THEN
      v_stmt := v_stmt || ' WITH CHECK (' || v_check || ')';
    ELSE
      IF v_qual IS NOT NULL THEN
        v_stmt := v_stmt || ' USING (' || v_qual || ')';
      END IF;
      IF v_check IS NOT NULL THEN
        v_stmt := v_stmt || ' WITH CHECK (' || v_check || ')';
      END IF;
    END IF;
    EXECUTE v_stmt;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. 收敛 helper 函数里的角色字面量
-- ────────────────────────────────────────────────────────────

-- 4.1 内容写权限：video_editor 角色下线
CREATE OR REPLACE FUNCTION public.rls_is_content_writer()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','ops_staff');
$function$;

-- 4.2 角色同步触发器：is_system 只认 super_admin
CREATE OR REPLACE FUNCTION public.sync_roles_to_sys_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sys_role (id, code, name, description, is_system, created_at, updated_at)
    VALUES (NEW.id, NEW.code, NEW.name, COALESCE(NEW.description, ''), (NEW.code = 'super_admin'), NEW.created_at, now())
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
$function$;

-- 4.3 已存在角色的 is_system 标记同步（admin 行已删除，super_admin 保持 true）
UPDATE public.sys_role SET is_system = true  WHERE code = 'super_admin';
UPDATE public.sys_role SET is_system = false WHERE code <> 'super_admin';

-- ────────────────────────────────────────────────────────────
-- 5. 收敛 users 角色约束（历史迁移 113/118/151 会复活 CHECK 约束）
--    自定义角色的 code 由 FK 保证，无需 CHECK 白名单
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- ────────────────────────────────────────────────────────────
-- 6. 校验
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM public.roles
   WHERE code IN ('video_editor','cs_agent','admin','operator','employee',
                  'brand_viewer','floor_manager','director','warehouse');
  IF v_left > 0 THEN
    RAISE EXCEPTION '仍有 % 个待下线角色残留', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.sys_role
   WHERE code IN ('video_editor','cs_agent','admin','operator','employee',
                  'brand_viewer','floor_manager','director','warehouse');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'sys_role 仍有 % 个待下线角色残留', v_left;
  END IF;

  RAISE NOTICE '冗余内置角色已下线，roles 现存 % 个角色', (SELECT count(*) FROM public.roles);
END $$;

COMMIT;

-- version: 225_prune_obsolete_roles
