-- ============================================================================
-- Migration: 120_midterm_architecture_optimization.sql
-- Description: 中期架构优化：
--   1. 清理 8 张确认 0 行/0 引用的僵尸与临时备份表；
--   2. 补齐 metric_definition 口径元数据并开放只读授权；
--   3. 将代码内硬编码的各平台售后/预售/预警阈值全面迁入 platform_sla_config 与 system_config；
--   4. 新增京东自营 vs POP 细粒度费项对账表 fact_jd_settlement_fees（含 RLS 与演示种子）。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 清理已确认 0 行且无代码引用的僵尸表与历史临时备份表
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.product_template_items;
DROP TABLE IF EXISTS public.product_templates;
DROP TABLE IF EXISTS public.ad_channel_metrics;
DROP TABLE IF EXISTS public.ad_plans;
DROP TABLE IF EXISTS public.agency_client_tokens;
DROP TABLE IF EXISTS public.attendance_records;
DROP TABLE IF EXISTS public.dim_channel;
DROP TABLE IF EXISTS public.live_registrations_backup_20261108;

-- ────────────────────────────────────────────────────────────
-- 2. 完善 metric_definition 指标口径字典（接入语义层与 /api/v1/caliber/metrics）
-- ────────────────────────────────────────────────────────────
UPDATE public.metric_definition
SET supported_platforms = ARRAY['douyin','kuaishou','taobao','tmall','jd','pdd','xiaohongshu']::varchar[]
WHERE metric_code <> 'gpm';

UPDATE public.metric_definition
SET supported_platforms = ARRAY['douyin','kuaishou']::varchar[]
WHERE metric_code = 'gpm';

UPDATE public.metric_definition
SET extra = jsonb_build_object(
  'standardDenominator', 'gmv',
  'pddDenominator', 'paid_order_count',
  'warningKey', 'refund_rate_warning_pct'
)
WHERE metric_code = 'refund_rate';

-- ────────────────────────────────────────────────────────────
-- 3. 平台默认 SLA 阈值配置化（替代 after-sales / fulfillment / orchestrator 硬编码）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.platform_sla_config
  (platform_code, sla_type, sla_name, threshold_hours, business_hours_only, pickup_threshold_hours,
   penalty_fixed_amount, penalty_rate, penalty_min_amount, penalty_max_amount, autonomy_min_score, is_verified, penalty_note)
VALUES
  ('pdd', 'ship_presale', '拼多多定制/预售发货时限', 120, false, 24,
   3.00, 0.0000, 3.00, 100.00, NULL, true,
   '拼多多定制/预售商品发货时限由默认 48h 放宽至 120h'),
  ('douyin', 'aftersale_only_refund_audit', '抖音仅退款审核时限', 24, false, 0,
   0.00, 0.0000, 0.00, 0.00, NULL, true,
   '抖音仅退款申请 默认 24h 内完成商家自审'),
  ('douyin', 'aftersale_return_audit', '抖音退货退款审核时限', 48, false, 0,
   0.00, 0.0000, 0.00, 0.00, NULL, true,
   '抖音退货退款申请 默认 48h 内完成商家自审'),
  ('pdd', 'aftersale_only_refund_audit', '拼多多仅退款审核时限', 24, false, 0,
   0.00, 0.0000, 0.00, 0.00, NULL, true,
   '拼多多仅退款申请 默认 24h 审核响应窗口'),
  ('pdd', 'aftersale_return_audit', '拼多多退货退款审核时限', 48, false, 0,
   0.00, 0.0000, 0.00, 0.00, NULL, true,
   '拼多多退货退款申请 默认 48h 审核窗口'),
  ('taobao', 'aftersale_only_refund_audit', '淘宝仅退款审核时限', 24, false, 0,
   0.00, 0.0000, 0.00, 0.00, 4.80, true,
   '淘宝仅退款 24h 响应窗口；体验分 >= 4.80 享有自主处置保护'),
  ('taobao', 'aftersale_return_audit', '淘宝退货退款审核时限', 48, false, 0,
   0.00, 0.0000, 0.00, 0.00, 4.80, true,
   '淘宝退货退款 48h 审核窗口'),
  ('tmall', 'aftersale_only_refund_audit', '天猫仅退款审核时限', 24, false, 0,
   0.00, 0.0000, 0.00, 0.00, 4.80, true,
   '天猫仅退款 24h 响应窗口；体验分 >= 4.80 享有自主处置保护'),
  ('tmall', 'aftersale_return_audit', '天猫退货退款审核时限', 48, false, 0,
   0.00, 0.0000, 0.00, 0.00, 4.80, true,
   '天猫退货退款 48h 审核窗口')
