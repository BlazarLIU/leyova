-- 迁移 143：employee/controller 补 overview（P0-D-1 配套）
-- 业务依据：主播/中控登录后第一屏就是首页（个人工作台），没有 overview 会直接 403 白屏。
--           审计 02 已指出「主播首页是考勤表」，但连首页都进不去更严重。
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('employee',   'overview', 'allow', '主播/中控需看首页与个人工作台'),
  ('controller', 'overview', 'allow', '中控需看首页与场次仪表')
ON CONFLICT (role_code, module_code) DO NOTHING;
-- version: 143_employee_overview_grant
