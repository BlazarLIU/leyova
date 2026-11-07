--
-- leyova 数据库基础数据（seed）
--
-- 依赖：先执行 database/01_schema.sql
-- 用法：psql -d leyova -f database/02_seed.sql
--
-- 内容：角色 / 权限 / 角色-权限 / 系统模块 / 角色-模块 / 管理员账号 /
--       系统配置 / 告警规则 / 目标模板 / 数据字典
-- 说明：本文件为幂等脚本，可重复执行（ON CONFLICT DO NOTHING / DO UPDATE）。
--       不包含任何真实业务数据，业务演示数据见 database/03_demo_data.sql。
--

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 角色（roles）
--    id 与历史环境保持一致，便于既有配置与文档对照
-- ────────────────────────────────────────────────────────────
INSERT INTO roles (id, code, name, description) VALUES
  (1, 'super_admin', '系统管理员', '系统超级管理员，拥有全部权限'),
  (6, 'ops_director', '运营总监',  '运营总监，拥有大部分运营管理权限'),
  (7, 'ops_staff',    '运营',      '运营人员，拥有基本运营操作权限'),
  (8, 'controller',   '中控',      '中控人员，拥有直播间基本操作权限')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────
-- 2. 权限（permissions）
-- ────────────────────────────────────────────────────────────
INSERT INTO permissions (id, code, name, module) VALUES
  ( 1, 'overview:view',        '查看总览',       'overview'),
  ( 2, 'overview:dashboard',   '查看驾驶舱',     'overview'),
  ( 3, 'overview:live_monitor','查看实时监控',   'overview'),
  ( 4, 'anchor:view',          '查看主播',       'anchor'),
  ( 5, 'anchor:create',        '创建主播',       'anchor'),
  ( 6, 'anchor:edit',          '编辑主播',       'anchor'),
  ( 7, 'anchor:delete',        '删除主播',       'anchor'),
  ( 8, 'session:view',         '查看场次',       'session'),
  ( 9, 'session:create',       '创建场次',       'session'),
  (10, 'session:edit',         '编辑场次',       'session'),
  (11, 'session:delete',       '删除场次',       'session'),
  (12, 'session:finalize',     '完结场次',       'session'),
  (13, 'data:view',            '查看数据',       'data'),
  (14, 'data:upload',          '上传数据',       'data'),
  (15, 'data:export',          '导出数据',       'data'),
  (16, 'data:quality',         '查看数据质量',   'data'),
  (17, 'bi:view',              '查看BI',         'bi'),
  (18, 'bi:roi',               '查看ROI',        'bi'),
  (19, 'bi:refund',            '查看退款分析',   'bi'),
  (20, 'bi:anomaly',           '查看异常检测',   'bi'),
  (21, 'system:config',        '系统配置',       'system'),
  (22, 'system:users',         '用户管理',       'system'),
  (23, 'system:alerts',        '告警管理',       'system'),
  (24, 'system:audit',         '查看审计日志',   'system'),
  (25, 'ops:products',         '货盘管理',       'ops'),
  (26, 'ops:ads',              '投放管理',       'ops'),
  (27, 'ops:scripts',          '话术库管理',     'ops'),
  (28, 'ops:issues',           '问题库管理',     'ops'),
  (29, 'ops:goals',            '目标管理',       'ops'),
  (30, 'ops:room_health',      '直播间健康度',   'ops'),
  (31, 'ai:chat',              'AI对话',         'ai')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      module = EXCLUDED.module;

-- ────────────────────────────────────────────────────────────
-- 3. 角色-权限（role_permissions）
-- ────────────────────────────────────────────────────────────
-- 先清空再重建，保证与下方定义一致
DELETE FROM role_permissions;

-- 系统管理员：全部 31 项权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'super_admin';

-- 运营总监：除系统管理（21-24）外全部
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ops_director'
  AND p.code NOT IN ('system:config', 'system:users', 'system:alerts', 'system:audit')
ON CONFLICT DO NOTHING;

-- 运营：数据 / 内容 / BI / 告警查看
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'ops_staff'
  AND p.code IN (
    'overview:view', 'overview:dashboard', 'overview:live_monitor',
    'anchor:view', 'session:view', 'session:create', 'session:edit',
    'data:view', 'data:upload', 'bi:view', 'bi:roi', 'bi:refund', 'bi:anomaly',
    'system:alerts',
    'ops:products', 'ops:ads', 'ops:scripts', 'ops:issues', 'ops:goals', 'ops:room_health',
    'ai:chat'
  )
