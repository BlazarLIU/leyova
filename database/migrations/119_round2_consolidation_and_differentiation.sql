-- 119_round2_consolidation_and_differentiation.sql
-- 第二轮审计（重叠与冗余收敛 + 平台差异化落盘 + 权限与数据闭环）
-- 幂等执行，兼顾已有线上库与空库冷启动。

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 默认成交口径视图 v_fact_trade_default（防止裸 SUM(gmv) 放大 2~4x）
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_fact_trade_default
WITH (security_invoker = true) AS
SELECT f.*
FROM public.fact_trade_daily f
LEFT JOIN public.platform_caliber_config pcc
  ON pcc.platform_code = f.platform_code
 AND pcc.metric_code = 'gmv'
 AND pcc.is_default = true
WHERE pcc.amount_type IS NULL OR f.amount_type = pcc.amount_type;

-- ────────────────────────────────────────────────────────────
-- 2. 投放事实表单一数据源收敛：fact_ad_daily → fact_ad_spend_daily
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.fact_ad_spend_daily
  ADD COLUMN IF NOT EXISTS direct_gmv NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_gmv NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_gmv NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 修正天猫万相台无界版结算周期（确认收货 T+7）
UPDATE public.ad_tool_dict
SET settlement_cycle_days = 7,
    description = '天猫万相台无界版：默认15天末次点击归因，确认收货T+7结算，需与五层官方立减让利联动核算净利'
WHERE code = 'wanxiangtai_tm' AND settlement_cycle_days = 10;

DO $$
DECLARE
  v_relkind char;
BEGIN
  SELECT c.relkind INTO v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'fact_ad_daily';

  -- 若 fact_ad_daily 仍是实体表/分区父表，则无损迁入 fact_ad_spend_daily 并转成兼容视图
  IF v_relkind IN ('r', 'p') THEN
    INSERT INTO public.fact_ad_spend_daily (
      tenant_id, platform_code, shop_id, biz_date, ad_tool_code,
      attribution_window_hours, ad_spend, impressions, clicks, attributed_orders,
      attributed_gross_gmv, attributed_settled_gmv, refund_reserve_amount,
      settlement_cycle_days, estimated_settle_date, is_demo,
      direct_gmv, indirect_gmv, net_gmv
    )
    SELECT
      COALESCE(s.tenant_id, 1),
      f.platform_code,
      f.shop_id,
      f.biz_date,
      COALESCE(
        CASE f.platform_code
          WHEN 'douyin' THEN 'qianchuan'
          WHEN 'taobao' THEN 'wanxiangtai'
          WHEN 'tmall' THEN 'wanxiangtai_tm'
          WHEN 'jd' THEN 'jingzhuntong'
          WHEN 'pdd' THEN 'pdd_goods_promo'
          WHEN 'kuaishou' THEN 'cili_jinniu'
          WHEN 'xiaohongshu' THEN 'juguang'
          ELSE 'qianchuan'
        END,
        'qianchuan'
      ) AS mapped_tool,
      COALESCE(d.default_attribution_hours, MAX(f.attribution_window_hours), 168),
      SUM(f.ad_spend)::numeric(14,2),
      SUM(f.impressions)::bigint,
      SUM(f.clicks)::bigint,
      SUM(f.conversions)::int,
      SUM(f.ad_gmv)::numeric(14,2),
      CASE
        WHEN SUM(COALESCE(f.net_gmv, 0)) > 0 THEN SUM(f.net_gmv)::numeric(14,2)
        ELSE ROUND(SUM(f.ad_gmv) * 0.85, 2)::numeric(14,2)
      END,
      GREATEST(
        0,
        SUM(f.ad_gmv) - CASE
          WHEN SUM(COALESCE(f.net_gmv, 0)) > 0 THEN SUM(f.net_gmv)
          ELSE ROUND(SUM(f.ad_gmv) * 0.85, 2)
        END
      )::numeric(14,2),
      COALESCE(d.settlement_cycle_days, 7),
      (f.biz_date + make_interval(days => COALESCE(d.settlement_cycle_days, 7)))::date,
      false,
      SUM(COALESCE(f.direct_gmv, 0))::numeric(14,2),
      SUM(COALESCE(f.indirect_gmv, 0))::numeric(14,2),
      SUM(COALESCE(f.net_gmv, 0))::numeric(14,2)
    FROM public.fact_ad_daily f
    LEFT JOIN public.dim_shop s ON s.id = f.shop_id
    LEFT JOIN public.ad_tool_dict d ON d.code = CASE f.platform_code
      WHEN 'douyin' THEN 'qianchuan'
      WHEN 'taobao' THEN 'wanxiangtai'
      WHEN 'tmall' THEN 'wanxiangtai_tm'
      WHEN 'jd' THEN 'jingzhuntong'
      WHEN 'pdd' THEN 'pdd_goods_promo'
      WHEN 'kuaishou' THEN 'cili_jinniu'
      WHEN 'xiaohongshu' THEN 'juguang'
      ELSE 'qianchuan'
    END
    WHERE f.shop_id IS NOT NULL AND s.id IS NOT NULL
    GROUP BY
      COALESCE(s.tenant_id, 1), f.platform_code, f.shop_id, f.biz_date,
      mapped_tool, d.default_attribution_hours, d.settlement_cycle_days
    ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, ad_tool_code)
    DO UPDATE SET
      direct_gmv = GREATEST(public.fact_ad_spend_daily.direct_gmv, EXCLUDED.direct_gmv),
      indirect_gmv = GREATEST(public.fact_ad_spend_daily.indirect_gmv, EXCLUDED.indirect_gmv),
      net_gmv = GREATEST(public.fact_ad_spend_daily.net_gmv, EXCLUDED.net_gmv),
      updated_at = NOW();

    DROP TABLE IF EXISTS public.fact_ad_daily CASCADE;
  END IF;
