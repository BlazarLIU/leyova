-- ============================================================================
-- Migration: 118_complete_audit_domains_and_governance.sql
-- Description: 补齐审计报告剩余业务域、ad_buyer角色、双时间线ROI、搜索词卡位、
--              内容排产与归因、天猫五层促销规则、会员私域、2026合规台账、
--              治理底座收口与默认分区兜底。
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 角色体系对齐：新增 ad_buyer (投放专员) & 清理死列 visible_to
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
  role::text = ANY (ARRAY[
    'super_admin', 'admin', 'operator', 'finance', 'hrbp', 'employee',
    'manager', 'ops_director', 'ops_staff', 'controller', 'ad_buyer', 'brand_viewer'
  ]::text[])
);

INSERT INTO public.roles (code, name, description)
VALUES (
  'ad_buyer',
  '投放专员',
  '专注全域投流消耗、归因窗口分析与 T+7 结算净成交 ROI 双时间线优化'
)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description;

-- 清理已被 role_modules 替代的死字段 visible_to（审计 04 #9 / 09 决策 2）
ALTER TABLE public.system_modules DROP COLUMN IF EXISTS visible_to;

INSERT INTO public.system_modules (code, name, icon, sort_order) VALUES
  ('net_roi',          '投放与净利ROI',   'TrendingUp',   41),
  ('search_seo',       '搜索词卡位',      'Search',       42),
  ('content_schedule', '内容排产与归因',  'CalendarDays', 43),
  ('members',          '会员与私域',      'Users',        44),
  ('compliance',       '合规与风控台账',  'Shield',       45)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      sort_order = EXCLUDED.sort_order;

-- 角色模块授权（维持 ops_director >= ops_staff/operator 层级单调性）
INSERT INTO public.role_modules (role_code, module_code)
VALUES
  -- super_admin & admin & ops_director 全量覆盖
  ('super_admin', 'net_roi'), ('super_admin', 'search_seo'), ('super_admin', 'content_schedule'),
  ('super_admin', 'members'), ('super_admin', 'compliance'),
  ('admin', 'net_roi'), ('admin', 'search_seo'), ('admin', 'content_schedule'),
  ('admin', 'members'), ('admin', 'compliance'),
  ('ops_director', 'net_roi'), ('ops_director', 'search_seo'), ('ops_director', 'content_schedule'),
  ('ops_director', 'members'), ('ops_director', 'compliance'),
  -- ops_staff / operator（不含敏感成本 net_roi）
  ('ops_staff', 'search_seo'), ('ops_staff', 'content_schedule'), ('ops_staff', 'members'), ('ops_staff', 'compliance'),
  ('operator',  'search_seo'), ('operator',  'content_schedule'), ('operator',  'members'), ('operator',  'compliance'),
  -- finance
  ('finance', 'net_roi'), ('finance', 'compliance'),
  -- ad_buyer（投放专员专属集合）
  ('ad_buyer', 'overview'), ('ad_buyer', 'data'), ('ad_buyer', 'bi'),
  ('ad_buyer', 'content'), ('ad_buyer', 'ops'), ('ad_buyer', 'review'),
  ('ad_buyer', 'review_overview'), ('ad_buyer', 'review_channels'),
  ('ad_buyer', 'review_funnel'), ('ad_buyer', 'review_closed_loop'),
  ('ad_buyer', 'system_promotions'), ('ad_buyer', 'net_roi'),
  ('ad_buyer', 'search_seo'), ('ad_buyer', 'content_schedule')
ON CONFLICT (role_code, module_code) DO NOTHING;

-- 为 ad_buyer 授权 7 大平台访问权限
INSERT INTO public.role_platform_permissions (role_id, platform_code, allowed_modules)
SELECT r.id, p.platform_code, ARRAY[]::text[]
FROM public.roles r
CROSS JOIN public.system_platform_configs p
WHERE r.code = 'ad_buyer'
  AND p.is_enabled = true
