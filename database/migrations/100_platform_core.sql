-- ============================================================================
-- Migration: 100_platform_core.sql
-- Description: Multi-platform core foundation:
--   1. Schema migrations registry
--   2. Global platform configurations with admin toggles (7 platforms)
--   3. 2D Role/User Platform & Module permissions matrix
--   4. Universal dimension tables (dim_shop, dim_channel, metric_definition)
--   5. Entity bridge (live_rooms.shop_id, platform_code additions)
--   6. Declarative range-partitioned fact tables (trade, traffic, product, ad, content)
--   7. Pre-aggregated rollup tables (agg_shop_daily, agg_platform_monthly)
-- ============================================================================

-- 1. Schema Migrations Registry
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version varchar(50) PRIMARY KEY,
    name varchar(255) NOT NULL,
    applied_at timestamptz DEFAULT now()
);

-- 2. System Platform Configs (7 Platforms across 6 ecosystems)
CREATE TABLE IF NOT EXISTS public.system_platform_configs (
    platform_code varchar(32) PRIMARY KEY,
    platform_name varchar(50) NOT NULL,
    category varchar(20) NOT NULL, -- 'live', 'shelf', 'content'
    is_enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    icon varchar(50) DEFAULT '',
    api_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

INSERT INTO public.system_platform_configs (platform_code, platform_name, category, is_enabled, sort_order)
VALUES 
    ('douyin', '抖音电商', 'live', true, 1),
    ('kuaishou', '快手电商', 'live', true, 2),
    ('taobao', '淘宝集市', 'shelf', true, 3),
    ('tmall', '天猫商城', 'shelf', true, 4),
    ('jd', '京东', 'shelf', true, 5),
    ('pdd', '拼多多', 'shelf', true, 6),
    ('xiaohongshu', '小红书电商', 'content', true, 7)
ON CONFLICT (platform_code) DO NOTHING;

-- 3. Two-Dimensional Permissions Matrix
CREATE TABLE IF NOT EXISTS public.role_platform_permissions (
    id serial PRIMARY KEY,
    role_id integer NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    allowed_modules text[] DEFAULT '{}'::text[],
    created_at timestamptz DEFAULT now(),
    UNIQUE(role_id, platform_code)
);

CREATE TABLE IF NOT EXISTS public.user_platform_permissions (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_scope bigint[] DEFAULT '{}'::bigint[],
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, platform_code)
);

-- Grant admin and super_admin all platforms by default
INSERT INTO public.role_platform_permissions (role_id, platform_code, allowed_modules)
SELECT r.id, p.platform_code, '{}'::text[]
FROM public.roles r
CROSS JOIN public.system_platform_configs p
WHERE r.code IN ('admin', 'super_admin')
ON CONFLICT (role_id, platform_code) DO NOTHING;

