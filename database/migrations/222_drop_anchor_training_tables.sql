-- ============================================================================
-- 迁移 222：下线主播培训模块（删除表结构）
-- ----------------------------------------------------------------------------
-- 背景：主播培训功能已从产品下线（前端页面、/anchors/training 重定向、导航入口均已移除），
--       但 anchor_training_plans / anchor_training_records 表与演示数据仍保留。
-- 前置：apps/ 下已无这两张表的任何代码引用。
-- ============================================================================

DROP TABLE IF EXISTS public.anchor_training_records CASCADE;
DROP TABLE IF EXISTS public.anchor_training_plans CASCADE;