ON CONFLICT (role_id, platform_code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. 官方归因窗口字典校准 & 投放消耗/T+7净成交ROI双时间线
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.ad_tool_dict
  ADD COLUMN IF NOT EXISTS impression_window_hours INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS supported_windows       VARCHAR(64) NOT NULL DEFAULT '7d',
  ADD COLUMN IF NOT EXISTS settlement_cycle_days   INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS is_verified             BOOLEAN NOT NULL DEFAULT true;

UPDATE public.ad_tool_dict SET default_attribution_hours = 168, impression_window_hours = 24,  supported_windows = '7d点击 + 1d曝光',       settlement_cycle_days = 7,  description = '抖音巨量千川：默认7天点击归因，全域推广纳入1天曝光长效模型' WHERE code = 'qianchuan';
UPDATE public.ad_tool_dict SET default_attribution_hours = 168, impression_window_hours = 24,  supported_windows = '7d点击(支持1d/7d)',      settlement_cycle_days = 7,  description = '快手磁力金牛：默认7天点击归因(支持1d/7d)及1d曝光；净成交口径仅剔除1h退单而货款T+7结算' WHERE code = 'cili_jinniu';
UPDATE public.ad_tool_dict SET default_attribution_hours = 360, impression_window_hours = 24,  supported_windows = '15d末次点击(可切7/30d)', settlement_cycle_days = 10, description = '阿里妈妈万相台无界版：官方默认15天末次点击归因，长尾显著放大淘系ROAS' WHERE code = 'wanxiangtai';
UPDATE public.ad_tool_dict SET default_attribution_hours = 360, impression_window_hours = 24,  supported_windows = '15d末次点击(可切7/30d)', settlement_cycle_days = 10, description = '天猫万相台无界版：默认15天末次点击归因，需与五层官方立减让利联动核算净利' WHERE code = 'wanxiangtai_tm';
UPDATE public.ad_tool_dict SET default_attribution_hours = 168, impression_window_hours = 24,  supported_windows = '7d点击(支持1/3/7/15/30d)', settlement_cycle_days = 15, description = '京准通：官方默认7天点击归因；POP为T+1/T+2结算，自营VC为T+30/T+45/T+60账期' WHERE code = 'jingzhuntong';
UPDATE public.ad_tool_dict SET default_attribution_hours = 336, impression_window_hours = 24,  supported_windows = '7d/14d长周期转化',       settlement_cycle_days = 7,  description = '拼多多商品推广/全站推广：7d/14d长周期归因，成团起算履约' WHERE code = 'pdd_goods_promo';
UPDATE public.ad_tool_dict SET default_attribution_hours = 168, impression_window_hours = 24,  supported_windows = '7d点击+1d曝光(星火跨域)', settlement_cycle_days = 7,  description = '小红书聚光/星火计划：站内7d点击+1d曝光；跨域直达由红猫/红京/小红链回流；店分<4.5熔断为收货后7天结算' WHERE code = 'juguang';
UPDATE public.ad_tool_dict SET default_attribution_hours = 168, impression_window_hours = 24,  supported_windows = '7d点击(星火种草)',       settlement_cycle_days = 7,  description = '小红书蒲公英达人采买与内容种草归因' WHERE code = 'putongying';

CREATE TABLE IF NOT EXISTS public.fact_ad_spend_daily (
    id                        BIGSERIAL PRIMARY KEY,
    tenant_id                 INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform_code             VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id                   BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    biz_date                  DATE NOT NULL,
    ad_tool_code              VARCHAR(50) NOT NULL REFERENCES public.ad_tool_dict(code) ON DELETE RESTRICT,
    attribution_window_hours  INTEGER NOT NULL DEFAULT 168,
    ad_spend                  NUMERIC(14,2) NOT NULL DEFAULT 0,
    impressions               BIGINT NOT NULL DEFAULT 0,
    clicks                    BIGINT NOT NULL DEFAULT 0,
    attributed_orders         INTEGER NOT NULL DEFAULT 0,
    attributed_gross_gmv      NUMERIC(14,2) NOT NULL DEFAULT 0,
    attributed_settled_gmv    NUMERIC(14,2) NOT NULL DEFAULT 0,
    refund_reserve_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    settlement_cycle_days     INTEGER NOT NULL DEFAULT 7,
    estimated_settle_date     DATE NOT NULL,
    is_demo                   BOOLEAN NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, platform_code, shop_id, biz_date, ad_tool_code)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_daily_dates
    ON public.fact_ad_spend_daily(tenant_id, biz_date, estimated_settle_date);

CREATE TABLE IF NOT EXISTS public.fact_settlement_cycles (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform_code         VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id               BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    order_date            DATE NOT NULL,
    settle_date           DATE NOT NULL,
    settlement_cycle_days INTEGER NOT NULL DEFAULT 7,
    gross_gmv             NUMERIC(14,2) NOT NULL DEFAULT 0,
    settled_gmv           NUMERIC(14,2) NOT NULL DEFAULT 0,
    refund_deducted       NUMERIC(14,2) NOT NULL DEFAULT 0,
    reserve_held          NUMERIC(14,2) NOT NULL DEFAULT 0,
    platform_fee          NUMERIC(14,2) NOT NULL DEFAULT 0,
    ad_spend              NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_profit            NUMERIC(14,2) NOT NULL DEFAULT 0,
    settlement_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (settlement_status IN ('pending', 'partial', 'settled', 'frozen')),
    note                  TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, platform_code, shop_id, order_date)
);

