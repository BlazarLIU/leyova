-- database/migrations/199_p14_director_workbench.sql
-- Part F.2 编导 AI 工作台：选题 → 简报 → 脚本版本 → 分镜 → 日历 → 效果回流
--
-- 设计要点：
--   1. 选题机会分由确定性公式计算（见 apps/api/src/director/scoring.ts），LLM 只写描述；
--   2. 缺失输入显式记录在 content_ideas.missing_items，不猜测；
--   3. 脚本按版本留痕，合规检查结果随版本落库；
--   4. 效果回流通过 content_metrics_link 关联 script_version ↔ video_metrics，可回测。
BEGIN;

-- ── 选题 ──
CREATE TABLE IF NOT EXISTS public.content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  title VARCHAR(200) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT '通用',
  platform_code VARCHAR(32) NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'manual',
  product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunity_score NUMERIC(5, 2) NULL,
  score_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT NOT NULL DEFAULT '',
  ai_description TEXT NOT NULL DEFAULT '',
  season_event_id UUID NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'candidate',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_content_idea_source CHECK (source IN (
    'manual', 'seasonal', 'product', 'history', 'ai'
  )),
  CONSTRAINT ck_content_idea_status CHECK (status IN (
    'candidate', 'shortlisted', 'briefed', 'rejected', 'published'
  )),
  CONSTRAINT ck_content_idea_score CHECK (opportunity_score IS NULL OR opportunity_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_content_ideas_tenant
  ON public.content_ideas (tenant_id, status, opportunity_score DESC NULLS LAST);

-- ── 创作简报 ──
CREATE TABLE IF NOT EXISTS public.content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  idea_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  objective VARCHAR(200) NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints TEXT NOT NULL DEFAULT '',
  platform_code VARCHAR(32) NULL,
  due_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_content_brief_status CHECK (status IN (
    'draft', 'approved', 'in_production', 'done', 'cancelled'
  ))
);

CREATE INDEX IF NOT EXISTS idx_content_briefs_tenant
  ON public.content_briefs (tenant_id, status, created_at DESC);

-- ── 脚本版本 ──
CREATE TABLE IF NOT EXISTS public.script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  brief_id UUID NULL REFERENCES public.content_briefs(id) ON DELETE CASCADE,
  idea_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1,
  variant VARCHAR(8) NOT NULL DEFAULT 'A',
  title VARCHAR(200) NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  body JSONB NOT NULL DEFAULT '[]'::jsonb,
  proof TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  words_count INT NOT NULL DEFAULT 0,
  compliance_status VARCHAR(16) NOT NULL DEFAULT 'pending',
  compliance_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_script_version_no CHECK (version > 0),
  CONSTRAINT ck_script_compliance CHECK (compliance_status IN ('pending', 'passed', 'failed')),
  CONSTRAINT ck_script_status CHECK (status IN ('draft', 'reviewing', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_script_versions_brief
  ON public.script_versions (tenant_id, brief_id, version DESC);

-- ── 分镜 ──
CREATE TABLE IF NOT EXISTS public.storyboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  script_version_id UUID NOT NULL REFERENCES public.script_versions(id) ON DELETE CASCADE,
  seq INT NOT NULL DEFAULT 0,
  shot_size VARCHAR(20) NOT NULL DEFAULT '中景',
  scene TEXT NOT NULL DEFAULT '',
  subtitle_text TEXT NOT NULL DEFAULT '',
  duration_sec INT NOT NULL DEFAULT 0,
  camera TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_storyboard_duration CHECK (duration_sec >= 0)
);

CREATE INDEX IF NOT EXISTS idx_storyboards_script
  ON public.storyboards (tenant_id, script_version_id, seq);

-- ── 季节 / 节点日历 ──
CREATE TABLE IF NOT EXISTS public.seasonal_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  event_code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  event_type VARCHAR(24) NOT NULL DEFAULT 'festival',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  platform_code VARCHAR(32) NULL,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  importance INT NOT NULL DEFAULT 3,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_seasonal_event_type CHECK (event_type IN (
    'festival', 'platform_promo', 'category_season'
  )),
  CONSTRAINT ck_seasonal_importance CHECK (importance BETWEEN 1 AND 5),
  CONSTRAINT ck_seasonal_range CHECK (end_date >= start_date),
  UNIQUE (tenant_id, event_code)
);

CREATE INDEX IF NOT EXISTS idx_seasonal_calendar_range
  ON public.seasonal_calendar (tenant_id, start_date, end_date);

-- ── 选题表现（按时间窗聚合）──
CREATE TABLE IF NOT EXISTS public.topic_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  idea_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  category VARCHAR(80) NOT NULL DEFAULT '通用',
  platform_code VARCHAR(32) NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  sample_size INT NOT NULL DEFAULT 0,
  avg_plays NUMERIC(14, 2) NOT NULL DEFAULT 0,
  avg_engagement_rate NUMERIC(6, 2) NOT NULL DEFAULT 0,
  avg_gmv NUMERIC(14, 2) NOT NULL DEFAULT 0,
  score NUMERIC(5, 2) NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_topic_performance_range CHECK (window_end >= window_start)
);

CREATE INDEX IF NOT EXISTS idx_topic_performance_tenant
  ON public.topic_performance (tenant_id, category, window_end DESC);

-- ── 内容 ↔ 指标回流关联 ──
CREATE TABLE IF NOT EXISTS public.content_metrics_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  script_version_id UUID NULL REFERENCES public.script_versions(id) ON DELETE SET NULL,
  idea_id UUID NULL REFERENCES public.content_ideas(id) ON DELETE SET NULL,
  video_id VARCHAR(100) NOT NULL,
  platform_code VARCHAR(32) NOT NULL,
  biz_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_metrics_link_version
  ON public.content_metrics_link (tenant_id, script_version_id, biz_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_metrics_link_video
  ON public.content_metrics_link (tenant_id, platform_code, video_id, biz_date);

-- ── 季节节点种子（幂等）──
INSERT INTO public.seasonal_calendar
  (tenant_id, event_code, name, event_type, start_date, end_date, categories, importance, notes)
VALUES
  (1, 'double12_2026', '双12', 'platform_promo', '2026-12-01', '2026-12-12', '["服饰","美妆","食品"]'::jsonb, 4, '平台年终大促'),
  (1, 'newyear_2027', '年货节', 'festival', '2027-01-05', '2027-01-28', '["食品","家居","礼盒"]'::jsonb, 5, '春节前礼盒与囤货'),
  (1, 'women_day_2027', '38 节', 'festival', '2027-02-20', '2027-03-08', '["美妆","服饰","个护"]'::jsonb, 4, '女性消费节点'),
  (1, '618_2027', '618', 'platform_promo', '2027-05-20', '2027-06-18', '["全品类"]'::jsonb, 5, '年中大促'),
  (1, 'midautumn_2027', '中秋', 'festival', '2027-09-10', '2027-09-17', '["食品","礼盒"]'::jsonb, 4, '礼赠节点'),
  (1, 'nationalday_2027', '国庆', 'festival', '2027-09-28', '2027-10-07', '["旅行","服饰","食品"]'::jsonb, 3, '长假消费'),
  (1, 'double11_2027', '双11', 'platform_promo', '2027-10-20', '2027-11-11', '["全品类"]'::jsonb, 5, '年度最大促')
ON CONFLICT (tenant_id, event_code) DO NOTHING;

-- ── RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'content_ideas', 'content_briefs', 'script_versions', 'storyboards',
    'seasonal_calendar', 'topic_performance', 'content_metrics_link'
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
