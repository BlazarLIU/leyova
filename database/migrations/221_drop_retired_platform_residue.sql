-- ============================================================================
-- 迁移 221：清理退役平台的数据库残留（表结构 + 约束）
-- ----------------------------------------------------------------------------
-- 背景：淘宝 / 天猫 / 小红书 / 京东 / 拼多多 已下线，仅保留抖音 / 快手 / 视频号。
--       迁移 220 已清理退役平台的数据（含 TRUNCATE 专属表），本迁移进一步删除
--       专属表结构，并收紧 fact_kol_cooperation.coop_type 约束中残留的 'xhs_note'。
-- 前置：apps/ 下已无 taobao_order_hierarchy / xhs_note 的任何代码引用。
-- 说明：培训相关表（anchor_training_*）与演示数据按计划稍后单独处理。
-- ============================================================================

-- 1. 删除退役平台专属表（含索引、序列、RLS 策略；当前数据已由迁移 220 清空）
DROP TABLE IF EXISTS public.taobao_order_hierarchy CASCADE;
DROP TABLE IF EXISTS public.xhs_note CASCADE;

-- 2. 移除约束中残留的 'xhs_note' 枚举值（兜底处理不同环境的约束命名）
DO $$
DECLARE
  con record;
BEGIN
  IF to_regclass('public.fact_kol_cooperation') IS NOT NULL THEN
    FOR con IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.fact_kol_cooperation'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%xhs_note%'
    LOOP
      EXECUTE format('ALTER TABLE public.fact_kol_cooperation DROP CONSTRAINT %I', con.conname);
    END LOOP;

    ALTER TABLE public.fact_kol_cooperation
      DROP CONSTRAINT IF EXISTS fact_kol_cooperation_coop_type_check;
    ALTER TABLE public.fact_kol_cooperation
      ADD CONSTRAINT fact_kol_cooperation_coop_type_check
      CHECK (coop_type IN ('live_slot', 'short_video', 'cps_only'));
  END IF;
END $$;