ON CONFLICT DO NOTHING;

-- 中控：直播登记 / 场次排品相关的最小操作集
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'controller'
  AND p.code IN (
    'overview:view',
    'session:view', 'session:create', 'session:edit',
    'data:view', 'data:upload', 'data:quality'
  )
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. 系统模块（system_modules）
--    visible_to：仅对指定角色可见；空数组表示全部角色可见
-- ────────────────────────────────────────────────────────────
INSERT INTO system_modules (code, name, icon, sort_order, visible_to) VALUES
  ('overview',             '总览',           'LayoutDashboard', 1,  '{}'),
  ('session',              '场次管理',       'CalendarCheck',   2,  '{}'),
  ('anchor',               '主播管理',       'Mic',             3,  '{}'),
  ('data',                 '数据管理',       'Database',        4,  '{}'),
  ('bi',                   '商业智能',       'BarChart',        5,  '{}'),
  ('content',              '内容中心',       'Clapperboard',    5,  '{}'),
  ('ops',                  '运营提效',       'Zap',             6,  '{}'),
  ('personal_achievement', '个人达成',       'CalendarDays',    6,  '{}'),
  ('ai',                    'AI 助手',        'Brain',           7,  '{}'),
  ('live_registration',    '直播登记',       'ClipboardPlus',   7,  '{}'),
  ('review',               '直播复盘',       'BarChart4',       8,  '{}'),
  ('system_users',         '账号管理',       'User',            8,  '{super_admin}'),
  ('system_personnel_ops', '运营管理',       'Users',           9,  '{super_admin}'),
  ('system_ai',            'AI 配置',        'Cog',             10, '{super_admin}'),
  ('system_dict',          '字典管理',       'BookKey',         11, '{super_admin}'),
  ('live_data',            '登记数据管理',   'Table',           12, '{}'),
  ('system_rooms',         '直播间管理',     'Radio',           12, '{super_admin,ops_director}'),
  ('session_products',     '场次排品',       'Package',         13, '{}'),
  ('system_config',        '系统配置',       'Settings',        13, '{super_admin}'),
  ('system_alerts',        '异常中心',       'AlertTriangle',   14, '{super_admin}'),
  ('system_tasks',         '改进任务',       'ClipboardList',   15, '{super_admin}'),
  ('system_promotions',    '大促管理',       'Megaphone',       16, '{super_admin}'),
  ('system_inventory',     '库存风险',       'Package',         17, '{super_admin}'),
  ('system_competitors',   '竞品观察',       'Eye',             18, '{super_admin}'),
  ('system_multiroom',     '多直播间总览',   'Monitor',         19, '{super_admin}'),
  ('review_overview',      '复盘总览',       'BarChart4',       81, '{}'),
  ('review_channels',      '渠道流量分析',   'BarChart4',       82, '{}'),
  ('review_anchors',       '主播效能分析',   'BarChart4',       83, '{}'),
  ('review_funnel',        '转化漏斗分析',   'BarChart4',       84, '{}'),
  ('review_closed_loop',   '改进闭环',       'BarChart4',       85, '{}')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order,
      visible_to = EXCLUDED.visible_to;

-- ────────────────────────────────────────────────────────────
-- 5. 角色-模块（role_modules）
-- ────────────────────────────────────────────────────────────
DELETE FROM role_modules;

-- 系统管理员：全部模块
INSERT INTO role_modules (role_code, module_code)
SELECT 'super_admin', code FROM system_modules
ON CONFLICT DO NOTHING;

-- 运营总监
INSERT INTO role_modules (role_code, module_code) VALUES
  ('ops_director', 'ai'),
  ('ops_director', 'anchor'),
  ('ops_director', 'bi'),
  ('ops_director', 'content'),
  ('ops_director', 'data'),
  ('ops_director', 'live_data'),
  ('ops_director', 'live_registration'),
  ('ops_director', 'ops'),
  ('ops_director', 'overview'),
  ('ops_director', 'personal_achievement'),
  ('ops_director', 'review'),
  ('ops_director', 'review_anchors'),
  ('ops_director', 'review_channels'),
  ('ops_director', 'review_closed_loop'),
  ('ops_director', 'review_funnel'),
  ('ops_director', 'review_overview'),
  ('ops_director', 'session'),
  ('ops_director', 'session_products'),
  ('ops_director', 'system_rooms')
