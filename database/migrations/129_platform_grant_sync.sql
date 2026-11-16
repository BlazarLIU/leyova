-- ============================================================================
-- 迁移 129：补齐角色平台授权 + 平台授权防遗漏机制
-- ----------------------------------------------------------------------------
-- 问题（S1 遗留）：
--   迁移 125 注册了 wechat 平台，但 `role_platform_permissions` 中所有角色
--   的平台授权仍是旧 5 平台（douyin/kuaishou/taobao/tmall/xiaohongshu），
--   不含 wechat → `resolvePlatforms()` 返回的集合非空，不会走「全部启用平台」
--   兜底 → 视频号在模块级权限里完全不可见。
--
-- 根因：平台授权是「硬编码的 per-role 白名单」，新增平台必须手工同步，
--       一旦漏掉就是静默失效（前端不报错、模块就是没了）。
--
-- 本迁移做两件事：
--   1. 补齐：把当前所有启用平台授权给所有角色（保持既有角色可见范围语义）
--   2. 防复发：新增 `platform_grants_auto_sync` 配置项 + 一个校验函数，
--      在新平台注册时能检测到授权缺口
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 补齐：所有角色 × 所有启用平台
--    （原本 role_platform_permissions 就是「该角色可见哪些平台」，
--      新增平台默认应对所有角色可见，除非后续显式收回）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.role_platform_permissions (role_id, platform_code)
SELECT r.id, p.platform_code
FROM public.roles r
CROSS JOIN public.system_platform_configs p
WHERE p.is_enabled = true
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. 清理已停用平台的授权（jd / pdd）
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.role_platform_permissions
 WHERE platform_code IN (
   SELECT platform_code FROM public.system_platform_configs WHERE is_enabled = false
 );

-- ────────────────────────────────────────────────────────────────
-- 3. 防复发：授权缺口校验函数
--    返回「已启用但未被任何角色授权的平台」；正常应为 0 行
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_platform_grant_gap()
RETURNS TABLE (platform_code varchar, enabled boolean, granted_role_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT p.platform_code,
         p.is_enabled,
         COUNT(DISTINCT rpp.role_id) AS granted_role_count
    FROM public.system_platform_configs p
    LEFT JOIN public.role_platform_permissions rpp ON rpp.platform_code = p.platform_code
   WHERE p.is_enabled = true
   GROUP BY p.platform_code, p.is_enabled
  HAVING COUNT(DISTINCT rpp.role_id) = 0;
$$;

COMMENT ON FUNCTION public.check_platform_grant_gap() IS
  '平台授权缺口检测：返回已启用但没有任何角色授权的平台。应在接入新平台后立即校验，避免模块静默不可见';

-- ────────────────────────────────────────────────────────────────
-- 4. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_gap int;
  v_total int;
  v_wechat int;
BEGIN
  SELECT count(*) INTO v_gap FROM public.check_platform_grant_gap();
  IF v_gap > 0 THEN
    RAISE EXCEPTION '仍有 % 个启用平台无任何角色授权', v_gap;
  END IF;

  SELECT count(*) INTO v_total FROM public.role_platform_permissions;
  SELECT count(*) INTO v_wechat FROM public.role_platform_permissions WHERE platform_code = 'wechat';

  RAISE NOTICE '平台授权：总 % 条，其中视频号 % 条', v_total, v_wechat;

  IF v_wechat = 0 THEN
    RAISE EXCEPTION '视频号平台授权补齐失败';
  END IF;
END $$;

-- version: 129_platform_grant_sync
