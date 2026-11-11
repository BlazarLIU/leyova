-- ============================================================================
-- Migration: 116_core_missing_business_chains.sql
-- Description: 补齐五大核心缺失业务链（审计第7章 7.1 / 7.7）
--   1. 商品主数据与全渠道库存中心 (dim_product, dim_sku_mapping, fact_inventory_stock, fact_inventory_ledger)
--   2. 多平台48h履约SLA与赔付风控 (platform_sla_config扩展, fact_fulfillment_waybill)
--   3. 售后退货原因归因与工单闭环 (fact_after_sale_tickets + 写入 canonical_refund_events)
--   4. 达人合作与佣金台账 (dim_kol, fact_kol_cooperation)
--   5. 客服咨询会话与响应绩效 (dim_cs_agent, fact_cs_session)
--   6. 补充系统模块与角色权限映射 (system_modules, role_modules)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 商品主数据与全渠道库存中心
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_product (
    id              BIGSERIAL PRIMARY KEY,
    spu_code        VARCHAR(64) NOT NULL,
    sku_code        VARCHAR(64) NOT NULL UNIQUE,
    product_name    VARCHAR(200) NOT NULL,
    category        VARCHAR(80) NOT NULL DEFAULT '通用服饰',
    brand_name      VARCHAR(80) NOT NULL DEFAULT 'Leyova自营',
    unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
    retail_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
    safety_stock    INTEGER NOT NULL DEFAULT 20,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'discontinued')),
    specs           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dim_product_spu ON public.dim_product(spu_code);

CREATE TABLE IF NOT EXISTS public.dim_sku_mapping (
    id                BIGSERIAL PRIMARY KEY,
    product_id        BIGINT NOT NULL REFERENCES public.dim_product(id) ON DELETE CASCADE,
    platform_code     VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id           BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    platform_item_id  VARCHAR(100) NOT NULL,
    platform_sku_id   VARCHAR(100) NOT NULL,
    platform_sku_name VARCHAR(200) NOT NULL DEFAULT '',
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform_code, shop_id, platform_sku_id)
);

CREATE INDEX IF NOT EXISTS idx_dim_sku_mapping_product ON public.dim_sku_mapping(product_id);

CREATE TABLE IF NOT EXISTS public.fact_inventory_stock (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES public.dim_product(id) ON DELETE CASCADE,
    warehouse_code  VARCHAR(50) NOT NULL DEFAULT 'MAIN_WH',
    warehouse_name  VARCHAR(100) NOT NULL DEFAULT '华东中心仓',
    shop_id         BIGINT REFERENCES public.dim_shop(id) ON DELETE SET NULL,
    on_hand_qty     INTEGER NOT NULL DEFAULT 0,
    locked_qty      INTEGER NOT NULL DEFAULT 0,
    in_transit_qty  INTEGER NOT NULL DEFAULT 0,
    available_qty   INTEGER GENERATED ALWAYS AS (GREATEST(on_hand_qty - locked_qty, 0)) STORED,
    safety_stock    INTEGER NOT NULL DEFAULT 20,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, warehouse_code)
);

CREATE INDEX IF NOT EXISTS idx_fact_inventory_low_stock
    ON public.fact_inventory_stock(available_qty, safety_stock);

