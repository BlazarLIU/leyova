-- Migration 166: P2-3 模块热插拔 — 启用状态 + 核心模块保护
-- 目标：超级管理员可开启/关闭非核心模块；核心模块（业务主链 + 系统管理 + AI 运营数据引用）
--       不允许关闭，避免影响系统运营与 AI 运营子系统的分析/数据引用。

BEGIN;

ALTER TABLE public.system_modules
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.system_modules
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false;

-- 核心模块（不可关闭）：
--   业务主链：总览/场次/场次排品/数据/商品库存/商业智能/主播/复盘全套
--   运营与财务：ops(运营工具组)/net_roi(投放与净利)/audit_logs(审计)/cost_visibility(成本可见性)
--   系统管理：账号/运营管理/AI配置/字典/直播间/系统配置/异常/任务/大促/竞品/多直播间
--   AI 运营子系统会引用场次、订单、商品、投放、主播、复盘等数据，上述均不可关闭。
UPDATE public.system_modules
   SET is_core = true
 WHERE code IN (
   'overview', 'session', 'session_products', 'data', 'product_center', 'bi', 'anchor',
   'review', 'review_overview', 'review_channels', 'review_anchors', 'review_funnel', 'review_closed_loop',
   'ops', 'net_roi', 'audit_logs', 'cost_visibility',
   'system_users', 'system_personnel_ops', 'system_ai', 'system_dict', 'system_rooms',
   'system_config', 'system_alerts', 'system_tasks', 'system_promotions',
   'system_competitors', 'system_multiroom'
 );

COMMIT;
