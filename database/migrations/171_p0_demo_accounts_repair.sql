-- ============================================================================
-- P0-1 修复演示账号无法登录
--
-- 背景：119 号迁移为 director_zhou / buyer_xu / staff_lin 写入了一枚与
--       Admin@123456 不匹配的 bcrypt 哈希；ctrl_wu 因 NOT EXISTS(role=...)
--       条件（controller 已有 control_zhao）从未插入。
-- 处理：统一使用 02_seed.sql / 113 中的标准哈希，并按用户名 upsert。
-- ============================================================================
BEGIN;

INSERT INTO public.users (username, password_hash, real_name, role, user_type, tenant_id, status)
VALUES
  ('director_zhou', '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry', '周总监 (运营总监)', 'ops_director', 'agency_staff', 1, 1),
  ('staff_lin',     '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry', '林运营 (常规运营)', 'ops_staff',    'agency_staff', 1, 1),
  ('ctrl_wu',       '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry', '吴中控 (现场中控)', 'controller',   'agency_staff', 1, 1),
  ('buyer_xu',      '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry', '许投手 (付费投放)', 'ad_buyer',     'agency_staff', 1, 1)
ON CONFLICT (username) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      real_name     = EXCLUDED.real_name,
      role          = EXCLUDED.role,
      status        = 1;

COMMIT;
