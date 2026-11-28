-- ============================================================================
-- 迁移 134：排班 + 排休 + 缺勤反推（S4-C）
-- ----------------------------------------------------------------------------
-- 老大决策：
--   3、B. 用排班反推，排班表要排班，还要排休
--
-- 需求拆解：
--   ① 排班表要能表达「上班」，也要能表达「休息」—— 休息不是挂在场次上的，
--      而是「某人 × 某天」的状态，需要独立表
--   ② 缺勤 = 排了班但没实际登记，且当天不是休息
--
-- 数据现实（如实说明）：
--   - 主播：有 live_registrations 登记表 → 应到 vs 实到可精确比对
--   - 中控/运营/投手/拍剪/编导：**没有出勤登记机制** → 只能统计「已排班」与「休假」，
--     无法判定是否实际到岗。本迁移把这部分如实暴露，不做假数据。
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 人员每日状态（上班 / 休息 / 请假 / 病假）
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_day_status (
    id          bigserial PRIMARY KEY,
    staff_name  varchar(64) NOT NULL,
    biz_date    date        NOT NULL,
    status      varchar(16) NOT NULL CHECK (status IN ('work', 'rest', 'leave', 'sick')),
    note        text        DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (staff_name, biz_date)
);

COMMENT ON TABLE public.staff_day_status IS
  '人员每日状态：work=排班上班 / rest=排休 / leave=请假 / sick=病假。休息不挂场次，是「人×天」维度';

CREATE INDEX IF NOT EXISTS idx_staff_day_status_date
  ON public.staff_day_status (biz_date);

CREATE INDEX IF NOT EXISTS idx_staff_day_status_name
  ON public.staff_day_status (staff_name);

-- ────────────────────────────────────────────────────────────────
-- 2. 岗位字典补「是否必须出勤登记」
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.staff_role_dict
  ADD COLUMN IF NOT EXISTS requires_attendance boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.staff_role_dict.requires_attendance IS
  '该岗位是否有出勤登记数据源。true=可用 live_registrations 反推缺勤；false=只能统计排班与休假';

-- 主播有登记表，可反推；其余岗位暂无
UPDATE public.staff_role_dict SET requires_attendance = true  WHERE code = 'anchor';
UPDATE public.staff_role_dict SET requires_attendance = false WHERE code <> 'anchor';

-- ────────────────────────────────────────────────────────────────
-- 3. 从既有数据回填「已排班 = work」状态（幂等）
--    依据：session_staff_assignments 里有记录 ⇒ 当天该人上班
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.staff_day_status (staff_name, biz_date, status, note)
SELECT DISTINCT
       sa.staff_name,
       s.date,
       'work',
       '由既有排班回填'
  FROM public.session_staff_assignments sa
  JOIN public.live_sessions s ON s.id = sa.session_id
 WHERE s.date IS NOT NULL
ON CONFLICT (staff_name, biz_date) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. 缺勤反推视图（主播可精确，其他岗位如实标记为不可判定）
-- ────────────────────────────────────────────────────────────────
-- 基线 schema 中该视图已是后续迁移的最终形态（列更多），先删除再按本版本重建，
-- 136 会再次重建为最终形态
DROP VIEW IF EXISTS public.v_staff_attendance;
CREATE OR REPLACE VIEW public.v_staff_attendance AS
WITH expected AS (
  -- 应到：被排进场次的人（按人 × 日期聚合）
  SELECT sa.staff_name,
         s.date AS biz_date,
         sa.role_code,
         COUNT(DISTINCT s.id) AS expected_sessions
    FROM public.session_staff_assignments sa
    JOIN public.live_sessions s ON s.id = sa.session_id
   WHERE s.date IS NOT NULL
   GROUP BY sa.staff_name, s.date, sa.role_code
),
actual AS (
  -- 实到：主播维度有直播登记记录
  SELECT a.name AS staff_name,
         lr.biz_date,
         COUNT(DISTINCT lr.id) AS actual_sessions
    FROM public.live_registrations lr
    JOIN public.anchors a ON a.id = lr.anchor_id
   GROUP BY a.name, lr.biz_date
),
day_status AS (
  SELECT staff_name, biz_date, status
    FROM public.staff_day_status
)
SELECT e.staff_name,
       e.biz_date,
       e.role_code,
       e.expected_sessions,
       COALESCE(ac.actual_sessions, 0) AS actual_sessions,
       COALESCE(ds.status, 'work')     AS day_status,
       CASE
         -- 休假 / 请假 / 病假：不算缺勤
         WHEN COALESCE(ds.status, 'work') IN ('rest', 'leave', 'sick') THEN false
         -- 主播且实到为 0：缺勤
         WHEN e.role_code = 'anchor' AND COALESCE(ac.actual_sessions, 0) = 0 THEN true
         -- 其他岗位：无登记数据源，不可判定（不冒充缺勤）
         ELSE false
       END AS is_absent,
       CASE
         WHEN e.role_code <> 'anchor' THEN '该岗位暂无出勤登记数据源，只能统计排班与休假'
         WHEN COALESCE(ds.status, 'work') IN ('rest', 'leave', 'sick') THEN '当日为' || COALESCE(ds.status, '') || '，不计缺勤'
         WHEN COALESCE(ac.actual_sessions, 0) = 0 THEN '已排班但无直播登记记录'
         ELSE ''
       END AS absence_note
  FROM expected e
  LEFT JOIN actual ac ON ac.staff_name = e.staff_name AND ac.biz_date = e.biz_date
  LEFT JOIN day_status ds ON ds.staff_name = e.staff_name AND ds.biz_date = e.biz_date;

COMMENT ON VIEW public.v_staff_attendance IS
  '出勤反推：主播用「排班 vs 直播登记」判定缺勤；其他岗位因无登记数据源，is_absent 恒为 false 并在 absence_note 中说明';

-- ────────────────────────────────────────────────────────────────
-- 5. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_anchor_flag int;
BEGIN
  SELECT count(*) INTO v_anchor_flag
    FROM public.staff_role_dict WHERE code = 'anchor' AND requires_attendance = true;
  IF v_anchor_flag <> 1 THEN
    RAISE EXCEPTION '主播岗位未标记 requires_attendance';
  END IF;

  RAISE NOTICE 'S6-C 完成：出勤视图已重建，主播可反推缺勤，其余岗位如实标注不可判定';
END $$;

-- version: 134_schedule_rest_and_attendance
