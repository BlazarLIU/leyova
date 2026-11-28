-- ============================================================================
-- 迁移 141：补齐 operator / ops_staff 的大促权限（P0-D-1 配套）
-- ----------------------------------------------------------------------------
-- 业务依据：大促 5 层抵扣试算是运营的核心工作（定活动价、算真实毛利），
--           运营没有 system_promotions 就做不了大促方案——明显的能力缺口。
-- ============================================================================
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('operator',    'system_promotions', 'allow', '运营需做大促 5 层抵扣试算（核心职责）'),
  ('ops_staff',   'system_promotions', 'allow', '运营专员同上'),
  ('ops_director','system_promotions', 'allow', '运营总监审批大促方案')
ON CONFLICT (role_code, module_code) DO NOTHING;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM public.role_module_grants
   WHERE role_code='operator' AND module_code='system_promotions';
  IF v=0 THEN RAISE EXCEPTION 'operator 未获得 system_promotions'; END IF;
  RAISE NOTICE 'operator 已获 system_promotions';
END $$;

-- version: 141_operator_promotions_grant
