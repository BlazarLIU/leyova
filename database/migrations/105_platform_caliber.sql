-- ============================================================================
-- Migration: 105_platform_caliber.sql
-- Description: 平台成交口径模型（阶段 A1）
--
-- 背景（见 docs/platform-business-model-comparison.md）：
--   6 个平台的 GMV 定义完全不同：
--   - 淘宝/天猫：支付金额，未剔除事后退款
--   - 京东：成交金额，含货到付款（口径比纯在线支付平台大）
--   - 京东自营：供货金额（采销额），与 POP 成交额不可相加
--   - 拼多多：交易额 / 结算金额 / 净成交 三套并存
--   - 快手：全站 GMV（含间接成交），另有净成交
--   - 小红书：站内 GMV / 站内+站外 GMV 两套
--
-- 只存一个 gmv 字段必然导致跨平台对比失真。
-- ============================================================================

-- 1. 平台口径配置表
CREATE TABLE IF NOT EXISTS public.platform_caliber_config (
    id serial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    metric_code varchar(50) NOT NULL DEFAULT 'gmv',
    amount_type varchar(40) NOT NULL,
    attribution_window_hours integer,
    attribution_type varchar(30) DEFAULT 'last_click',
    is_default boolean DEFAULT false NOT NULL,
    display_note text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    UNIQUE(platform_code, metric_code, amount_type)
);

CREATE INDEX IF NOT EXISTS idx_caliber_platform ON public.platform_caliber_config (platform_code, metric_code);

-- 2. amount_type 字典说明（供前端展示口径解释）
CREATE TABLE IF NOT EXISTS public.amount_type_dict (
    code varchar(40) PRIMARY KEY,
    name varchar(80) NOT NULL,
    description text DEFAULT '',
    is_comparable boolean DEFAULT true NOT NULL  -- 能否与其他平台横向对比
);

INSERT INTO public.amount_type_dict (code, name, description, is_comparable) VALUES
    ('gross_paid',      '支付口径',   '用户完成支付的金额，未剔除事后退款', true),
    ('gross_settled',   '结算口径',   '扣除退款后的结算金额（拼多多结算金额 / 京东供货金额）', false),
    ('net_settled',     '净成交口径', '剔除秒退/短时退款后的净成交（拼多多净成交 / 快手净成交）', false),
    ('indirect_included', '含间接成交', '包含点击广告后通过其他渠道再次触达产生的成交（快手核心指标）', false),
    ('offline_cod_included', '含货到付款', '包含货到付款与公司转账的金额（京东特有）', false),
    ('onsite',          '站内成交',   '仅统计本平台内完成的成交', true),
    ('offsite',         '站外成交',   '笔记/广告挂链跳转外部平台完成的成交（小红书红猫/红京等）', false),
    ('supply_amount',   '供货金额',   '京东自营对供应商的采销结算额，与零售成交额不同量级', false)
ON CONFLICT (code) DO NOTHING;

-- 3. 事实表增加口径字段
ALTER TABLE public.fact_trade_daily
    ADD COLUMN IF NOT EXISTS amount_type varchar(40) DEFAULT 'gross_paid';
ALTER TABLE public.fact_trade_daily
    ADD COLUMN IF NOT EXISTS attribution_window_hours integer;

CREATE INDEX IF NOT EXISTS idx_trade_daily_amount_type
    ON public.fact_trade_daily (platform_code, amount_type, biz_date);

-- 4. 预置各平台默认口径（来自调研报告）
INSERT INTO public.platform_caliber_config
    (platform_code, metric_code, amount_type, attribution_window_hours, attribution_type, is_default, display_note)
