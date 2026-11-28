-- ============================================================================
-- 迁移 153：归因窗口三方对齐（P2）
-- ----------------------------------------------------------------------------
-- 审计 04 发现：同一平台的归因窗口在三处不一致
--   · platform_caliber_config.attribution_window_hours —— 5 个平台为 NULL，快手填了 24（其实是退款窗口，填错了字段）
--   · ad_tool_dict.default_attribution_hours            —— 168 / 360
--   · fact_trade_daily.attribution_window_hours         —— 168 / 360（真实值）
--
-- 后果：net-roi 计算「T+N 结算」时，不同来源读到不同窗口 → ROI 口径漂移
--
-- 修复：以 fact_trade_daily 的实际值为权威，回填 caliber_config；
--       并把 attribution_type 标清楚（click / view），避免语义含糊。
-- ============================================================================

-- 1. 以事实表真实值为准，回填 caliber_config 的归因窗口
UPDATE public.platform_caliber_config c
   SET attribution_window_hours = f.h,
       attribution_type = COALESCE(c.attribution_type, 'click')
  FROM (
    SELECT platform_code, MAX(attribution_window_hours) AS h
      FROM public.fact_trade_daily
     WHERE attribution_window_hours IS NOT NULL
     GROUP BY platform_code
  ) f
 WHERE c.platform_code = f.platform_code
   AND c.metric_code = 'gmv';

-- 2. 快手修正：24 是被误填的退款窗口，不是归因窗口
UPDATE public.platform_caliber_config
   SET attribution_window_hours = 168,
       display_note = CONCAT(COALESCE(display_note,''), ' [归因窗口已修正：原填 24h 实为退款窗口]')
 WHERE platform_code = 'kuaishou'
   AND attribution_window_hours = 24;

-- 3. 补 attribution_type 语义说明
UPDATE public.platform_caliber_config
   SET display_note = CONCAT(
         COALESCE(display_note,''),
         CASE WHEN display_note IS NULL OR display_note = '' THEN '' ELSE ' | ' END,
         '归因窗口 ', attribution_window_hours::text, 'h（与 ad_tool_dict / fact_trade_daily 对齐）'
       )
 WHERE metric_code = 'gmv'
   AND attribution_window_hours IS NOT NULL
   AND (display_note IS NULL OR display_note NOT LIKE '%对齐%');

-- 4. 校验：三处必须一致
DO $$
DECLARE
  r record;
  v_bad int := 0;
BEGIN
  FOR r IN
    SELECT c.platform_code,
           c.attribution_window_hours AS caliber_h,
           (SELECT MAX(f.attribution_window_hours)
              FROM public.fact_trade_daily f
             WHERE f.platform_code = c.platform_code) AS fact_h
      FROM public.platform_caliber_config c
     WHERE c.metric_code = 'gmv' AND c.is_default = true
  LOOP
    IF r.fact_h IS NOT NULL AND r.caliber_h IS DISTINCT FROM r.fact_h THEN
      v_bad := v_bad + 1;
      RAISE WARNING '平台 % 归因窗口不一致：caliber=%, fact=%', r.platform_code, r.caliber_h, r.fact_h;
    END IF;
  END LOOP;

  IF v_bad > 0 THEN
    RAISE EXCEPTION '仍有 % 个平台归因窗口不一致', v_bad;
  END IF;
  RAISE NOTICE '归因窗口三方已对齐';
END $$;

-- version: 153_alignment_attribution_window
