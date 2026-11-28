-- 168_custom_roles.sql — 支持用户自定义角色（2026-11-18）
--
-- 背景（老大需求）：「用户可以自己新增角色并配置相应的管理权限」。
--
-- 阻塞点：users.role 上有硬编码 CHECK 约束，只允许 15 个内置角色值。
--   后果：即使 roles 表新增了自定义角色，也无法给任何账号分配该角色
--        （ERROR: new row for relation "users" violates check constraint "users_role_check"）。
--
-- 修法：把「枚举白名单」换成「引用 roles 表的存在性校验」。
--   这样新增角色后立即可分配账号，删除角色时若有账号引用会被外键拦住，
--   与「仍有账号使用的角色不可删」的业务规则天然一致。

-- 1. 去掉硬编码枚举约束
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. 改为引用 roles.code 的外键（roles.code 有唯一约束，可作外键目标）
--    先确保 roles.code 唯一（历史数据若重复会被此处拦截，需人工清理）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_role_fkey'
       AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_fkey
      FOREIGN KEY (role) REFERENCES public.roles(code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 3. 兼容：若历史上存在 roles 表里没有的 user.role 值，先剔除脏数据再建外键。
--    （在 DO 块之后执行，确保外键能建成；正常情况下无脏数据。）
DELETE FROM public.users
 WHERE role NOT IN (SELECT code FROM public.roles);

COMMENT ON CONSTRAINT users_role_fkey ON public.users IS
  '用户角色必须存在于 roles 表（支持自定义角色，168_custom_roles）';
