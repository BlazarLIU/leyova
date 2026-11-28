-- ============================================================================
-- 211_drop_deprecated_session_products.sql
--
-- 删除已被 session_plan_products 取代的下线对象：
--   - _deprecated_session_product_skus（引用 details，先删）
--   - _deprecated_session_product_details
--   - _deprecated_v_schedule_by_role（视图）
--
-- 依赖确认（2026-11-22）：
--   - skus -> details 外键：product_id ON DELETE CASCADE，先删 skus；
--   - 两表对 live_rooms / live_sessions / data_uploads 的外键均为出向，不影响删除；
--   - 全仓无运行时代码引用，无其他视图依赖。
--
-- 回滚：需从备份恢复（执行前已备份 schema + data）。
-- ============================================================================

BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DROP VIEW IF EXISTS public._deprecated_v_schedule_by_role;
DROP TABLE IF EXISTS public._deprecated_session_product_skus;
DROP TABLE IF EXISTS public._deprecated_session_product_details;

COMMIT;