CREATE TABLE IF NOT EXISTS public.fact_inventory_ledger (
    id              BIGSERIAL PRIMARY KEY,
    product_id      BIGINT NOT NULL REFERENCES public.dim_product(id) ON DELETE CASCADE,
    warehouse_code  VARCHAR(50) NOT NULL,
    change_type     VARCHAR(30) NOT NULL
                    CHECK (change_type IN ('inbound', 'outbound', 'lock', 'unlock', 'adjust', 'return_in')),
    delta_qty       INTEGER NOT NULL,
    before_on_hand  INTEGER NOT NULL,
    after_on_hand   INTEGER NOT NULL,
    ref_type        VARCHAR(40) NOT NULL DEFAULT 'manual_adjust',
    ref_id          VARCHAR(100) NOT NULL DEFAULT '',
    operator_id     BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    remark          TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_inventory_ledger_prod_time
    ON public.fact_inventory_ledger(product_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 2. 多平台履约 SLA 与赔付风控 (扩展 platform_sla_config + 新建运单履约表)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.platform_sla_config
    ADD COLUMN IF NOT EXISTS pickup_threshold_hours INTEGER NOT NULL DEFAULT 24,
    ADD COLUMN IF NOT EXISTS penalty_fixed_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS penalty_rate           NUMERIC(8,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS penalty_min_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS penalty_max_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS autonomy_min_score     NUMERIC(4,2);

-- 同步核验后的七大平台官方履约与售后规则（依据官方开放平台与平台规则）
INSERT INTO public.platform_sla_config
    (platform_code, sla_type, sla_name, threshold_hours, pickup_threshold_hours,
     penalty_fixed_amount, penalty_rate, penalty_min_amount, penalty_max_amount, autonomy_min_score,
     business_hours_only, business_hour_start, business_hour_end, penalty_note, is_verified)
VALUES
    -- 拼多多：48h 发货+揽收（定制预售最高120h），超时固定 3 元/单无门槛券；虚假发货 24h 无揽收/轨迹停滞
    ('pdd', 'ship', '拼多多48h发货+揽收时限', 48, 24,
     3.00, 0.0000, 3.00, 3.00, NULL,
     false, NULL, NULL, '未在48h内完成发货且物流公司24h内揽收，按单赔付固定3元无门槛现金券（定制商品最长120h）', true),
    ('pdd', 'fake_ship', '拼多多虚假发货判定', 48, 24,
     0.00, 0.0500, 3.00, 100.00, NULL,
     false, NULL, NULL, '上传单号后超过24h无揽收或轨迹异常停滞，判定虚假发货风险（赔付比例5%）', true),

    -- 快手：48h 发货 + 24h 揽收；虚假发货 1% 赔付（下限 3 元、上限 30 元）；售后 24h 仅退款 / 36h 退货退款商家自审；体验分 >= 4.7 仅退款自治保护
    ('kuaishou', 'ship', '快手48h发货+24h揽收', 48, 24,
     3.00, 0.0000, 3.00, 3.00, 4.70,
     false, NULL, NULL, '需在48h内点击发货且单号上传24h内具备真实揽收记录；体验分>=4.7享仅退款争议保护', true),
    ('kuaishou', 'fake_ship', '快手虚假发货赔付规则', 48, 24,
     0.00, 0.0100, 3.00, 30.00, 4.70,
     false, NULL, NULL, '虚假发货按订单实付金额1%赔付（最低3元、最高30元封顶）', true),
    ('kuaishou', 'aftersale_only_refund_audit', '快手仅退款商家自审倒计时', 24, 0,
     0.00, 0.0000, 0.00, 0.00, 4.70,
     false, NULL, NULL, '快手仅退款需商家在24h内响应审核，超时将自动退款或触发平台介入；体验分>=4.7可免平台直接强退', true),
    ('kuaishou', 'aftersale_return_audit', '快手退货退款商家自审倒计时', 36, 0,
     0.00, 0.0000, 0.00, 0.00, 4.70,
     false, NULL, NULL, '快手退货退款商家审单时限36h，超时系统自动同意退货申请', true),

    -- 抖音：常规48h发货+24h首条揽收轨迹
    ('douyin', 'ship', '抖音48h发货+24h首条揽收轨迹', 48, 24,
     0.00, 0.0500, 5.00, 500.00, NULL,
     false, NULL, NULL, '未按承诺48h发货或上传单号后24h无首条揽收轨迹，判定延迟/虚假发货（按实付5%，5-500元）', true),

    -- 淘宝/天猫：48h发货+24h揽收，体验分 >= 4.8 仅退款自治
    ('taobao', 'ship', '淘宝48h发货+24h揽收', 48, 24,
     0.00, 0.0500, 5.00, 50.00, 4.80,
     false, NULL, NULL, '48h内发货并在24h内产生揽收记录；体验分>=4.8享收货后仅退款自治保护', true),
    ('tmall', 'ship', '天猫48h发货+24h揽收', 48, 24,
     0.00, 0.0500, 5.00, 50.00, 4.80,
     false, NULL, NULL, '同淘宝，天猫体验分>=4.8享收货后仅退款自治保护', true),

    -- 小红书：48h发货+24h揽收
    ('xiaohongshu', 'ship', '小红书48h发货+24h揽收', 48, 24,
     0.00, 0.0300, 5.00, 100.00, NULL,
     false, NULL, NULL, '需48h内发货并完成24h首条揽收轨迹', true)
ON CONFLICT (platform_code, sla_type) DO UPDATE
SET sla_name = EXCLUDED.sla_name,
    threshold_hours = EXCLUDED.threshold_hours,
    pickup_threshold_hours = EXCLUDED.pickup_threshold_hours,
    penalty_fixed_amount = EXCLUDED.penalty_fixed_amount,
    penalty_rate = EXCLUDED.penalty_rate,
    penalty_min_amount = EXCLUDED.penalty_min_amount,
    penalty_max_amount = EXCLUDED.penalty_max_amount,
    autonomy_min_score = COALESCE(EXCLUDED.autonomy_min_score, public.platform_sla_config.autonomy_min_score),
    penalty_note = EXCLUDED.penalty_note,
    is_verified = EXCLUDED.is_verified;

-- 为既有 108 迁移中的 jd/taobao/tmall 更新定量字段
UPDATE public.platform_sla_config
SET pickup_threshold_hours = 24,
    penalty_fixed_amount = 0,
    penalty_rate = 0.0500,
    penalty_min_amount = 5.00,
    penalty_max_amount = 500.00
WHERE platform_code = 'jd' AND sla_type = 'ship_delay';

UPDATE public.platform_sla_config
SET autonomy_min_score = 4.80
WHERE platform_code IN ('taobao', 'tmall') AND sla_type = 'only_refund_autonomy';

CREATE TABLE IF NOT EXISTS public.fact_fulfillment_waybill (
    id                       BIGSERIAL PRIMARY KEY,
    platform_code            VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id                  BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    order_no                 VARCHAR(100) NOT NULL,
    waybill_no               VARCHAR(100),
    carrier_code             VARCHAR(40) DEFAULT 'SF',
    product_id               BIGINT REFERENCES public.dim_product(id) ON DELETE SET NULL,
    order_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
    is_custom_presale        BOOLEAN NOT NULL DEFAULT false,
    paid_at                  TIMESTAMPTZ NOT NULL,
    ship_deadline_at         TIMESTAMPTZ NOT NULL,
    shipped_at               TIMESTAMPTZ,
    pickup_at                TIMESTAMPTZ,
    signed_at                TIMESTAMPTZ,
    fulfillment_status       VARCHAR(30) NOT NULL DEFAULT 'pending_ship'
                             CHECK (fulfillment_status IN ('pending_ship', 'shipped_no_pickup', 'in_transit', 'signed', 'cancelled')),
    is_ship_delayed          BOOLEAN NOT NULL DEFAULT false,
    is_fake_ship_risk        BOOLEAN NOT NULL DEFAULT false,
    estimated_penalty_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    sla_risk_reason          TEXT NOT NULL DEFAULT '',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform_code, shop_id, order_no)
);

CREATE INDEX IF NOT EXISTS idx_waybill_status_deadline
    ON public.fact_fulfillment_waybill(fulfillment_status, ship_deadline_at);
CREATE INDEX IF NOT EXISTS idx_waybill_risk
    ON public.fact_fulfillment_waybill(is_ship_delayed, is_fake_ship_risk)
    WHERE is_ship_delayed = true OR is_fake_ship_risk = true;

-- ────────────────────────────────────────────────────────────
-- 3. 售后退货原因归因与工单处置 (同步联动 canonical_refund_events)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_after_sale_tickets (
    id                    BIGSERIAL PRIMARY KEY,
    ticket_no             VARCHAR(80) NOT NULL UNIQUE,
    platform_code         VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id               BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    source_order_id       VARCHAR(100) NOT NULL,
    source_refund_id      VARCHAR(100) NOT NULL,
    product_id            BIGINT REFERENCES public.dim_product(id) ON DELETE SET NULL,
    refund_type           VARCHAR(30) NOT NULL
                          CHECK (refund_type IN ('only_refund', 'return_refund', 'exchange')),
    refund_amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    reason_category       VARCHAR(50) NOT NULL
                          CHECK (reason_category IN ('size_mismatch', 'quality_defect', 'logistics_slow', 'not_as_described', 'buyer_remorse', 'other')),
    reason_detail         TEXT NOT NULL DEFAULT '',
    ticket_status         VARCHAR(30) NOT NULL DEFAULT 'pending_audit'
                          CHECK (ticket_status IN ('pending_audit', 'waiting_return', 'approved', 'rejected', 'platform_intervened', 'closed')),
    shop_experience_score NUMERIC(3,2) DEFAULT 4.80,
    autonomy_protected    BOOLEAN NOT NULL DEFAULT false,
    audit_deadline_at     TIMESTAMPTZ,
    applied_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at           TIMESTAMPTZ,
    assignee_id           BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    resolution_note       TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_after_sale_status_deadline
    ON public.fact_after_sale_tickets(ticket_status, audit_deadline_at);
CREATE INDEX IF NOT EXISTS idx_after_sale_reason
    ON public.fact_after_sale_tickets(platform_code, reason_category, applied_at DESC);

-- ────────────────────────────────────────────────────────────
-- 4. 达人合作与佣金台账 (与内部主播 anchors 分离)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_kol (
    id                      BIGSERIAL PRIMARY KEY,
    kol_name                VARCHAR(100) NOT NULL,
    platform_code           VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    platform_uid            VARCHAR(100) NOT NULL DEFAULT '',
    tier                    VARCHAR(30) NOT NULL DEFAULT 'waist'
                            CHECK (tier IN ('head', 'waist', 'tail', 'koc')),
    fans_count              INTEGER NOT NULL DEFAULT 0,
    category                VARCHAR(80) NOT NULL DEFAULT '时尚穿搭',
    contact_info            VARCHAR(150) NOT NULL DEFAULT '',
    default_commission_rate NUMERIC(6,4) NOT NULL DEFAULT 0.1500,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'paused', 'blacklist')),
    notes                   TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dim_kol_platform_name
    ON public.dim_kol(platform_code, kol_name);

CREATE TABLE IF NOT EXISTS public.fact_kol_cooperation (
    id                BIGSERIAL PRIMARY KEY,
    kol_id            BIGINT NOT NULL REFERENCES public.dim_kol(id) ON DELETE CASCADE,
    platform_code     VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id           BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    product_id        BIGINT REFERENCES public.dim_product(id) ON DELETE SET NULL,
    coop_type         VARCHAR(30) NOT NULL DEFAULT 'live_slot'
                      CHECK (coop_type IN ('live_slot', 'short_video', 'xhs_note', 'cps_only')),
    campaign_name     VARCHAR(150) NOT NULL,
    publish_date      DATE NOT NULL,
    pit_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission_rate   NUMERIC(6,4) NOT NULL DEFAULT 0.1500,
    gmv               NUMERIC(14,2) NOT NULL DEFAULT 0,
    refund_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_gmv           NUMERIC(14,2) GENERATED ALWAYS AS (GREATEST(gmv - refund_amount, 0)) STORED,
    commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    settlement_status VARCHAR(30) NOT NULL DEFAULT 'pending'
                      CHECK (settlement_status IN ('pending', 'confirmed', 'paid', 'disputed')),
    settled_at        TIMESTAMPTZ,
    remark            TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kol_coop_date_status
    ON public.fact_kol_cooperation(publish_date DESC, settlement_status);

-- ────────────────────────────────────────────────────────────
-- 5. 客服咨询会话与响应绩效
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_cs_agent (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    agent_code    VARCHAR(40) NOT NULL UNIQUE,
    agent_name    VARCHAR(80) NOT NULL,
    platform_code VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id       BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    shift_group   VARCHAR(30) NOT NULL DEFAULT 'day'
                  CHECK (shift_group IN ('day', 'night', 'all')),
    status        VARCHAR(20) NOT NULL DEFAULT 'online'
                  CHECK (status IN ('online', 'busy', 'offline')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fact_cs_session (
    id                     BIGSERIAL PRIMARY KEY,
    session_date           DATE NOT NULL,
    agent_id               BIGINT NOT NULL REFERENCES public.dim_cs_agent(id) ON DELETE CASCADE,
    platform_code          VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id                BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    shift_type             VARCHAR(20) NOT NULL DEFAULT 'day' CHECK (shift_type IN ('day', 'night')),
    total_sessions         INTEGER NOT NULL DEFAULT 0,
    responded_sessions     INTEGER NOT NULL DEFAULT 0,
    timeout_sessions       INTEGER NOT NULL DEFAULT 0,
    avg_first_response_sec NUMERIC(8,2) NOT NULL DEFAULT 0,
    inquiry_buyers         INTEGER NOT NULL DEFAULT 0,
    converted_buyers       INTEGER NOT NULL DEFAULT 0,
    converted_gmv          NUMERIC(14,2) NOT NULL DEFAULT 0,
    satisfaction_rate      NUMERIC(5,2) NOT NULL DEFAULT 95.00,
    notes                  TEXT NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_date, agent_id, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_cs_session_date_platform
    ON public.fact_cs_session(session_date DESC, platform_code);

-- ────────────────────────────────────────────────────────────
-- 6. 系统模块与角色权限配置 (配合前端 fail-closed Sidebar)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.system_modules (code, name, icon, sort_order, visible_to) VALUES
    ('product_center',   '商品主数据中心',   'Package',       20, '{}'),
    ('fulfillment',      '履约SLA与赔付风控','Clock',         21, '{}'),
    ('after_sales',      '售后工单与原因归因','Undo2',         22, '{}'),
    ('kol',              '达人合作与佣金台账','Users',         23, '{}'),
    ('customer_service', '客服会话与响应绩效','MessageSquare', 24, '{}'),
    ('agency',           'MCN代运营管理',    'Building2',     25, '{super_admin,admin,ops_director,finance}')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    visible_to = EXCLUDED.visible_to;

INSERT INTO public.role_modules (role_code, module_code)
SELECT r_code, m_code
FROM (VALUES
    ('super_admin',  'product_center'),
    ('super_admin',  'fulfillment'),
    ('super_admin',  'after_sales'),
    ('super_admin',  'kol'),
    ('super_admin',  'customer_service'),
    ('super_admin',  'agency'),
    ('admin',        'product_center'),
    ('admin',        'system_inventory'),
    ('admin',        'fulfillment'),
    ('admin',        'after_sales'),
    ('admin',        'kol'),
    ('admin',        'customer_service'),
    ('admin',        'agency'),
    ('ops_director', 'product_center'),
    ('ops_director', 'system_inventory'),
    ('ops_director', 'fulfillment'),
    ('ops_director', 'after_sales'),
    ('ops_director', 'kol'),
    ('ops_director', 'customer_service'),
    ('ops_director', 'agency'),
    ('ops_staff',    'product_center'),
    ('ops_staff',    'fulfillment'),
    ('ops_staff',    'after_sales'),
    ('ops_staff',    'kol'),
    ('ops_staff',    'customer_service'),
    ('operator',     'product_center'),
    ('operator',     'system_inventory'),
    ('operator',     'fulfillment'),
    ('operator',     'after_sales'),
    ('operator',     'kol'),
    ('operator',     'customer_service'),
    ('finance',      'product_center'),
    ('finance',      'kol'),
    ('finance',      'agency')
) AS t(r_code, m_code)
WHERE EXISTS (SELECT 1 FROM public.roles r WHERE r.code = t.r_code)
  AND EXISTS (SELECT 1 FROM public.system_modules m WHERE m.code = t.m_code)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 7. 初始化基础业务台账（仅针对新增独立业务链，不触碰 fact_trade_daily）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.dim_product (spu_code, sku_code, product_name, category, brand_name, unit_cost, retail_price, safety_stock)
VALUES
    ('SPU-2026-001', 'SKU-2026-001-BLK-M', '三防冲锋衣（曜石黑 / M）',     '户外服饰', 'Leyova自营', 128.00, 399.00, 50),
    ('SPU-2026-001', 'SKU-2026-001-BLK-L', '三防冲锋衣（曜石黑 / L）',     '户外服饰', 'Leyova自营', 128.00, 399.00, 50),
    ('SPU-2026-002', 'SKU-2026-002-IVO-M', '美利奴羊毛打底衫（象牙白 / M）','针织内搭', 'Leyova自营',  72.00, 229.00, 40),
    ('SPU-2026-003', 'SKU-2026-003-GRY-F', '加绒德绒阔腿裤（浅雾灰 / 均码）','女装下装', 'Leyova自营',  54.00, 169.00, 35),
    ('SPU-2026-004', 'SKU-2026-004-KHK-L', '轻量羽绒马甲（卡其 / L）',       '羽绒棉服', 'Leyova自营',  88.00, 269.00, 30),
    ('SPU-2026-005', 'SKU-2026-005-WHT-F', '零感玻尿酸保湿面膜（5片/盒）', '美妆个护', 'Leyova甄选',  18.50,  79.00, 80)
ON CONFLICT (sku_code) DO NOTHING;

-- 跨平台 SKU 映射
INSERT INTO public.dim_sku_mapping (product_id, platform_code, shop_id, platform_item_id, platform_sku_id, platform_sku_name)
SELECT p.id, v.platform_code, v.shop_id, v.item_id, v.psku_id, p.product_name
FROM (VALUES
    ('SKU-2026-001-BLK-M', 'douyin',      1::bigint, 'DY-ITEM-9001', 'DY-SKU-9001-M'),
    ('SKU-2026-001-BLK-M', 'taobao',      2::bigint, 'TB-ITEM-8101', 'TB-SKU-8101-M'),
    ('SKU-2026-001-BLK-M', 'pdd',         5::bigint, 'PDD-ITEM-7101','PDD-SKU-7101-M'),
    ('SKU-2026-002-IVO-M', 'douyin',      1::bigint, 'DY-ITEM-9002', 'DY-SKU-9002-M'),
    ('SKU-2026-002-IVO-M', 'kuaishou',    6::bigint, 'KS-ITEM-6102', 'KS-SKU-6102-M'),
    ('SKU-2026-005-WHT-F', 'xiaohongshu', 7::bigint, 'XHS-ITEM-5105','XHS-SKU-5105-F')
) AS v(sku_code, platform_code, shop_id, item_id, psku_id)
JOIN public.dim_product p ON p.sku_code = v.sku_code
WHERE EXISTS (SELECT 1 FROM public.dim_shop s WHERE s.id = v.shop_id)
ON CONFLICT (platform_code, shop_id, platform_sku_id) DO NOTHING;

-- 库存实时快照
INSERT INTO public.fact_inventory_stock (product_id, warehouse_code, warehouse_name, shop_id, on_hand_qty, locked_qty, in_transit_qty, safety_stock)
SELECT p.id, v.wh_code, v.wh_name, v.shop_id, v.on_hand, v.locked, v.transit, p.safety_stock
FROM (VALUES
    ('SKU-2026-001-BLK-M', 'MAIN_WH', '华东中心仓', 1::bigint, 145, 22, 60),
    ('SKU-2026-001-BLK-L', 'MAIN_WH', '华东中心仓', 1::bigint,  38, 12, 50),
    ('SKU-2026-002-IVO-M', 'MAIN_WH', '华东中心仓', 2::bigint,  92,  8,  0),
    ('SKU-2026-003-GRY-F', 'MAIN_WH', '华东中心仓', 5::bigint,  24,  9, 40),
    ('SKU-2026-004-KHK-L', 'SOUTH_WH','华南前置仓', 6::bigint,  64,  6,  0),
    ('SKU-2026-005-WHT-F', 'MAIN_WH', '华东中心仓', 7::bigint, 260, 15,100)
) AS v(sku_code, wh_code, wh_name, shop_id, on_hand, locked, transit)
JOIN public.dim_product p ON p.sku_code = v.sku_code
ON CONFLICT (product_id, warehouse_code) DO NOTHING;

-- 运单履约 SLA（含拼多多超48h+3元定额券、快手虚假发货1%上下限3-30元、抖音24h揽收预警示例）
INSERT INTO public.fact_fulfillment_waybill
    (platform_code, shop_id, order_no, waybill_no, carrier_code, product_id, order_amount, is_custom_presale,
     paid_at, ship_deadline_at, shipped_at, pickup_at, signed_at, fulfillment_status,
     is_ship_delayed, is_fake_ship_risk, estimated_penalty_amount, sla_risk_reason)
SELECT
    v.platform_code, v.shop_id, v.order_no, v.waybill_no, v.carrier_code, p.id, v.order_amount, v.is_custom,
    v.paid_at, v.ship_deadline_at, v.shipped_at, v.pickup_at, v.signed_at, v.f_status,
    v.delayed, v.fake_ship, v.penalty, v.risk_reason
FROM (VALUES
    ('pdd', 5::bigint, 'PDD-20261110-1001', NULL, 'YTO', 'SKU-2026-003-GRY-F', 169.00, false,
     NOW() - INTERVAL '52 hours', NOW() - INTERVAL '4 hours', NULL::timestamptz, NULL::timestamptz, NULL::timestamptz,
     'pending_ship', true, false, 3.00, '拼多多超时未发货（已过48h线），预计赔付3元无门槛延迟券'),
    ('kuaishou', 6::bigint, 'KS-20261110-2002', 'SF1688990022', 'SF', 'SKU-2026-002-IVO-M', 480.00, false,
     NOW() - INTERVAL '40 hours', NOW() + INTERVAL '8 hours', NOW() - INTERVAL '27 hours', NULL::timestamptz, NULL::timestamptz,
     'shipped_no_pickup', false, true, 4.80, '快手上传单号超24h未见物流首条揽收轨迹，虚假发货风险（1%赔付约¥4.80，范围¥3-¥30）'),
    ('douyin', 1::bigint, 'DY-20261111-3003', 'ZTO7800112233', 'ZTO', 'SKU-2026-001-BLK-M', 399.00, false,
     NOW() - INTERVAL '20 hours', NOW() + INTERVAL '28 hours', NOW() - INTERVAL '14 hours', NOW() - INTERVAL '10 hours', NULL::timestamptz,
     'in_transit', false, false, 0.00, ''),
    ('jd', 4::bigint, 'JD-20261109-4004', 'JDV9900887766', 'JD', 'SKU-2026-004-KHK-L', 269.00, false,
     NOW() - INTERVAL '60 hours', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '50 hours', NOW() - INTERVAL '46 hours', NOW() - INTERVAL '6 hours',
     'signed', false, false, 0.00, '')
) AS v(platform_code, shop_id, order_no, waybill_no, carrier_code, sku_code, order_amount, is_custom,
       paid_at, ship_deadline_at, shipped_at, pickup_at, signed_at, f_status, delayed, fake_ship, penalty, risk_reason)
JOIN public.dim_product p ON p.sku_code = v.sku_code
WHERE EXISTS (SELECT 1 FROM public.dim_shop s WHERE s.id = v.shop_id)
ON CONFLICT (platform_code, shop_id, order_no) DO NOTHING;

-- 售后退货原因归因与工单（并向 canonical_refund_events 写入对应标准退款事件）
INSERT INTO public.fact_after_sale_tickets
    (ticket_no, platform_code, shop_id, source_order_id, source_refund_id, product_id, refund_type,
     refund_amount, reason_category, reason_detail, ticket_status, shop_experience_score, autonomy_protected,
     audit_deadline_at, applied_at)
SELECT
    v.ticket_no, v.platform_code, v.shop_id, v.order_id, v.refund_id, p.id, v.r_type,
    v.r_amount, v.r_cat, v.r_detail, v.t_status, v.exp_score, v.autonomy, v.deadline_at, v.applied_at
FROM (VALUES
    ('AS-20261111-001', 'kuaishou', 6::bigint, 'KS-20261108-8801', 'RFD-KS-8801', 'SKU-2026-002-IVO-M',
     'only_refund', 229.00, 'size_mismatch', '买家反馈M码偏紧申请仅退款协商换码', 'pending_audit', 4.76, true,
     NOW() + INTERVAL '6 hours', NOW() - INTERVAL '18 hours'),
    ('AS-20261111-002', 'kuaishou', 6::bigint, 'KS-20261108-8802', 'RFD-KS-8802', 'SKU-2026-004-KHK-L',
     'return_refund', 269.00, 'buyer_remorse', '7天无理由退货退款', 'waiting_return', 4.76, true,
     NOW() + INTERVAL '22 hours', NOW() - INTERVAL '14 hours'),
    ('AS-20261111-003', 'pdd', 5::bigint, 'PDD-20261110-1001', 'RFD-PDD-1001', 'SKU-2026-003-GRY-F',
     'only_refund', 169.00, 'logistics_slow', '发货超48小时未揽收发起仅退款', 'pending_audit', 4.55, false,
     NOW() + INTERVAL '12 hours', NOW() - INTERVAL '10 hours'),
    ('AS-20261110-004', 'douyin', 1::bigint, 'DY-20261107-7701', 'RFD-DY-7701', 'SKU-2026-001-BLK-L',
     'return_refund', 399.00, 'quality_defect', '拉链卡顿退回重发，已完成质检退款', 'closed', 4.88, true,
     NOW() - INTERVAL '12 hours', NOW() - INTERVAL '36 hours')
) AS v(ticket_no, platform_code, shop_id, order_id, refund_id, sku_code, r_type, r_amount, r_cat, r_detail, t_status, exp_score, autonomy, deadline_at, applied_at)
JOIN public.dim_product p ON p.sku_code = v.sku_code
WHERE EXISTS (SELECT 1 FROM public.dim_shop s WHERE s.id = v.shop_id)
ON CONFLICT (ticket_no) DO NOTHING;

INSERT INTO public.canonical_refund_events
    (biz_date, source_platform, store_id, source_refund_id, source_order_id, refund_type, refund_amount, refund_status, refunded_at_source, maturity_status)
SELECT
    t.applied_at::date, t.platform_code, t.shop_id, t.source_refund_id, t.source_order_id, t.refund_type, t.refund_amount,
    t.ticket_status, t.applied_at, CASE WHEN t.ticket_status = 'closed' THEN 'FINAL' ELSE 'PENDING' END
FROM public.fact_after_sale_tickets t
WHERE t.applied_at::date >= '2026-08-01'::date AND t.applied_at::date < '2027-07-01'::date
ON CONFLICT (biz_date, source_platform, store_id, source_refund_id) DO NOTHING;

-- 达人档案与佣金台账
INSERT INTO public.dim_kol (kol_name, platform_code, platform_uid, tier, fans_count, category, contact_info, default_commission_rate)
VALUES
    ('林小鹿穿搭日记', 'xiaohongshu', 'XHS-992018', 'waist', 285000, '户外都市穿搭', '微信：linxiaolu_mcn', 0.1800),
    ('山野阿哲测评',   'douyin',      'DY-551029',  'head',  1250000,'机能户外实测', '微信：azhe_studio',  0.1500),
    ('南风好物社',     'kuaishou',    'KS-338810',  'waist', 420000, '家庭性价比服饰','电话：13800138011', 0.2000),
    ('苏苏护肤研究所', 'xiaohongshu', 'XHS-774120', 'tail',   68000, '平价功效护肤', '微信：susu_lab',     0.2200)
ON CONFLICT (platform_code, kol_name) DO NOTHING;

INSERT INTO public.fact_kol_cooperation
    (kol_id, platform_code, shop_id, product_id, coop_type, campaign_name, publish_date,
     pit_fee, commission_rate, gmv, refund_amount, commission_amount, settlement_status)
SELECT
    k.id, v.platform_code, v.shop_id, p.id, v.coop_type, v.campaign_name, CURRENT_DATE - v.days_ago,
    v.pit_fee, v.c_rate, v.gmv, v.refund_amt, ROUND(GREATEST(v.gmv - v.refund_amt, 0) * v.c_rate, 2), v.s_status
FROM (VALUES
    ('山野阿哲测评',   'douyin',      1::bigint, 'SKU-2026-001-BLK-M', 'live_slot',   '双11冲锋衣专场挂车', 3, 8000.00, 0.1500, 148000.00, 11200.00, 'confirmed'),
    ('林小鹿穿搭日记', 'xiaohongshu', 7::bigint, 'SKU-2026-002-IVO-M', 'xhs_note',    '秋冬通勤羊绒搭配图文', 5, 3200.00, 0.1800,  42600.00,  2100.00, 'pending'),
    ('南风好物社',     'kuaishou',    6::bigint, 'SKU-2026-003-GRY-F', 'live_slot',   '快手秋装源头好货专场', 7, 2500.00, 0.2000,  68400.00,  4900.00, 'paid'),
    ('苏苏护肤研究所', 'xiaohongshu', 7::bigint, 'SKU-2026-005-WHT-F', 'cps_only',    '玻尿酸急救面膜种草',   2,    0.00, 0.2200,  19500.00,   650.00, 'pending')
) AS v(kol_name, platform_code, shop_id, sku_code, coop_type, campaign_name, days_ago, pit_fee, c_rate, gmv, refund_amt, s_status)
JOIN public.dim_kol k ON k.kol_name = v.kol_name AND k.platform_code = v.platform_code
JOIN public.dim_product p ON p.sku_code = v.sku_code
WHERE EXISTS (SELECT 1 FROM public.dim_shop s WHERE s.id = v.shop_id)
  AND NOT EXISTS (
      SELECT 1 FROM public.fact_kol_cooperation fk WHERE fk.kol_id = k.id AND fk.campaign_name = v.campaign_name
  );

-- 客服坐席与会话响应绩效
INSERT INTO public.dim_cs_agent (agent_code, agent_name, platform_code, shop_id, shift_group, status)
VALUES
    ('CS-DY-01', '林夏',   'douyin', 1, 'day',   'online'),
    ('CS-JD-01', '陈默',   'jd',     4, 'day',   'online'),
    ('CS-PDD-01','周暖',   'pdd',    5, 'night', 'online'),
    ('CS-KS-01', '许晴',   'kuaishou',6,'day',   'busy')
ON CONFLICT (agent_code) DO NOTHING;

INSERT INTO public.fact_cs_session
    (session_date, agent_id, platform_code, shop_id, shift_type, total_sessions, responded_sessions,
     timeout_sessions, avg_first_response_sec, inquiry_buyers, converted_buyers, converted_gmv, satisfaction_rate)
SELECT
    CURRENT_DATE - v.days_ago, a.id, a.platform_code, a.shop_id, v.shift_type,
    v.total_s, v.resp_s, v.timeout_s, v.avg_sec, v.inq_b, v.conv_b, v.conv_gmv, v.sat_rate
FROM (VALUES
    ('CS-DY-01', 0, 'day',   186, 184,  4, 16.5, 142, 48, 19152.00, 97.20),
    ('CS-JD-01', 0, 'day',   124, 124,  2, 11.8,  96, 39, 12870.00, 98.40),
    ('CS-PDD-01',0, 'night', 215, 208, 14, 24.3, 178, 52,  9240.00, 93.80),
    ('CS-KS-01', 0, 'day',   132, 128,  7, 19.6, 105, 34, 10680.00, 95.50),
    ('CS-DY-01', 1, 'day',   204, 201,  5, 17.2, 160, 53, 21040.00, 96.90),
    ('CS-JD-01', 1, 'day',   138, 137,  3, 12.4, 110, 44, 14320.00, 98.10)
) AS v(agent_code, days_ago, shift_type, total_s, resp_s, timeout_s, avg_sec, inq_b, conv_b, conv_gmv, sat_rate)
JOIN public.dim_cs_agent a ON a.agent_code = v.agent_code
ON CONFLICT (session_date, agent_id, shift_type) DO NOTHING;

COMMIT;
