-- ============================================================================
-- 迁移 147：v_fact_trade_default 改为 fail-closed（P0-B-2）
-- ----------------------------------------------------------------------------
-- 审计 04 发现的隐患：
--   原视图 WHERE 条件为 `pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type`
--   → 若某平台**未配置默认口径**，`pcc.amount_type IS NULL` 为真，
--     该平台**所有 amount_type 的行全部返回**，静默退化成裸 SUM（放大 2~4 倍）。
--
-- 实测放大倍数不等（1.90x ~ 3.88x）→ 会导致**平台排名反转**：
--   裸 SUM：tmall(2560万) > douyin(2402万)
--   默认口径：douyin(1264万) > tmall(938万)
--
-- 修复：改为 fail-closed —— 必须配置了默认口径才会被选中。
--   未配置平台的后果从「静默放大」变为「查不到数据」，
--   配合下面的自检函数可在启动时/CI 中立即发现缺口。
-- ============================================================================

DROP VIEW IF EXISTS public.v_fact_trade_default;

CREATE VIEW public.v_fact_trade_default AS
SELECT f.id,
       f.biz_date,
       f.platform_code,
       f.shop_id,
       f.channel_name,
       f.gmv,
       f.pay_amount,
       f.paid_order_count,
       f.paid_buyer_count,
       f.refund_amount,
       f.refund_count,
       f.source,
       f.upload_id,
       f.extra,
       f.created_at,
       f.amount_type,
       f.attribution_window_hours,
       f.source_code,
       f.content_id,
       f.is_demo
  FROM public.fact_trade_daily f
  JOIN public.platform_caliber_config pcc
    ON pcc.platform_code = f.platform_code
   AND pcc.metric_code   = 'gmv'
   AND pcc.is_default    = true
 WHERE f.amount_type = pcc.amount_type;

COMMENT ON VIEW public.v_fact_trade_default IS
  'GMV 默认口径视图（fail-closed）：仅返回与 platform_caliber_config 中 is_default=true 的 amount_type 匹配的行。未配置默认口径的平台将返回 0 行（而非静默返回全部口径）';

-- ────────────────────────────────────────────────────────────────
-- 口径缺口自检函数（供 CI / 运维巡检调用）
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_caliber_gap()
RETURNS TABLE (platform_code varchar, reason text)
LANGUAGE sql STABLE AS $$
  -- ① 启用了但没配默认口径
  SELECT p.platform_code, '未配置 is_default=true 的 gmv 口径'::text
    FROM public.system_platform_configs p
   WHERE p.is_enabled = true
     AND NOT EXISTS (
       SELECT 1 FROM public.platform_caliber_config c
        WHERE c.platform_code = p.platform_code
          AND c.metric_code = 'gmv' AND c.is_default = true
     )
  UNION ALL
  -- ② 配了默认口径但事实表里没有该 amount_type 的数据
  SELECT c.platform_code, '默认口径配置为 ' || c.amount_type || '，但事实表无此口径数据'::text
    FROM public.platform_caliber_config c
   WHERE c.metric_code = 'gmv' AND c.is_default = true
     AND NOT EXISTS (
       SELECT 1 FROM public.fact_trade_daily f
        WHERE f.platform_code = c.platform_code
          AND f.amount_type = c.amount_type
     );
$$;

COMMENT ON FUNCTION public.check_caliber_gap() IS
  '口径缺口检测：返回「启用但未配默认口径」或「默认口径无数据」的平台。正常应为 0 行';

-- ────────────────────────────────────────────────────────────────
-- 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_gap int;
  v_raw numeric;
  v_default numeric;
BEGIN
  SELECT count(*) INTO v_gap FROM public.check_caliber_gap();

  SELECT COALESCE(SUM(gmv),0) INTO v_raw FROM public.fact_trade_daily;
  SELECT COALESCE(SUM(gmv),0) INTO v_default FROM public.v_fact_trade_default;

  RAISE NOTICE '口径修复完成：裸SUM=%, 默认口径=%, 放大倍数=%, 缺口=%',
    round(v_raw/10000,0), round(v_default/10000,0),
    round(v_raw / NULLIF(v_default,0), 2), v_gap;

  IF v_gap > 0 THEN
    RAISE WARNING '存在 % 个平台的默认口径缺口，请运行 SELECT * FROM check_caliber_gap() 查看', v_gap;
  END IF;
END $$;

-- version: 147_v_fact_trade_default_fail_closed
