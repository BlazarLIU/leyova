-- database/migrations/193_p11_media_pipeline.sql
-- W11 媒体流水线：上传 → ASR 转写 → 高光评分 → FFmpeg 渲染切片 → 剪映草稿
-- 设计要点：
--   1. 源文件与产物统一落 MEDIA_ROOT 下的受控目录，URL 走鉴权下载端点，不做目录裸暴露；
--   2. 转写片段沿用 W9 契约 {text,startMs,endMs,speaker}，可直接进化知识库；
--   3. 渲染任务状态机 queued → running → succeeded/failed，失败保留错误原因；
--   4. 切片产物回写 content_assets（parent_asset_id 指向母版），复用既有分发与合规字段。
BEGIN;

-- ── 源素材（上传的直播回放/视频）──
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  source_type VARCHAR(16) NOT NULL DEFAULT 'upload',
  storage_path TEXT NOT NULL DEFAULT '',
  mime_type VARCHAR(100) NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  width INT NULL,
  height INT NULL,
  has_audio BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(16) NOT NULL DEFAULT 'uploaded',
  business_key VARCHAR(120) NOT NULL DEFAULT '',
  content_asset_id BIGINT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_media_asset_status CHECK (status IN ('uploaded', 'transcribing', 'transcribed', 'analysing', 'analysed', 'failed')),
  CONSTRAINT ck_media_asset_source CHECK (source_type IN ('upload', 'url', 'record'))
);

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant
  ON public.media_assets (tenant_id, status, created_at DESC);

-- ── 转写（ASR 结果或人工上传字幕稿）──
CREATE TABLE IF NOT EXISTS public.media_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL DEFAULT 'manual',
  language VARCHAR(16) NOT NULL DEFAULT 'zh',
  segment_count INT NOT NULL DEFAULT 0,
  -- [{"text","startMs","endMs","speaker"}]
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_text TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'ready',
  error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_media_transcript_provider CHECK (provider IN ('manual', 'whisper', 'volcengine', 'dashscope')),
  CONSTRAINT ck_media_transcript_status CHECK (status IN ('pending', 'ready', 'failed')),
  UNIQUE (asset_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_media_transcripts_asset
  ON public.media_transcripts (tenant_id, asset_id);

-- ── 高光候选 ──
CREATE TABLE IF NOT EXISTS public.media_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  transcript_id UUID NULL REFERENCES public.media_transcripts(id) ON DELETE SET NULL,
  start_ms INT NOT NULL,
  end_ms INT NOT NULL,
  duration_ms INT NOT NULL,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL DEFAULT '',
  reason VARCHAR(500) NOT NULL DEFAULT '',
  -- 评分明细：{"keyword":..,"density":..,"peak":..,"llm":..}
  score_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_media_highlight_status CHECK (status IN ('candidate', 'selected', 'rejected', 'rendered', 'failed')),
  CONSTRAINT ck_media_highlight_range CHECK (start_ms >= 0 AND end_ms > start_ms AND duration_ms > 0),
  CONSTRAINT ck_media_highlight_score CHECK (score >= 0 AND score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_media_highlights_asset
  ON public.media_highlights (tenant_id, asset_id, score DESC);

-- ── 渲染任务 ──
CREATE TABLE IF NOT EXISTS public.media_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  highlight_id UUID NULL REFERENCES public.media_highlights(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  stage VARCHAR(24) NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  output_path TEXT NOT NULL DEFAULT '',
  cover_path TEXT NOT NULL DEFAULT '',
  subtitle_path TEXT NOT NULL DEFAULT '',
  content_asset_id BIGINT NULL,
  duration_ms INT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_media_render_status CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  CONSTRAINT ck_media_render_stage CHECK (stage IN ('queued', 'probe', 'cut', 'subtitle', 'cover', 'done', 'failed')),
  CONSTRAINT ck_media_render_progress CHECK (progress BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_media_render_jobs_tenant
  ON public.media_render_jobs (tenant_id, status, created_at DESC);

-- ── 剪映草稿导出记录 ──
CREATE TABLE IF NOT EXISTS public.media_draft_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  asset_id UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  clip_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_path TEXT NOT NULL DEFAULT '',
  draft_json_path TEXT NOT NULL DEFAULT '',
  clip_count INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'ready',
  error TEXT NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_media_draft_status CHECK (status IN ('ready', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_media_draft_exports_tenant
  ON public.media_draft_exports (tenant_id, created_at DESC);

-- ── RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'media_assets', 'media_transcripts', 'media_highlights',
    'media_render_jobs', 'media_draft_exports'
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