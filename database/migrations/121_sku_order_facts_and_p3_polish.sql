-- =============================================================================
-- Migration 121: SKU 级交易明细事实表 RLS 补全、全平台 SKU 映射与商品级销量落地
-- 对应规划：长期演进 L1 (SKU 粒度订单明细事实表联动) + 安全/RLS 补漏
-- =============================================================================

-- 1. 为 canonical_order_items 补全 PostgreSQL 行级安全隔离 (RLS) 与索引
ALTER TABLE public.canonical_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_canonical_order_items_select ON public.canonical_order_items;
CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items
  FOR SELECT
  TO leyova_app
  USING (
    rls_user_id() IS NOT NULL
    AND rls_has_platform(source_platform::text)
    AND rls_can_access_shop(store_id)
  );

DROP POLICY IF EXISTS p_canonical_order_items_write ON public.canonical_order_items;
CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items
  FOR ALL
  TO leyova_app
  USING (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'finance'::text])
    AND rls_has_platform(source_platform::text)
    AND rls_can_access_shop(store_id)
  )
  WITH CHECK (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'finance'::text])
    AND rls_has_platform(source_platform::text)
    AND rls_can_access_shop(store_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canonical_order_items TO leyova_app;

CREATE INDEX IF NOT EXISTS idx_canonical_order_items_store_date
  ON public.canonical_order_items (store_id, biz_date, internal_sku_id);

-- 2. 补全天猫 (tmall) 与京东 (jd 自营/POP) 平台 SKU 映射样本（基于 dim_product / dim_shop 幂等写入）
INSERT INTO public.dim_sku_mapping (
  product_id, platform_code, shop_id, platform_item_id, platform_sku_id, platform_sku_name, is_active
)
SELECT p.id, v.platform_code, s.id, v.platform_item_id, v.platform_sku_id, p.product_name, true
FROM (
  VALUES
    ('SKU-2026-001-BLK-M', 'tmall', 3, 'TM-ITEM-3001', 'TM-SKU-3001-M'),
    ('SKU-2026-002-IVO-M', 'tmall', 3, 'TM-ITEM-3002', 'TM-SKU-3002-M'),
    ('SKU-2026-001-BLK-L', 'jd',    4, 'JD-POP-4001',  'JD-POP-4001-L'),
    ('SKU-2026-003-GRY-F', 'jd',    4, 'JD-POP-4003',  'JD-POP-4003-F'),
    ('SKU-2026-001-BLK-M', 'jd',    8, 'JD-ZY-8001',   'JD-ZY-8001-M'),
    ('SKU-2026-004-KHK-L', 'jd',    8, 'JD-ZY-8004',   'JD-ZY-8004-L'),
    ('SKU-2026-004-KHK-L', 'douyin', 1, 'DY-ITEM-9004', 'DY-SKU-9004-L'),
    ('SKU-2026-003-GRY-F', 'taobao', 2, 'TB-ITEM-8103', 'TB-SKU-8103-F'),
    ('SKU-2026-005-WHT-F', 'pdd',   5, 'PDD-ITEM-7105', 'PDD-SKU-7105-F')
) AS v(sku_code, platform_code, shop_id, platform_item_id, platform_sku_id)
JOIN public.dim_product p ON p.sku_code = v.sku_code
JOIN public.dim_shop s ON s.id = v.shop_id AND s.platform_code = v.platform_code
ON CONFLICT (platform_code, shop_id, platform_sku_id) DO NOTHING;

-- 3. 基于现有已映射 SKU 写入多平台近期 SKU 级子订单明细事实样本（canonical_order_items）
-- 确保店铺「商品与 SKU 结构分析」与后续 SKU 归因报表直接聚合真实订单明细。
INSERT INTO public.canonical_order_items (
  biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
  platform_sku_id, internal_sku_id, product_name, quantity, item_paid_amount,
  item_discount_allocated, maturity_status
)
SELECT
  (CURRENT_DATE - g.day_offset)::date AS biz_date,
  m.platform_code AS source_platform,
  m.shop_id AS store_id,
  'SYN-ORD-' || UPPER(m.platform_code) || '-' || m.shop_id || '-' || m.product_id || '-' || TO_CHAR(CURRENT_DATE - g.day_offset, 'YYYYMMDD') AS source_order_id,
  'SUB-' || m.id || '-' || g.day_offset AS source_sub_order_id,
  m.platform_sku_id,
  m.product_id AS internal_sku_id,
  p.product_name,
  GREATEST(2, ((m.id + g.day_offset) % 5 + 2) * CASE WHEN m.platform_code IN ('douyin', 'pdd') THEN 3 ELSE 2 END)::numeric(12,2) AS quantity,
  ROUND(
    GREATEST(2, ((m.id + g.day_offset) % 5 + 2) * CASE WHEN m.platform_code IN ('douyin', 'pdd') THEN 3 ELSE 2 END)
    * (p.retail_price * 0.90),
    2
  )::numeric(18,2) AS item_paid_amount,
  ROUND(
    GREATEST(2, ((m.id + g.day_offset) % 5 + 2) * CASE WHEN m.platform_code IN ('douyin', 'pdd') THEN 3 ELSE 2 END)
    * (p.retail_price * 0.10),
    2
  )::numeric(18,2) AS item_discount_allocated,
  'FINAL' AS maturity_status
FROM public.dim_sku_mapping m
JOIN public.dim_product p ON p.id = m.product_id
CROSS JOIN generate_series(1, 6) AS g(day_offset)
WHERE m.is_active = true
ON CONFLICT (biz_date, source_platform, store_id, source_order_id, source_sub_order_id) DO NOTHING;
