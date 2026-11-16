-- ============================================================================
-- 迁移 130：取消工作模式，权限模型归一（S3）
-- ----------------------------------------------------------------------------
-- 老大明确要求：
--   「没有代运营模式和品牌自播模式了，全部功能归一，就一个模式全部功能，
--     不用再去区分什么代运营和品牌自播了」
--
-- 因此：
--   1. `role_module_grants.work_mode` 维度取消 → 简化为 角色 × 模块
--   2. `user_work_modes` 表整体删除
--   3. `users.primary_work_mode` 列删除
--   4. `agency` 模块从 system_modules 移除（代运营管理整体下线）
--
-- 保留 `role_module_grants` 的价值：它是「角色可显式 deny 某模块」的机制，
-- 与 `role_modules`（简单的 allow 列表）互补。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 合并 role_module_grants：三模式取并集，deny 优先
--    理由：取消模式后，只要任一模式曾授权过，就应保留；
--         但若某模式被 deny 过，则 deny 生效（保守）。
-- ────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _grant_merged ON COMMIT DROP AS
SELECT role_code,
       module_code,
       CASE WHEN bool_or(effect = 'deny') THEN 'deny' ELSE 'allow' END AS effect
  FROM public.role_module_grants
 GROUP BY role_code, module_code;

-- 删除旧表的数据（保留表结构，先删 work_mode 列依赖）
DELETE FROM public.role_module_grants;

-- 去掉 work_mode 列与相关约束
ALTER TABLE public.role_module_grants DROP CONSTRAINT IF EXISTS role_module_grants_role_code_work_mode_module_code_key;
ALTER TABLE public.role_module_grants DROP COLUMN IF EXISTS work_mode CASCADE;

-- 重建唯一约束（幂等：已存在则跳过）
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.role_module_grants'::regclass
       AND conname = 'role_module_grants_role_module_key'
  ) THEN
    ALTER TABLE public.role_module_grants
      ADD CONSTRAINT role_module_grants_role_module_key UNIQUE (role_code, module_code);
  END IF;
END $;

-- 回填合并后的数据
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
SELECT role_code, module_code, effect, 'S3 取消工作模式后合并'
  FROM _grant_merged
ON CONFLICT (role_code, module_code) DO UPDATE SET effect = EXCLUDED.effect;

-- ────────────────────────────────────────────────────────────────
-- 2. 删除用户工作模式相关
-- ────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.user_work_modes;
ALTER TABLE public.users DROP COLUMN IF EXISTS primary_work_mode;

-- ────────────────────────────────────────────────────────────────
-- 3. 下线代运营相关：模块 / 角色 / 表
-- ────────────────────────────────────────────────────────────────
-- 3.1 角色
DELETE FROM public.role_module_grants WHERE role_code = 'agency';
DELETE FROM public.role_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE code = 'agency');
DELETE FROM public.role_platform_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE code = 'agency');
DELETE FROM public.role_modules WHERE role_code = 'agency';
DELETE FROM public.roles WHERE code = 'agency';

-- 3.2 system_modules 中的 agency 模块
DELETE FROM public.role_modules WHERE module_code = 'agency';
DELETE FROM public.role_module_grants WHERE module_code = 'agency';
DELETE FROM public.platform_capability_matrix WHERE module_code = 'agency';
DELETE FROM public.system_modules WHERE code = 'agency';

-- 3.3 代运营专属表（数据极少：客户1 项目1 对账单1 其余0）
DROP TABLE IF EXISTS public.agency_settlement_items CASCADE;
DROP TABLE IF EXISTS public.agency_settlement_bills CASCADE;
DROP TABLE IF EXISTS public.agency_slot_fees CASCADE;
DROP TABLE IF EXISTS public.agency_anchor_commission_plans CASCADE;
DROP TABLE IF EXISTS public.agency_anchor_assignments CASCADE;
DROP TABLE IF EXISTS public.brand_viewer_permissions CASCADE;

-- agency_projects 被 access-resolver / guard 引用（brand_viewer 平台授权），
-- 但 brand_viewer 角色本身保留（品牌方只读门户仍可用），故先清数据再删表
DELETE FROM public.agency_projects;
DROP TABLE IF EXISTS public.agency_projects CASCADE;
DROP TABLE IF EXISTS public.agency_clients CASCADE;

-- ────────────────────────────────────────────────────────────────
-- 4. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_grants int;
  v_work_mode_col int;
  v_user_wm int;
  v_agency_mod int;
  v_agency_tables int;
BEGIN
  SELECT count(*) INTO v_grants FROM public.role_module_grants;
  IF v_grants < 150 THEN
    RAISE EXCEPTION '合并后 role_module_grants 过少（%），可能丢失授权', v_grants;
  END IF;

  SELECT count(*) INTO v_work_mode_col
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='role_module_grants' AND column_name='work_mode';
  IF v_work_mode_col > 0 THEN
    RAISE EXCEPTION 'role_module_grants.work_mode 列仍存在';
  END IF;

  SELECT count(*) INTO v_user_wm FROM pg_tables
   WHERE schemaname='public' AND tablename='user_work_modes';
  IF v_user_wm > 0 THEN
    RAISE EXCEPTION 'user_work_modes 表仍存在';
  END IF;

  SELECT count(*) INTO v_agency_mod FROM public.system_modules WHERE code = 'agency';
  IF v_agency_mod > 0 THEN
    RAISE EXCEPTION 'system_modules 中 agency 模块仍存在';
  END IF;

  SELECT count(*) INTO v_agency_tables FROM pg_tables
   WHERE schemaname='public' AND tablename LIKE 'agency%';
  IF v_agency_tables > 0 THEN
    RAISE EXCEPTION '仍有 % 张 agency_* 表未删除', v_agency_tables;
  END IF;

  RAISE NOTICE 'S3 完成：role_module_grants=% 条，work_mode 维度已取消，代运营表已清理', v_grants;
END $$;

-- version: 130_simplify_access_no_workmode
