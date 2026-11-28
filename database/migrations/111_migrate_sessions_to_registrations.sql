-- ============================================================================
-- 数据迁移：live_sessions → live_registrations
--
-- 背景：三个「人工登记」页面已改为读写 live_registrations 独立表，
--       但历史 144 条场次数据仍在 live_sessions 中，
--       导致登记页面显示为空。
--
-- 策略：
--   把 live_sessions 的全部场次数据复制到 live_registrations，
--   保留原始 id 关联（存进 remark 便于追溯），
--   源表 live_sessions 数据不动（分析功能仍需要）。
-- ============================================================================

BEGIN;

-- 1) 备份现有 live_registrations（若已有数据）
CREATE TABLE IF NOT EXISTS public.live_registrations_backup_20261108 AS
SELECT * FROM public.live_registrations;

-- 2) 从 live_sessions 复制到 live_registrations
INSERT INTO public.live_registrations (
    biz_date,
    anchor_id,
    room_id,
    operator_id,
    title,
    start_time,
    end_time,
    duration_min,
    status,
    gmv,
    orders,
    buyer_count,
    return_amount,
    remark,
    registered_at,
    updated_at,
    entry_source
)
SELECT
    s.date,
    s.anchor_id,
    s.room_id,
    s.operator_id,
    COALESCE(NULLIF(s.title, ''), '场次 ' || s.date::text) AS title,
    s.start_time,
    s.end_time,
    COALESCE(s.duration_min, 0),
    CASE
        WHEN s.status IN ('completed', 'live', 'scheduled', 'cancelled') THEN s.status
        ELSE 'completed'
    END,
    COALESCE(s.gmv, 0),
    COALESCE(s.orders, 0),
    COALESCE(s.buyer_count, 0),
    COALESCE(s.return_amount, 0),
    -- 保留原始场次 id 便于追溯
    CONCAT_WS(' | ',
        NULLIF(s.remark, ''),
        '原场次ID:' || s.id::text,
        '数据来源:' || COALESCE(s.data_source, 'unknown')
    ),
    COALESCE(s.created_at, now()),
    COALESCE(s.updated_at, now()),
    'migrated'
FROM public.live_sessions s
WHERE NOT EXISTS (
    -- 避免重复迁移
    SELECT 1 FROM public.live_registrations r
     WHERE r.biz_date = s.date
       AND COALESCE(r.anchor_id, 0) = COALESCE(s.anchor_id, 0)
       AND COALESCE(r.room_id, 0) = COALESCE(s.room_id, 0)
       AND COALESCE(r.start_time, '00:00'::time) = COALESCE(s.start_time, '00:00'::time)
);

-- 3) 验证计数
DO $$
DECLARE
    v_sessions int;
    v_registrations int;
BEGIN
    SELECT count(*) INTO v_sessions FROM live_sessions;
    SELECT count(*) INTO v_registrations FROM live_registrations;
    RAISE NOTICE '迁移结果: live_sessions=% 条, live_registrations=% 条', v_sessions, v_registrations;
END $$;

COMMIT;
