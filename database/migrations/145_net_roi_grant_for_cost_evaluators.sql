-- 迁移 145：给需评估成本的角色开 net_roi 模块（P0-D-2 配套）
-- 逻辑闭环：老大要求「投手/运营/HRBP 需评估成本」，
--           但他们若连 net_roi 模块都进不去，cost_visibility 就毫无意义。
-- 说明：net_roi 页面本身会对成本字段做脱敏（canAccessCostAsync 控制 costMasked），
--       所以给模块 ≠ 一定能看成本，两层控制是正交的。
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('operator',   'net_roi', 'allow', '运营需评估单场投放产出与成本（成本字段仍受 cost_visibility 控制）'),
  ('ops_staff',  'net_roi', 'allow', '运营专员同上'),
  ('hrbp',       'net_roi', 'allow', 'HRBP 需评估人力成本与主播产出比')
ON CONFLICT (role_code, module_code) DO NOTHING;
-- version: 145_net_roi_grant_for_cost_evaluators
