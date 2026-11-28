--
-- leyova 数据库基础数据（seed）
--
-- 依赖：先执行 database/01_schema.sql
-- 用法：psql -d leyova -f database/02_seed.sql
--
-- 内容：系统模块 / 系统配置 / 告警规则模板 / 目标模板
-- 说明：本文件为幂等脚本，可重复执行（ON CONFLICT DO NOTHING / DO UPDATE）。
--       不包含任何业务演示数据，也不预置账号；角色与管理员账号由迁移链创建。
--

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. 角色（roles）
--    组织收敛后仅保留 6 个核心角色；其余角色由用户在「角色管理」页自建
-- ────────────────────────────────────────────────────────────
INSERT INTO roles (id, code, name, description) VALUES
  (1,  'super_admin',  '系统管理员', '拥有全部权限'),
  (6,  'ops_director', '运营总监',   '负责经营目标、场次与团队管理'),
  (7,  'ops_staff',    '运营专员',   '负责场次执行、数据登记与复盘'),
  (8,  'controller',   '中控',       '负责直播间中控与实时盯盘'),
  (19, 'hrbp',         'HRBP',       '负责主播招募、培训与绩效'),
  (33, 'ad_buyer',     '投放专员',   '负责投流计划与净 ROI 优化')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description;

-- 显式 ID 插入后同步序列，避免后续迁移插入主键冲突
SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT max(id) FROM roles));

-- ────────────────────────────────────────────────────────────
-- 1. 系统模块（system_modules）
--    visible_to：仅对指定角色可见；空数组表示全部角色可见
-- ────────────────────────────────────────────────────────────
INSERT INTO system_modules (code, name, icon, sort_order) VALUES
  ('overview',             '总览',           'LayoutDashboard', 1),
  ('session',              '场次管理',       'CalendarCheck',   2),
  ('anchor',               '主播管理',       'Mic',             3),
  ('data',                 '数据管理',       'Database',        4),
  ('bi',                   '商业智能',       'BarChart',        5),
  ('content',              '内容中心',       'Clapperboard',    5),
  ('ops',                  '运营提效',       'Zap',             6),
  ('personal_achievement', '个人达成',       'CalendarDays',    6),
  ('ai',                   'AI 助手',        'Brain',           7),
  ('live_registration',    '直播登记',       'ClipboardPlus',   7),
  ('review',               '直播复盘',       'BarChart4',       8),
  ('system_users',         '账号管理',       'User',            8),
  ('system_personnel_ops', '运营管理',       'Users',           9),
  ('system_ai',            'AI 配置',        'Cog',             10),
  ('live_data',            '登记数据管理',   'Table',           12),
  ('system_rooms',         '直播间管理',     'Radio',           12),
  ('session_products',     '场次排品',       'Package',         13),
  ('system_config',        '系统配置',       'Settings',        13),
  ('system_alerts',        '异常中心',       'AlertTriangle',   14),
  ('system_tasks',         '改进任务',       'ClipboardList',   15),
  ('system_promotions',    '大促管理',       'Megaphone',       16),
  ('system_inventory',     '库存风险',       'Package',         17),
  ('system_competitors',   '竞品观察',       'Eye',             18),
  ('system_multiroom',     '多直播间总览',   'Monitor',         19),
  ('review_overview',      '复盘总览',       'BarChart4',       81),
  ('review_channels',      '渠道流量分析',   'BarChart4',       82),
  ('review_anchors',       '主播效能分析',   'BarChart4',       83),
  ('review_funnel',        '转化漏斗分析',   'BarChart4',       84),
  ('review_closed_loop',   '改进闭环',       'BarChart4',       85)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order;

-- ────────────────────────────────────────────────────────────
-- 2. 角色-模块（role_modules）
-- ────────────────────────────────────────────────────────────
-- 系统管理员：全部模块
INSERT INTO role_modules (role_code, module_code)
SELECT 'super_admin', code FROM system_modules
ON CONFLICT DO NOTHING;

-- 运营总监
INSERT INTO role_modules (role_code, module_code) VALUES
  ('ops_director', 'ai'), ('ops_director', 'anchor'), ('ops_director', 'bi'),
  ('ops_director', 'content'), ('ops_director', 'data'), ('ops_director', 'live_data'),
  ('ops_director', 'live_registration'), ('ops_director', 'ops'), ('ops_director', 'overview'),
  ('ops_director', 'personal_achievement'), ('ops_director', 'review'),
  ('ops_director', 'review_anchors'), ('ops_director', 'review_channels'),
  ('ops_director', 'review_closed_loop'), ('ops_director', 'review_funnel'),
  ('ops_director', 'review_overview'), ('ops_director', 'session'),
  ('ops_director', 'session_products'), ('ops_director', 'system_rooms')
