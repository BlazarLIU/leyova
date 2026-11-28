-- ============================================================================
-- 200：角色授权双表再次对齐（grants → sys_role_permission 回填）
-- ----------------------------------------------------------------------------
-- 背景：
--   196 号迁移曾要求两表 allow 集合一致，但当时部分 grant 记录已存在，
--   ON CONFLICT DO NOTHING 未触发 sync 触发器，导致 sys_role_permission
--   仍缺少 ai_chat / ai_review / ai_content 等 W2.5 补授模块。
--   access-resolver 优先读 sys_role_permission，因此权限矩阵回归失败。
--
-- 策略：
--   以 role_module_grants（权限页编辑入口）为准，单向回填 sys_role_permission；
--   只同步 effect，不扩权，不新增模块。
-- ============================================================================

BEGIN;

INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type)
SELECT g.role_code, 'module:' || g.module_code, '*', g.effect, 'tenant'
  FROM public.role_module_grants g
 WHERE g.effect IN ('allow', 'deny')
ON CONFLICT (role_code, resource, action) DO UPDATE
  SET effect = EXCLUDED.effect;

DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.role_module_grants g
   WHERE g.effect = 'allow'
     AND NOT EXISTS (
       SELECT 1 FROM public.sys_role_permission p
        WHERE p.role_code = g.role_code
          AND p.resource = 'module:' || g.module_code
          AND p.effect = 'allow'
     );
  IF v_missing > 0 THEN
    RAISE EXCEPTION '仍有 % 条角色授权未同步到 sys_role_permission', v_missing;
  END IF;
  RAISE NOTICE '200 完成：role_module_grants → sys_role_permission 已对齐';
END $$;

COMMIT;
