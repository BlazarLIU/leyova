-- ============================================================================
-- 迁移 132：直播排班多岗位化 + 日历视图支撑（S6）
-- ----------------------------------------------------------------------------
-- 老大原话：
--   1.「增加一个主播排班（改名为直播排班）」
--   2.「主播排班的显示逻辑不对，要按照日历的方式来显示」
--   3.「不要只显示主播，还要显示中控、运营、投手、拍剪、编导这些岗位」
--
-- 现状（实测）：
--   live_sessions 只有 anchor_id（主播）与 operator_id（运营）两个人员字段，
--   中控 / 投手 / 拍剪 / 编导 完全没有落点。
--
-- 本迁移建立「场次 × 岗位 × 人员」模型：
--   session_staff_assignments  一场直播可挂多个岗位，每岗位可挂多人
--   staff_role_dict            岗位字典（含显示顺序与颜色）
-- ============================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. 岗位字典
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_role_dict (
    code          varchar(24) PRIMARY KEY,
    name          varchar(32) NOT NULL,
    sort_order    smallint    NOT NULL DEFAULT 0,
    color         varchar(24) NOT NULL DEFAULT 'slate',
    is_multi      boolean     NOT NULL DEFAULT false,  -- 是否允许同岗位多人
    description   text        DEFAULT ''
);

INSERT INTO public.staff_role_dict (code, name, sort_order, color, is_multi, description) VALUES
  ('anchor',     '主播', 10, 'rose',    false, '出镜讲解与成交引导'),
  ('controller', '中控', 20, 'sky',     false, '上链接、改库存、切素材、控场'),
  ('operator',   '运营', 30, 'emerald', false, '定目标、控节奏、复盘归因'),
  ('ad_buyer',   '投手', 40, 'amber',   false, '投流预算、素材与人群调优'),
  ('video_editor','拍剪', 50, 'violet', true,  '拍摄与剪辑，可多人'),
  ('director',   '编导', 60, 'cyan',    true,  '脚本策划与内容编排，可多人')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      sort_order = EXCLUDED.sort_order,
      color = EXCLUDED.color,
      is_multi = EXCLUDED.is_multi,
      description = EXCLUDED.description;

-- ────────────────────────────────────────────────────────────────
-- 2. 场次 × 岗位 × 人员
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_staff_assignments (
    id           bigserial PRIMARY KEY,
    session_id   integer     NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
    role_code    varchar(24) NOT NULL REFERENCES public.staff_role_dict(code) ON DELETE RESTRICT,
    staff_id     integer,                       -- 有系统账号时关联 users.id，否则为空
    staff_name   varchar(64) NOT NULL,
    note         text        DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, role_code, staff_name)
);

COMMENT ON TABLE public.session_staff_assignments IS
  '场次人员排班：一场直播可挂主播/中控/运营/投手/拍剪/编导多岗位，每岗位按 staff_role_dict.is_multi 决定可否多人';

CREATE INDEX IF NOT EXISTS idx_session_staff_session
  ON public.session_staff_assignments (session_id);

CREATE INDEX IF NOT EXISTS idx_session_staff_role
  ON public.session_staff_assignments (role_code);

-- ────────────────────────────────────────────────────────────────
-- 3. 从既有字段回填（幂等）
-- ────────────────────────────────────────────────────────────────
-- 3.1 主播
INSERT INTO public.session_staff_assignments (session_id, role_code, staff_name)
SELECT s.id, 'anchor', a.name
  FROM public.live_sessions s
  JOIN public.anchors a ON a.id = s.anchor_id
 WHERE a.name IS NOT NULL
ON CONFLICT (session_id, role_code, staff_name) DO NOTHING;

-- 3.2 运营（operator_id → users）
INSERT INTO public.session_staff_assignments (session_id, role_code, staff_id, staff_name)
SELECT s.id, 'operator', u.id, COALESCE(NULLIF(u.real_name, ''), u.username)
  FROM public.live_sessions s
  JOIN public.users u ON u.id = s.operator_id
 WHERE s.operator_id IS NOT NULL
ON CONFLICT (session_id, role_code, staff_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. 为视频号演示场次补齐多岗位（S1 只写了单主播，用于验证日历）
-- ────────────────────────────────────────────────────────────────
INSERT INTO public.session_staff_assignments (session_id, role_code, staff_name)
SELECT s.id, v.role_code, v.staff_name
  FROM public.live_sessions s
  JOIN public.live_rooms r ON r.id = s.room_id
  CROSS JOIN (VALUES
    ('controller',   '周砚'),
    ('operator',     '林清和'),
    ('ad_buyer',     '许知远'),
    ('video_editor', '陈拾'),
    ('director',     '苏晚')
  ) AS v(role_code, staff_name)
 WHERE r.platform_code = 'wechat'
ON CONFLICT (session_id, role_code, staff_name) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 5. 自校验
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_role int;
  v_assign int;
  v_multi int;
  v_wechat_multi int;
BEGIN
  SELECT count(*) INTO v_role FROM public.staff_role_dict;
  IF v_role < 6 THEN
    RAISE EXCEPTION '岗位字典不足（实际 %，预期 6）', v_role;
  END IF;

  SELECT count(*) INTO v_assign FROM public.session_staff_assignments;
  IF v_assign < 100 THEN
    RAISE EXCEPTION '排班回填不足（实际 %）', v_assign;
  END IF;

  -- 视频号场次应具备多岗位（验证日历可展示多岗位）
  SELECT count(DISTINCT role_code) INTO v_multi
    FROM public.session_staff_assignments sa
    JOIN public.live_sessions s ON s.id = sa.session_id
    JOIN public.live_rooms r ON r.id = s.room_id
   WHERE r.platform_code = 'wechat';
  v_wechat_multi := v_multi;
  IF v_wechat_multi < 5 THEN
    RAISE EXCEPTION '视频号场次岗位覆盖不足（实际 % 种）', v_wechat_multi;
  END IF;

  RAISE NOTICE 'S6 完成：岗位 % 种，排班记录 % 条，视频号场次覆盖 % 种岗位', v_role, v_assign, v_wechat_multi;
END $$;

-- version: 132_live_schedule_multirole
