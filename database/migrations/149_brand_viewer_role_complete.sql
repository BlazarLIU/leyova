-- ============================================================================
-- 迁移 149：补全 brand_viewer 角色（P1-B16）
-- ----------------------------------------------------------------------------
-- 审计 02 发现的幽灵角色问题：
--   · users_role_check 允许 brand_viewer
--   · getDefaultHomePath / RequireAccess 都引用它，跳 /brand-portal
--   · 但 roles 表无此行、role_module_grants 无授权、实际 0 个用户
--   → 一旦有人被设为 brand_viewer，登录即白屏（路由不存在 + 无模块）
--
-- 本迁移补全角色定义与最小模块集：
--   品牌方只能看「自己品牌的经营数据」，不能看成本、不能写。
--   数据隔离由 RLS（brand_viewer_permissions）负责，模块只控制「能进哪些页面」。
-- ============================================================================

-- 1. 角色定义
INSERT INTO public.roles (code, name, description)
VALUES ('brand_viewer', '品牌方', '品牌方只读视角：仅可查看本品牌经营数据，不可写、不可看成本')
ON CONFLICT (code) DO NOTHING;

-- 2. 最小模块集（只读、无成本、无系统管理）
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('brand_viewer', 'overview',         'allow', '品牌方需看经营总览'),
  ('brand_viewer', 'bi',               'allow', '品牌方需看 BI 指标（成本字段由 canAccessCost 脱敏）'),
  ('brand_viewer', 'review',           'allow', '品牌方需看直播复盘'),
  ('brand_viewer', 'review_overview',  'allow', '复盘总览'),
  ('brand_viewer', 'product_center',   'allow', '商品维度'),
  ('brand_viewer', 'session',          'allow', '场次列表（只读）')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 3. 平台授权：品牌方可见平台由其项目授权决定，这里给全平台兜底
--    （真正的行级隔离由 brand_viewer_permissions 的 project_ids 控制）
INSERT INTO public.role_platform_permissions (role_id, platform_code)
SELECT r.id, p.platform_code
  FROM public.roles r
  CROSS JOIN public.system_platform_configs p
 WHERE r.code = 'brand_viewer' AND p.is_enabled = true
ON CONFLICT DO NOTHING;

DO $$
DECLARE v_role int; v_mod int;
BEGIN
  SELECT count(*) INTO v_role FROM public.roles WHERE code='brand_viewer';
  SELECT count(*) INTO v_mod FROM public.role_module_grants WHERE role_code='brand_viewer';
  IF v_role = 0 THEN RAISE EXCEPTION 'brand_viewer 角色未创建'; END IF;
  RAISE NOTICE 'brand_viewer 已补全：角色 1 个，模块 % 个', v_mod;
END $$;

-- version: 149_brand_viewer_role_complete
