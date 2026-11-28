-- database/migrations/194_p12_publish_qianchuan_feedback.sql
-- W12 发布 + 千川 + 回流迭代
-- 设计要点：
--   1. 发布走任务状态机，未配置平台凭证时降级为「待人工发布」，不伪造成功；
--   2. 千川预算变更属 R3，必须走审批，禁止直接改远端；
--   3. 回流闭环：效果快照 → 规则建议 → 人工审核 → 生成新 Prompt 版本（不自动生效）。
BEGIN;

-- ── 发布任务 ──
CREATE TABLE IF NOT EXISTS public.content_publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  schedule_id BIGINT NULL,
  content_asset_id BIGINT NULL,
  platform_code VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  video_path TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  stage VARCHAR(24) NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  external_content_id VARCHAR(128) NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  -- 未配置凭证时记录原因，供人工接管
  blocked_reason VARCHAR(500) NOT NULL DEFAULT '',
  compliance_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  compliance_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INT NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_publish_job_status CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'manual_required', 'cancelled')),
  CONSTRAINT ck_publish_job_stage CHECK (stage IN ('queued', 'compliance', 'upload', 'publish', 'done', 'failed')),
  CONSTRAINT ck_publish_job_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT ck_publish_job_compliance CHECK (compliance_status IN ('pending', 'passed', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_tenant
  ON public.content_publish_jobs (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_schedule
  ON public.content_publish_jobs (tenant_id, schedule_id);

-- ── 千川同步批次 ──
CREATE TABLE IF NOT EXISTS public.qianchuan_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  source VARCHAR(16) NOT NULL DEFAULT 'manual',
  biz_date_from DATE NULL,
  biz_date_to DATE NULL,
  row_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'succeeded',
  error TEXT NOT NULL DEFAULT '',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_qianchuan_sync_source CHECK (source IN ('manual', 'api')),
  CONSTRAINT ck_qianchuan_sync_status CHECK (status IN ('succeeded', 'failed', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_qianchuan_sync_tenant
  ON public.qianchuan_sync_runs (tenant_id, created_at DESC);

-- ── 千川预算变更申请（R3 审批）──
CREATE TABLE IF NOT EXISTS public.qianchuan_budget_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  plan_id BIGINT NOT NULL,
  current_budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
  requested_budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reason VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_note VARCHAR(500) NOT NULL DEFAULT '',
  applied_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_qianchuan_budget_status CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  CONSTRAINT ck_qianchuan_budget_positive CHECK (requested_budget > 0)
);

CREATE INDEX IF NOT EXISTS idx_qianchuan_budget_tenant
  ON public.qianchuan_budget_requests (tenant_id, status, created_at DESC);

-- ── 回流迭代：效果快照与建议 ──
CREATE TABLE IF NOT EXISTS public.content_feedback_loops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  business_key VARCHAR(120) NOT NULL DEFAULT '',
  template_key VARCHAR(64) NOT NULL DEFAULT '',
  template_version INT NOT NULL DEFAULT 0,
  window_days INT NOT NULL DEFAULT 7,
  -- 指标快照：{"views":..,"gmv":..,"orders":..,"adSpend":..,"roi":..}
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 建议：[{"type":"prompt","target":"live_script","action":"...","reason":"..."}]
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  applied_version INT NULL,
  reviewed_by BIGINT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_note VARCHAR(500) NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_feedback_loop_status CHECK (status IN ('pending', 'approved', 'rejected', 'applied'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_loops_tenant
  ON public.content_feedback_loops (tenant_id, status, created_at DESC);

-- ── RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'content_publish_jobs', 'qianchuan_sync_runs',
    'qianchuan_budget_requests', 'content_feedback_loops'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_tenant ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY p_%I_tenant ON public.%I USING ((tenant_id = rls_tenant_id()) OR (rls_role() = ''super_admin'')) WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = ''super_admin''))',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMIT;