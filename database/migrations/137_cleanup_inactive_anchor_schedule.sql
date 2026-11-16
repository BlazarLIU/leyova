-- ============================================================================
-- 迁移 137：清理已停用主播的排班残留（S-A 配套）
-- ----------------------------------------------------------------------------
-- 问题（实测）：
--   S0 下线 jd/pdd 时把这两个平台的主播置为 status=0（停用），
--   但 S6 建立 session_staff_assignments 时按「场次 anchor_id → anchors.name」回填，
--   把已停用主播也回填进了排班表（跨平台排班的遗留）。
--
--   后果：
--     1. 缺勤反推把这些已离职主播算成大量缺勤（莫问归 132 次、司空摘星 131 次…）
--     2. HRBP 考勤统计被污染
--
-- 处理：
--   ① 删除已停用主播（anchors.status = 0）的排班记录
--   ② 同步清掉这些人的 staff_day_status（由排班回填出来的 work 状态）
--   ③ 加约束：排班人员若对应到 anchors 且已停用，不应存在
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 统计并删除已停用主播的排班
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_inactive text[];
  v_cnt bigint;
BEGIN
  SELECT array_agg(name) INTO v_inactive
    FROM public.anchors WHERE status = 0;

  IF v_inactive IS NULL THEN
    RAISE NOTICE '无已停用主播，跳过';
    RETURN;
  END IF;

  SELECT count(*) INTO v_cnt
    FROM public.session_staff_assignments
   WHERE role_code = 'anchor' AND staff_name = ANY(v_inactive);

  RAISE NOTICE '已停用主播 % 人，涉及排班 % 条，开始清理', array_length(v_inactive, 1), v_cnt;
END $$;

DELETE FROM public.session_staff_assignments sa
 WHERE sa.role_code = 'anchor'
   AND sa.staff_name IN (SELECT name FROM public.anchors WHERE status = 0);

-- ────────────────────────────────────────────────────────────────
-- 2. 清理这些人的每日状态（仅保留人工标记的 rest/leave/sick）
-- ────────────────────────────────────────────────────────────────
DELETE FROM public.staff_day_status ds
 WHERE ds.staff_name IN (SELECT name FROM public.anchors WHERE status = 0)
   AND ds.status = 'work'
   AND ds.note = '由既有排班回填';

-- ────────────────────────────────────────────────────────────────
-- 3. 校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left bigint;
  v_absent bigint;
  v_absent_roles int;
BEGIN
  SELECT count(*) INTO v_left
    FROM public.session_staff_assignments sa
   WHERE sa.role_code = 'anchor'
     AND sa.staff_name IN (SELECT name FROM public.anchors WHERE status = 0);
  IF v_left > 0 THEN
    RAISE EXCEPTION '仍有 % 条已停用主播的排班', v_left;
  END IF;

  SELECT count(*) FILTER (WHERE is_absent) INTO v_absent FROM public.v_staff_attendance;
  SELECT count(DISTINCT role_code) INTO v_absent_roles
    FROM public.v_staff_attendance WHERE is_absent;

  RAISE NOTICE '清理完成：剩余缺勤 % 条，涉及 % 个岗位', v_absent, v_absent_roles;
END $$;

-- version: 137_cleanup_inactive_anchor_schedule
