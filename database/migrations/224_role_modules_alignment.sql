-- 224_role_modules_alignment.sql
-- 清理演示数据后角色模块矩阵补齐，使 module-guard-matrix.test.ts 的角色
-- × 代表性端点矩阵与真实授权一致。新装库/升级库均可安全重复执行。
-- 注：video_editor / cs_agent 已在 225 中下线，本迁移不再为它们补授权。

BEGIN;

-- hrbp：ops（话术库、改进任务、系统作业）、bi（指标注册）
INSERT INTO public.role_modules (role_code, module_code) VALUES
  ('hrbp', 'ops'),
  ('hrbp', 'bi')
ON CONFLICT DO NOTHING;

-- controller：anchor（主播管理/查询 + ops/capabilities 任一模块即放行）
INSERT INTO public.role_modules (role_code, module_code) VALUES
  ('controller', 'anchor')
ON CONFLICT DO NOTHING;

-- 同步 role_module_grants（128 引入、130 移除 work_mode 之后仍保留 effect 列）
DO $$
BEGIN
  IF to_regclass('public.role_module_grants') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='role_module_grants'
                    AND column_name='effect')
  THEN
    INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
    SELECT rm.role_code, rm.module_code, 'allow', '224 对齐 module-guard-matrix 测试'
      FROM public.role_modules rm
     WHERE rm.role_code IN ('hrbp','controller')
    ON CONFLICT (role_code, module_code) DO UPDATE SET effect = 'allow';
  END IF;
END $$;

COMMIT;
