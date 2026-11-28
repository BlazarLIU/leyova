-- ============================================================================
-- 196：角色授权双表对齐（role_module_grants ↔ sys_role_permission）
-- ----------------------------------------------------------------------------
-- 背景：
--   access-resolver 的读取顺序是
--     user_module_overrides > sys_role_permission > role_module_grants > role_modules
--   但「角色与模块权限」页编辑的是 role_module_grants，而部分迁移直接写
--   sys_role_permission，导致两表漂移：权限页看不到真实授权，改了也不生效。
--
-- 策略（最小权限，不扩权）：
--   1. 以 sys_role_permission 为准，单向回填到 role_module_grants（权限页可见）。
--   2. 收回误授的父模块 ai：客服(cs_agent) / 拍剪(video_editor) 不该拥有
--      全部 AI 子模块（父模块 ai 会被 resolveEffectiveModule 展开为 8 个子模块）。
--   3. 补 W2.5 设计意图但漏授的：video_editor 需要 ai_chat / ai_review / ai_content。
--   4. 校验两表 allow 集合一致。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 收回误授的父模块 ai（连带触发器删除 sys 中的 module:ai）
-- ────────────────────────────────────────────────────────────
DELETE FROM public.role_module_grants
 WHERE module_code = 'ai'
   AND role_code IN ('cs_agent', 'video_editor');

DELETE FROM public.sys_role_permission
 WHERE resource = 'module:ai'
   AND role_code IN ('cs_agent', 'video_editor');

-- ────────────────────────────────────────────────────────────
-- 2. 补授 W2.5 明确要求、但当前库缺失的 AI 子模块
--    （写 grants，触发器同步到 sys）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
VALUES
  ('video_editor', 'ai_chat',    'allow', '196 W2.5 补授：拍剪可用 AI 对话'),
  ('video_editor', 'ai_review',  'allow', '196 W2.5 补授：拍剪可看 AI 复盘'),
  ('video_editor', 'ai_content', 'allow', '196 W2.5 补授：拍剪核心域（脚本/剪辑）'),
  ('cs_agent',     'ai_chat',    'allow', '196 W2.5 补授：客服可用 AI 对话'),
  ('cs_agent',     'ai_review',  'allow', '196 W2.5 补授：客服可看 AI 复盘')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. sys → grants 单向回填：让权限页反映真实授权
-- ────────────────────────────────────────────────────────────
INSERT INTO public.role_module_grants (role_code, module_code, effect, note)
SELECT p.role_code, p.module_code, p.effect, '196 双表对齐（来自 sys_role_permission）'
FROM (
  SELECT role_code, substring(resource from 8) AS module_code, effect
    FROM public.sys_role_permission
   WHERE resource LIKE 'module:%'
   GROUP BY 1, 2, 3
) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_module_grants x
   WHERE x.role_code = p.role_code AND x.module_code = p.module_code
)
-- effect 列只接受 allow/deny；其它历史值一律按 allow 处理
AND p.effect IN ('allow', 'deny');

-- ────────────────────────────────────────────────────────────
-- 4. 校验：两表 allow 集合完全一致
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_grants int;
  v_sys int;
  v_missing int;
  v_orphan int;
BEGIN
  SELECT count(*) INTO v_grants FROM public.role_module_grants WHERE effect = 'allow';
  SELECT count(*) INTO v_sys
    FROM public.sys_role_permission
   WHERE resource LIKE 'module:%' AND effect = 'allow';

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

  SELECT count(*) INTO v_orphan
    FROM public.sys_role_permission p
   WHERE p.resource LIKE 'module:%' AND p.effect = 'allow'
     AND NOT EXISTS (
       SELECT 1 FROM public.role_module_grants g
        WHERE g.role_code = p.role_code
          AND g.module_code = substring(p.resource from 8)
          AND g.effect = 'allow'
     );
  IF v_orphan > 0 THEN
    RAISE EXCEPTION '仍有 % 条 sys 授权未出现在角色权限页', v_orphan;
  END IF;

  RAISE NOTICE '196 完成：grants % 条 / sys % 条，双向一致', v_grants, v_sys;
END $$;

COMMIT;