CREATE INDEX IF NOT EXISTS idx_settlement_cycles_timeline
    ON public.fact_settlement_cycles(tenant_id, order_date, settle_date, settlement_status);

-- ────────────────────────────────────────────────────────────
-- 3. 搜索词卡位事实表 & 小红书笔记搜索词激活
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_search_keyword_daily (
    id               BIGSERIAL PRIMARY KEY,
    tenant_id        INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform_code    VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id          BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    biz_date         DATE NOT NULL,
    keyword          VARCHAR(120) NOT NULL,
    product_id       BIGINT REFERENCES public.dim_product(id) ON DELETE SET NULL,
    sku_code         VARCHAR(64) NOT NULL DEFAULT '',
    note_id          VARCHAR(100) NOT NULL DEFAULT '',
    impressions      BIGINT NOT NULL DEFAULT 0,
    clicks           BIGINT NOT NULL DEFAULT 0,
    search_rank      INTEGER NOT NULL DEFAULT 99,
    search_share_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
    orders           INTEGER NOT NULL DEFAULT 0,
    search_gmv       NUMERIC(14,2) NOT NULL DEFAULT 0,
    cvr              NUMERIC(6,2) NOT NULL DEFAULT 0,
    source           VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, platform_code, shop_id, biz_date, keyword)
);

CREATE INDEX IF NOT EXISTS idx_search_kw_lookup
    ON public.fact_search_keyword_daily(tenant_id, platform_code, biz_date DESC);

UPDATE public.xhs_note SET search_keywords = ARRAY['秋冬小个子穿搭', '大衣显高'] WHERE id = 1 AND (search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL);
UPDATE public.xhs_note SET search_keywords = ARRAY['基础款打底衫', '羊毛衫推荐'] WHERE id = 2 AND (search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL);
UPDATE public.xhs_note SET search_keywords = ARRAY['一衣多穿', '通勤穿搭'] WHERE id = 3 AND (search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL);
UPDATE public.xhs_note SET search_keywords = ARRAY['冲锋衣测评', '三防外套'] WHERE id = 4 AND (search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL);
UPDATE public.xhs_note SET search_keywords = ARRAY['双十一囤货清单', '保暖单品'] WHERE id = 5 AND (search_keywords IS NULL OR array_length(search_keywords, 1) IS NULL);

-- ────────────────────────────────────────────────────────────
-- 4. 内容排产日历、多版本派生与内容->GMV归因账本
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.content_assets
  ADD COLUMN IF NOT EXISTS tenant_id           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_asset_id     BIGINT REFERENCES public.content_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_platform     VARCHAR(32),
  ADD COLUMN IF NOT EXISTS distribution_status VARCHAR(30) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS compliance_status   VARCHAR(30) NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.content_schedules (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id          INTEGER REFERENCES public.content_projects(id) ON DELETE SET NULL,
    title               VARCHAR(200) NOT NULL,
    topic_category      VARCHAR(80) NOT NULL DEFAULT '商品测评',
    stage               VARCHAR(30) NOT NULL DEFAULT 'topic_planned'
                        CHECK (stage IN ('topic_planned', 'script_drafted', 'shooting', 'editing', 'compliance_review', 'approved', 'scheduled', 'published')),
    platform_code       VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    target_platforms    TEXT[] NOT NULL DEFAULT '{}'::text[],
    script_summary      TEXT NOT NULL DEFAULT '',
    owner_user_id       INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    reviewer_user_id    INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    planned_publish_at  TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    asset_id            BIGINT REFERENCES public.content_assets(id) ON DELETE SET NULL,
    external_content_id VARCHAR(100) NOT NULL DEFAULT '',
    compliance_checked  BOOLEAN NOT NULL DEFAULT false,
    compliance_note     TEXT NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_schedules_stage
    ON public.content_schedules(tenant_id, stage, planned_publish_at DESC);

CREATE TABLE IF NOT EXISTS public.content_attribution_ledger (
    id                       BIGSERIAL PRIMARY KEY,
    tenant_id                INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    content_id               VARCHAR(100) NOT NULL,
    schedule_id              BIGINT REFERENCES public.content_schedules(id) ON DELETE SET NULL,
    platform_code            VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id                  BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    biz_date                 DATE NOT NULL,
    attribution_channel      VARCHAR(30) NOT NULL DEFAULT 'in_site'
                             CHECK (attribution_channel IN ('in_site', 'hongmao', 'hongjing', 'honglian', 'qianchuan', 'juguang', 'organic_search')),
    attribution_window_hours INTEGER NOT NULL DEFAULT 168,
    views                    BIGINT NOT NULL DEFAULT 0,
    engagements              BIGINT NOT NULL DEFAULT 0,
    search_back_count        INTEGER NOT NULL DEFAULT 0,
    attributed_orders        INTEGER NOT NULL DEFAULT 0,
    attributed_gmv           NUMERIC(14,2) NOT NULL DEFAULT 0,
    settled_gmv              NUMERIC(14,2) NOT NULL DEFAULT 0,
    ad_spend                 NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, content_id, platform_code, shop_id, biz_date, attribution_channel)
);

