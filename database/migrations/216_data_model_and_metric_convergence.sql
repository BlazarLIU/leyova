-- 216_data_model_and_metric_convergence.sql
-- 1) C5 商品成本版本表 (dim_product_cost_versions: cost_version, effective_from)
-- 2) C8 订单事实增加场次归因 (canonical_orders: room_id, live_session_id)
-- 3) C3 结算周期扣减 COGS (fact_settlement_cycles: cogs_amount)
-- 4) 决策复核与指标快照表 (decision_reviews, decision_metric_snapshots)
-- 5) 受控合规脚本审计记录表 (compliance_script_check_logs)
-- 6) Decision Memo 补齐 8 段结构 (execution_owners, review_learning) 与 A-D 归因等级
-- 7) C4 统一场次全口径成本视图升级 (v_session_cost: 真实场次投流 + GMV权重分摊 + COGS)

BEGIN;

-- 1. C5 商品成本版本表
CREATE TABLE IF NOT EXISTS public.dim_product_cost_versions (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id          bigint NOT NULL REFERENCES public.dim_product(id) ON DELETE CASCADE,
  cost_version        varchar(32) NOT NULL,
  unit_cost           numeric(12, 4) NOT NULL CHECK (unit_cost >= 0),
  effective_from      timestamptz NOT NULL,
  effective_to        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_cost_version UNIQUE (tenant_id, product_id, cost_version)
);

CREATE INDEX IF NOT EXISTS idx_prod_cost_eff ON public.dim_product_cost_versions(tenant_id, product_id, effective_from);

ALTER TABLE public.dim_product_cost_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dim_product_cost_versions_tenant_isolation ON public.dim_product_cost_versions;
CREATE POLICY dim_product_cost_versions_tenant_isolation ON public.dim_product_cost_versions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 2. C8 订单事实增加场次归因
ALTER TABLE public.canonical_orders
  ADD COLUMN IF NOT EXISTS room_id bigint,
  ADD COLUMN IF NOT EXISTS live_session_id bigint;

-- 3. C3 结算周期扣减 COGS
ALTER TABLE public.fact_settlement_cycles
  ADD COLUMN IF NOT EXISTS cogs_amount numeric(18, 2) DEFAULT 0.00;

