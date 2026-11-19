-- Migration 167: 兼容旧演示数据脚本的 session_product_skus 视图写入
--
-- 背景（2026-11-17 发现，非本次重构引入）：
--   session_product_skus 在 P3 架构收敛（11-15）中由「表」改为「视图」，
--   派生自 session_plan_products.sku_snapshot_jsonb。
--   但 database/04b_demo_data_v2_facts.sql（11-14）仍在向其 INSERT 旧格式数据，
--   导致官方演示数据重建脚本 reset-demo-v2.sh 报错中断。
--
-- 方案：加 INSTEAD OF INSERT 触发器做兼容层，把旧格式写入转为 session_plan_products 行。
--   视图定义中 product_id 即 session_plan_products.id，故可直接映射。
--   不影响业务代码路径（业务侧读视图）。

CREATE OR REPLACE FUNCTION public.session_product_skus_insert() RETURNS trigger AS $$
BEGIN
  -- 语义约束要求 (product_id + product_name) 或 (plan_id + product_code) 二者其一，
  -- 旧格式数据仅带 product_id，故补一个占位 product_name 以满足约束。
  INSERT INTO public.session_plan_products (
    id, product_id, product_name, payment_amount, sold_count, buyer_count, order_count,
    sku_snapshot_jsonb, created_at
  ) VALUES (
    NEW.id,
    NEW.product_id,
    COALESCE(NEW.sku_name, '标准款'),
    COALESCE(NEW.payment_amount, 0),
    COALESCE(NEW.sold_count, 0),
    COALESCE(NEW.buyer_count, 0),
    COALESCE(NEW.order_count, 0),
    jsonb_build_object('sku_name', COALESCE(NEW.sku_name, '标准款')),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    payment_amount = EXCLUDED.payment_amount,
    sold_count      = EXCLUDED.sold_count,
    buyer_count     = EXCLUDED.buyer_count,
    order_count     = EXCLUDED.order_count;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS session_product_skus_insert_trg ON public.session_product_skus;
CREATE TRIGGER session_product_skus_insert_trg
  INSTEAD OF INSERT ON public.session_product_skus
  FOR EACH ROW EXECUTE FUNCTION public.session_product_skus_insert();
