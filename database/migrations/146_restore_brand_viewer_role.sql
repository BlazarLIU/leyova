-- 迁移 146：修复 users_role_check 漏掉 brand_viewer（迁移 144 的回归）
-- 迁移 144 重建 CHECK 时只保留了 RBAC 角色，漏了 brand_viewer（品牌方只读视角）。
-- 后果：createTempAccount('brand_viewer') 直接违反约束，导致整个测试 before() 失败。
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','ops_director','ops_staff','operator',
                  'controller','ad_buyer','hrbp','employee','brand_viewer'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='public.users'::regclass AND conname='users_role_check'
       AND pg_get_constraintdef(oid) LIKE '%brand_viewer%'
  ) THEN
    RAISE EXCEPTION 'brand_viewer 未恢复';
  END IF;
  RAISE NOTICE 'users_role_check 已恢复 brand_viewer，并移除 manager';
END $$;
-- version: 146_restore_brand_viewer_role