-- 4. 决策复核记录表 (decision_reviews)
CREATE TABLE IF NOT EXISTS public.decision_reviews (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id             bigint NOT NULL REFERENCES public.decision_cases(id) ON DELETE CASCADE,
  review_date         date NOT NULL DEFAULT CURRENT_DATE,
  planned_outcome     jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_outcome      jsonb NOT NULL DEFAULT '{}'::jsonb,
  variance_pct        numeric(8, 2) DEFAULT 0.00,
  learnings           text NOT NULL DEFAULT '',
  reviewer_id         integer REFERENCES public.users(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PENDING')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_reviews_tenant_case ON public.decision_reviews(tenant_id, case_id);

ALTER TABLE public.decision_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_reviews_tenant_isolation ON public.decision_reviews;
CREATE POLICY decision_reviews_tenant_isolation ON public.decision_reviews
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 4.2 决策指标快照表 (decision_metric_snapshots)
CREATE TABLE IF NOT EXISTS public.decision_metric_snapshots (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id             bigint NOT NULL REFERENCES public.decision_cases(id) ON DELETE CASCADE,
  snapshot_stage      varchar(32) NOT NULL CHECK (snapshot_stage IN ('BASELINE', 'EXECUTION', 'REVIEW')),
  metric_code         varchar(64) NOT NULL,
  metric_value        numeric(18, 4) NOT NULL,
  recorded_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_snapshots_tenant_case ON public.decision_metric_snapshots(tenant_id, case_id);

ALTER TABLE public.decision_metric_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_metric_snapshots_tenant_isolation ON public.decision_metric_snapshots;
CREATE POLICY decision_metric_snapshots_tenant_isolation ON public.decision_metric_snapshots
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 5. 受控合规脚本审计记录表 (compliance_script_check_logs)
CREATE TABLE IF NOT EXISTS public.compliance_script_check_logs (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  script_text         text NOT NULL,
  risk_level          varchar(32) NOT NULL,
  hit_count           integer NOT NULL DEFAULT 0,
  hit_details         jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_by          integer REFERENCES public.users(id) ON DELETE SET NULL,
  checked_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_script_logs_tenant ON public.compliance_script_check_logs(tenant_id, checked_at);

ALTER TABLE public.compliance_script_check_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_script_check_logs_tenant_isolation ON public.compliance_script_check_logs;
CREATE POLICY compliance_script_check_logs_tenant_isolation ON public.compliance_script_check_logs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 6. Decision Memo 8 段结构扩展与归因等级 A-D 支持
ALTER TABLE public.decision_memo_versions
  ADD COLUMN IF NOT EXISTS execution_owners jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_learning jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.decision_cases
  DROP CONSTRAINT IF EXISTS decision_cases_attribution_grade_check;
ALTER TABLE public.decision_cases
  ADD CONSTRAINT decision_cases_attribution_grade_check
  CHECK (attribution_grade IN ('GRADE_A', 'GRADE_B', 'GRADE_C', 'GRADE_D', 'OBSERVED', 'ADJUSTED', 'EXPERIMENTAL'));

-- 7. C4 统一场次全口径成本视图升级
DROP VIEW IF EXISTS public.v_session_cost;

CREATE VIEW public.v_session_cost AS
WITH sess AS (
  SELECT s.id                          AS session_id,
         s.room_id,
         r.shop_id,
         r.platform_code,
         s.date                        AS biz_date,
         COALESCE(s.gmv, 0)            AS gmv,
         COALESCE(s.return_amount, 0)  AS return_amount,
         COALESCE(s.ad_cost, 0)        AS session_ad_cost
    FROM public.live_sessions s
    JOIN public.live_rooms r ON r.id = s.room_id
),
-- 当天该直播间总 GMV 与总场次（用于权重分摊公共费用）
day_room_stats AS (
  SELECT s.room_id,
         s.date                        AS biz_date,
         COUNT(*)::numeric             AS session_cnt,
         COALESCE(SUM(s.gmv), 0)       AS day_total_gmv
    FROM public.live_sessions s
   GROUP BY s.room_id, s.date
),
-- 平台费（按 shop + 日期）
fee AS (
  SELECT c.shop_id, c.order_date AS biz_date,
         SUM(c.platform_fee)  AS platform_fee,
         SUM(c.ad_spend)      AS settle_ad_spend,
         SUM(c.reserve_held)  AS reserve_held
    FROM public.fact_settlement_cycles c
   GROUP BY c.shop_id, c.order_date
),
-- 投流总池：按 shop + 日期
ad_pool AS (
  SELECT a.shop_id, a.biz_date,
         SUM(a.ad_spend) AS day_ad_spend
    FROM public.fact_ad_spend_daily a
   GROUP BY a.shop_id, a.biz_date
),
-- 达人佣金与坑位费：按 shop + 发布日期
ko AS (
  SELECT k.shop_id, k.publish_date AS biz_date,
         SUM(k.pit_fee)           AS pit_fee,
         SUM(k.commission_amount) AS commission_amount
    FROM public.fact_kol_cooperation k
   GROUP BY k.shop_id, k.publish_date
),
-- 场次商品销售成本 (COGS)
cogs AS (
  SELECT sp.session_id,
         SUM(sp.sold_count * COALESCE(cv.unit_cost, p.unit_cost, 0)) AS session_cogs
    FROM public.session_plan_products sp
    LEFT JOIN public.dim_product p ON p.id::text = sp.product_id OR p.sku_code = sp.product_code
    LEFT JOIN public.dim_product_cost_versions cv ON cv.product_id = p.id
          AND sp.business_date >= cv.effective_from::date
          AND (cv.effective_to IS NULL OR sp.business_date <= cv.effective_to::date)
   WHERE sp.session_id IS NOT NULL
   GROUP BY sp.session_id
)
SELECT sess.session_id,
       sess.room_id,
       sess.shop_id,
       sess.platform_code,
       sess.biz_date,
       sess.gmv,
       sess.return_amount,
       -- 净收入
       (sess.gmv - sess.return_amount) AS net_revenue,
       -- 商品成本 COGS
       ROUND(COALESCE(cogs.session_cogs, 0), 2) AS cogs_alloc,
       -- 平台费分摊（按 GMV 权重优先，若无 GMV 则按场次数平摊）
       ROUND(
         COALESCE(fee.platform_fee, 0) * (
           CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
         ), 2
       ) AS platform_fee_alloc,
       -- 投流成本分摊：若场次已直接填报 ad_cost，则直接使用场次归因；否则按 GMV 权重分摊店铺日投流
       ROUND(
         CASE WHEN sess.session_ad_cost > 0 THEN sess.session_ad_cost
              ELSE COALESCE(ad_pool.day_ad_spend, 0) * (
                CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                     ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
              )
         END, 2
       ) AS ad_spend_alloc,
       -- 达人坑位与佣金分摊
       ROUND(
         COALESCE(ko.pit_fee, 0) * (
           CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
         ), 2
       ) AS kol_pit_fee_alloc,
       ROUND(
         COALESCE(ko.commission_amount, 0) * (
           CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
         ), 2
       ) AS kol_commission_alloc,
       -- 全口径总成本（COGS + 平台费 + 投流 + 达人）
       ROUND(
         COALESCE(cogs.session_cogs, 0)
         + COALESCE(fee.platform_fee, 0) * (
             CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                  ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
           )
         + (
             CASE WHEN sess.session_ad_cost > 0 THEN sess.session_ad_cost
                  ELSE COALESCE(ad_pool.day_ad_spend, 0) * (
                    CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                         ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
                  )
             END
           )
         + (COALESCE(ko.pit_fee, 0) + COALESCE(ko.commission_amount, 0)) * (
             CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                  ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
           )
       , 2) AS total_cost_alloc,
       -- 单场真实净利润（净收入 - 全口径总成本）
       ROUND(
         (sess.gmv - sess.return_amount) - (
           COALESCE(cogs.session_cogs, 0)
           + COALESCE(fee.platform_fee, 0) * (
               CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                    ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
             )
           + (
               CASE WHEN sess.session_ad_cost > 0 THEN sess.session_ad_cost
                    ELSE COALESCE(ad_pool.day_ad_spend, 0) * (
                      CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                           ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
                    )
               END
             )
           + (COALESCE(ko.pit_fee, 0) + COALESCE(ko.commission_amount, 0)) * (
               CASE WHEN dr.day_total_gmv > 0 THEN sess.gmv / dr.day_total_gmv
                    ELSE 1.0 / GREATEST(dr.session_cnt, 1) END
             )
         )
       , 2) AS net_profit_alloc
  FROM sess
  JOIN day_room_stats dr ON dr.room_id = sess.room_id AND dr.biz_date = sess.biz_date
  LEFT JOIN fee ON fee.shop_id = sess.shop_id AND fee.biz_date = sess.biz_date
  LEFT JOIN ad_pool ON ad_pool.shop_id = sess.shop_id AND ad_pool.biz_date = sess.biz_date
  LEFT JOIN ko ON ko.shop_id = sess.shop_id AND ko.biz_date = sess.biz_date
  LEFT JOIN cogs ON cogs.session_id = sess.session_id;

COMMIT;
