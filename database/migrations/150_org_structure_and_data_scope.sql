-- ============================================================================
-- 迁移 150：组织架构 + data_scope 落地（P1）
-- ----------------------------------------------------------------------------
-- 审计 02 发现：
--   · data_scope 是纯装饰字段：17/17 用户全 'self'（含 super_admin）
--   · withRlsContext 注入的 10 个 GUC 里没有 app.data_scope
--   · 13 个 rls_* 函数无一读取它
--   · users 表没有 dept_id / team_id / manager_id → team 和 org 两档**物理上算不出来**
--
-- 本迁移：
--   1. 建 dim_dept（部门）/ dim_team（小组）两级组织架构
--   2. users 加 dept_id / team_id / manager_id
--   3. 加 rls 函数：rls_user_dept_ids() / rls_user_team_ids()
--   4. 回填现有用户到默认部门/团队
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 组织架构表
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_dept (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL DEFAULT 1,
  dept_code   varchar(64) NOT NULL,
  dept_name   varchar(128) NOT NULL,
  parent_id   integer REFERENCES public.dim_dept(id),
  leader_id   integer,
  status      smallint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dept_code)
);

CREATE TABLE IF NOT EXISTS public.dim_team (
  id          serial PRIMARY KEY,
  tenant_id   integer NOT NULL DEFAULT 1,
  dept_id     integer NOT NULL REFERENCES public.dim_dept(id) ON DELETE CASCADE,
  team_code   varchar(64) NOT NULL,
  team_name   varchar(128) NOT NULL,
  leader_id   integer,
  status      smallint NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, team_code)
);

CREATE INDEX IF NOT EXISTS idx_dim_team_dept ON public.dim_team(dept_id);

-- ────────────────────────────────────────────────────────────────
-- 2. users 加组织字段
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dept_id    integer REFERENCES public.dim_dept(id),
  ADD COLUMN IF NOT EXISTS team_id    integer REFERENCES public.dim_team(id),
  ADD COLUMN IF NOT EXISTS manager_id integer;

-- data_scope 约束：四档
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_data_scope_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_data_scope_check
      CHECK (data_scope IN ('self','team','org','all'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 3. 初始组织架构（贴合直播电商真实结构）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.dim_dept (id, dept_code, dept_name) VALUES
  (1, 'OPS',    '运营中心'),
  (2, 'CONTENT','内容中心'),
  (3, 'SUPPLY', '供应链中心'),
  (4, 'HR',     '人力行政中心')
ON CONFLICT (tenant_id, dept_code) DO NOTHING;

INSERT INTO public.dim_team (id, dept_id, team_code, team_name) VALUES
  (1, 1, 'LIVE_A',   '直播运营一组'),
  (2, 1, 'LIVE_B',   '直播运营二组'),
  (3, 1, 'AD',       '投放组'),
  (4, 2, 'VIDEO',    '短视频组'),
  (5, 2, 'SCRIPT',   '编导组'),
  (6, 3, 'WAREHOUSE','仓储履约组'),
  (7, 3, 'CS',       '客服组'),
  (8, 4, 'HRBP',     'HRBP 组')
ON CONFLICT (tenant_id, team_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. 回填现有用户（按角色归入团队，便于 data_scope 测试）
-- ────────────────────────────────────────────────────────────────
UPDATE public.users SET dept_id = 1, team_id = 1 WHERE role IN ('operator','ops_staff') AND dept_id IS NULL;
UPDATE public.users SET dept_id = 1, team_id = 2 WHERE role = 'ops_director' AND dept_id IS NULL;
UPDATE public.users SET dept_id = 1, team_id = 3 WHERE role = 'ad_buyer' AND dept_id IS NULL;
UPDATE public.users SET dept_id = 1, team_id = 1 WHERE role IN ('controller','employee') AND dept_id IS NULL;
UPDATE public.users SET dept_id = 4, team_id = 8 WHERE role = 'hrbp' AND dept_id IS NULL;
UPDATE public.users SET dept_id = 1, team_id = 1 WHERE role IN ('admin','super_admin') AND dept_id IS NULL;

-- 默认 data_scope：管理类给 all/org，执行类给 team，基层给 self
UPDATE public.users SET data_scope = 'all'  WHERE role IN ('super_admin','admin');
UPDATE public.users SET data_scope = 'org'  WHERE role = 'ops_director';
UPDATE public.users SET data_scope = 'team' WHERE role IN ('operator','ops_staff','ad_buyer','hrbp','controller');
UPDATE public.users SET data_scope = 'self' WHERE role = 'employee';

-- ────────────────────────────────────────────────────────────────
-- 5. RLS 辅助函数（读 app.data_scope）
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_data_scope()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.data_scope', true), ''), 'self');
$$;

/**
 * 当前用户可见的部门 ID 集合
 *   self  → 只有自己所在部门（但行级还要按 user_id 过滤）
 *   team  → 自己所在团队
 *   org   → 自己所在部门（含下属团队）
 *   all   → 全部
 */
CREATE OR REPLACE FUNCTION public.rls_visible_dept_ids()
RETURNS integer[] LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN public.rls_data_scope() = 'all' THEN
      ARRAY(SELECT id FROM public.dim_dept WHERE status = 1)
    ELSE
      ARRAY(
        SELECT dept_id FROM public.users
         WHERE id = NULLIF(current_setting('app.user_id', true), '')::int
           AND dept_id IS NOT NULL
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.rls_visible_team_ids()
RETURNS integer[] LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN public.rls_data_scope() = 'all' THEN
      ARRAY(SELECT id FROM public.dim_team WHERE status = 1)
    WHEN public.rls_data_scope() = 'org' THEN
      ARRAY(
        SELECT t.id FROM public.dim_team t
         WHERE t.dept_id = ANY(public.rls_visible_dept_ids())
      )
    ELSE
      ARRAY(
        SELECT team_id FROM public.users
         WHERE id = NULLIF(current_setting('app.user_id', true), '')::int
           AND team_id IS NOT NULL
      )
  END;
$$;

COMMENT ON FUNCTION public.rls_data_scope() IS 'data_scope 四档：self / team / org / all';
COMMENT ON FUNCTION public.rls_visible_dept_ids() IS '当前用户可见部门（org 档为本部门，all 档为全部）';
COMMENT ON FUNCTION public.rls_visible_team_ids() IS '当前用户可见团队（team 档为本团队，org 档为本部门下全部团队，all 档为全部）';

-- ────────────────────────────────────────────────────────────────
-- 6. 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dept int; v_team int; v_scoped int; v_null int;
BEGIN
  SELECT count(*) INTO v_dept FROM public.dim_dept;
  SELECT count(*) INTO v_team FROM public.dim_team;
  SELECT count(DISTINCT data_scope) INTO v_scoped FROM public.users WHERE status = 1;
  SELECT count(*) INTO v_null FROM public.users WHERE status = 1 AND dept_id IS NULL;

  IF v_dept < 4 THEN RAISE EXCEPTION '部门不足'; END IF;
  IF v_team < 8 THEN RAISE EXCEPTION '团队不足'; END IF;
  IF v_null > 0 THEN RAISE WARNING '仍有 % 个在职用户未分配部门', v_null; END IF;

  RAISE NOTICE '组织架构已建：% 部门 / % 团队 / % 种 data_scope', v_dept, v_team, v_scoped;
END $$;

-- version: 150_org_structure_and_data_scope
