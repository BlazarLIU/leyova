-- ============================================================================
-- 迁移 140：补齐 operator 的 AI 模块 + 说明 brand_viewer 豁免
-- ----------------------------------------------------------------------------
-- 背景：模块守卫接通后暴露出 operator 连 AI 助手都访问不了。
--       业务上，运营每天都在用 AI 助手做分析、写话术、看复盘，
--       没有 ai 模块意味着「运营不能用系统的 AI」——这是明显的能力缺口。
-- ============================================================================

INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('operator',    'ai', 'allow', '运营日常使用 AI 助手做分析与话术（历史缺口）'),
  ('ops_staff',   'ai', 'allow', '运营专员同上'),
  ('ops_director','ai', 'allow', '运营总监同上')
ON CONFLICT (role_code, module_code) DO NOTHING;

DO $$
DECLARE
  v int;
BEGIN
  SELECT count(*) INTO v FROM public.role_module_grants
   WHERE role_code='operator' AND module_code='ai' AND effect='allow';
  IF v = 0 THEN RAISE EXCEPTION 'operator 未获得 ai 授权'; END IF;
  RAISE NOTICE 'operator 已获 ai 模块授权';
END $$;

-- version: 140_operator_ai_grant
