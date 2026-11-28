-- ============================================================================
-- 迁移 155：指标注册表（Metric Catalog）升级与统一真值源（P1）
-- ----------------------------------------------------------------------------
-- 解决痛点：
--   1. 全仓同一指标手写计算 17 遍（GMV / 退款率 / ROI 各处表达式微有不同）
--   2. 多口径混存导致裸 SUM 放大，需要单一真值源对齐口径
--   3. 统一指标元数据：字段归属、事实表映射、是否可累加、单位、计算公式
-- ============================================================================

BEGIN;

-- 1. 扩充 metric_definition 字段
ALTER TABLE public.metric_definition
  ADD COLUMN IF NOT EXISTS fact_table VARCHAR(32) DEFAULT 'trade',
  ADD COLUMN IF NOT EXISTS caliber VARCHAR(32) DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS version VARCHAR(16) DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'active';

-- 2. 补齐核心指标注册信息（交易、流量、广告、售后）
INSERT INTO public.metric_definition (
  metric_code, name, unit, category, formula, description,
  fact_table, is_additive, caliber, version, status
) VALUES
  ('gmv', '成交总额 (GMV)', '元', 'trade', 'COALESCE(SUM(f.gmv), 0)::numeric', '总订单销售金额（含退款）', 'trade', true, 'standard', 'v1', 'active'),
  ('pay_amount', '买家实付金额', '元', 'trade', 'COALESCE(SUM(f.pay_amount), 0)::numeric', '买家实际支付金额', 'trade', true, 'standard', 'v1', 'active'),
  ('net_sales', '净成交额', '元', 'trade', '(COALESCE(SUM(f.gmv), 0) - COALESCE(SUM(f.refund_amount), 0))::numeric', '成交总额减去退款金额', 'trade', true, 'standard', 'v1', 'active'),
  ('paid_order_count', '支付订单数', '单', 'trade', 'COALESCE(SUM(f.paid_order_count), 0)::int', '完成支付的订单笔数', 'trade', true, 'standard', 'v1', 'active'),
  ('paid_buyer_count', '支付买家数', '人', 'trade', 'COALESCE(SUM(f.paid_buyer_count), 0)::int', '独立支付买家数（非加总指标）', 'trade', false, 'standard', 'v1', 'active'),
  ('avg_order_value', '客单价 (AOV)', '元', 'trade', 'CASE WHEN SUM(f.paid_order_count) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.paid_order_count), 2) ELSE 0 END', '笔单价：总成交金额 / 支付订单数', 'trade', false, 'standard', 'v1', 'active'),
  ('refund_amount', '退款金额', '元', 'aftersale', 'COALESCE(SUM(f.refund_amount), 0)::numeric', '已产生退款退货金额', 'trade', true, 'standard', 'v1', 'active'),
  ('refund_count', '退款订单数', '单', 'aftersale', 'COALESCE(SUM(f.refund_count), 0)::int', '发生退款的订单笔数', 'trade', true, 'standard', 'v1', 'active'),
  ('refund_rate', '退款率', '%', 'aftersale', 'CASE WHEN SUM(f.gmv) > 0 THEN ROUND(SUM(f.refund_amount) / SUM(f.gmv) * 100, 2) ELSE 0 END', '退款金额占成交额百分比', 'trade', false, 'standard', 'v1', 'active'),
  ('impressions', '曝光展现量', '次', 'traffic', 'COALESCE(SUM(f.impressions), 0)::bigint', '商品或直播间总展现次数', 'traffic', true, 'standard', 'v1', 'active'),
  ('clicks', '点击量', '次', 'traffic', 'COALESCE(SUM(f.clicks), 0)::bigint', '点击进入人次', 'traffic', true, 'standard', 'v1', 'active'),
  ('visitors', '访客数 (UV)', '人', 'traffic', 'COALESCE(SUM(f.visitors), 0)::bigint', '独立访客数', 'traffic', true, 'standard', 'v1', 'active'),
  ('ctr', '点击率 (CTR)', '%', 'traffic', 'CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.clicks)::numeric / SUM(f.impressions) * 100, 2) ELSE 0 END', '点击量 / 展现量', 'traffic', false, 'standard', 'v1', 'active'),
  ('gpm', '千次展现成交 (GPM)', '元', 'traffic', 'CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.impressions) * 1000, 2) ELSE 0 END', '每千次曝光撬动的 GMV', 'traffic', false, 'standard', 'v1', 'active'),
  ('ad_spend', '投流花费', '元', 'ad', 'COALESCE(SUM(f.cost), 0)::numeric', '各平台商业化投放消耗总额', 'ad', true, 'standard', 'v1', 'active'),
  ('roi', '投产比 (ROI)', '', 'ad', 'CASE WHEN SUM(f.cost) > 0 THEN ROUND(SUM(f.gmv) / SUM(f.cost), 2) ELSE 0 END', '成交金额 / 投流花费', 'ad', false, 'standard', 'v1', 'active'),
  ('net_roi', '净利润投产比 (Net ROI)', '', 'ad', 'CASE WHEN SUM(f.cost) > 0 THEN ROUND((SUM(f.gmv) - SUM(f.refund_amount)) / SUM(f.cost), 2) ELSE 0 END', '净销售额 / 投流花费', 'ad', false, 'standard', 'v1', 'active')
ON CONFLICT (metric_code) DO UPDATE SET
  name        = EXCLUDED.name,
  unit        = EXCLUDED.unit,
  category    = EXCLUDED.category,
  formula     = EXCLUDED.formula,
  description = EXCLUDED.description,
  fact_table  = EXCLUDED.fact_table,
  is_additive = EXCLUDED.is_additive,
  caliber     = EXCLUDED.caliber,
  version     = EXCLUDED.version,
  status      = EXCLUDED.status;

-- 3. 建立统一视图别名 metric_catalog 供外部和新代码访问
-- 基线中该视图可能已是后续版本（列不同），先删除再重建
DROP VIEW IF EXISTS public.metric_catalog;
CREATE VIEW public.metric_catalog AS
  SELECT id, metric_code, name, unit, category, formula, description,
         fact_table, is_additive, caliber, version, status,
         supported_platforms, extra, created_at
    FROM public.metric_definition;

COMMIT;
