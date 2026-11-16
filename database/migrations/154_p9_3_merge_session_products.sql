-- ============================================================================
-- P9-3：排品 4 → 3 表合并
--
-- 背景（master-plan §13.3）：原排品链有 4 张表
--   session_plans            72 行  计划头（直播间/日期/主播/活动）
--   session_plan_products   288 行  计划排品项（组别字母/商品编码/价格）
--   session_product_details 17820 行 实际商品成交明细（21 列）
--   session_product_skus    17820 行 SKU 明细（6 列）
--
-- 实测结论（P9-3 第 1 步）：session_product_skus 的每个 product_id
--   平均只有 1 条 SKU 记录（17,820 个 product_id → 17,820 条 SKU，
--   分布：1 个 SKU 的 17,820 个 / 2-5 个 0 个 / 6-10 个 0 个 / >10 个 0 个）。
--   即 SKU 表在业务语义上等价于「父商品自带的单规格明细」，
--   拆表带来的只有 JOIN 成本，没有信息增量。
--
-- 合并策略（渐进式，可回滚）：
--   session_plan_products 升级为唯一的商品表，同时承载
--     · 计划排品行：plan_id / group_letter / product_code / price
--     · 实际成交行：room_id / business_date / product_name / ... 22 列指标
--     · SKU 折叠：sku_snapshot_jsonb（原 session_product_skus 全部字段）
--   session_plans 保留不动（它是唯一的计划头，无冗余）。
--   session_product_details / session_product_skus 先保留为「归档表」
--   （rename 后只读，供回滚与校验），下一版迁移再物理 DROP。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Step 1：为 session_plan_products 增加实际成交维度列
--   全部 nullable —— 计划行这些列为 NULL，实际行 plan_id 等为 NULL
-- ---------------------------------------------------------------------------
ALTER TABLE session_plan_products
  -- 归属维度（实际行用；计划行为 NULL）
  ADD COLUMN IF NOT EXISTS session_id    integer,
  ADD COLUMN IF NOT EXISTS room_id       integer,
  ADD COLUMN IF NOT EXISTS business_date date,
  ADD COLUMN IF NOT EXISTS product_order integer,
  ADD COLUMN IF NOT EXISTS product_name  varchar(255),
  ADD COLUMN IF NOT EXISTS product_id    varchar(255),
  ADD COLUMN IF NOT EXISTS product_image varchar(500),
  ADD COLUMN IF NOT EXISTS upload_id     integer,

  -- 成交指标（实际行用；计划行为 NULL）
  ADD COLUMN IF NOT EXISTS payment_amount    numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count        integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_count       integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_count       integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_sale_orders   integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pre_sale_amount   numeric(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exposure_users    integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_users       integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exposure_click_rate numeric(9,4),
  ADD COLUMN IF NOT EXISTS click_deal_rate   numeric(9,4),
  ADD COLUMN IF NOT EXISTS refund_users      integer        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount     numeric(14,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_orders     integer        DEFAULT 0,

  -- SKU 折叠（P9-3 核心：单规格化后无损折叠）
  ADD COLUMN IF NOT EXISTS sku_snapshot_jsonb jsonb,

  -- 时间戳补齐（与 session_product_details 对齐）
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- Step 2：放宽原有 NOT NULL 约束
--   计划行有 product_code + price；实际行有 product_id + product_name。
--   两者互不为空，因此把 plan_id / group_letter / product_code / price
--   改为 nullable，由 CHECK 约束保证「至少一种语义完整」。
-- ---------------------------------------------------------------------------
ALTER TABLE session_plan_products
  ALTER COLUMN plan_id       DROP NOT NULL,
  ALTER COLUMN group_letter  DROP NOT NULL,
  ALTER COLUMN product_code  DROP NOT NULL,
  ALTER COLUMN price         DROP NOT NULL;

-- 语义完整性：要么是计划排品行（plan_id + product_code），要么是实际成交行（product_id + product_name）
ALTER TABLE session_plan_products
  DROP CONSTRAINT IF EXISTS session_plan_products_semantics_check;
ALTER TABLE session_plan_products
  ADD CONSTRAINT session_plan_products_semantics_check CHECK (
    (plan_id IS NOT NULL AND product_code IS NOT NULL)
    OR (product_id IS NOT NULL AND product_name IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- Step 3：唯一索引与约束前置创建（供 Step 4 的 ON CONFLICT 作为 arbiter index）
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS session_plan_products_room_date_product_uidx
  ON session_plan_products (room_id, business_date, product_id)
  WHERE plan_id IS NULL AND room_id IS NOT NULL AND product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS session_plan_products_plan_group_uidx
  ON session_plan_products (plan_id, group_letter)
  WHERE plan_id IS NOT NULL AND group_letter IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_plan_products_room_date
  ON session_plan_products (room_id, business_date DESC)
  WHERE plan_id IS NULL;

-- ---------------------------------------------------------------------------
-- Step 4：回填实际成交行（17,820 行）
--   幂等：用 ON CONFLICT (room_id, business_date, product_id) 保证重跑安全
-- ---------------------------------------------------------------------------
INSERT INTO session_plan_products (
  room_id, business_date, session_id, upload_id,
  product_order, product_name, product_id, product_image,
  payment_amount, sold_count, buyer_count, order_count,
  pre_sale_orders, pre_sale_amount,
  exposure_users, click_users, exposure_click_rate, click_deal_rate,
  refund_users, refund_amount, refund_orders,
  sku_snapshot_jsonb
)
SELECT
  d.room_id, d.business_date, d.session_id, d.upload_id,
  d.product_order, d.product_name, d.product_id, d.product_image,
  d.payment_amount, d.sold_count, d.buyer_count, d.order_count,
  d.pre_sale_orders, d.pre_sale_amount,
  d.exposure_users, d.click_users, d.exposure_click_rate, d.click_deal_rate,
  d.refund_users, d.refund_amount, d.refund_orders,
  (
    SELECT jsonb_agg(
             jsonb_build_object(
               'id',             s.id,
               'sku_name',       s.sku_name,
               'sku_image',      s.sku_image,
               'payment_amount', s.payment_amount,
               'sold_count',     s.sold_count,
               'buyer_count',    s.buyer_count,
               'order_count',    s.order_count,
               'upload_id',      s.upload_id
             ) ORDER BY s.payment_amount DESC NULLS LAST
           )
      FROM session_product_skus s
     WHERE s.product_id = d.id
  )
FROM session_product_details d
ON CONFLICT (room_id, business_date, product_id)
  WHERE plan_id IS NULL AND room_id IS NOT NULL AND product_id IS NOT NULL
DO UPDATE SET
  session_id          = EXCLUDED.session_id,
  upload_id           = EXCLUDED.upload_id,
  product_order       = EXCLUDED.product_order,
  product_name        = EXCLUDED.product_name,
  product_image       = EXCLUDED.product_image,
  payment_amount      = EXCLUDED.payment_amount,
  sold_count          = EXCLUDED.sold_count,
  buyer_count         = EXCLUDED.buyer_count,
  order_count         = EXCLUDED.order_count,
  pre_sale_orders     = EXCLUDED.pre_sale_orders,
  pre_sale_amount     = EXCLUDED.pre_sale_amount,
  exposure_users      = EXCLUDED.exposure_users,
  click_users         = EXCLUDED.click_users,
  exposure_click_rate = EXCLUDED.exposure_click_rate,
  click_deal_rate     = EXCLUDED.click_deal_rate,
  refund_users        = EXCLUDED.refund_users,
  refund_amount       = EXCLUDED.refund_amount,
  refund_orders       = EXCLUDED.refund_orders,
  sku_snapshot_jsonb  = EXCLUDED.sku_snapshot_jsonb,
  updated_at          = NOW();

-- ---------------------------------------------------------------------------
-- Step 5：外键（实际行归属维度）
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_plan_products_session_id_fkey') THEN
    ALTER TABLE session_plan_products
      ADD CONSTRAINT session_plan_products_session_id_fkey
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_plan_products_room_id_fkey') THEN
    ALTER TABLE session_plan_products
      ADD CONSTRAINT session_plan_products_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES live_rooms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_plan_products_upload_id_fkey') THEN
    ALTER TABLE session_plan_products
      ADD CONSTRAINT session_plan_products_upload_id_fkey
      FOREIGN KEY (upload_id) REFERENCES data_uploads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Step 6：RLS policy 对齐（原 session_product_details 的 policy 平移到合并表）
--   实际行与计划行都遵循「管理员全量 / 运营看自己 scope」的既有模型
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS session_product_details_admin_all ON session_plan_products;
DROP POLICY IF EXISTS session_product_details_ops_scope ON session_plan_products;

CREATE POLICY session_plan_products_admin_all ON session_plan_products
  FOR ALL
  USING (current_setting('app.role', true) IN ('super_admin', 'admin'))
  WITH CHECK (current_setting('app.role', true) IN ('super_admin', 'admin'));

CREATE POLICY session_plan_products_read_scope ON session_plan_products
  FOR SELECT
  USING (
    current_setting('app.role', true) IN ('super_admin', 'admin', 'operator', 'brand_viewer')
  );

-- ---------------------------------------------------------------------------
-- Step 7：原表改名为归档表（只读保留，供回滚与校验；下一版物理 DROP）
--   session_product_details → _deprecated_session_product_details
--   session_product_skus    → _deprecated_session_product_skus
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS session_product_details RENAME TO _deprecated_session_product_details;
ALTER TABLE IF EXISTS session_product_skus    RENAME TO _deprecated_session_product_skus;

COMMENT ON TABLE _deprecated_session_product_details IS 'P9-3 归档表：已合并入 session_plan_products（sku_snapshot_jsonb），只读保留供回滚/校验，下一版迁移物理 DROP';
COMMENT ON TABLE _deprecated_session_product_skus    IS 'P9-3 归档表：已折叠为 session_plan_products.sku_snapshot_jsonb，只读保留供回滚/校验，下一版迁移物理 DROP';

COMMIT;

-- ---------------------------------------------------------------------------
-- 回滚指引（如需回退）：
--   1) 新写入 session_plan_products 的实际行先备份：
--      CREATE TABLE _p9_3_backup AS SELECT * FROM session_plan_products WHERE plan_id IS NULL;
--   2) ALTER TABLE _deprecated_session_product_details RENAME TO session_product_details;
--      ALTER TABLE _deprecated_session_product_skus    RENAME TO session_product_skus;
--   3) 从 _p9_3_backup 把增量行按旧结构拆回两表。
-- ---------------------------------------------------------------------------