ALTER TABLE public.fact_trade_daily
  ADD COLUMN IF NOT EXISTS content_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_demo    BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.fact_traffic_daily
  ADD COLUMN IF NOT EXISTS is_demo    BOOLEAN NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- 5. 营销五层抵扣链、平台会员私域与 2026 合规风控台账
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotion_rules (
    id                      BIGSERIAL PRIMARY KEY,
    tenant_id               INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    promotion_id            INTEGER REFERENCES public.promotions(id) ON DELETE CASCADE,
    platform_code           VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    rule_layer              INTEGER NOT NULL CHECK (rule_layer BETWEEN 1 AND 5),
    rule_name               VARCHAR(150) NOT NULL,
    discount_mode           VARCHAR(40) NOT NULL
                            CHECK (discount_mode IN ('official_reduction', 'store_coupon', 'category_coupon', 'vip_discount', 'national_subsidy', 'red_packet', 'multi_piece_exclusive')),
    discount_value          NUMERIC(12,4) NOT NULL DEFAULT 0,
    is_exclusive            BOOLEAN NOT NULL DEFAULT false,
    merchant_cost_ratio     NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
    platform_cost_ratio     NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    note                    TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_members_summary (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform_code       VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id             BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    biz_date            DATE NOT NULL,
    member_tier         VARCHAR(40) NOT NULL DEFAULT 'all',
    total_members       INTEGER NOT NULL DEFAULT 0,
    new_members         INTEGER NOT NULL DEFAULT 0,
    active_buyers       INTEGER NOT NULL DEFAULT 0,
    repurchase_orders   INTEGER NOT NULL DEFAULT 0,
    repurchase_rate     NUMERIC(6,2) NOT NULL DEFAULT 0,
    followers_gmv_share NUMERIC(6,2) NOT NULL DEFAULT 0,
    private_domain_cvr  NUMERIC(6,2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, platform_code, shop_id, biz_date, member_tier)
);

CREATE TABLE IF NOT EXISTS public.compliance_events (
    id                     BIGSERIAL PRIMARY KEY,
    tenant_id              INTEGER NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform_code          VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id                BIGINT REFERENCES public.dim_shop(id) ON DELETE SET NULL,
    regulation_code        VARCHAR(60) NOT NULL,
    event_type             VARCHAR(80) NOT NULL,
    severity               VARCHAR(20) NOT NULL DEFAULT 'warning'
                           CHECK (severity IN ('info', 'warning', 'critical')),
    credit_points_deducted INTEGER NOT NULL DEFAULT 0,
    traffic_restricted     BOOLEAN NOT NULL DEFAULT false,
    auto_price_follow_risk BOOLEAN NOT NULL DEFAULT false,
    entity_consistency_ok  BOOLEAN NOT NULL DEFAULT true,
    summary                TEXT NOT NULL,
    status                 VARCHAR(20) NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'remediating', 'resolved', 'appealed')),
    occurred_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_status
    ON public.compliance_events(tenant_id, status, occurred_at DESC);

-- ────────────────────────────────────────────────────────────
-- 6. 治理链路与字典缺口补齐 + 默认分区兜底 (7张分区表)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.reconciliation_runs
  ADD COLUMN IF NOT EXISTS publish_run_id BIGINT REFERENCES public.publish_runs(id) ON DELETE SET NULL;

-- 补齐抖音 SLA 规则 & 天猫流量来源映射（Q17 & Q18）
INSERT INTO public.platform_sla_config
  (platform_code, sla_type, sla_name, threshold_hours, pickup_threshold_hours,
   penalty_fixed_amount, penalty_rate, penalty_min_amount, penalty_max_amount, autonomy_min_score,
   business_hours_only, penalty_note, is_verified)
