-- database/migrations/160_p7_order_event_stream_and_line_rma.sql
-- Master Plan §5.2 #12: 订单/退款事件流 (Order Event Stream) 与行级 RMA (Line-Level Return Merchandise Authorization)
BEGIN;

-- 1. 订单生命周期事件流水表 fact_order_event_stream (状态变更留痕与全生命周期审计)
CREATE TABLE IF NOT EXISTS public.fact_order_event_stream (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_platform VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  store_id BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  source_order_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN (
      'order_placed', 'payment_confirmed', 'inventory_locked', 'inventory_released',
      'shipped', 'delivered', 'rma_created', 'item_refunded', 'order_completed', 'order_closed'
    )
  ),
  from_status VARCHAR(50) NOT NULL DEFAULT '',
  to_status VARCHAR(50) NOT NULL,
  operator_type VARCHAR(30) NOT NULL DEFAULT 'system' CHECK (operator_type IN ('system', 'user', 'operator', 'staff', 'platform_webhook', 'customer_service')),
  operator_name VARCHAR(100) NOT NULL DEFAULT 'system',
  payload JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_lookup ON public.fact_order_event_stream(source_platform, store_id, source_order_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_order_events_type ON public.fact_order_event_stream(event_type, occurred_at);

-- 2. 行级售后退换单表 fact_order_rma_item (Line-level RMA: 支持子订单行精准退换、质检与自动回仓)
CREATE TABLE IF NOT EXISTS public.fact_order_rma_item (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  rma_no VARCHAR(64) NOT NULL UNIQUE,
  biz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_platform VARCHAR(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  store_id BIGINT NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  source_order_id VARCHAR(100) NOT NULL,
  source_sub_order_id VARCHAR(100) NOT NULL,
  internal_sku_id BIGINT REFERENCES public.dim_product(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  rma_type VARCHAR(30) NOT NULL CHECK (rma_type IN ('refund_only', 'return_and_refund', 'exchange')),
  return_quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (return_quantity > 0),
  refund_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  reason_category VARCHAR(50) NOT NULL CHECK (
    reason_category IN ('size_mismatch', 'quality_issue', 'change_mind', 'logistics_damage', 'fake_goods', 'wrong_item', 'other')
  ),
  reason_detail TEXT NOT NULL DEFAULT '',
  return_tracking_no VARCHAR(100) NOT NULL DEFAULT '',
  return_logistics_company VARCHAR(50) NOT NULL DEFAULT '',
  inspection_status VARCHAR(30) NOT NULL DEFAULT 'pending_inspection' CHECK (
    inspection_status IN ('pending_inspection', 'passed', 'failed_damaged', 'waived')
  ),
  restock_status VARCHAR(30) NOT NULL DEFAULT 'not_restocked' CHECK (
    restock_status IN ('not_restocked', 'restocked_to_warehouse', 'scrapped')
  ),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  handled_by VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rma_order_sub ON public.fact_order_rma_item(source_order_id, source_sub_order_id);
CREATE INDEX IF NOT EXISTS idx_rma_store_platform ON public.fact_order_rma_item(store_id, source_platform);
CREATE INDEX IF NOT EXISTS idx_rma_status ON public.fact_order_rma_item(status, inspection_status);

-- 3. RLS 强制隔离策略
ALTER TABLE public.fact_order_event_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_order_event_stream FORCE ROW LEVEL SECURITY;

ALTER TABLE public.fact_order_rma_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_order_rma_item FORCE ROW LEVEL SECURITY;

-- fact_order_event_stream RLS
DROP POLICY IF EXISTS p_order_event_stream_select ON public.fact_order_event_stream;
CREATE POLICY p_order_event_stream_select ON public.fact_order_event_stream
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    rls_has_platform(source_platform) AND
    rls_can_access_shop(store_id)
  );

DROP POLICY IF EXISTS p_order_event_stream_write ON public.fact_order_event_stream;
CREATE POLICY p_order_event_stream_write ON public.fact_order_event_stream
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'customer_service']) AND
    rls_has_platform(source_platform) AND
    rls_can_access_shop(store_id)
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'customer_service']) AND
    rls_has_platform(source_platform) AND
    rls_can_access_shop(store_id)
  );

