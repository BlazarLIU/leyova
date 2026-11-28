-- ============================================================================
-- 迁移 139：补齐角色模块缺口（P0-D-1 配套）
-- ----------------------------------------------------------------------------
-- 背景：模块守卫（module-guard.ts）接通后，暴露出权限矩阵的真实缺口。
--       此前 canAccessModule() 全仓 0 调用，矩阵从未被真正校验，
--       因此「缺模块」的问题一直被隐藏。
--
-- 依据业务语义补齐（不是为了让测试通过，而是按真实岗位职责）：
--   operator（运营/操盘手）：必须能看 BI 仪表盘与退款分析，否则无法定位经营问题
--   ops_staff（运营专员）：同上
--   hrbp：需要 review_anchors 看主播效能（HRBP 核心职责之一）
--   ad_buyer（投手）：需要 review_channels 看渠道流量归因
-- ============================================================================

INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('operator',   'bi',             'allow', '运营需看 BI 仪表盘与退款分析（历史缺口）'),
  ('ops_staff',  'bi',             'allow', '运营专员需看 BI 仪表盘（历史缺口）'),
  ('ops_director','bi',            'allow', '运营总监需看 BI 仪表盘（历史缺口）'),
  ('hrbp',       'review_anchors', 'allow', 'HRBP 需看主播效能（核心职责）'),
  ('hrbp',       'review',         'allow', 'HRBP 需访问复盘入口'),
  ('ad_buyer',   'review_channels','allow', '投手需看渠道流量归因'),
  ('ad_buyer',   'bi',             'allow', '投手需看 BI 指标')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 自校验
DO $$
DECLARE
  v int;
BEGIN
  SELECT count(*) INTO v FROM public.role_module_grants
   WHERE role_code = 'operator' AND module_code = 'bi' AND effect = 'allow';
  IF v = 0 THEN
    RAISE EXCEPTION 'operator 未获得 bi 模块授权';
  END IF;

  SELECT count(*) INTO v FROM public.role_module_grants WHERE role_code = 'hrbp';
  RAISE NOTICE '补齐后 hrbp 模块数：%', v;
END $$;

-- version: 139_role_module_gap_fix