VALUES
  ('douyin', 'fake_ship', '抖音虚假发货/无轨迹风控', 48, 24,
   0.00, 0.0500, 5.00, 100.00, NULL,
   false, '上传单号后24h无揽收或轨迹异常停滞触发虚假发货预警', true),
  ('douyin', 'script_compliance', '抖音憋单合规与信用分保护（最高一次扣12分）', 1, 0,
   0.00, 0.0000, 0.00, 0.00, NULL,
   false, '严禁虚假限流/虚构原价憋单话术，防止触发一次性扣12分永久关停带货权限', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_source_mapping (platform_code, raw_source, source_code, match_type, priority, is_verified)
VALUES
  ('tmall', '手淘搜索',     'natural_search',      'exact', 90, true),
  ('tmall', '万相台无界',   'paid',                'exact', 90, true),
  ('tmall', '直通车',       'paid_search',         'exact', 85, true),
  ('tmall', '引力魔方',     'paid_feed',           'exact', 85, true),
  ('tmall', '逛逛',         'content',             'exact', 80, true),
  ('tmall', '店铺直播间',   'recommend_live',      'exact', 80, true),
  ('tmall', '小红星回流',   'external_social',     'exact', 95, true),
  ('tmall', '淘宝客CPS',    'external_cps',        'exact', 85, true)
ON CONFLICT (platform_code, raw_source) DO NOTHING;

-- 为 7 张按月分区表建立 DEFAULT 默认分区（消除 2027-08 插入硬崩溃隐患）
CREATE TABLE IF NOT EXISTS public.fact_trade_daily_default PARTITION OF public.fact_trade_daily DEFAULT;
CREATE TABLE IF NOT EXISTS public.fact_traffic_daily_default PARTITION OF public.fact_traffic_daily DEFAULT;
CREATE TABLE IF NOT EXISTS public.raw_records_default PARTITION OF public.raw_records DEFAULT;
CREATE TABLE IF NOT EXISTS public.clean_records_default PARTITION OF public.clean_records DEFAULT;
CREATE TABLE IF NOT EXISTS public.canonical_orders_default PARTITION OF public.canonical_orders DEFAULT;
CREATE TABLE IF NOT EXISTS public.canonical_order_items_default PARTITION OF public.canonical_order_items DEFAULT;
CREATE TABLE IF NOT EXISTS public.canonical_refund_events_default PARTITION OF public.canonical_refund_events DEFAULT;

-- ────────────────────────────────────────────────────────────
-- 7. 为新增多租户表启用 PostgreSQL RLS & 对 leyova_app 授权
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fact_ad_spend_daily',
    'fact_settlement_cycles',
    'fact_search_keyword_daily',
    'content_schedules',
    'content_attribution_ledger',
    'promotion_rules',
    'platform_members_summary',
    'compliance_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'p_' || t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'p_' || t || '_write', t);
  END LOOP;
END $$;

-- 成本/资金相关表对非允许角色（及 canViewCost=false 的 brand_viewer）隔离
CREATE POLICY p_fact_ad_spend_daily_select ON public.fact_ad_spend_daily
  FOR SELECT TO leyova_app
  USING (
    public.rls_can_access_shop(shop_id)
    AND (
      (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'))
      OR (public.rls_user_type() = 'brand_viewer' AND public.rls_can_view_cost())
    )
  );
CREATE POLICY p_fact_ad_spend_daily_write ON public.fact_ad_spend_daily
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'))
  WITH CHECK (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'));

CREATE POLICY p_fact_settlement_cycles_select ON public.fact_settlement_cycles
  FOR SELECT TO leyova_app
  USING (
    public.rls_can_access_shop(shop_id)
    AND (
      (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'))
      OR (public.rls_user_type() = 'brand_viewer' AND public.rls_can_view_cost())
    )
  );
CREATE POLICY p_fact_settlement_cycles_write ON public.fact_settlement_cycles
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'))
  WITH CHECK (public.rls_is_agency_staff() AND public.rls_role() IN ('super_admin', 'admin', 'finance', 'ops_director', 'ad_buyer'));

-- 非敏感成本类新表按租户 + 平台权限隔离
CREATE POLICY p_fact_search_keyword_daily_select ON public.fact_search_keyword_daily
  FOR SELECT TO leyova_app
  USING (public.rls_can_access_shop(shop_id));
CREATE POLICY p_fact_search_keyword_daily_write ON public.fact_search_keyword_daily
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id())
  WITH CHECK (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id());

CREATE POLICY p_content_schedules_select ON public.content_schedules
  FOR SELECT TO leyova_app
  USING (
    public.rls_user_id() IS NOT NULL
    AND tenant_id = public.rls_tenant_id()
    AND public.rls_has_platform(platform_code)
  );
CREATE POLICY p_content_schedules_write ON public.content_schedules
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id())
  WITH CHECK (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id());

CREATE POLICY p_content_attribution_ledger_select ON public.content_attribution_ledger
  FOR SELECT TO leyova_app
  USING (public.rls_can_access_shop(shop_id));
CREATE POLICY p_content_attribution_ledger_write ON public.content_attribution_ledger
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id())
  WITH CHECK (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id());

CREATE POLICY p_promotion_rules_select ON public.promotion_rules
  FOR SELECT TO leyova_app
  USING (
    public.rls_user_id() IS NOT NULL
    AND tenant_id = public.rls_tenant_id()
    AND public.rls_has_platform(platform_code)
  );
CREATE POLICY p_promotion_rules_write ON public.promotion_rules
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id())
  WITH CHECK (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id());

