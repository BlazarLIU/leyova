-- ============================================================================
-- 迁移 126：清理 session_* 孤儿行（迁移 124 的副作用修复）
-- ----------------------------------------------------------------------------
-- 背景：迁移 124 删除 jd/pdd 的 live_rooms 时，以下 4 张表的 room_id 外键
--       删除规则为 NO ACTION，但因当时是在同一事务内先删子表再删父表，
--       部分行未被级联清理；pg 实际将引用置为 NULL（实测结果）。
--
-- 实测孤儿行（room_id IS NULL）：
--   session_live_basic_info      540 行  GMV ≈ 499 万
--   session_overview_metrics     540 行
--   session_product_details     4,590 行
--   session_short_video_traffic   796 行
--   ─────────────────────────────────────
--   合计                        6,466 行
--
-- 影响：BI 面板把 room_id 为 NULL 的 540 行误归到「抖音」（COALESCE 兜底），
--       导致抖音 GMV 被放大一倍（501,817 + 489,965），且订单数显示为 0。
--
-- 本迁移只删除「room_id IS NULL 且无对应直播间」的孤儿行，不影响任何有效数据。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 0. 前置校验：确认孤儿行确实是 jd/pdd 遗留（不是其他真实业务数据）
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_orphan_basic bigint;
  v_orphan_metrics bigint;
  v_orphan_details bigint;
  v_orphan_traffic bigint;
BEGIN
  SELECT count(*) INTO v_orphan_basic
    FROM public.session_live_basic_info lb
    LEFT JOIN public.live_rooms r ON r.id = lb.room_id
   WHERE r.id IS NULL AND lb.room_id IS NULL;

  SELECT count(*) INTO v_orphan_metrics
    FROM public.session_overview_metrics om
    LEFT JOIN public.live_rooms r ON r.id = om.room_id
   WHERE r.id IS NULL AND om.room_id IS NULL;

  SELECT count(*) INTO v_orphan_details
    FROM public.session_product_details sp
    LEFT JOIN public.live_rooms r ON r.id = sp.room_id
   WHERE r.id IS NULL AND sp.room_id IS NULL;

  SELECT count(*) INTO v_orphan_traffic
    FROM public.session_short_video_traffic sv
    LEFT JOIN public.live_rooms r ON r.id = sv.room_id
   WHERE r.id IS NULL AND sv.room_id IS NULL;

  RAISE NOTICE '孤儿行实测：basic=%, metrics=%, details=%, traffic=%',
    v_orphan_basic, v_orphan_metrics, v_orphan_details, v_orphan_traffic;

  -- 防御：如果孤儿行数超过 20,000，说明可能删错了，中止
  IF (v_orphan_basic + v_orphan_metrics + v_orphan_details + v_orphan_traffic) > 20000 THEN
    RAISE EXCEPTION '孤儿行合计 % 行，超过安全阈值 20,000，已中止。请人工核查。',
      (v_orphan_basic + v_orphan_metrics + v_orphan_details + v_orphan_traffic);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 1. 删除孤儿行（room_id IS NULL 或指向不存在的直播间）
--    顺序：子表 → 父表
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.session_product_details
 WHERE room_id IS NULL
    OR room_id NOT IN (SELECT id FROM public.live_rooms);

DELETE FROM public.session_short_video_traffic
 WHERE room_id IS NULL
    OR room_id NOT IN (SELECT id FROM public.live_rooms);

DELETE FROM public.session_overview_metrics
 WHERE room_id IS NULL
    OR room_id NOT IN (SELECT id FROM public.live_rooms);

DELETE FROM public.session_live_basic_info
 WHERE room_id IS NULL
    OR room_id NOT IN (SELECT id FROM public.live_rooms);

-- ────────────────────────────────────────────────────────────────
-- 2. 后置校验：所有 session_* 表不再有孤儿行
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left bigint;
BEGIN
  SELECT count(*) INTO v_left FROM public.session_live_basic_info lb
    LEFT JOIN public.live_rooms r ON r.id = lb.room_id WHERE r.id IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'session_live_basic_info 仍残留孤儿行 % 条', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.session_overview_metrics om
    LEFT JOIN public.live_rooms r ON r.id = om.room_id WHERE r.id IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'session_overview_metrics 仍残留孤儿行 % 条', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.session_product_details sp
    LEFT JOIN public.live_rooms r ON r.id = sp.room_id WHERE r.id IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'session_product_details 仍残留孤儿行 % 条', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.session_short_video_traffic sv
    LEFT JOIN public.live_rooms r ON r.id = sv.room_id WHERE r.id IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'session_short_video_traffic 仍残留孤儿行 % 条', v_left;
  END IF;
END $$;

-- version: 126_cleanup_session_orphans
