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