-- fact_order_rma_item RLS
DROP POLICY IF EXISTS p_order_rma_item_select ON public.fact_order_rma_item;
CREATE POLICY p_order_rma_item_select ON public.fact_order_rma_item
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    rls_has_platform(source_platform) AND
    rls_can_access_shop(store_id)
  );

DROP POLICY IF EXISTS p_order_rma_item_write ON public.fact_order_rma_item;
CREATE POLICY p_order_rma_item_write ON public.fact_order_rma_item
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'customer_service']) AND
    rls_has_platform(source_platform) AND
    rls_can_access_shop(store_id)
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'customer_service']) AND
    rls_has_platform(source_platform) AND
    rls_can_access_shop(store_id)
  );

-- 4. 插入样本订单事件与行级 RMA 记录
DO $$
DECLARE
  v_plat VARCHAR(32);
  v_store_id BIGINT;
  v_order_id VARCHAR(100);
  v_sub_order_id VARCHAR(100);
  v_prod_id BIGINT;
  v_prod_name VARCHAR(255);
BEGIN
  -- 寻找已存在的订单明细行
  SELECT source_platform, store_id, source_order_id, source_sub_order_id, internal_sku_id, product_name
  INTO v_plat, v_store_id, v_order_id, v_sub_order_id, v_prod_id, v_prod_name
  FROM public.canonical_order_items
  ORDER BY id
  LIMIT 1;

  IF v_order_id IS NULL THEN
    SELECT platform_code, id INTO v_plat, v_store_id FROM public.dim_shop ORDER BY id LIMIT 1;
    v_order_id := 'ORD-DEMO-20261116-001';
    v_sub_order_id := 'SUB-DEMO-20261116-001-1';
    SELECT id, product_name INTO v_prod_id, v_prod_name FROM public.dim_product ORDER BY id LIMIT 1;
  END IF;

  IF v_store_id IS NOT NULL AND v_plat IS NOT NULL THEN
    -- 记录事件流
    INSERT INTO public.fact_order_event_stream (
      source_platform, store_id, source_order_id, event_type, from_status, to_status, operator_type, operator_name, payload, occurred_at
    ) VALUES
      (v_plat, v_store_id, v_order_id, 'order_placed', '', 'UNPAID', 'user', '买家', '{"channel": "live_room"}'::jsonb, now() - INTERVAL '3 hours'),
      (v_plat, v_store_id, v_order_id, 'payment_confirmed', 'UNPAID', 'PAID', 'platform_webhook', '平台收银台', '{"pay_amount": 259.00}'::jsonb, now() - INTERVAL '2 hours 55 minutes'),
      (v_plat, v_store_id, v_order_id, 'inventory_locked', 'PAID', 'WAIT_SHIP', 'system', '防超卖锁定引擎', '{"reserved_qty": 1}'::jsonb, now() - INTERVAL '2 hours 54 minutes'),
      (v_plat, v_store_id, v_order_id, 'shipped', 'WAIT_SHIP', 'SHIPPED', 'operator', '仓管员-张三', '{"tracking_no": "SF10839482910"}'::jsonb, now() - INTERVAL '1 hour'),
      (v_plat, v_store_id, v_order_id, 'rma_created', 'SHIPPED', 'RMA_PENDING', 'customer_service', '客服-李四', '{"rma_type": "return_and_refund", "reason": "size_mismatch"}'::jsonb, now() - INTERVAL '20 minutes');

    -- 创建对应的行级 RMA 记录
    INSERT INTO public.fact_order_rma_item (
      rma_no, biz_date, source_platform, store_id, source_order_id, source_sub_order_id,
      internal_sku_id, product_name, rma_type, return_quantity, refund_amount,
      reason_category, reason_detail, return_tracking_no, return_logistics_company,
      inspection_status, restock_status, status, handled_by
    ) VALUES (
      'RMA-20261116-0001', CURRENT_DATE, v_plat, v_store_id, v_order_id, v_sub_order_id,
      v_prod_id, COALESCE(v_prod_name, '户外冲锋衣标准款'), 'return_and_refund', 1, 259.00,
      'size_mismatch', '买家反馈尺码偏小，申请退货换大一码', 'JD9920194029', '京东物流',
      'pending_inspection', 'not_restocked', 'pending', '客服-李四'
    ) ON CONFLICT (rma_no) DO NOTHING;
  END IF;
END $$;

COMMIT;
