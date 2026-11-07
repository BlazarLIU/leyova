-- ============================================================================
-- Migration: 108_attribution_and_sla.sql
-- Description: 推广归因模型 + 订单状态机 + 售后 SLA（阶段 A4、A5）
--
-- 背景：
--   A4：各平台归因窗口不同（京东30天/拼多多14天/快手24h），
--       且快手「间接成交」是核心指标，只存一个 ad_roi 无法表达
--   A5：拼多多有「待成团」前置状态、京东有 24h 售后兜底 + 48h 延迟发货，
--       状态机与 SLA 必须按平台可配置
-- ============================================================================

-- ────────────────────────────────────────────────────────────
-- A4. 推广归因模型
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.fact_ad_daily ADD COLUMN IF NOT EXISTS attribution_window_hours integer DEFAULT 24;
ALTER TABLE public.fact_ad_daily ADD COLUMN IF NOT EXISTS attribution_type varchar(30) DEFAULT 'last_click';
ALTER TABLE public.fact_ad_daily ADD COLUMN IF NOT EXISTS direct_gmv numeric(14,2) DEFAULT 0;
ALTER TABLE public.fact_ad_daily ADD COLUMN IF NOT EXISTS indirect_gmv numeric(14,2) DEFAULT 0;
ALTER TABLE public.fact_ad_daily ADD COLUMN IF NOT EXISTS net_gmv numeric(14,2) DEFAULT 0;
ALTER TABLE public.fact_ad_daily ADD COLUMN IF NOT EXISTS ad_tool varchar(50);

COMMENT ON COLUMN public.fact_ad_daily.ad_tool IS
    '投放工具：巨量千川/磁力金牛/万相台无界版/京准通/商品推广/聚光等';
COMMENT ON COLUMN public.fact_ad_daily.indirect_gmv IS
    '间接成交金额（快手核心指标）：点击广告未直接转化，当天内通过关注/搜索/购物车/主页/橱窗再次触达成交';
COMMENT ON COLUMN public.fact_ad_daily.net_gmv IS
    '净成交金额：剔除秒退/短时退款后的成交（拼多多净成交 / 快手净成交）';

-- 投放工具字典
CREATE TABLE IF NOT EXISTS public.ad_tool_dict (
    code varchar(50) PRIMARY KEY,
    name varchar(80) NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    default_attribution_hours integer,
    has_indirect boolean DEFAULT false,
    description text DEFAULT ''
);

INSERT INTO public.ad_tool_dict (code, name, platform_code, default_attribution_hours, has_indirect, description) VALUES
    ('qianchuan',       '巨量千川',       'douyin',      NULL, false, '抖音电商投放'),
    ('cili_jinniu',     '磁力金牛',       'kuaishou',    24,   true,  '快手电商投流，含间接成交；官方明确与生意通口径不可对比'),
    ('cili_juxing',     '磁力聚星',       'kuaishou',    NULL, false, '快手达人内容合作'),
    ('wanxiangtai',     '万相台无界版',   'taobao',      NULL, false, '原直通车/引力魔方/万相台整合，2024-08 起统一'),
    ('wanxiangtai_tm',  '万相台无界版',   'tmall',       NULL, false, '同淘宝'),
    ('jingzhuntong',    '京准通',         'jd',          720,  true,  '京东投放，默认 30 天转化周期，可切 15 天'),
    ('pdd_goods_promo', '商品推广',       'pdd',         336,  false, '原全站推广+标准推广，2024-07 合并'),
    ('juguang',         '聚光',           'xiaohongshu', NULL, false, '小红书一站式广告投放'),
    ('shutiao',         '薯条',           'xiaohongshu', NULL, false, '原生内容加热，不带广告标识'),
    ('putongying',      '蒲公英',         'xiaohongshu', NULL, false, '达人合作平台')
ON CONFLICT (code) DO NOTHING;

-- 双源对账视图（承认广告后台与商家后台数永远不一致）
CREATE OR REPLACE VIEW public.v_ad_reconciliation AS
SELECT
    a.platform_code,
    a.shop_id,
    a.biz_date,
    a.ad_tool,
    a.ad_spend,
    a.ad_gmv                                        AS ad_platform_gmv,
    COALESCE(t.trade_gmv, 0)                        AS merchant_gmv,
    CASE WHEN COALESCE(t.trade_gmv, 0) > 0
         THEN ROUND((a.ad_gmv - t.trade_gmv) / t.trade_gmv * 100, 2)
         ELSE NULL END                              AS diff_pct,
    CASE WHEN a.ad_spend > 0
         THEN ROUND(a.ad_gmv / a.ad_spend, 2)
         ELSE 0 END                                 AS ad_roi,
    CASE WHEN COALESCE(t.trade_gmv, 0) > 0 AND a.ad_spend > 0
         THEN ROUND(t.trade_gmv / a.ad_spend, 2)
         ELSE 0 END                                 AS merchant_roi
