-- ============================================================================
-- Migration: 110_standalone_registration.sql
--
-- 背景（用户明确要求）：
--   「个人达成、直播登记、登记数据管理」三个页面属于【手动登记】，
--   不与其他数据和功能产生任何关联，是完全独立的模块。
--
--   复盘用的场次数据来源改为：官方 API 接口 或 手动上传数据。
--
-- 变更：
--   1. 新建 live_registrations 表（人工登记专用，独立存储）
--   2. live_sessions 保持原样，但写入来源限定为：official_api / manual_upload
--   3. 提供回填：把 live_sessions 中已有的登记类数据迁移到新表（若需要）
-- ============================================================================

-- ────────────────────────────────────────────────────────────
-- 1. 人工登记表（独立模块）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_registrations (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    anchor_id integer REFERENCES public.anchors(id) ON DELETE SET NULL,
    room_id integer REFERENCES public.live_rooms(id) ON DELETE SET NULL,
    operator_id integer REFERENCES public.operators(id) ON DELETE SET NULL,

    -- 登记字段（人工填写，不参与任何分析）
    title varchar(200) DEFAULT '',
    start_time time,
    end_time time,
    duration_min integer,
    status varchar(20) DEFAULT 'completed',

    -- 人工记录的经营数据（仅作记录，不进入 fact_* 表，不参与复盘）
    gmv numeric(14,2) DEFAULT 0,
    orders integer DEFAULT 0,
    buyer_count integer DEFAULT 0,
    return_amount numeric(14,2) DEFAULT 0,
    remark text DEFAULT '',

    -- 登记元信息
    registered_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    registered_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- 登记来源标记（便于区分人工登记与系统数据）
    entry_source varchar(20) DEFAULT 'manual_entry' NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_reg_date ON public.live_registrations (biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_live_reg_anchor ON public.live_registrations (anchor_id, biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_live_reg_room ON public.live_registrations (room_id, biz_date DESC);

COMMENT ON TABLE public.live_registrations IS
    '人工登记表：个人达成/直播登记/登记数据管理专用。独立模块，不参与任何分析计算。';

-- ────────────────────────────────────────────────────────────
-- 2. 个人达成登记表（考勤/达成类）
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    person_type varchar(20) NOT NULL DEFAULT 'anchor',  -- anchor | operator
    person_id integer NOT NULL,
    person_name varchar(100) DEFAULT '',

    -- 达成数据（人工填写）
    target_hours numeric(6,2) DEFAULT 0,      -- 目标时长
    actual_hours numeric(6,2) DEFAULT 0,      -- 实际时长
    target_gmv numeric(14,2) DEFAULT 0,       -- 目标 GMV
    actual_gmv numeric(14,2) DEFAULT 0,       -- 实际 GMV
    attendance_status varchar(20) DEFAULT 'present', -- present | absent | leave | late
    remark text DEFAULT '',

    registered_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(biz_date, person_type, person_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_records (biz_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_person ON public.attendance_records (person_type, person_id, biz_date DESC);

COMMENT ON TABLE public.attendance_records IS
    '个人达成登记：人工填写的目标与实际达成，独立模块。';

-- ────────────────────────────────────────────────────────────
-- 3. live_sessions 增加数据来源标记
--    明确：只有 official_api / manual_upload 可以写入分析用场次数据
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS data_source varchar(30);

-- 回填现有数据来源
UPDATE public.live_sessions
   SET data_source = CASE
       WHEN EXISTS (SELECT 1 FROM data_uploads du WHERE du.business_date = live_sessions.date) THEN 'manual_upload'
       ELSE 'legacy'
   END
 WHERE data_source IS NULL;

-- 约束：禁止插入未知来源
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_live_sessions_source') THEN
        ALTER TABLE public.live_sessions
            ADD CONSTRAINT chk_live_sessions_source
            CHECK (data_source IS NULL OR data_source IN ('official_api', 'manual_upload', 'legacy', 'bridge'));
    END IF;
END $$;

COMMENT ON COLUMN public.live_sessions.data_source IS
    '场次数据来源：official_api（官方接口）/ manual_upload（手动上传）/ legacy（历史遗留）/ bridge（桥接）。人工登记不写入本表。';

INSERT INTO public.schema_migrations (version, name)
VALUES ('110_standalone_registration', 'Standalone registration tables; live_sessions data_source')
ON CONFLICT (version) DO NOTHING;