END $$;

-- 以受 RLS 约束的兼容视图保留 fact_ad_daily 只读接口，彻底消除双表双真相源
CREATE OR REPLACE VIEW public.fact_ad_daily
WITH (security_invoker = true) AS
SELECT
  f.id,
  f.biz_date,
  f.platform_code,
  f.shop_id,
  f.id AS plan_id,
  COALESCE(d.name, f.ad_tool_code)::varchar(128) AS plan_name,
  f.ad_spend,
  f.attributed_gross_gmv AS ad_gmv,
  CASE WHEN f.ad_spend > 0 THEN ROUND(f.attributed_gross_gmv / f.ad_spend, 2) ELSE 0::numeric END AS ad_roi,
  f.impressions,
  f.clicks::int AS clicks,
  f.attributed_orders AS conversions,
  'fact_ad_spend_daily'::varchar(32) AS source,
  f.created_at,
  f.attribution_window_hours,
  'last_click'::varchar(32) AS attribution_type,
  f.direct_gmv,
  f.indirect_gmv,
  f.net_gmv,
  COALESCE(d.name, f.ad_tool_code)::varchar(64) AS ad_tool
FROM public.fact_ad_spend_daily f
LEFT JOIN public.ad_tool_dict d ON d.code = f.ad_tool_code;

-- ────────────────────────────────────────────────────────────
-- 3. anchor_rankings 去重收敛为 anchor_capabilities 视图
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_relkind char;
BEGIN
  SELECT c.relkind INTO v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'anchor_rankings';

  IF v_relkind IN ('r', 'p') THEN
    INSERT INTO public.anchor_capabilities (
      anchor_id, expression, interaction, conversion, professionalism, overall, evaluated_at, created_at
    )
    SELECT
      r.anchor_id, r.expression, r.interaction, r.conversion, r.professionalism, r.overall, r.rank_date, r.created_at
    FROM public.anchor_rankings r
    WHERE NOT EXISTS (
      SELECT 1 FROM public.anchor_capabilities c
      WHERE c.anchor_id = r.anchor_id AND c.evaluated_at = r.rank_date
    );

    DROP TABLE IF EXISTS public.anchor_rankings CASCADE;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.anchor_rankings
WITH (security_invoker = true) AS
SELECT
  id,
  anchor_id,
  overall,
  expression,
  interaction,
  conversion,
  professionalism,
  evaluated_at AS rank_date,
  created_at
FROM public.anchor_capabilities;

-- ────────────────────────────────────────────────────────────
-- 4. agg_platform_monthly 收敛为物化视图（消除与 agg_shop_daily 的双写）
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_relkind char;
BEGIN
  SELECT c.relkind INTO v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'agg_platform_monthly';

  IF v_relkind IN ('r', 'p') THEN
    DROP TABLE IF EXISTS public.agg_platform_monthly CASCADE;
    v_relkind := NULL;
  END IF;

  IF v_relkind IS NULL THEN
    CREATE MATERIALIZED VIEW public.agg_platform_monthly AS
    SELECT
      ROW_NUMBER() OVER (ORDER BY to_char(biz_date, 'YYYY-MM'), platform_code)::int AS id,
      to_char(biz_date, 'YYYY-MM')::varchar(7) AS year_month,
      platform_code,
      COALESCE(SUM(total_gmv), 0)::numeric(14,2) AS total_gmv,
      COALESCE(SUM(total_refund_amount), 0)::numeric(14,2) AS total_refund_amount,
      COALESCE(SUM(net_sales), 0)::numeric(14,2) AS net_sales,
      COALESCE(SUM(total_ad_spend), 0)::numeric(14,2) AS total_ad_spend,
      CASE
        WHEN COALESCE(SUM(total_ad_spend), 0) > 0
        THEN ROUND(SUM(total_gmv) / SUM(total_ad_spend), 2)
        ELSE 0::numeric
      END AS overall_roi,
      COALESCE(MAX(updated_at), NOW()) AS updated_at
    FROM public.agg_shop_daily
    GROUP BY to_char(biz_date, 'YYYY-MM'), platform_code;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_agg_platform_monthly_ym_plat
  ON public.agg_platform_monthly (year_month, platform_code);

