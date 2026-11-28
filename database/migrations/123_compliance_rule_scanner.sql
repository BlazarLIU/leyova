-- =============================================================================
-- Migration 123: 平台规则巡检雷达、合规变更差量检测与大促活动提醒
-- 对应规划：FINAL-PLAN Phase 3 (③ 合规风控每日 3 次巡检)
-- =============================================================================

-- 1. 规则原文快照表 (compliance_rule_snapshot)
CREATE TABLE IF NOT EXISTS public.compliance_rule_snapshot (
  id bigserial PRIMARY KEY,
  platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  external_id varchar(120) NOT NULL,
  title varchar(300) NOT NULL,
  category varchar(60) NOT NULL DEFAULT '通用规则',
  source_url varchar(500) NOT NULL,
  published_at timestamptz,
  effective_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  fetch_method varchar(20) NOT NULL DEFAULT 'manual' CHECK (fetch_method IN ('html_direct', 'rss', 'json_api', 'headless', 'manual')),
  content_text text NOT NULL,
  content_hash varchar(64) NOT NULL,
  raw_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule_snapshot UNIQUE (platform_code, external_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_rule_snapshot_pf_ext ON public.compliance_rule_snapshot(platform_code, external_id);
CREATE INDEX IF NOT EXISTS idx_rule_snapshot_hash ON public.compliance_rule_snapshot(content_hash);
CREATE INDEX IF NOT EXISTS idx_rule_snapshot_fetched ON public.compliance_rule_snapshot(fetched_at DESC);

-- 2. 规则变更事件表 (compliance_rule_change)
CREATE TABLE IF NOT EXISTS public.compliance_rule_change (
  id bigserial PRIMARY KEY,
  snapshot_id bigint NOT NULL REFERENCES public.compliance_rule_snapshot(id) ON DELETE CASCADE,
  platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  external_id varchar(120) NOT NULL,
  change_type varchar(20) NOT NULL CHECK (change_type IN ('new', 'revised', 'repealed')),
  diff_summary text NOT NULL DEFAULT '',
  severity varchar(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  is_read boolean NOT NULL DEFAULT false,
  read_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_change_unread ON public.compliance_rule_change(platform_code, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rule_change_severity ON public.compliance_rule_change(severity, created_at DESC);

-- 3. AI 风险评估与运营影响表 (compliance_risk_assessment)
CREATE TABLE IF NOT EXISTS public.compliance_risk_assessment (
  id bigserial PRIMARY KEY,
  change_id bigint NOT NULL REFERENCES public.compliance_rule_change(id) ON DELETE CASCADE,
  affected_shops integer[] DEFAULT '{}'::integer[],
  risk_summary text NOT NULL,
  operational_impact text NOT NULL,
  recommended_actions text[] DEFAULT '{}'::text[],
  evidence_refs jsonb DEFAULT '[]'::jsonb,
  assessed_by varchar(40) NOT NULL DEFAULT 'AI_RISK_ENGINE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessment_change ON public.compliance_risk_assessment(change_id);

-- 4. 大促与营销活动报名提醒表 (compliance_activity_reminder)
CREATE TABLE IF NOT EXISTS public.compliance_activity_reminder (
  id bigserial PRIMARY KEY,
  platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  activity_name varchar(200) NOT NULL,
  activity_type varchar(50) NOT NULL DEFAULT '大促活动',
  signup_deadline timestamptz NOT NULL,
  activity_start timestamptz,
  activity_end timestamptz,
  requirements text DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reminded', 'done', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_reminder_status ON public.compliance_activity_reminder(signup_deadline) WHERE status <> 'done';


-- 6. 行级安全隔离与权限
ALTER TABLE public.compliance_rule_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rule_change ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_risk_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_activity_reminder ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_rule_snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rule_change FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_risk_assessment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_activity_reminder FORCE ROW LEVEL SECURITY;

-- 读权限：只要是已登录用户且有对应平台权限即可看
DROP POLICY IF EXISTS p_rule_snapshot_select ON public.compliance_rule_snapshot;
CREATE POLICY p_rule_snapshot_select ON public.compliance_rule_snapshot FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(platform_code::text));

DROP POLICY IF EXISTS p_rule_change_select ON public.compliance_rule_change;
CREATE POLICY p_rule_change_select ON public.compliance_rule_change FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(platform_code::text));

DROP POLICY IF EXISTS p_risk_assessment_select ON public.compliance_risk_assessment;
CREATE POLICY p_risk_assessment_select ON public.compliance_risk_assessment FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.compliance_rule_change c
      WHERE c.id = change_id AND rls_has_platform(c.platform_code::text)
    )
  );

DROP POLICY IF EXISTS p_activity_reminder_select ON public.compliance_activity_reminder;
CREATE POLICY p_activity_reminder_select ON public.compliance_activity_reminder FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL AND rls_has_platform(platform_code::text));

-- 写权限：机构运营、合规风控与超管
DROP POLICY IF EXISTS p_rule_snapshot_write ON public.compliance_rule_snapshot;
CREATE POLICY p_rule_snapshot_write ON public.compliance_rule_snapshot FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]));

DROP POLICY IF EXISTS p_rule_change_write ON public.compliance_rule_change;
CREATE POLICY p_rule_change_write ON public.compliance_rule_change FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]));

DROP POLICY IF EXISTS p_risk_assessment_write ON public.compliance_risk_assessment;
CREATE POLICY p_risk_assessment_write ON public.compliance_risk_assessment FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]));

DROP POLICY IF EXISTS p_activity_reminder_write ON public.compliance_activity_reminder;
CREATE POLICY p_activity_reminder_write ON public.compliance_activity_reminder FOR ALL TO leyova_app
  USING (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))
  WITH CHECK (rls_is_agency_staff() AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_rule_snapshot TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_rule_change TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_risk_assessment TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_activity_reminder TO leyova_app;

GRANT USAGE, SELECT ON SEQUENCE public.compliance_rule_snapshot_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.compliance_rule_change_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.compliance_risk_assessment_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.compliance_activity_reminder_id_seq TO leyova_app;