ON CONFLICT DO NOTHING;

-- 运营
INSERT INTO role_modules (role_code, module_code) VALUES
  ('ops_staff', 'ai'),
  ('ops_staff', 'anchor'),
  ('ops_staff', 'bi'),
  ('ops_staff', 'content'),
  ('ops_staff', 'data'),
  ('ops_staff', 'live_data'),
  ('ops_staff', 'live_registration'),
  ('ops_staff', 'ops'),
  ('ops_staff', 'overview'),
  ('ops_staff', 'personal_achievement'),
  ('ops_staff', 'review'),
  ('ops_staff', 'review_anchors'),
  ('ops_staff', 'review_channels'),
  ('ops_staff', 'review_closed_loop'),
  ('ops_staff', 'review_funnel'),
  ('ops_staff', 'review_overview'),
  ('ops_staff', 'session'),
  ('ops_staff', 'session_products'),
  ('ops_staff', 'system_alerts'),
  ('ops_staff', 'system_competitors'),
  ('ops_staff', 'system_config'),
  ('ops_staff', 'system_inventory'),
  ('ops_staff', 'system_multiroom'),
  ('ops_staff', 'system_promotions'),
  ('ops_staff', 'system_tasks')
ON CONFLICT DO NOTHING;

-- 中控
INSERT INTO role_modules (role_code, module_code) VALUES
  ('controller', 'live_data'),
  ('controller', 'live_registration'),
  ('controller', 'personal_achievement'),
  ('controller', 'session_products')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 6. 管理员账号（users）
--    初始账号：admin / Admin@123456
--    ⚠ 请首次登录后立即通过「个人设置 → 修改密码」更换
--    哈希由 bcryptjs 生成（cost=10），与本项目 apps/api 使用的 bcryptjs 兼容
-- ────────────────────────────────────────────────────────────
INSERT INTO users (username, password_hash, real_name, role, status) VALUES
  ('admin', '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry', '管理员', 'super_admin', 1)
ON CONFLICT (username) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. 系统配置（system_config）
-- ────────────────────────────────────────────────────────────
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
  ('site_name',          '云梭直播管理平台',                        'string',  '站点名称'),
  ('logo_url',           '',                                        'string',  'Logo URL'),
  ('timezone',           'Asia/Shanghai',                           'string',  '时区'),
  ('date_format',        'YYYY-MM-DD',                              'string',  '日期格式'),
  ('items_per_page',     '20',                                      'int',     '每页条数'),
  ('session_timeout',    '3600',                                    'int',     '会话超时时间(秒)'),
  ('maintenance_mode',   'false',                                   'boolean', '维护模式'),
  ('enable_audit_log',   'true',                                    'boolean', '启用操作审计日志'),
  ('ai_engine',          'openclaw',                                'string',  'AI 引擎（openclaw / deerflow）'),
  ('deerflow_api_base',  'http://localhost:2026/api/langgraph',     'string',  'DeerFlow API 地址'),
  ('deerflow_model',     'deepseek-ai/DeepSeek-V4-Flash',           'string',  'DeerFlow 默认模型'),
  ('deerflow_timeout_ms','2700000',                                 'string',  'DeerFlow 超时时间(毫秒)')
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      config_type = EXCLUDED.config_type,
      description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────
-- 8. 告警规则（alert_rules）
--    项目默认未内置规则，此处提供一组可直接启用的常用规则示例
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
-- 9. 目标模板（target_templates）
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

-- ────────────────────────────────────────────────────────────
-- 10. 数据字典（dict_items）
-- ────────────────────────────────────────────────────────────
INSERT INTO dict_items (code, name, item_count, status) VALUES
  ('product_category', '商品类目',   12, '启用'),
  ('alert_severity',   '告警级别',    3, '启用'),
  ('room_type',        '直播间类型',  4, '启用'),
  ('anchor_level',     '主播等级',    5, '启用'),
  ('platform',         '平台',        4, '启用')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      item_count = EXCLUDED.item_count,
      status = EXCLUDED.status;

-- ────────────────────────────────────────────────────────────
-- 11. 重置自增序列（显式插入 id 后必须校正，否则后续 INSERT 会主键冲突）
-- ────────────────────────────────────────────────────────────
SELECT setval('roles_id_seq',       (SELECT COALESCE(MAX(id), 1) FROM roles));
SELECT setval('permissions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM permissions));

COMMIT;
