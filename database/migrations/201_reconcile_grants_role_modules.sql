-- ============================================================================
-- 201：角色模块三表对齐（role_module_grants → role_modules）
-- ----------------------------------------------------------------------------
-- 背景：
--   196 号迁移补齐了 role_module_grants（18 个模块），但 role_modules 仍停留在
--   旧集合（13 个），/system/roles 读取 role_modules，导致「角色与模块权限」页
--   回写时把 ai_chat / ai_content / ai_review 等新授权覆盖丢失。
--
-- 策略：
--   以 role_module_grants 的 allow 集合为准，回填 role_modules。
-- ============================================================================

BEGIN;

INSERT INTO public.role_modules (role_code, module_code)
SELECT g.role_code, g.module_code
  FROM public.role_module_grants g
 WHERE g.effect = 'allow'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.role_module_grants g
   WHERE g.effect = 'allow'
     AND NOT EXISTS (
       SELECT 1 FROM public.role_modules m
        WHERE m.role_code = g.role_code AND m.module_code = g.module_code
     );
  IF v_missing > 0 THEN
    RAISE EXCEPTION '仍有 % 条授权未同步到 role_modules', v_missing;
  END IF;
  RAISE NOTICE '201 完成：role_module_grants → role_modules 已对齐';
END $$;

COMMIT;