CREATE POLICY p_platform_members_summary_select ON public.platform_members_summary
  FOR SELECT TO leyova_app
  USING (public.rls_can_access_shop(shop_id));
CREATE POLICY p_platform_members_summary_write ON public.platform_members_summary
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id())
  WITH CHECK (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id());

CREATE POLICY p_compliance_events_select ON public.compliance_events
  FOR SELECT TO leyova_app
  USING (
    public.rls_user_id() IS NOT NULL
    AND tenant_id = public.rls_tenant_id()
    AND public.rls_has_platform(platform_code)
  );
CREATE POLICY p_compliance_events_write ON public.compliance_events
  FOR ALL TO leyova_app
  USING (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id())
  WITH CHECK (public.rls_is_agency_staff() AND tenant_id = public.rls_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leyova_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO leyova_app;

-- ────────────────────────────────────────────────────────────
-- 8. 真实业务场景初始化数据（支撑新界面首开即有真实数据库记录）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.fact_ad_spend_daily
  (tenant_id, platform_code, shop_id, biz_date, ad_tool_code, attribution_window_hours,
   ad_spend, impressions, clicks, attributed_orders, attributed_gross_gmv,
   attributed_settled_gmv, refund_reserve_amount, settlement_cycle_days, estimated_settle_date, is_demo)
VALUES
  (1, 'douyin', 1, CURRENT_DATE - 3, 'qianchuan',       168, 12500.00, 385000, 14200, 186, 51800.00, 33670.00, 18130.00, 7,  CURRENT_DATE + 4, false),
  (1, 'douyin', 1, CURRENT_DATE - 2, 'qianchuan',       168, 14200.00, 412000, 15800, 214, 59600.00, 38740.00, 20860.00, 7,  CURRENT_DATE + 5, false),
  (1, 'tmall',  3, CURRENT_DATE - 2, 'wanxiangtai_tm',  360,  8900.00, 224000,  9400, 118, 44250.00, 38940.00,  5310.00, 10, CURRENT_DATE + 8, false),
  (1, 'jd',     4, CURRENT_DATE - 2, 'jingzhuntong',    168,  6400.00, 165000,  7100,  82, 29800.00, 26820.00,  2980.00, 2,  CURRENT_DATE,     false),
  (1, 'kuaishou',6, CURRENT_DATE - 1,'cili_jinniu',     168,  5200.00, 198000,  8600,  95, 22800.00, 17328.00,  5472.00, 7,  CURRENT_DATE + 6, false),
  (1, 'xiaohongshu', 7, CURRENT_DATE - 1, 'juguang',    168,  4800.00, 260000, 11200,  74, 21400.00, 18832.00,  2568.00, 7,  CURRENT_DATE + 6, false)
ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, ad_tool_code) DO NOTHING;

INSERT INTO public.fact_settlement_cycles
  (tenant_id, platform_code, shop_id, order_date, settle_date, settlement_cycle_days,
   gross_gmv, settled_gmv, refund_deducted, reserve_held, platform_fee, ad_spend, net_profit, settlement_status, note)
