-- ============================================================================
-- 迁移 138：session_channel_metrics 结构修正（P0-A 配套）
-- ----------------------------------------------------------------------------
-- 问题（审计发现）：
--   原唯一约束是 `UNIQUE (period_date, channel)` —— **不含 session_id / platform_code**
--   → 表的语义被迫变成「天 × 渠道」，导致：
--     1. 一天内多平台多店铺时，无法区分渠道归属
--     2. 一天多场直播时，渠道指标无法落到具体场次
--     3. 生成器无法按场次写入，只能按天聚合（审计中 70 行全部来自视频号）
--
-- 修正：
--   1. 加 `platform_code` / `source_code` / `shop_id` 三列
--   2. 唯一键改为 `UNIQUE (session_id, channel)` —— 场次级
--   3. 保留 `period_date` 作为冗余查询列（由 session 的 date 回填）
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 加列
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.session_channel_metrics
  ADD COLUMN IF NOT EXISTS platform_code varchar(32),
  ADD COLUMN IF NOT EXISTS source_code   varchar(64),
  ADD COLUMN IF NOT EXISTS shop_id       bigint;

-- ────────────────────────────────────────────────────────────────
-- 2. 回填现有数据（从 live_sessions + live_rooms）
-- ────────────────────────────────────────────────────────────────
UPDATE public.session_channel_metrics scm
   SET platform_code = r.platform_code,
       shop_id       = r.shop_id
  FROM public.live_sessions s
  JOIN public.live_rooms r ON r.id = s.room_id
 WHERE s.id = scm.session_id
   AND scm.platform_code IS NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. 换唯一键：天×渠道 → 场次×渠道
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.session_channel_metrics
  DROP CONSTRAINT IF EXISTS uq_session_channel_period_channel;

-- 幂等：已存在则跳过
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.session_channel_metrics'::regclass
       AND conname = 'uq_session_channel_session_channel'
  ) THEN
    ALTER TABLE public.session_channel_metrics
      ADD CONSTRAINT uq_session_channel_session_channel UNIQUE (session_id, channel);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 4. 补索引
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_session_channel_platform
  ON public.session_channel_metrics (platform_code, period_date);

CREATE INDEX IF NOT EXISTS idx_session_channel_shop
  ON public.session_channel_metrics (shop_id, period_date);

COMMENT ON TABLE public.session_channel_metrics IS
  '场次 × 渠道指标（唯一键 session_id+channel）。platform_code/shop_id 冗余用于跨场次聚合查询';

-- ────────────────────────────────────────────────────────────────
-- 5. 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_old int;
  v_new int;
  v_total int;
BEGIN
  SELECT count(*) INTO v_old FROM pg_constraint
   WHERE conname = 'uq_session_channel_period_channel';
  IF v_old > 0 THEN
    RAISE EXCEPTION '旧唯一键 uq_session_channel_period_channel 仍存在';
  END IF;

  SELECT count(*) INTO v_new FROM pg_constraint
   WHERE conname = 'uq_session_channel_session_channel';
  IF v_new = 0 THEN
    RAISE EXCEPTION '新唯一键 uq_session_channel_session_channel 未创建';
  END IF;

  SELECT count(*) INTO v_total FROM public.session_channel_metrics;
  RAISE NOTICE 'session_channel_metrics 结构已修正：唯一键改为 (session_id, channel)，当前 % 行', v_total;
END $$;

-- version: 138_session_channel_metrics_fix