ON CONFLICT DO NOTHING;

-- 运营
INSERT INTO role_modules (role_code, module_code) VALUES
  ('ops_staff', 'ai'), ('ops_staff', 'anchor'), ('ops_staff', 'bi'),
  ('ops_staff', 'content'), ('ops_staff', 'data'), ('ops_staff', 'live_data'),
  ('ops_staff', 'live_registration'), ('ops_staff', 'ops'), ('ops_staff', 'overview'),
  ('ops_staff', 'personal_achievement'), ('ops_staff', 'review'),
  ('ops_staff', 'review_anchors'), ('ops_staff', 'review_channels'),
  ('ops_staff', 'review_closed_loop'), ('ops_staff', 'review_funnel'),
  ('ops_staff', 'review_overview'), ('ops_staff', 'session'),
  ('ops_staff', 'session_products'), ('ops_staff', 'system_alerts'),
  ('ops_staff', 'system_competitors'), ('ops_staff', 'system_config'),
  ('ops_staff', 'system_inventory'), ('ops_staff', 'system_multiroom'),
  ('ops_staff', 'system_promotions'), ('ops_staff', 'system_tasks')
ON CONFLICT DO NOTHING;

-- 中控
INSERT INTO role_modules (role_code, module_code) VALUES
  ('controller', 'live_data'), ('controller', 'live_registration'),
  ('controller', 'personal_achievement'), ('controller', 'session_products')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. 系统配置（system_config）
-- ────────────────────────────────────────────────────────────
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
  ('site_name',          '云梭直播管理平台',                        'string',  '站点名称'),
  ('logo_url',           '',                                        'string',  'Logo URL'),
  ('timezone',           'Asia/Shanghai',                           'string',  '时区'),
  ('date_format',        'YYYY-MM-DD',                              'string',  '日期格式'),
  ('items_per_page',     '20',                                      'int',     '每页条数'),
  ('session_timeout',    '3600',                                    'int',     '会话超时时间(秒)'),
  ('maintenance_mode',   'false',                                   'boolean', '维护模式'),
  ('enable_audit_log',   'true',                                    'boolean', '启用操作审计日志')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      config_type = EXCLUDED.config_type,
      description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────
-- 3. 告警规则模板（alert_rules）
-- ────────────────────────────────────────────────────────────
INSERT INTO alert_rules (name, metric, method, params, severity, enabled)
SELECT * FROM (VALUES
  ('单场GMV低于 5000 元',     'gmv',          '阈值检测', '{"op":"<","value":5000}',                    '警告', true),
  ('小时产出低于 1000 元',     'gmv_per_hour', '阈值检测', '{"op":"<","value":1000}',                    '警告', true),
  ('退款率高于 15%',          'refund_rate',  '阈值检测', '{"op":">","value":0.15}',                    '严重', true),
  ('直播间在线人数骤降 30%',   'online_peak',  '环比下降', '{"ratio":0.3,"window":"1h"}',                '严重', true),
  ('当日数据未上传',          'data_upload',  '缺失检测', '{"types":["anchor_analysis","channel_analysis"]}', '警告', true)
) AS v(name, metric, method, params, severity, enabled)
WHERE NOT EXISTS (SELECT 1 FROM alert_rules);

-- ────────────────────────────────────────────────────────────
-- 4. 目标模板（target_templates）
--    metrics: [{ metric, target, unit }]
-- ────────────────────────────────────────────────────────────
INSERT INTO target_templates (name, period, metrics)
SELECT * FROM (VALUES
  ('月度经营目标', 'monthly',
   '[{"metric":"gmv","target":3000000,"unit":"元"},{"metric":"orders","target":12000,"unit":"单"},{"metric":"gmv_per_hour","target":12000,"unit":"元/小时"}]'::jsonb),
  ('季度经营目标', 'quarterly',
   '[{"metric":"gmv","target":9000000,"unit":"元"},{"metric":"roi","target":3.5,"unit":"倍"},{"metric":"new_fans","target":60000,"unit":"人"}]'::jsonb),
  ('年度经营目标', 'yearly',
   '[{"metric":"gmv","target":36000000,"unit":"元"},{"metric":"orders","target":150000,"unit":"单"},{"metric":"buyer_count","target":90000,"unit":"人"}]'::jsonb)
) AS v(name, period, metrics)
WHERE NOT EXISTS (SELECT 1 FROM target_templates);

COMMIT;