VALUES
    -- 淘宝 / 天猫：支付金额，未扣退款；万相台归因窗口待核实
    ('taobao', 'gmv', 'gross_paid', NULL, 'last_click', true,
     '生意参谋「支付金额」口径：用户通过支付宝支付的金额，未剔除事后退款。与万相台广告后台数据天然不一致，复盘需声明数据源。'),
    ('tmall',  'gmv', 'gross_paid', NULL, 'last_click', true,
     '同淘宝：支付金额口径，未剔除事后退款'),
    ('tmall',  'gmv', 'gross_paid', NULL, 'last_click', false,
     '天猫与淘宝共用生意参谋，指标定义一致，差异仅在入驻资质与活动资格'),

    -- 京东 POP：成交金额含货到付款
    ('jd', 'gmv', 'offline_cod_included', 720, 'last_click', true,
     '京麦「成交金额」口径：含先款订单（在线支付/公司转账/邮局汇款）与货到付款订单。因含 COD，与纯在线支付平台不可直接横比。投产比默认 30 天转化周期。'),
    ('jd', 'gmv', 'gross_paid', 720, 'last_click', false,
     '仅在线支付口径，剔除货到付款'),

    -- 拼多多：三套口径并存
    ('pdd', 'gmv', 'gross_paid', 336, 'last_click', true,
     '交易额口径：以已成团订单为准。注意拼多多售后指标分母是「已成团订单数」，不是支付订单数。投产比 14 天归因。'),
    ('pdd', 'gmv', 'gross_settled', 336, 'last_click', false,
     '结算金额口径：总交易额 - 退款交易额。部分退款只剔除对应金额，且该单不计入退单笔数。'),
    ('pdd', 'gmv', 'net_settled', 336, 'last_click', false,
     '净成交口径：剔除秒退订单（支付后 1 小时内且当日 23:59:59 前退款、商家未发货）'),

    -- 快手：含间接成交
    ('kuaishou', 'gmv', 'indirect_included', 24, 'last_click', true,
     '磁力金牛「当日总成交订单金额」口径：直接成交 + 间接成交（点击广告后当天内通过关注/搜索/购物车/主页/橱窗再次触达成交）。快手官方明确：金牛口径与生意通口径天然不可对比。'),
    ('kuaishou', 'gmv', 'net_settled', 24, 'last_click', false,
     '净成交口径：剔除下单后 1 小时内退款'),

    -- 小红书：站内外两套
    ('xiaohongshu', 'gmv', 'onsite', NULL, 'cross_platform', true,
     '站内成交口径：小红书站内完成的成交。小红书核心经营单元是「笔记」而非店铺，GMV 需与笔记/搜索/人群资产一起看。'),
    ('xiaohongshu', 'gmv', 'offsite', NULL, 'cross_platform', false,
     '站外成交口径：通过红猫/红京/红美等广告挂链跳转外部平台完成的成交，依赖小红星/小红盟回传'),

    -- 抖音：对照组
    ('douyin', 'gmv', 'gross_paid', NULL, 'last_click', true,
     '抖音电商罗盘口径：直播间/短视频/货架成交，未剔除退款')
ON CONFLICT (platform_code, metric_code, amount_type) DO NOTHING;

-- 5. 店铺扩展：业务模式与店铺类型（京东自营/POP、淘宝/天猫店铺类型）
ALTER TABLE public.dim_shop ADD COLUMN IF NOT EXISTS business_mode varchar(30);
ALTER TABLE public.dim_shop ADD COLUMN IF NOT EXISTS shop_type varchar(40);

-- 给 business_mode / shop_type 加注释
COMMENT ON COLUMN public.dim_shop.business_mode IS
    '京东：self_operated(自营采销) | pop_sop | pop_fbp。其他平台留空。禁止跨 mode 加总 GMV。';
COMMENT ON COLUMN public.dim_shop.shop_type IS
    '淘宝系：taobao_personal | taobao_enterprise | tmall。天猫与淘宝不拆平台，用此字段区分。';

-- 回填现有店铺的 shop_type
UPDATE public.dim_shop SET shop_type = 'taobao_enterprise'
 WHERE platform_code = 'taobao' AND shop_type IS NULL;
UPDATE public.dim_shop SET shop_type = 'tmall'
 WHERE platform_code = 'tmall' AND shop_type IS NULL;

INSERT INTO public.schema_migrations (version, name)
VALUES ('105_platform_caliber', 'Platform caliber model: amount_type, attribution, business_mode, shop_type')
ON CONFLICT (version) DO NOTHING;
