-- ============================================================================
-- 迁移 131：关闭财务板块 + 清理权限死代码（S4）
-- ----------------------------------------------------------------------------
-- 老大要求：「整个系统目前暂时不开放财务板块，相关的功能、账号、角色这些要全面清理掉」
--
-- 财务板块界定（实测依赖分析）：
--   ✅ 删除：finance 角色、finance_chen 账号、cost_entries 表、
--            /api/v1/costs 全套端点、成本结构页面
--   ⛔ 保留：net_roi 模块（投放消耗 / 支付ROI / 净成交ROI 属运营核心指标，
--            且不依赖 cost_entries；其「结算净利」来自 fact_settlement_cycles）
--
-- 同时清理确认零调用的权限死代码：
--   permissions(31 条) + role_permissions + hasPermission()/requirePermission()
--   实测：全项目除 guard.ts 内部自引用外无任何路由调用
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 财务角色与账号
-- ────────────────────────────────────────────────────────────────
-- 1.1 先把 finance 角色下的账号改派为 admin（避免账号变孤儿后无法登录）
UPDATE public.users
   SET role = 'admin', updated_at = now()
 WHERE role = 'finance';

-- 1.2 删除 finance 角色的全部授权
DELETE FROM public.role_platform_permissions
 WHERE role_id IN (SELECT id FROM public.roles WHERE code = 'finance');
DELETE FROM public.role_module_grants WHERE role_code = 'finance';
DELETE FROM public.role_modules WHERE role_code = 'finance';
DELETE FROM public.role_permissions
 WHERE role_id IN (SELECT id FROM public.roles WHERE code = 'finance');

-- 1.3 删除角色
DELETE FROM public.roles WHERE code = 'finance';

-- ────────────────────────────────────────────────────────────────
-- 2. 成本台账（财务专属）
-- ────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.cost_entries CASCADE;

-- 同步移除 ops 模块下与成本相关的权限（若 permissions 表仍存在）
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='permissions') THEN
    DELETE FROM public.permissions WHERE module = 'ops' AND code LIKE '%cost%';
  END IF;
END $;

-- ────────────────────────────────────────────────────────────────
-- 3. 权限死代码清理
-- ────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.role_permissions CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='permissions') THEN
    -- 确认零引用后再删：先看是否有任何角色仍通过 role_permissions 使用（表已删，必然为空）
    DROP TABLE public.permissions CASCADE;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 4. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_finance_role int;
  v_finance_user int;
  v_cost_table int;
  v_perm_table int;
  v_net_roi int;
BEGIN
  SELECT count(*) INTO v_finance_role FROM public.roles WHERE code = 'finance';
  IF v_finance_role > 0 THEN
    RAISE EXCEPTION 'finance 角色仍存在';
  END IF;

  SELECT count(*) INTO v_finance_user FROM public.users WHERE role = 'finance';
  IF v_finance_user > 0 THEN
    RAISE EXCEPTION '仍有 % 个账号使用 finance 角色', v_finance_user;
  END IF;

  SELECT count(*) INTO v_cost_table FROM pg_tables
   WHERE schemaname='public' AND tablename='cost_entries';
  IF v_cost_table > 0 THEN
    RAISE EXCEPTION 'cost_entries 表仍存在';
  END IF;

  SELECT count(*) INTO v_perm_table FROM pg_tables
   WHERE schemaname='public' AND (tablename='permissions' OR tablename='role_permissions');
  IF v_perm_table > 0 THEN
    RAISE EXCEPTION '权限死代码表仍存在（% 张）', v_perm_table;
  END IF;

  -- net_roi 必须保留（投放 ROI 是运营核心）
  SELECT count(*) INTO v_net_roi FROM public.system_modules WHERE code = 'net_roi';
  IF v_net_roi = 0 THEN
    RAISE EXCEPTION 'net_roi 模块被误删（不应删除）';
  END IF;

  RAISE NOTICE 'S4 完成：财务角色/账号/成本台账已清理，权限死代码已移除，net_roi 保留';
END $$;

-- version: 131_remove_finance_and_permissions
