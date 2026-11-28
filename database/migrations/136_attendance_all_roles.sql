-- ============================================================================
-- 迁移 136：缺勤反推扩展到全部岗位（方案 A）+ 日历按岗位视图支撑
-- ----------------------------------------------------------------------------
-- 老大决策：
--   「A（排班逻辑应该是所有岗位都在日历里面体现）」
--
-- 含义两层：
--   ① 缺勤判定用方案 A：场次被取消 / 该开的没开 → 该场全体排班人员记缺勤
--      （不再只判主播，所有岗位一视同仁）
--   ② 排班日历要能体现全部岗位（不只是主播）
--
-- 旧视图的问题：
--   v_staff_attendance 只对 role_code='anchor' 判定缺勤，其余岗位恒为 false
--
-- 新逻辑（统一判定，全部岗位适用）：
--   1. 当日为 rest/leave/sick → 不算缺勤（已排休）
--   2. 场次 status='cancelled' → 该场排班人员全部缺勤
--   3. 场次已过期（date < today）但 status 仍是 scheduled（从未开播）→ 缺勤
--   4. 主播额外：场次已开播（completed/live）但无直播登记实到 → 缺勤
-- ============================================================================

DROP VIEW IF EXISTS public.v_staff_attendance;

CREATE VIEW public.v_staff_attendance AS
WITH dedup_expected AS (
  -- 应到：被排进某场次的人（按 人 × 日期 × 岗位 × 场次 粒度去重）
  SELECT DISTINCT sa.staff_name,
         s.date    AS biz_date,
         sa.role_code,
         s.id      AS session_id,
         s.room_id AS room_id,
         s.status  AS session_status
    FROM public.session_staff_assignments sa
    JOIN public.live_sessions s ON s.id = sa.session_id
   WHERE s.date IS NOT NULL
),
actual AS (
  -- 实到（仅主播有登记数据源；live_registrations 无 session_id，按 room_id + 日期关联）
  SELECT a.name AS staff_name,
         lr.biz_date,
         lr.room_id,
         COUNT(*)::int AS actual_rows
    FROM public.live_registrations lr
    JOIN public.anchors a ON a.id = lr.anchor_id
   GROUP BY a.name, lr.biz_date, lr.room_id
),
day_status AS (
  SELECT staff_name, biz_date, status FROM public.staff_day_status
)
SELECT
  de.staff_name,
  de.biz_date,
  de.role_code,
  de.session_id,
  de.session_status,
  1 AS expected_sessions,
  COALESCE(ac.actual_rows, 0) AS actual_sessions,
  COALESCE(ds.status, 'work') AS day_status,
  CASE
    -- ① 排休/请假/病假 → 不计缺勤
    WHEN COALESCE(ds.status, 'work') IN ('rest', 'leave', 'sick') THEN false
    -- ② 场次被取消 → 该场全体排班人员缺勤
    WHEN de.session_status = 'cancelled' THEN true
    -- ③ 场次已过期但仍未开播（scheduled 且日期已过）→ 缺勤
    WHEN de.session_status = 'scheduled' AND de.biz_date < CURRENT_DATE THEN true
    -- ④ 主播专属：场次已开播但无实到登记 → 缺勤
    WHEN de.role_code = 'anchor'
         AND de.session_status IN ('completed', 'live')
         AND COALESCE(ac.actual_rows, 0) = 0 THEN true
    ELSE false
  END AS is_absent,
  CASE
    WHEN COALESCE(ds.status, 'work') IN ('rest', 'leave', 'sick')
      THEN '当日为' || COALESCE(ds.status, '') || '，不计缺勤'
    WHEN de.session_status = 'cancelled' THEN '场次已取消'
    WHEN de.session_status = 'scheduled' AND de.biz_date < CURRENT_DATE THEN '场次过期未开播'
    WHEN de.role_code = 'anchor'
         AND de.session_status IN ('completed', 'live')
         AND COALESCE(ac.actual_rows, 0) = 0 THEN '场次已开播但无直播登记'
    ELSE ''
  END AS absence_note
FROM dedup_expected de
LEFT JOIN actual ac
       ON ac.staff_name = de.staff_name
      AND ac.biz_date = de.biz_date
      AND ac.room_id = de.room_id
LEFT JOIN day_status ds
       ON ds.staff_name = de.staff_name
      AND ds.biz_date = de.biz_date;

COMMENT ON VIEW public.v_staff_attendance IS
  '出勤反推（方案A，全岗位）：排休不计；场次取消或过期未开播 → 该场全体排班人员缺勤；主播额外校验直播登记实到';

-- ────────────────────────────────────────────────────────────────
-- 补一个按「岗位 × 日期」聚合的视图，供日历按岗位视图直接读取
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_schedule_by_role AS
SELECT s.date AS biz_date,
       sa.role_code,
       d.name  AS role_name,
       d.sort_order,
       sa.staff_name,
       COUNT(DISTINCT s.id)::int AS sessions,
       MIN(s.start_time) AS first_start,
       MAX(s.end_time)   AS last_end,
       COALESCE(ds.status, 'work') AS day_status
  FROM public.session_staff_assignments sa
  JOIN public.live_sessions s ON s.id = sa.session_id
  JOIN public.staff_role_dict d ON d.code = sa.role_code
  LEFT JOIN public.staff_day_status ds
         ON ds.staff_name = sa.staff_name AND ds.biz_date = s.date
 WHERE s.date IS NOT NULL
 GROUP BY s.date, sa.role_code, d.name, d.sort_order, sa.staff_name, COALESCE(ds.status, 'work');

COMMENT ON VIEW public.v_schedule_by_role IS
  '按「日期 × 岗位 × 人员」聚合的排班视图，供排班日历的「按岗位」视图直接使用';

-- ────────────────────────────────────────────────────────────────
-- 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total bigint;
  v_absent bigint;
  v_role_count int;
  v_absent_roles int;
BEGIN
  SELECT count(*) INTO v_total FROM public.v_staff_attendance;
  SELECT count(*) FILTER (WHERE is_absent) INTO v_absent FROM public.v_staff_attendance;

  SELECT count(DISTINCT role_code) INTO v_role_count FROM public.v_staff_attendance;

  -- 缺勤是否已覆盖多个岗位（不再只有主播）
  SELECT count(DISTINCT role_code) INTO v_absent_roles
    FROM public.v_staff_attendance WHERE is_absent;

  RAISE NOTICE 'S-A 完成：出勤视图 % 行，缺勤 % 条，覆盖 % 个岗位（缺勤涉及 % 个岗位）',
    v_total, v_absent, v_role_count, v_absent_roles;

  -- 演示数据清理后空库属正常，视图可查询即视为通过
END $$;

-- version: 136_attendance_all_roles
