-- 113_rbac_role_hierarchy.sql
-- 落地系统 6 级账号身份权限体系与标准体验账号

BEGIN;

-- 0. 扩展 users 表角色枚举约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('super_admin', 'admin', 'operator', 'finance', 'hrbp', 'employee', 'manager', 'ops_director', 'ops_staff', 'controller', 'brand_viewer'));

-- 1. 更新与插入 6 级法定角色
INSERT INTO roles (code, name, description)
VALUES 
  ('super_admin', '系统管理员', '系统最高权限，掌控平台全局与系统级底层安全配置'),
  ('admin', '管理员', '机构负责人/业务总监，拥有全业务大盘审批、跨项目统筹与人员编制审批权限'),
  ('operator', '运营', '直播操盘手、场控运营、投放与选品人员，负责场次调度、货盘排品、投流与复盘'),
  ('finance', '财务', '财务主管/对账专员，专注成本录入、GMV阶梯佣金核算、月结对账单生成与法律凭证锁定'),
  ('hrbp', 'HRBP', '人力行政/经纪人，专注主播人才库画像、评级签约、考勤统计、排班审批与绩效考核'),
  ('employee', '员工', '基层一线作业人员（含带货主播、中控场控），个人极简自驱工作台与现场工具')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. 清理并重构各角色的 module 授权
DELETE FROM role_modules WHERE role_code IN ('super_admin', 'admin', 'operator', 'finance', 'hrbp', 'employee');

-- (1) super_admin: 所有模块
INSERT INTO role_modules (role_code, module_code)
SELECT 'super_admin', code FROM system_modules;

-- (2) admin: 除系统字典与核心底层技术配置外的所有业务模块
INSERT INTO role_modules (role_code, module_code)
SELECT 'admin', code FROM system_modules
WHERE code NOT IN ('system_dict', 'system_config');

-- (3) operator: 业务运营相关模块
INSERT INTO role_modules (role_code, module_code)
VALUES
  ('operator', 'overview'),
  ('operator', 'session'),
  ('operator', 'session_products'),
  ('operator', 'anchor'),
  ('operator', 'personal_achievement'),
  ('operator', 'live_registration'),
  ('operator', 'live_data'),
  ('operator', 'review'),
  ('operator', 'review_overview'),
  ('operator', 'review_channels'),
  ('operator', 'review_anchors'),
  ('operator', 'review_funnel'),
  ('operator', 'review_closed_loop'),
  ('operator', 'data'),
  ('operator', 'bi'),
  ('operator', 'ops'),
  ('operator', 'content'),
  ('operator', 'ai'),
  ('operator', 'system_rooms'),
  ('operator', 'system_tasks'),
  ('operator', 'system_promotions'),
  ('operator', 'system_competitors'),
  ('operator', 'system_alerts');

-- (4) finance: 财务成本与结算对账专属模块
INSERT INTO role_modules (role_code, module_code)
VALUES
  ('finance', 'overview'),
  ('finance', 'bi'),
  ('finance', 'data'),
  ('finance', 'ops'),
  ('finance', 'live_data'),
  ('finance', 'ai');

-- (5) hrbp: 主播人才与人事考核专属模块
INSERT INTO role_modules (role_code, module_code)
VALUES
  ('hrbp', 'overview'),
  ('hrbp', 'anchor'),
  ('hrbp', 'personal_achievement'),
  ('hrbp', 'system_personnel_ops'),
  ('hrbp', 'ai');

-- (6) employee: 个人工作台与现场登记模块
INSERT INTO role_modules (role_code, module_code)
VALUES
  ('employee', 'personal_achievement'),
  ('employee', 'live_registration'),
  ('employee', 'ai');

-- 3. 注入平台超级管理员账号（密码统一为 Admin@123456）
-- 密码哈希: $2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry
INSERT INTO users (username, password_hash, real_name, role, user_type, status, tenant_id)
VALUES
  ('admin', '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry', '平台超管', 'super_admin', 'agency_staff', 1, 1)
ON CONFLICT (username) DO UPDATE
SET 
  password_hash = EXCLUDED.password_hash,
  real_name = EXCLUDED.real_name,
  role = EXCLUDED.role,
  user_type = EXCLUDED.user_type,
  status = 1;

COMMIT;
