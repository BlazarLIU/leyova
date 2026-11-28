-- ============================================================================
-- 197：platform_capability_matrix 真实差异化（P1-3）
-- ----------------------------------------------------------------------------
-- 现状（审计 _evidence/02-db-rowcounts.md §6）：
--   198 行、is_applicable=false 0 行、六平台签名完全相同
--   → 「切平台只改变 22 个导航项」，平台差异等于没做。
--
-- 本迁移按各平台官方在营能力落真实差异（不是拍脑袋砍功能）：
--
--   模块              抖音 快手 淘宝 天猫 视频号 小红书   依据
--   system_multiroom   ✅   ✅   ✅   ✅   ✅    ❌      小红书买手单场直播，无多直播间矩阵
--   search_seo         ✅   ❌   ✅   ✅   ✅    ❌      快手/小红书无商品搜索卡位量化数据源
--   kol                ✅   ✅   ✅   ✅   ✅    ✅      六平台均有达人/买手体系
--
-- 另：needs_dedicated_page 已在 133 落 20 条，此处补齐「按平台必须换口径」的
--   剩余项，让前端可据此渲染专属视图提示。
--
-- 只「减」不「加」：本迁移不会把任何已停用能力重新打开。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 真实差异：不可用模块
-- ────────────────────────────────────────────────────────────
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
VALUES
  ('xiaohongshu', 'system_multiroom', false, false, '小红书买手为单场直播，不存在多直播间矩阵'),
  ('kuaishou',    'search_seo',       false, false, '快手无商品搜索卡位量化数据源（磁力金牛为投放，不属搜索词卡位）'),
  ('xiaohongshu', 'search_seo',       false, false, '小红书为笔记搜索，无法映射为商品卡位口径')
ON CONFLICT (platform_code, module_code)
DO UPDATE SET
  is_applicable = EXCLUDED.is_applicable,
  needs_dedicated_page = EXCLUDED.needs_dedicated_page,
  note = EXCLUDED.note;

-- ────────────────────────────────────────────────────────────
-- 2. 专属口径标记补齐：凡平台专属页已存在的模块，标记 needs_dedicated_page
--    （与 route-manifest 中 platforms: [...] 的 22 条平台专属入口对齐）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
VALUES
  ('douyin',      'review_channels', true, true, '抖音三池（直播/短视频/商城）统一调度口径'),
  ('kuaishou',    'review_channels', true, true, '快手公私域（关注页/发现页）拆分口径'),
  ('taobao',      'review_channels', true, true, '淘系三源（直播推荐/搜索/店铺自运营）口径'),
  ('tmall',       'review_channels', true, true, '天猫五层抵扣 + 官方立减联动口径'),
  ('wechat',      'review_channels', true, true, '视频号公私域（社交裂变）拆分口径'),
  ('xiaohongshu', 'review_channels', true, true, '小红书笔记引流 + 推荐 + 搜索口径'),
  ('xiaohongshu', 'content',         true, true, '小红书笔记经营与种草转化链路'),
  ('wechat',      'content',         true, true, '视频号图文内容与全域带货者视角')
ON CONFLICT (platform_code, module_code)
DO UPDATE SET
  is_applicable = EXCLUDED.is_applicable,
  needs_dedicated_page = EXCLUDED.needs_dedicated_page,
  note = EXCLUDED.note;

-- ────────────────────────────────────────────────────────────
-- 3. 校验：平台之间必须存在真实差异（验收：至少 3 种能力签名）
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_signatures int;
  v_not_applicable int;
  v_total int;
BEGIN
  SELECT count(DISTINCT sig) INTO v_signatures
    FROM (
      SELECT platform_code,
             string_agg(module_code || ':' || is_applicable::text, ',' ORDER BY module_code) AS sig
        FROM public.platform_capability_matrix
       GROUP BY platform_code
    ) s;

  SELECT count(*) INTO v_not_applicable
    FROM public.platform_capability_matrix WHERE is_applicable = false;
  SELECT count(*) INTO v_total FROM public.platform_capability_matrix;

  IF v_signatures < 3 THEN
    RAISE EXCEPTION '平台能力签名仅 % 种（要求 ≥3），差异化未生效', v_signatures;
  END IF;
  IF v_not_applicable = 0 THEN
    RAISE EXCEPTION '仍无任何 is_applicable=false 行，平台差异仍为空';
  END IF;

  RAISE NOTICE '197 完成：能力矩阵 % 条，% 条不适用，% 种平台签名',
    v_total, v_not_applicable, v_signatures;
END $$;

COMMIT;