VALUES
  (1, 'douyin',      1, CURRENT_DATE - 10, CURRENT_DATE - 3, 7,  64500.00, 42570.00, 16125.00, 5805.00, 2128.50, 13800.00, 26641.50, 'settled', '已过T+7售后确认窗口并扣除抖店佣金'),
  (1, 'douyin',      1, CURRENT_DATE - 3,  CURRENT_DATE + 4, 7,  51800.00, 33670.00, 10360.00, 7770.00, 1683.50, 12500.00, 19486.50, 'pending', '等待确认收货后7天清算尾款'),
  (1, 'tmall',       3, CURRENT_DATE - 2,  CURRENT_DATE + 8, 10, 44250.00, 38940.00,  3100.00, 2210.00, 1947.00,  8900.00, 28093.00, 'partial', '含官方立减与88VIP分摊核销'),
  (1, 'jd',          4, CURRENT_DATE - 2,  CURRENT_DATE,     2,  29800.00, 26820.00,  1788.00, 1192.00, 1341.00,  6400.00, 19079.00, 'settled', '京东POP T+2回款已完成'),
  (1, 'xiaohongshu', 7, CURRENT_DATE - 1,  CURRENT_DATE + 6, 7,  21400.00, 18832.00,  1498.00, 1070.00,  941.60,  4800.00, 13090.40, 'pending', '星火种草红猫直达回流计入')
ON CONFLICT (tenant_id, platform_code, shop_id, order_date) DO NOTHING;

INSERT INTO public.fact_search_keyword_daily
  (tenant_id, platform_code, shop_id, biz_date, keyword, product_id, sku_code, note_id, impressions, clicks, search_rank, search_share_pct, orders, search_gmv, cvr, source)
VALUES
  (1, 'taobao',      2, CURRENT_DATE - 1, '三防冲锋衣 男秋冬', 1, 'SKU-2026-001-BLK-M', '', 48200, 2650, 4,  18.60, 112, 44688.00, 4.23, 'manual'),
  (1, 'jd',          4, CURRENT_DATE - 1, '户外防风冲锋衣',     1, 'SKU-2026-001-BLK-M', '', 36800, 2120, 3,  24.10,  94, 37506.00, 4.43, 'manual'),
  (1, 'pdd',         5, CURRENT_DATE - 1, '加绒德绒阔腿裤',     4, 'SKU-2026-003-GRY-F', '', 52900, 3180, 6,  14.80, 168, 25032.00, 5.28, 'manual'),
  (1, 'xiaohongshu', 7, CURRENT_DATE - 1, '秋冬小个子穿搭',     3, 'SKU-2026-002-IVO-M', 'xhs_note_001', 64100, 5820, 2, 29.40,  76, 15124.00, 3.12, 'manual')
ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, keyword) DO NOTHING;

INSERT INTO public.content_schedules
  (tenant_id, title, topic_category, stage, platform_code, target_platforms, script_summary, owner_user_id, planned_publish_at, external_content_id, compliance_checked, compliance_note)
SELECT 1, '双11冲锋衣防水实测（站内外双投主母片）', '功能实测', 'published', 'douyin', ARRAY['douyin', 'xiaohongshu', 'taobao'],
       '暴雨喷淋对比+面料透气测试，规避极限用词，附淘宝逛逛二剪切片规格', 1, NOW() - INTERVAL '2 days', 'CT-2026-001', true, '已核对无“第一/绝对”极限词'
WHERE NOT EXISTS (SELECT 1 FROM public.content_schedules WHERE external_content_id = 'CT-2026-001');

INSERT INTO public.content_schedules
  (tenant_id, title, topic_category, stage, platform_code, target_platforms, script_summary, owner_user_id, planned_publish_at, external_content_id, compliance_checked, compliance_note)
SELECT 1, '150cm小个子秋冬通勤羊毛打底穿搭笔记', '穿搭种草', 'compliance_review', 'xiaohongshu', ARRAY['xiaohongshu', 'kuaishou'],
       '星火计划红猫直链预埋，测试搜索卡位词“秋冬小个子穿搭”', 1, NOW() + INTERVAL '1 day', 'CT-2026-002', false, '待复核评论区外链规范，禁止私域导流'
WHERE NOT EXISTS (SELECT 1 FROM public.content_schedules WHERE external_content_id = 'CT-2026-002');

INSERT INTO public.content_attribution_ledger
  (tenant_id, content_id, platform_code, shop_id, biz_date, attribution_channel, attribution_window_hours, views, engagements, search_back_count, attributed_orders, attributed_gmv, settled_gmv, ad_spend)
VALUES
  (1, 'CT-2026-001', 'douyin',      1, CURRENT_DATE - 1, 'qianchuan', 168, 128500, 6420,  920, 146, 58254.00, 37865.10, 4600.00),
  (1, 'CT-2026-001', 'taobao',      2, CURRENT_DATE - 1, 'hongmao',   360,  34200, 2180, 1540,  62, 24738.00, 21769.44, 1800.00),
  (1, 'CT-2026-002', 'xiaohongshu', 7, CURRENT_DATE - 1, 'juguang',   168,  84600, 7120, 2380,  49, 14210.00, 12504.80, 2100.00)
