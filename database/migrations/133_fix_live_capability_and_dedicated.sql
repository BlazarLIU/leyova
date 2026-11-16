-- ============================================================================
-- 迁移 133：修正平台直播属性 + 补全各平台专属能力（S7）
-- ----------------------------------------------------------------------------
-- 老大原话：
--   1.「leyova 系统只专注于直播电商，去掉不含主播带货的电商平台」
--   2.「这些平台里面，哪些会有直播带货的板块，比如：抖音、快手、小红书」
--   3.「很多分组、模块、功能在切换平台后，还是在显示，根本没有根据每个平台
--      属性来定制显示（也有一个就是每个平台专属的功能还不完善，调研后详细补全）」
--
-- 🔴 本轮发现的严重逻辑错误：
--   老大选定的 5 个平台全部是直播带货平台，但系统中：
--     taobao / tmall / xiaohongshu 的 supportsLive = false
--     platform_capability_matrix 中这 3 个平台的直播模块 is_applicable = false
--   → 导致它们的直播场次/复盘/排班/主播等模块被整体隐藏，
--     与「只做直播电商」的定位直接矛盾。
--
-- 修正依据（各平台直播形态，均为官方在营业务）：
--   抖音     直播间 + 短视频引流 + 商城，达人分销 + 商家自播
--   快手     直播间 + 私域关注页 + 小店，达人分销 + 商家自播
--   视频号   视频号直播 + 公众号/社群/朋友圈全域带货
--   淘宝     淘宝直播/点淘，店播 + 达人直播（老大选的就是「淘宝直播/点淘」）
--   天猫     品牌自播为主 + 达人直播（天猫直播，与淘宝直播同一技术底座）
--   小红书   买手直播 + 笔记种草联动（老大明确点名小红书有直播带货板块）
--
-- 结论：5 个平台全部 supportsLive = true；
--       差异体现在「直播形态」（直播专属页面与指标口径），不是「有无直播」。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 修正能力矩阵：所有启用平台的直播域模块均适用
-- ────────────────────────────────────────────────────────────────
UPDATE public.platform_capability_matrix m
   SET is_applicable = true,
       note = CASE
         WHEN p.platform_code IN ('taobao','tmall') THEN '淘宝/天猫直播（店播 + 达人直播），直播与店铺强绑定'
         WHEN p.platform_code = 'xiaohongshu' THEN '小红书买手直播，直播与笔记种草强联动'
         WHEN p.platform_code = 'wechat' THEN '视频号直播，公私域混合'
         ELSE ''
       END
  FROM public.system_platform_configs p
 WHERE p.platform_code = m.platform_code
   AND m.module_code = ANY (ARRAY[
     'session', 'session_products', 'personal_achievement',
     'live_registration', 'live_data', 'review', 'review_overview',
     'review_anchors', 'review_funnel', 'review_closed_loop',
     'system_multiroom', 'anchor'
   ]::varchar[]);

-- ────────────────────────────────────────────────────────────────
-- 2. 补全「平台专属能力」标记（needs_dedicated_page = true）
--    含义：该模块在此平台需要专属页面/专属口径，不能只靠通用页
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.platform_capability_matrix (platform_code, module_code, is_applicable, needs_dedicated_page, note)
VALUES
  -- 淘宝：直播与店铺强绑定，需要「店铺直播总览」专属页
  ('taobao',    'session',        true, true,  '淘宝直播按店铺维度组织，需店铺×场次联动视图'),
  ('taobao',    'review_channels',true, true,  '淘宝直播流量含「直播推荐/搜索/店铺自运营」三源'),
  ('tmall',     'session',        true, true,  '天猫以品牌自播为主，需品牌×场次视图'),
  ('tmall',     'review_channels',true, true,  '天猫直播与官方立减/五层抵扣联动'),
  -- 小红书：直播与笔记种草联动
  ('xiaohongshu','session',       true, true,  '小红书买手直播，需「笔记→直播→成交」联动视图'),
  ('xiaohongshu','review_channels',true,true,  '小红书直播流量来自笔记引流 + 推荐 + 搜索'),
  ('xiaohongshu','anchor',        true, true,  '小红书主播即买手，需买手调性/粉丝画像维度'),
  -- 视频号：公私域混合
  ('wechat',    'review_channels',true, true,  '视频号直播流量公私域混合度最高，需拆分社交裂变'),
  ('wechat',    'anchor',         true, true,  '视频号主播与公众号/社群绑定，需全域带货者视角'),
  -- 快手：私域
  ('kuaishou',  'review_channels',true, true,  '快手公私域（关注页/发现页）拆分'),
  ('kuaishou',  'anchor',         true, true,  '快手粉丝团与私域信任关系'),
  -- 抖音：三池
  ('douyin',    'review_channels',true, true,  '抖音三池（直播/短视频/商城）统一调度'),
  ('douyin',    'session',        true, true,  '抖音需「短视频引流→直播承接」联动视图')
ON CONFLICT (platform_code, module_code)
DO UPDATE SET
  is_applicable = EXCLUDED.is_applicable,
  needs_dedicated_page = EXCLUDED.needs_dedicated_page,
  note = EXCLUDED.note;

-- ────────────────────────────────────────────────────────────────
-- 3. 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_bad int;
  v_dedicated int;
  v_total int;
BEGIN
  -- 所有启用平台的 session 模块都必须适用
  SELECT count(*) INTO v_bad
    FROM public.platform_capability_matrix m
    JOIN public.system_platform_configs p ON p.platform_code = m.platform_code
   WHERE m.module_code = 'session' AND p.is_enabled = true AND m.is_applicable = false;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '仍有 % 个启用平台被标记为「无直播场次」，与直播电商定位矛盾', v_bad;
  END IF;

  SELECT count(*) INTO v_dedicated FROM public.platform_capability_matrix WHERE needs_dedicated_page = true;
  SELECT count(*) INTO v_total FROM public.platform_capability_matrix;

  RAISE NOTICE 'S7 完成：能力矩阵 % 条，其中标记专属页 % 条；5 平台直播属性已全部修正', v_total, v_dedicated;
END $$;

-- version: 133_fix_live_capability_and_dedicated
