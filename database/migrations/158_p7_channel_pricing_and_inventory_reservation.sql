-- database/migrations/158_p7_channel_pricing_and_inventory_reservation.sql
-- Master Plan §5.2 #9 (Channel 级价格与库存) + #10 (库存预留防超卖) + §7.5 (fact_trade_daily 幂等版本与时间戳)
BEGIN;

-- 1. Channel 级价格与库存表 dim_product_channel_listing (Master Plan §5.2 #9)
CREATE TABLE IF NOT EXISTS public.dim_product_channel_listing (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.dim_product(id) ON DELETE CASCADE,
  platform_code VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  shop_id BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  channel_sku_id VARCHAR(100) NOT NULL,
  channel_price NUMERIC(10,2) NOT NULL,
  allocated_stock INT NOT NULL DEFAULT 0,
  reserved_stock INT NOT NULL DEFAULT 0,
  safety_stock INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_channel_listing_sku UNIQUE (shop_id, platform_code, channel_sku_id),
  CONSTRAINT chk_allocated_gte_reserved CHECK (allocated_stock >= reserved_stock)
);

CREATE INDEX IF NOT EXISTS idx_channel_listing_prod ON public.dim_product_channel_listing(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_listing_shop_platform ON public.dim_product_channel_listing(shop_id, platform_code);
CREATE INDEX IF NOT EXISTS idx_channel_listing_active ON public.dim_product_channel_listing(is_active);

-- 2. 库存预留表 fact_inventory_reservation (Master Plan §5.2 #10)
CREATE TABLE IF NOT EXISTS public.fact_inventory_reservation (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  reservation_no VARCHAR(64) NOT NULL UNIQUE,
  order_no VARCHAR(100) NOT NULL,
  product_id BIGINT NOT NULL REFERENCES public.dim_product(id) ON DELETE RESTRICT,
  platform_code VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  shop_id BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  warehouse_code VARCHAR(50) NOT NULL DEFAULT 'MAIN_WH',
  channel_listing_id BIGINT REFERENCES public.dim_product_channel_listing(id) ON DELETE SET NULL,
  reserved_qty INT NOT NULL CHECK (reserved_qty > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'committed', 'released')),
  expires_at TIMESTAMPTZ NOT NULL,
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  release_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_order ON public.fact_inventory_reservation(order_no);
CREATE INDEX IF NOT EXISTS idx_reservation_status_expires ON public.fact_inventory_reservation(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reservation_prod_wh ON public.fact_inventory_reservation(product_id, warehouse_code);
CREATE INDEX IF NOT EXISTS idx_reservation_shop_plat ON public.fact_inventory_reservation(shop_id, platform_code);

-- 3. fact_trade_daily 版本比较与时间戳加固 (Master Plan §7.5)
ALTER TABLE public.fact_trade_daily ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.fact_trade_daily ADD COLUMN IF NOT EXISTS batch_version BIGINT DEFAULT 1;

-- 4. RLS 强制安全策略
ALTER TABLE public.dim_product_channel_listing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dim_product_channel_listing FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fact_inventory_reservation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_inventory_reservation FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_dim_product_channel_listing_select ON public.dim_product_channel_listing;
CREATE POLICY p_dim_product_channel_listing_select ON public.dim_product_channel_listing FOR SELECT
  USING (
    (rls_user_id() IS NOT NULL)
    AND rls_has_platform(platform_code::text)
    AND rls_can_access_shop(shop_id)
  );

DROP POLICY IF EXISTS p_dim_product_channel_listing_write ON public.dim_product_channel_listing;
CREATE POLICY p_dim_product_channel_listing_write ON public.dim_product_channel_listing FOR ALL
  USING (
    rls_is_agency_staff()
    AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
    AND rls_has_platform(platform_code::text)
    AND rls_can_access_shop(shop_id)
  )
  WITH CHECK (
    rls_is_agency_staff()
    AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
    AND rls_has_platform(platform_code::text)
    AND rls_can_access_shop(shop_id)
  );

DROP POLICY IF EXISTS p_fact_inventory_reservation_select ON public.fact_inventory_reservation;
CREATE POLICY p_fact_inventory_reservation_select ON public.fact_inventory_reservation FOR SELECT
  USING (
    (rls_user_id() IS NOT NULL)
    AND rls_has_platform(platform_code::text)
    AND rls_can_access_shop(shop_id)
  );

DROP POLICY IF EXISTS p_fact_inventory_reservation_write ON public.fact_inventory_reservation;
CREATE POLICY p_fact_inventory_reservation_write ON public.fact_inventory_reservation FOR ALL
  USING (
    rls_is_agency_staff()
    AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
    AND rls_has_platform(platform_code::text)
    AND rls_can_access_shop(shop_id)
  )
  WITH CHECK (
    rls_is_agency_staff()
    AND (rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator']))
    AND rls_has_platform(platform_code::text)
    AND rls_can_access_shop(shop_id)
  );


COMMIT;
