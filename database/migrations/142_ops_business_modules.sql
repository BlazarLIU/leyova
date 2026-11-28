-- 迁移 142：补齐运营的业务模块（竞品观察 / 改进任务 / 合规）
-- 业务依据：这三个都是运营日常（看竞品、跟进任务、处理合规），不属于系统管理。
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('operator',    'system_competitors', 'allow', '运营需观察竞品'),
  ('operator',    'system_tasks',       'allow', '运营需跟进改进任务'),
  ('operator',    'compliance',         'allow', '运营需处理合规'),
  ('ops_staff',   'system_competitors', 'allow', '运营专员需观察竞品'),
  ('ops_staff',   'system_tasks',       'allow', '运营专员需跟进任务'),
  ('ops_staff',   'compliance',         'allow', '运营专员需处理合规'),
  ('ops_director','system_competitors', 'allow', '总监需看竞品'),
  ('ops_director','system_tasks',       'allow', '总监需跟进任务')
ON CONFLICT (role_code, module_code) DO NOTHING;
-- version: 142_ops_business_modules