-- 4. Universal Dimension Tables
CREATE TABLE IF NOT EXISTS public.dim_shop (
    id bigserial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_name varchar(100) NOT NULL,
    external_shop_id varchar(100),
    status varchar(20) DEFAULT 'active' NOT NULL,
    auth_status varchar(20) DEFAULT 'manual_only' NOT NULL, -- 'authorized', 'unauthorized', 'manual_only'
    auth_token_info jsonb DEFAULT '{}'::jsonb,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dim_channel (
    id serial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    channel_code varchar(50) NOT NULL,
    channel_name varchar(100) NOT NULL,
    channel_type varchar(30) DEFAULT 'general',
    created_at timestamptz DEFAULT now(),
    UNIQUE(platform_code, channel_code)
);

CREATE TABLE IF NOT EXISTS public.metric_definition (
    id serial PRIMARY KEY,
    metric_code varchar(50) UNIQUE NOT NULL,
    name varchar(100) NOT NULL,
    unit varchar(20) DEFAULT '',
    category varchar(30) DEFAULT 'trade',
    formula text,
    description text,
    supported_platforms text[] DEFAULT '{}'::text[],
    is_additive boolean DEFAULT true NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

INSERT INTO public.metric_definition (metric_code, name, unit, category, formula, description, supported_platforms, is_additive)
VALUES
    ('gmv', '成交总额 (GMV)', '元', 'trade', 'sum(gmv)', '平台下单成交总金额（包含未支付或已退款）', '{}', true),
    ('pay_amount', '实际支付金额', '元', 'trade', 'sum(pay_amount)', '买家实际支付金额', '{}', true),
    ('paid_order_count', '支付订单数', '单', 'trade', 'sum(paid_order_count)', '已付款订单总量', '{}', true),
    ('paid_buyer_count', '支付买家数', '人', 'trade', 'sum(paid_buyer_count)', '付款独立买家数', '{}', false),
    ('refund_amount', '退款金额', '元', 'aftersale', 'sum(refund_amount)', '退款退货及仅退款总额', '{}', true),
    ('refund_rate', '退款率', '%', 'aftersale', 'sum(refund_amount) / NULLIF(sum(gmv), 0) * 100', '退款总额占GMV比例', '{}', false),
    ('net_sales', '净销售额', '元', 'trade', 'sum(gmv) - sum(refund_amount)', '剔除退款后的真实销售业绩', '{}', true),
    ('ad_spend', '投流花费', '元', 'ad', 'sum(ad_spend)', '商业投放总消耗（千川/万相台/快车/金牛等）', '{}', true),
    ('roi', '综合投产比 (ROI)', '', 'ad', 'sum(gmv) / NULLIF(sum(ad_spend), 0)', 'GMV与广告费比值', '{}', false),
    ('traffic_views', '浏览展现量', '次', 'traffic', 'sum(impressions)', '商品或直播间展现曝光次数', '{}', true),
    ('click_count', '点击量', '次', 'traffic', 'sum(clicks)', '点击进入详情或直播间次数', '{}', true),
    ('ctr', '点击率 (CTR)', '%', 'traffic', 'sum(clicks)::numeric / NULLIF(sum(impressions), 0) * 100', '展现到点击转化率', '{}', false),
    ('gpm', '千次展现成交 (GPM)', '元', 'traffic', 'sum(gmv) / NULLIF(sum(impressions), 0) * 1000', '每千次曝光产生的GMV', '{"douyin","kuaishou"}', false)
ON CONFLICT (metric_code) DO NOTHING;

-- 5. Entity Bridge & Backfill
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS shop_id bigint REFERENCES public.dim_shop(id);
ALTER TABLE public.live_rooms ADD COLUMN IF NOT EXISTS platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code);

-- Backfill live_rooms with default douyin shop
UPDATE public.live_rooms 
SET 
    shop_id = (SELECT id FROM public.dim_shop WHERE platform_code = 'douyin' LIMIT 1),
    platform_code = 'douyin'
WHERE shop_id IS NULL;

ALTER TABLE public.anchors ADD COLUMN IF NOT EXISTS platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code);
UPDATE public.anchors SET platform_code = 'douyin' WHERE platform_code IS NULL;

ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code);
UPDATE public.live_sessions SET platform_code = 'douyin' WHERE platform_code IS NULL;

ALTER TABLE public.ad_plan ADD COLUMN IF NOT EXISTS platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code);
UPDATE public.ad_plan SET platform_code = 'douyin' WHERE platform_code IS NULL;

ALTER TABLE public.data_uploads ADD COLUMN IF NOT EXISTS platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code);
ALTER TABLE public.data_uploads ADD COLUMN IF NOT EXISTS clean_rule_set_id integer;
UPDATE public.data_uploads SET platform_code = 'douyin' WHERE platform_code IS NULL;

-- 6. Universal Fact Tables (Declarative Monthly Partitioning)

-- (1) fact_trade_daily
CREATE TABLE IF NOT EXISTS public.fact_trade_daily (
    id bigserial,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id),
    channel_name varchar(100) DEFAULT '默认渠道',
    gmv numeric(14,2) DEFAULT 0 NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    paid_order_count integer DEFAULT 0 NOT NULL,
    paid_buyer_count integer DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_count integer DEFAULT 0 NOT NULL,
    source varchar(20) DEFAULT 'api' NOT NULL, -- 'api' | 'manual'
    upload_id integer REFERENCES public.data_uploads(id) ON DELETE SET NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id)
) PARTITION BY RANGE (biz_date);

