-- ============================================================================
-- Migration: 106_platform_entities.sql
-- Description: 平台扩展实体（阶段 A2）
--
-- 背景：不同平台的经营对象根本不同，硬塞进订单表是错误的：
--   - 拼多多：订单原子是「团」，支付后还要成团
--   - 小红书：核心资产是「笔记」，不是店铺
--   - 京东自营：「采销单 + SKU 供货」，不是店铺成交
--   - 快手：快手号 + 粉丝团 + 公私域流量
-- ============================================================================

-- ────────────────────────────────────────────────────────────
-- 1. 拼多多：拼团（订单前置状态）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pdd_group_buy (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    group_id varchar(64) NOT NULL,
    product_id varchar(64),
    product_name varchar(300) DEFAULT '',
    status varchar(20) NOT NULL DEFAULT 'waiting',
        -- waiting(待成团) | grouping(拼团中) | grouped(已成团) | expired(已过期)
    group_size_required integer DEFAULT 2 NOT NULL,
    group_size_actual integer DEFAULT 0 NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    grouped_at timestamptz,
    expired_at timestamptz,
    source varchar(20) DEFAULT 'manual' NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(biz_date, shop_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_pdd_group_status ON public.pdd_group_buy (status, biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_pdd_group_shop ON public.pdd_group_buy (shop_id, biz_date DESC);

COMMENT ON TABLE public.pdd_group_buy IS
    '拼多多拼团事实表。核心用途：计算「支付→成团」转化损耗。注意售后指标分母应为已成团订单数。';

-- ────────────────────────────────────────────────────────────
-- 2. 小红书：笔记（核心经营单元）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xhs_note (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    shop_id bigint REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    note_id varchar(64) NOT NULL,
    title varchar(300) DEFAULT '',
    note_type varchar(20) DEFAULT 'image_text',   -- image_text | video
    author_name varchar(100) DEFAULT '',
    -- 内容表现
    impressions bigint DEFAULT 0 NOT NULL,
    reads bigint DEFAULT 0 NOT NULL,
    likes bigint DEFAULT 0 NOT NULL,
    collects bigint DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    follows integer DEFAULT 0 NOT NULL,
    -- 搜索维度（小红书独立维度，其他平台无）
    search_impressions bigint DEFAULT 0 NOT NULL,
    recommend_impressions bigint DEFAULT 0 NOT NULL,
    search_keywords text[],
    -- 转化
    product_clicks bigint DEFAULT 0 NOT NULL,
    onsite_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    offsite_gmv numeric(14,2) DEFAULT 0 NOT NULL,  -- 小红星/小红盟回传
    source varchar(20) DEFAULT 'manual' NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(biz_date, note_id)
);
CREATE INDEX IF NOT EXISTS idx_xhs_note_date ON public.xhs_note (biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_xhs_note_shop ON public.xhs_note (shop_id, biz_date DESC);

COMMENT ON TABLE public.xhs_note IS
    '小红书笔记事实表。笔记是核心经营资产，允许「无成交」的笔记计入分析（种草价值）。';

-- ────────────────────────────────────────────────────────────
-- 3. 京东自营：采销单
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.jd_purchase_order (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    po_number varchar(64) NOT NULL,
    sku_code varchar(64) DEFAULT '',
    sku_name varchar(300) DEFAULT '',
    business_mode varchar(30) NOT NULL DEFAULT 'self_operated',
        -- self_operated(自营采销) | pop_sop | pop_fbp
    supply_price numeric(14,2) DEFAULT 0 NOT NULL,   -- 供货价
    retail_price numeric(14,2) DEFAULT 0 NOT NULL,   -- 京东零售价
    quantity integer DEFAULT 0 NOT NULL,
    settle_amount numeric(14,2) DEFAULT 0 NOT NULL,  -- 结算金额
    gross_margin numeric(14,2) DEFAULT 0 NOT NULL,   -- (retail - supply) * qty
    settle_cycle_days integer,                       -- 账期天数
    source varchar(20) DEFAULT 'manual' NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(biz_date, shop_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_jd_po_date ON public.jd_purchase_order (biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_jd_po_mode ON public.jd_purchase_order (business_mode, biz_date DESC);

COMMENT ON TABLE public.jd_purchase_order IS
    '京东采销单。供货金额与 POP 成交金额量级与含义不同，禁止相加。';

-- ────────────────────────────────────────────────────────────
-- 4. 快手：账号私域与公私域流量
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kuaishou_fans_ops (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    account_id varchar(64) NOT NULL,      -- 快手号
    account_name varchar(100) DEFAULT '',
    -- 粉丝资产
    new_followers integer DEFAULT 0 NOT NULL,
    total_followers integer DEFAULT 0 NOT NULL,
    fans_team_joiners integer DEFAULT 0 NOT NULL,   -- 粉丝团新增（购物团）
    fans_team_total integer DEFAULT 0 NOT NULL,
    close_friends integer DEFAULT 0 NOT NULL,        -- 亲密度达标人数
    -- 公私域成交拆分（快手核心）
    follow_page_gmv numeric(14,2) DEFAULT 0 NOT NULL,    -- 关注页成交（私域）
    discover_page_gmv numeric(14,2) DEFAULT 0 NOT NULL,  -- 发现页成交（公域）
    other_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    -- 间接成交（快手独有的一级指标）
    direct_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    indirect_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source varchar(20) DEFAULT 'manual' NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    UNIQUE(biz_date, shop_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_ks_fans_date ON public.kuaishou_fans_ops (biz_date DESC);

COMMENT ON TABLE public.kuaishou_fans_ops IS
    '快手账号私域经营。间接成交与关注页成交是快手区别于抖音的核心指标。';

-- ────────────────────────────────────────────────────────────
-- 5. 阿里系：父子订单结构（淘宝/天猫双层订单）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.taobao_order_hierarchy (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    parent_order_id varchar(64) NOT NULL,
    sub_order_id varchar(64) NOT NULL,
    sku_code varchar(64) DEFAULT '',
    pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    terminal varchar(20) DEFAULT 'wireless',   -- pc | wireless
    buyer_id_masked varchar(64) DEFAULT '',
    source varchar(20) DEFAULT 'manual' NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(parent_order_id, sub_order_id)
);
CREATE INDEX IF NOT EXISTS idx_tb_order_date ON public.taobao_order_hierarchy (biz_date DESC, shop_id);

COMMENT ON TABLE public.taobao_order_hierarchy IS
    '淘宝/天猫父子订单结构。父订单=一次付款，子订单=商品×SKU 明细。取数必须声明用哪一层。';

INSERT INTO public.schema_migrations (version, name)
VALUES ('106_platform_entities', 'Platform-specific entities: pdd group, xhs note, jd PO, kuaishou fans, taobao order hierarchy')
ON CONFLICT (version) DO NOTHING;