-- ────────────────────────────────────────────────────────────
-- 5. 清理零行死表 order_facts（京东分析已统一迁移到 fact_fulfillment_waybill）
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.order_facts CASCADE;

-- ────────────────────────────────────────────────────────────
-- 6. 京东自营 (T+45 VC) 与 POP (T+1) 财务结算模式拆分
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.fact_settlement_cycles
  ADD COLUMN IF NOT EXISTS business_mode VARCHAR(32) NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fact_settlement_cycles_business_mode_check'
  ) THEN
    ALTER TABLE public.fact_settlement_cycles
      ADD CONSTRAINT fact_settlement_cycles_business_mode_check
      CHECK (business_mode IN ('standard', 'pop', 'self_operated'));
  END IF;
END $$;

UPDATE public.fact_settlement_cycles
SET business_mode = CASE
  WHEN platform_code = 'jd' AND shop_id = 8 THEN 'self_operated'
  WHEN platform_code = 'jd' THEN 'pop'
  ELSE 'standard'
END;

INSERT INTO public.fact_settlement_cycles (
  tenant_id, platform_code, shop_id, order_date, settle_date, settlement_cycle_days,
  gross_gmv, settled_gmv, refund_deducted, reserve_held, platform_fee, ad_spend, net_profit,
  settlement_status, business_mode, note
)
SELECT
  s.tenant_id, 'jd', s.id, DATE '2026-11-08', DATE '2026-12-23', 45,
  48600.00, 44226.00, 1458.00, 2916.00, 0.00, 5200.00, 39026.00,
  'pending', 'self_operated', '京东自营 VC T+45 月结账期（按供货结算额入账）'
FROM public.dim_shop s
WHERE s.id = 8 AND s.platform_code = 'jd'
ON CONFLICT (tenant_id, platform_code, shop_id, order_date) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. 折扣叠加规则从 promotions 假外键解耦，独立建表 pricing_rules + 补全天猫 5 层链路
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform_code VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  shop_id BIGINT REFERENCES public.dim_shop(id) ON DELETE SET NULL,
  rule_layer SMALLINT NOT NULL CHECK (rule_layer BETWEEN 1 AND 5),
  rule_name VARCHAR(128) NOT NULL,
  discount_mode VARCHAR(40) NOT NULL CHECK (discount_mode IN (
    'official_reduction', 'store_coupon', 'category_coupon', 'vip_discount', 'national_subsidy', 'red_packet', 'multi_piece_exclusive'
  )),
  discount_value NUMERIC(10,4) NOT NULL,
  is_exclusive BOOLEAN NOT NULL DEFAULT false,
  merchant_cost_ratio NUMERIC(6,4) NOT NULL DEFAULT 1.0000,
  platform_cost_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.0000,
  note TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_pricing_rules_select ON public.pricing_rules;
DROP POLICY IF EXISTS p_pricing_rules_write ON public.pricing_rules;

CREATE POLICY p_pricing_rules_select ON public.pricing_rules
  FOR SELECT TO leyova_app
  USING (
    public.rls_user_id() IS NOT NULL
    AND tenant_id = public.rls_tenant_id()
    AND public.rls_has_platform(platform_code)
  );

CREATE POLICY p_pricing_rules_write ON public.pricing_rules
  FOR ALL TO leyova_app
  USING (
    public.rls_is_agency_staff()
    AND tenant_id = public.rls_tenant_id()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'operator', 'ad_buyer', 'finance')
  )
  WITH CHECK (
    public.rls_is_agency_staff()
    AND tenant_id = public.rls_tenant_id()
    AND public.rls_role() IN ('super_admin', 'admin', 'ops_director', 'operator', 'ad_buyer', 'finance')
  );

INSERT INTO public.pricing_rules (
  tenant_id, platform_code, rule_layer, rule_name, discount_mode,
  discount_value, is_exclusive, merchant_cost_ratio, platform_cost_ratio, note
)
SELECT
  r.tenant_id, r.platform_code, r.rule_layer, r.rule_name, r.discount_mode,
  r.discount_value, r.is_exclusive, r.merchant_cost_ratio, r.platform_cost_ratio, r.note