FROM (
    SELECT platform_code, shop_id, biz_date, ad_tool,
           SUM(ad_spend) AS ad_spend, SUM(ad_gmv) AS ad_gmv
      FROM public.fact_ad_daily
     GROUP BY platform_code, shop_id, biz_date, ad_tool
) a
LEFT JOIN (
    SELECT platform_code, shop_id, biz_date, SUM(gmv) AS trade_gmv
      FROM public.fact_trade_daily
     GROUP BY platform_code, shop_id, biz_date
) t ON t.platform_code = a.platform_code
   AND t.shop_id = a.shop_id
   AND t.biz_date = a.biz_date;

COMMENT ON VIEW public.v_ad_reconciliation IS
    '双源对账：广告后台口径 vs 商家后台口径。快手官方明确两者天然不可对比，此处如实展示差异而非强行对齐。';

-- ────────────────────────────────────────────────────────────
-- A5. 订单状态机与售后 SLA
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_config (
    id serial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    status_code varchar(40) NOT NULL,
    status_name varchar(60) NOT NULL,
    is_final boolean DEFAULT false NOT NULL,
    counts_as_gmv boolean DEFAULT true NOT NULL,
    counts_as_order boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    description text DEFAULT '',
    UNIQUE(platform_code, status_code)
);

INSERT INTO public.order_status_config
    (platform_code, status_code, status_name, is_final, counts_as_gmv, counts_as_order, sort_order, description) VALUES
    -- 拼多多：团是前置状态，未成团不计入 GMV
    ('pdd', 'waiting_group',  '待成团',   false, false, false, 10, '支付后等待成团，未成团自动退款。不计入 GMV 与成交订单。'),
    ('pdd', 'grouping',       '拼团中',   false, false, false, 20, '已成团但仍在拼团过程中'),
    ('pdd', 'grouped',        '已成团',   false, true,  true,  30, '成团成功，计入 GMV。售后指标分母应取此状态订单数。'),
    ('pdd', 'expired',        '拼团过期', true,  false, false, 40, '超时未成团，自动退款退款'),
    ('pdd', 'shipped',        '已发货',   false, true,  true,  50, ''),
    ('pdd', 'completed',      '已完成',   true,  true,  true,  60, ''),

    -- 京东：货到付款是特有状态
    ('jd', 'pending_payment', '待付款',   false, false, false, 10, ''),
    ('jd', 'cod_pending',     '货到付款待收', false, true, true, 20, '京东特有：货到付款订单，计入成交金额但资金未到账。'),
    ('jd', 'paid',            '已付款',   false, true,  true,  30, '含在线支付与公司转账'),
    ('jd', 'shipped',         '已发货',   false, true,  true,  40, ''),
    ('jd', 'completed',       '已完成',   true,  true,  true,  50, ''),
    ('jd', 'after_sale',      '售后中',   false, true,  false, 60, ''),

    -- 淘宝/天猫
    ('taobao', 'pending_payment', '待付款', false, false, false, 10, ''),
    ('taobao', 'paid',            '已付款', false, true,  true,  20, ''),
    ('taobao', 'shipped',         '已发货', false, true,  true,  30, ''),
    ('taobao', 'completed',       '已完成', true,  true,  true,  40, ''),
    ('tmall',  'pending_payment', '待付款', false, false, false, 10, ''),
    ('tmall',  'paid',            '已付款', false, true,  true,  20, ''),
    ('tmall',  'shipped',         '已发货', false, true,  true,  30, ''),
    ('tmall',  'completed',       '已完成', true,  true,  true,  40, ''),

    -- 快手
    ('kuaishou', 'paid',      '已付款',   false, true, true,  10, ''),
    ('kuaishou', 'shipped',   '已发货',   false, true, true,  20, ''),
    ('kuaishou', 'completed', '已完成',   true,  true, true,  30, ''),

    -- 小红书：站外转化是特有状态
    ('xiaohongshu', 'paid',              '已付款',     false, true,  true,  10, ''),
    ('xiaohongshu', 'shipped',           '已发货',     false, true,  true,  20, ''),
    ('xiaohongshu', 'completed',         '已完成',     true,  true,  true,  30, ''),
    ('xiaohongshu', 'offsite_converted', '站外转化',   true,  false, false, 40, '小红书特有：笔记/广告挂链跳转外部平台成交，单独口径'),

    -- 抖音（对照组）
    ('douyin', 'paid',      '已付款',   false, true, true,  10, ''),
    ('douyin', 'shipped',   '已发货',   false, true, true,  20, ''),
    ('douyin', 'completed', '已完成',   true,  true, true,  30, '')
