-- ============================================================================
-- 204_rls_p0_helpers.sql
--
-- RLS 190 张表补齐计划的辅助函数（P0 前置）。
--
-- 仅新增 5 个只读辅助函数，不修改任何表、不改动已有策略：
--   rls_is_ops_writer()      运营写角色：super_admin / ops_director / ops_staff
--   rls_is_content_writer()  内容写角色：运营写角色 + video_editor
--   rls_is_hr_writer()       HR 写角色：super_admin / ops_director / hrbp
--   rls_platform_strict()    平台 fail-closed（NULL / 空串不可见）
--   rls_shop_strict()        店铺 fail-closed（NULL 不可见）
--
-- 全部幂等（CREATE OR REPLACE），可重复执行。
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rls_is_ops_writer() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','ops_staff');
$$;

CREATE OR REPLACE FUNCTION public.rls_is_content_writer() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','ops_staff','video_editor');
$$;

CREATE OR REPLACE FUNCTION public.rls_is_hr_writer() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','hrbp');
$$;

CREATE OR REPLACE FUNCTION public.rls_platform_strict(p_code text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_code IS NOT NULL AND p_code <> '' AND public.rls_has_platform(p_code);
$$;

CREATE OR REPLACE FUNCTION public.rls_shop_strict(p_shop_id bigint) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT p_shop_id IS NOT NULL AND public.rls_can_access_shop(p_shop_id);
$$;

COMMIT;