FROM public.promotion_rules r
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules p
  WHERE p.tenant_id = r.tenant_id AND p.platform_code = r.platform_code AND p.rule_layer = r.rule_layer AND p.rule_name = r.rule_name
);

-- 补齐天猫 5 层官方抵扣链（第2层店铺券、第3层品类券、第5层国补/红包）
INSERT INTO public.pricing_rules (
  tenant_id, platform_code, rule_layer, rule_name, discount_mode,
  discount_value, is_exclusive, merchant_cost_ratio, platform_cost_ratio, note
)
SELECT 1, 'tmall', v.rule_layer, v.rule_name, v.discount_mode, v.discount_value, false, v.m_ratio, v.p_ratio, v.note
FROM (VALUES
  (2::smallint, '天猫店铺满减券 5%', 'store_coupon'::varchar, 0.0500::numeric, 1.0000::numeric, 0.0000::numeric, '第2层店铺券：商家全额让利'),
  (3::smallint, '天猫品类消费券 5%', 'category_coupon'::varchar, 0.0500::numeric, 0.3000::numeric, 0.7000::numeric, '第3层平台/品类消费券：平台承担70%，商家让利30%'),
  (5::smallint, '国家以旧换新补贴与平台红包 5%', 'national_subsidy'::varchar, 0.0500::numeric, 0.0000::numeric, 1.0000::numeric, '第5层封顶国补/平台红包：全额由补贴池承担，不扣减商家结算净额')
) AS v(rule_layer, rule_name, discount_mode, discount_value, m_ratio, p_ratio, note)
WHERE EXISTS (SELECT 1 FROM public.system_platform_configs WHERE platform_code = 'tmall')
  AND NOT EXISTS (
    SELECT 1 FROM public.pricing_rules p
    WHERE p.platform_code = 'tmall' AND p.rule_layer = v.rule_layer
  );

-- ────────────────────────────────────────────────────────────
-- 8. 人员绑定（operator_id）+ RBAC 收敛（审计日志独立模块 + operator 15 模块）+ 4 个零账号角色补齐
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES public.operators(id) ON DELETE SET NULL;

UPDATE public.users u
SET operator_id = (SELECT id FROM public.operators WHERE id = 3 LIMIT 1)
WHERE u.username = 'operator_wang' AND u.operator_id IS NULL;

-- 下线无页面、无接口的死模块 system_inventory；新增独立审计日志模块 audit_logs
DELETE FROM public.role_modules WHERE module_code = 'system_inventory';
DELETE FROM public.system_modules WHERE code = 'system_inventory';

INSERT INTO public.system_modules (code, name, icon, sort_order)
VALUES ('audit_logs', '操作审计日志', 'ScrollText', 14)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.role_modules (role_code, module_code)
VALUES
  ('super_admin', 'audit_logs'),
  ('admin', 'audit_logs')
ON CONFLICT DO NOTHING;

-- 收紧 operator 到核心 15 个日常操盘模块，避免与 ops_director / finance / ad_buyer 越界混同
DELETE FROM public.role_modules WHERE role_code = 'operator';
INSERT INTO public.role_modules (role_code, module_code)
SELECT 'operator', m.code
FROM public.system_modules m
WHERE m.code IN (
  'overview',
  'session',
  'session_products',
  'ops',
  'data',
  'review',
  'review_overview',
  'review_channels',
  'review_anchors',
  'review_funnel',
  'review_closed_loop',
  'fulfillment',
  'after_sales',
  'customer_service',
  'product_center'
)
ON CONFLICT DO NOTHING;

-- 为 4 个零账号角色补充可真实登录验证的账号
INSERT INTO public.users (username, password_hash, real_name, role, user_type, tenant_id, status)
SELECT v.username, '$2b$10$Aj8Gv2CY1TiZDXOjFSAwXOZHnG17yNIURbokNeO.iF/d2TggRPmZ.', v.real_name, v.role, 'agency_staff', 1, 1
FROM (VALUES
  ('director_zhou', '周总监 (运营总监)', 'ops_director'),
  ('staff_lin',     '林运营 (常规运营)', 'ops_staff'),
  ('ctrl_wu',       '吴中控 (现场中控)', 'controller'),
  ('buyer_xu',      '许投手 (付费投放)', 'ad_buyer')
) AS v(username, real_name, role)
WHERE EXISTS (SELECT 1 FROM public.roles r WHERE r.code = v.role)
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.role = v.role);

-- 确保新对象与视图对 leyova_app 可用
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leyova_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO leyova_app;

COMMIT;