-- Create monthly partitions for trade facts
CREATE TABLE IF NOT EXISTS public.fact_trade_daily_y2026m09 PARTITION OF public.fact_trade_daily
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS public.fact_trade_daily_y2026m10 PARTITION OF public.fact_trade_daily
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS public.fact_trade_daily_y2026m11 PARTITION OF public.fact_trade_daily
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS public.fact_trade_daily_y2026m12 PARTITION OF public.fact_trade_daily
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS public.fact_trade_daily_y2027m01 PARTITION OF public.fact_trade_daily
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE INDEX IF NOT EXISTS idx_trade_daily_ps ON public.fact_trade_daily (biz_date, platform_code, shop_id);

-- (2) fact_traffic_daily
CREATE TABLE IF NOT EXISTS public.fact_traffic_daily (
    id bigserial,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id),
    channel_name varchar(100) DEFAULT '默认渠道',
    impressions bigint DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    visitors bigint DEFAULT 0 NOT NULL,
    avg_stay_seconds integer DEFAULT 0 NOT NULL,
    source varchar(20) DEFAULT 'api' NOT NULL,
    upload_id integer REFERENCES public.data_uploads(id) ON DELETE SET NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id)
) PARTITION BY RANGE (biz_date);

CREATE TABLE IF NOT EXISTS public.fact_traffic_daily_y2026m10 PARTITION OF public.fact_traffic_daily
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS public.fact_traffic_daily_y2026m11 PARTITION OF public.fact_traffic_daily
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS public.fact_traffic_daily_y2026m12 PARTITION OF public.fact_traffic_daily
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_traffic_daily_ps ON public.fact_traffic_daily (biz_date, platform_code, shop_id);

-- (3) fact_ad_daily
CREATE TABLE IF NOT EXISTS public.fact_ad_daily (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id),
    plan_id bigint,
    plan_name varchar(200) NOT NULL,
    ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    ad_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    ad_roi numeric(8,2) DEFAULT 0 NOT NULL,
    impressions bigint DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    source varchar(20) DEFAULT 'api' NOT NULL,
    created_at timestamptz DEFAULT now()
);
-- fact_ad_daily 在基线中为视图，无需额外索引

-- (4) fact_content_daily (Short video / Xiaohongshu notes)
CREATE TABLE IF NOT EXISTS public.fact_content_daily (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id),
    content_id varchar(100) NOT NULL,
    title varchar(255) DEFAULT '',
    content_type varchar(30) DEFAULT 'short_video', -- 'short_video', 'note', 'live_clip'
    views bigint DEFAULT 0 NOT NULL,
    likes bigint DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    collects integer DEFAULT 0 NOT NULL,
    attributed_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source varchar(20) DEFAULT 'api' NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_daily_ps ON public.fact_content_daily (biz_date, platform_code, shop_id);

-- 7. Pre-aggregated Rollup Tables
CREATE TABLE IF NOT EXISTS public.agg_shop_daily (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id),
    total_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    total_pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_order_count integer DEFAULT 0 NOT NULL,
    total_buyer_count integer DEFAULT 0 NOT NULL,
    total_refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_sales numeric(14,2) DEFAULT 0 NOT NULL,
    total_ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    overall_roi numeric(8,2) DEFAULT 0 NOT NULL,
    total_impressions bigint DEFAULT 0 NOT NULL,
    total_clicks bigint DEFAULT 0 NOT NULL,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(biz_date, platform_code, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_agg_shop_daily_date ON public.agg_shop_daily (biz_date DESC);

CREATE TABLE IF NOT EXISTS public.agg_platform_monthly (
    id serial PRIMARY KEY,
    year_month varchar(7) NOT NULL, -- '2026-11'
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    total_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    total_refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_sales numeric(14,2) DEFAULT 0 NOT NULL,
    total_ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    overall_roi numeric(8,2) DEFAULT 0 NOT NULL,
    updated_at timestamptz DEFAULT now(),
    UNIQUE(year_month, platform_code)
);

-- Record migration in registry
INSERT INTO public.schema_migrations (version, name)
VALUES ('100_platform_core', 'Multi-platform core foundation, shop bridge, partitioned facts, and permissions')
ON CONFLICT (version) DO NOTHING;