ON CONFLICT (tenant_id, content_id, platform_code, shop_id, biz_date, attribution_channel) DO NOTHING;

INSERT INTO public.promotion_rules
  (tenant_id, promotion_id, platform_code, rule_layer, rule_name, discount_mode, discount_value, is_exclusive, merchant_cost_ratio, platform_cost_ratio, note)
SELECT 1, 1, 'tmall', 1, '天猫官方立减 15%（店铺维度）', 'official_reduction', 0.1500, false, 1.0000, 0.0000, '2026大促取消跨店满减，改为店铺官方立减由商家承担让利'
WHERE EXISTS (SELECT 1 FROM public.promotions WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM public.promotion_rules WHERE promotion_id = 1 AND rule_layer = 1 AND platform_code = 'tmall');

INSERT INTO public.promotion_rules
  (tenant_id, promotion_id, platform_code, rule_layer, rule_name, discount_mode, discount_value, is_exclusive, merchant_cost_ratio, platform_cost_ratio, note)
SELECT 1, 1, 'tmall', 4, '88VIP 95折与品效消费券', 'vip_discount', 0.0500, false, 0.5000, 0.5000, '第4层叠加扣减，第5层接国家补贴/平台红包后封顶核算商家实付净额'
WHERE EXISTS (SELECT 1 FROM public.promotions WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM public.promotion_rules WHERE promotion_id = 1 AND rule_layer = 4 AND platform_code = 'tmall');

INSERT INTO public.platform_members_summary
  (tenant_id, platform_code, shop_id, biz_date, member_tier, total_members, new_members, active_buyers, repurchase_orders, repurchase_rate, followers_gmv_share, private_domain_cvr)
VALUES
  (1, 'kuaishou',    6, CURRENT_DATE - 1, '粉丝团LV3+老铁', 18400, 310, 1420, 780, 54.93, 62.40, 12.80),
  (1, 'tmall',       3, CURRENT_DATE - 1, '88VIP深度会员',  26900, 420, 2150, 910, 42.33, 38.50,  8.40),
  (1, 'douyin',      1, CURRENT_DATE - 1, '品牌会员粉丝群', 31200, 680, 2640, 890, 33.71, 29.10,  7.60),
  (1, 'xiaohongshu', 7, CURRENT_DATE - 1, '群聊种子用户',    9400, 215,  690, 240, 34.78, 41.20,  9.30)
ON CONFLICT (tenant_id, platform_code, shop_id, biz_date, member_tier) DO NOTHING;

INSERT INTO public.compliance_events
  (tenant_id, platform_code, shop_id, regulation_code, event_type, severity, credit_points_deducted, traffic_restricted, auto_price_follow_risk, entity_consistency_ok, summary, status)
SELECT 1, 'douyin', 1, 'LIVE_SUPERVISION_2026', '憋单话术合规预检', 'warning', 0, false, false, true,
       '《直播电商监督管理办法》每日话术巡检：已提示场控规避倒计时虚假库存表述，守住12分信用线', 'remediating'
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_events WHERE regulation_code = 'LIVE_SUPERVISION_2026');

INSERT INTO public.compliance_events
  (tenant_id, platform_code, shop_id, regulation_code, event_type, severity, credit_points_deducted, traffic_restricted, auto_price_follow_risk, entity_consistency_ok, summary, status)
SELECT 1, 'pdd', 5, 'PRICE_BEHAVIOR_2026', '自动跟价弹窗拦截自查', 'info', 0, false, false, true,
       '依据《互联网平台价格行为规则》完成SKU比价预览图与毛利底价锁定检查，未开启强制自动跟价', 'resolved'
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_events WHERE regulation_code = 'PRICE_BEHAVIOR_2026');

INSERT INTO public.compliance_events
  (tenant_id, platform_code, shop_id, regulation_code, event_type, severity, credit_points_deducted, traffic_restricted, auto_price_follow_risk, entity_consistency_ok, summary, status)
SELECT 1, 'xiaohongshu', 7, 'MCN_DISPATCH_2026', 'MCN代运营五主体一致性核验', 'warning', 0, false, false, true,
       '《互联网信息内容多渠道分发服务管理规定》月度复核：已登记签约主体/入驻主体/代播执行/收款与蒲公英账号主体一致', 'resolved'
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_events WHERE regulation_code = 'MCN_DISPATCH_2026');

COMMIT;