ON CONFLICT (platform_code, status_code) DO NOTHING;

-- 售后与履约 SLA 配置
CREATE TABLE IF NOT EXISTS public.platform_sla_config (
    id serial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    sla_type varchar(40) NOT NULL,
    sla_name varchar(80) NOT NULL,
    threshold_hours integer NOT NULL,
    business_hours_only boolean DEFAULT false,
    business_hour_start integer,
    business_hour_end integer,
    penalty_note text DEFAULT '',
    is_verified boolean DEFAULT false,
    UNIQUE(platform_code, sla_type)
);

INSERT INTO public.platform_sla_config
    (platform_code, sla_type, sla_name, threshold_hours, business_hours_only, business_hour_start, business_hour_end, penalty_note, is_verified) VALUES
    -- 京东：最严
    ('jd', 'aftersale_review',   '售后审核兜底',   24, false, NULL, NULL, '2024-02 起由 48h 收紧至 24h', true),
    ('jd', 'aftersale_receive',  '售后收货兜底',   24, false, NULL, NULL, '新增上门取件妥投、收货兜底 24h', true),
    ('jd', 'aftersale_return',   '退换场景收货处理', 24, false, NULL, NULL, '由 3 天收紧至 24h（维修不变）', true),
    ('jd', 'aftersale_ship_out', '寄出/揽件处理',  168, false, NULL, NULL, '由 10 天收紧至 7 天（维修不变）', true),
    ('jd', 'ship_delay',         '延迟发货减分线', 48, false, NULL, NULL, '近 30 天延迟发货超 48h 订单量，计入店铺星级减分', true),
    ('jd', 'customer_service',   '客服响应考核时段', 0, true, 9, 23, '咚咚无响应会话纳入平均响应时长，考核时段 9:00-23:00', true),

    -- 拼多多
    ('pdd', 'ship',              '发货+揽收时限',  48, false, NULL, NULL, '2025-05 起延迟发货认定改为「未在时限内完成发货及揽收」', true),
    ('pdd', 'fake_ship',         '虚假发货判定',   48, false, NULL, NULL, '赔付比例由 25% 降至 5%', true),
    ('pdd', 'refund_denominator','退款率分母口径',  0, false, NULL, NULL, '分母为「已成团订单数」而非支付订单数', true),

    -- 淘宝/天猫
    ('taobao', 'only_refund_autonomy', '仅退款自主权分界线', 0, false, NULL, NULL, '店铺综合体验分 ≥ 4.8 时平台不主动介入收货后仅退款', true),
    ('taobao', 'dsr_window',     'DSR 评分统计窗口', 4320, false, NULL, NULL, 'DSR 三项取最近 180 天滚动', true),
    ('tmall', 'only_refund_autonomy', '仅退款自主权分界线', 0, false, NULL, NULL, '同淘宝', true),
    ('tmall', 'dsr_window',      'DSR 评分统计窗口', 4320, false, NULL, NULL, '同淘宝', true),

    -- 快手
    ('kuaishou', 'net_settlement', '净成交剔除窗口', 1, false, NULL, NULL, '净成交剔除下单后 1 小时内退款', true),

    -- 小红书
    ('xiaohongshu', 'note_review', '笔记审核时效', 24, false, NULL, NULL, '规则待核实', false)
ON CONFLICT (platform_code, sla_type) DO NOTHING;

COMMENT ON TABLE public.platform_sla_config IS
    '按平台配置的售后与履约 SLA。禁止硬编码统一的 48 小时。';

-- 订单表（承载状态机）
CREATE TABLE IF NOT EXISTS public.order_facts (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    order_id varchar(64) NOT NULL,
    status_code varchar(40) NOT NULL,
    amount_type varchar(40) DEFAULT 'gross_paid',
    pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    source_code varchar(50),
    raw_source varchar(200),
    paid_at timestamptz,
    shipped_at timestamptz,
    completed_at timestamptz,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(platform_code, order_id)
);
CREATE INDEX IF NOT EXISTS idx_order_facts_date ON public.order_facts (biz_date DESC, platform_code);
CREATE INDEX IF NOT EXISTS idx_order_facts_status ON public.order_facts (platform_code, status_code);

COMMENT ON TABLE public.order_facts IS
    '订单事实表。状态机按 order_status_config 配置，拼多多的「待成团」状态不计入 GMV。';

INSERT INTO public.schema_migrations (version, name)
VALUES ('108_attribution_and_sla', 'Ad attribution model, order status machine, platform SLA config')
ON CONFLICT (version) DO NOTHING;