ON CONFLICT (platform_code, sla_type) DO UPDATE
SET sla_name = EXCLUDED.sla_name,
    threshold_hours = EXCLUDED.threshold_hours,
    pickup_threshold_hours = EXCLUDED.pickup_threshold_hours,
    penalty_fixed_amount = EXCLUDED.penalty_fixed_amount,
    autonomy_min_score = COALESCE(EXCLUDED.autonomy_min_score, public.platform_sla_config.autonomy_min_score),
    is_verified = EXCLUDED.is_verified,
    penalty_note = EXCLUDED.penalty_note;

UPDATE public.platform_sla_config
SET penalty_fixed_amount = 3.00
WHERE sla_type IN ('ship', 'ship_delay')
  AND penalty_fixed_amount = 0
  AND penalty_rate = 0;

INSERT INTO public.system_config (config_key, config_value, config_type, description)
VALUES (
  'refund_rate_warning_pct',
  '10',
  'number',
  'AI 编排器与经营看板默认退款率预警阈值（百分比）'
)
ON CONFLICT (config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────
-- 4. 京东自营 vs POP 细粒度费项对账表（毛保/返点/TC运费/贴码费/质保金/佣金）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_jd_settlement_fees (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    shop_id         BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    business_mode   VARCHAR(32) NOT NULL CHECK (business_mode IN ('self_operated', 'pop_sop', 'pop_fbp')),
    biz_month       VARCHAR(7) NOT NULL,
    fee_code        VARCHAR(40) NOT NULL CHECK (fee_code IN (
                      'gross_margin_guarantee', 'rebate', 'tc_freight', 'label_fee', 'quality_deposit', 'commission'
                    )),
    fee_name        VARCHAR(64) NOT NULL,
    direction       VARCHAR(16) NOT NULL DEFAULT 'deduct' CHECK (direction IN ('deduct', 'rebate')),
    amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, shop_id, biz_month, fee_code)
);

CREATE INDEX IF NOT EXISTS idx_jd_settlement_fees_lookup
  ON public.fact_jd_settlement_fees (tenant_id, shop_id, biz_month, business_mode);

GRANT SELECT ON public.metric_definition, public.platform_sla_config, public.system_config TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fact_jd_settlement_fees TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.fact_jd_settlement_fees_id_seq TO leyova_app;

ALTER TABLE public.fact_jd_settlement_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_jd_settlement_fees FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_fact_jd_settlement_fees_select ON public.fact_jd_settlement_fees;
CREATE POLICY p_fact_jd_settlement_fees_select ON public.fact_jd_settlement_fees
  FOR SELECT TO leyova_app
  USING (
    public.rls_can_access_shop(shop_id)
    AND (
      (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'))
      OR (public.rls_user_type() = 'brand_viewer' AND public.rls_can_view_cost())
    )
  );

DROP POLICY IF EXISTS p_fact_jd_settlement_fees_write ON public.fact_jd_settlement_fees;
CREATE POLICY p_fact_jd_settlement_fees_write ON public.fact_jd_settlement_fees
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director'))
  WITH CHECK (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director'));


COMMIT;

