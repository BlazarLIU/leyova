-- database/migrations/198_p14_video_template_layer.sql
-- Part F.1 全类型自动剪辑：模板 DSL + 槽位 + 装配 + 渲染质检
--
-- 设计要点：
--   1. 剪辑拆成三层：模板（template/versions）、装配（project/shot_items）、渲染（render_jobs/outputs）；
--   2. 模板版本化且可灰度：published 版本 + gray_ratio（0-100）决定新项目使用哪个版本；
--   3. 槽位由 DSL + JSON 值双重校验，缺必选槽在装配入口直接拒绝；
--   4. 质检门禁结果落 render_jobs.gate_result / render_outputs.qc，不通过不产出成片；
--   5. 首期 8 类模板随迁移种子化，后续扩展只加模板不改代码。
BEGIN;

-- ── 品牌套件 ──
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  primary_color VARCHAR(16) NOT NULL DEFAULT '#111827',
  secondary_color VARCHAR(16) NOT NULL DEFAULT '#F59E0B',
  font_family VARCHAR(80) NOT NULL DEFAULT 'Source Han Sans SC',
  logo_path TEXT NOT NULL DEFAULT '',
  intro_path TEXT NOT NULL DEFAULT '',
  outro_path TEXT NOT NULL DEFAULT '',
  watermark JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- ── 音色档案 ──
CREATE TABLE IF NOT EXISTS public.voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'system',
  voice_id VARCHAR(120) NOT NULL DEFAULT '',
  language VARCHAR(16) NOT NULL DEFAULT 'zh',
  speed NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  pitch NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  sample_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_voice_provider CHECK (provider IN ('system', 'tts', 'clone')),
  UNIQUE (tenant_id, code)
);

-- ── BGM 库 ──
CREATE TABLE IF NOT EXISTS public.bgm_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  title VARCHAR(160) NOT NULL,
  file_path TEXT NOT NULL DEFAULT '',
  duration_ms INT NOT NULL DEFAULT 0,
  mood VARCHAR(40) NOT NULL DEFAULT 'upbeat',
  bpm INT NOT NULL DEFAULT 0,
  loudness NUMERIC(5, 2) NOT NULL DEFAULT -14.00,
  license VARCHAR(80) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- ── 字幕样式 ──
CREATE TABLE IF NOT EXISTS public.subtitle_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  font_family VARCHAR(80) NOT NULL DEFAULT 'Source Han Sans SC',
  font_size INT NOT NULL DEFAULT 42,
  color VARCHAR(16) NOT NULL DEFAULT '#FFFFFF',
  stroke_color VARCHAR(16) NOT NULL DEFAULT '#000000',
  position VARCHAR(20) NOT NULL DEFAULT 'bottom',
  safe_area BOOLEAN NOT NULL DEFAULT TRUE,
  max_chars INT NOT NULL DEFAULT 16,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_subtitle_position CHECK (position IN ('top', 'center', 'bottom')),
  UNIQUE (tenant_id, code)
);

-- ── 视频模板（8 类）──
CREATE TABLE IF NOT EXISTS public.video_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  code VARCHAR(60) NOT NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(32) NOT NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'assembly',
  aspect VARCHAR(12) NOT NULL DEFAULT '9:16',
  min_duration_sec INT NOT NULL DEFAULT 15,
  max_duration_sec INT NOT NULL DEFAULT 30,
  brand_kit_id UUID NULL REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  gray_ratio INT NOT NULL DEFAULT 100,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_video_template_category CHECK (category IN (
    'live_highlight', 'product_seed', 'talking_head', 'image_text',
    'batch_mashup', 'review_compare', 'tutorial_steps', 'report_teaser'
  )),
  CONSTRAINT ck_video_template_type CHECK (type IN ('selection', 'assembly', 'generation')),
  CONSTRAINT ck_video_template_status CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT ck_video_template_gray CHECK (gray_ratio BETWEEN 0 AND 100),
  CONSTRAINT ck_video_template_duration CHECK (min_duration_sec > 0 AND max_duration_sec >= min_duration_sec),
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_video_templates_tenant
  ON public.video_templates (tenant_id, status, category);

-- ── 模板版本（DSL 全量快照）──
CREATE TABLE IF NOT EXISTS public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  template_id UUID NOT NULL REFERENCES public.video_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  dsl JSONB NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_canary BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_template_version_status CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT ck_template_version_no CHECK (version > 0),
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template
  ON public.template_versions (tenant_id, template_id, version DESC);

-- ── 装配项目 ──
CREATE TABLE IF NOT EXISTS public.video_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  template_id UUID NOT NULL REFERENCES public.video_templates(id) ON DELETE RESTRICT,
  template_version_id UUID NULL REFERENCES public.template_versions(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'template_fill',
  aspect VARCHAR(12) NOT NULL DEFAULT '9:16',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  slot_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_asset_id UUID NULL REFERENCES public.media_assets(id) ON DELETE SET NULL,
  business_key VARCHAR(120) NOT NULL DEFAULT '',
  automation_level VARCHAR(8) NOT NULL DEFAULT 'L1',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_video_project_mode CHECK (mode IN ('template_fill', 'script_to_video', 'mashup')),
  CONSTRAINT ck_video_project_status CHECK (status IN (
    'draft', 'assembling', 'ready', 'rendering', 'rendered', 'failed', 'archived'
  )),
  CONSTRAINT ck_video_project_automation CHECK (automation_level IN ('L1', 'L2', 'L3'))
);

CREATE INDEX IF NOT EXISTS idx_video_projects_tenant
  ON public.video_projects (tenant_id, status, created_at DESC);

-- ── 分镜 / 镜头项 ──
CREATE TABLE IF NOT EXISTS public.shot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  seq INT NOT NULL DEFAULT 0,
  shot_type VARCHAR(24) NOT NULL DEFAULT 'scene',
  title VARCHAR(200) NOT NULL DEFAULT '',
  script_text TEXT NOT NULL DEFAULT '',
  subtitle_text TEXT NOT NULL DEFAULT '',
  asset_path TEXT NOT NULL DEFAULT '',
  media_asset_id UUID NULL REFERENCES public.media_assets(id) ON DELETE SET NULL,
  duration_ms INT NOT NULL DEFAULT 0,
  transition VARCHAR(24) NOT NULL DEFAULT 'cut',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_shot_type CHECK (shot_type IN (
    'hook', 'selling_point', 'proof', 'cta', 'card', 'scene', 'transition'
  )),
  CONSTRAINT ck_shot_duration CHECK (duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shot_items_project
  ON public.shot_items (tenant_id, project_id, seq);

-- ── 渲染任务 ──
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  project_id UUID NOT NULL REFERENCES public.video_projects(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  stage VARCHAR(24) NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 5,
  gate_passed BOOLEAN NULL,
  gate_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NOT NULL DEFAULT '',
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_by BIGINT NULL,
  CONSTRAINT ck_render_job_status CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT ck_render_job_stage CHECK (stage IN (
    'queued', 'precheck', 'assemble', 'audio', 'subtitle', 'qc', 'done', 'failed'
  )),
  CONSTRAINT ck_render_job_progress CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT ck_render_job_priority CHECK (priority BETWEEN 1 AND 9)
);

CREATE INDEX IF NOT EXISTS idx_render_jobs_tenant
  ON public.render_jobs (tenant_id, status, queued_at);

-- ── 渲染产物 ──
CREATE TABLE IF NOT EXISTS public.render_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  job_id UUID NOT NULL REFERENCES public.render_jobs(id) ON DELETE CASCADE,
  output_path TEXT NOT NULL DEFAULT '',
  cover_path TEXT NOT NULL DEFAULT '',
  subtitle_path TEXT NOT NULL DEFAULT '',
  duration_ms INT NOT NULL DEFAULT 0,
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  loudness NUMERIC(5, 2) NULL,
  content_asset_id BIGINT NULL,
  qc JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_render_output_duration CHECK (duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_render_outputs_job
  ON public.render_outputs (tenant_id, job_id);

-- ── 默认品牌套件 / 音色 / BGM / 字幕样式（幂等种子）──
INSERT INTO public.brand_kits (tenant_id, code, name, is_default)
VALUES (1, 'default', '默认品牌套件', TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.voice_profiles (tenant_id, code, name, provider, voice_id, language)
VALUES
  (1, 'female_zh_01', '中文女声-标准', 'system', 'female_zh_01', 'zh'),
  (1, 'male_zh_01', '中文男声-标准', 'system', 'male_zh_01', 'zh')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.bgm_library (tenant_id, code, title, mood, bpm)
VALUES
  (1, 'upbeat_01', '轻快种草', 'upbeat', 120),
  (1, 'warm_01', '温暖叙事', 'warm', 90),
  (1, 'hype_01', '促销节奏', 'hype', 132)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.subtitle_styles (tenant_id, code, name, color, stroke_color, position)
VALUES
  (1, 'bold_yellow', '粗体黄字', '#FFE500', '#000000', 'bottom'),
  (1, 'clean_white', '简洁白字', '#FFFFFF', '#111827', 'bottom')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ── 8 类模板种子 ──
INSERT INTO public.video_templates
  (tenant_id, code, name, category, type, aspect, min_duration_sec, max_duration_sec, description, status, gray_ratio)
VALUES
  (1, 'live_highlight_v1', '直播高光', 'live_highlight', 'selection', '9:16', 15, 60,
   '直播回放选段：ASR → 评分 → 切片 → 烧录字幕', 'active', 100),
  (1, 'product_seed_v1', '商品种草', 'product_seed', 'assembly', '9:16', 15, 30,
   '商品图/视频 + 3–5 个卖点槽 + 价格贴 + CTA', 'active', 100),
  (1, 'talking_head_v1', '口播讲解', 'talking_head', 'generation', '9:16', 30, 90,
   '脚本 + 主播形象 → TTS/真人录制 → 字幕贴片', 'active', 100),
  (1, 'image_text_v1', '图文成片', 'image_text', 'assembly', '9:16', 20, 40,
   '6–12 张图 + 文案 → 分页 → TTS → 转场', 'active', 100),
  (1, 'batch_mashup_v1', '批量混剪', 'batch_mashup', 'assembly', '9:16', 15, 30,
   '素材库 + 钩子/CTA 库组合，去重后批量渲染', 'active', 100),
  (1, 'review_compare_v1', '测评对比', 'review_compare', 'assembly', '9:16', 30, 60,
   '双商品参数对齐 → 对比表/分屏 → 结论', 'active', 100),
  (1, 'tutorial_steps_v1', '教程步骤', 'tutorial_steps', 'assembly', '9:16', 30, 60,
   '步骤拆分 → 步骤卡/序号 → 配音 → 字幕', 'active', 100),
  (1, 'report_teaser_v1', '战报预告', 'report_teaser', 'assembly', '9:16', 15, 30,
   '指标/排期 → 数据卡 → 倒计时 → 渲染', 'active', 100)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.template_versions (tenant_id, template_id, version, dsl, changelog, status)
SELECT 1, t.id, 1, v.dsl, '首期模板', 'published'
  FROM (VALUES
    ('live_highlight_v1', '{
      "template": "live_highlight_v1",
      "type": "selection",
      "aspect": "9:16",
      "duration": { "min": 15, "max": 60 },
      "brand_kit": "default",
      "slots": [
        { "key": "source_asset", "label": "直播回放", "type": "media", "required": true },
        { "key": "hook", "label": "开头钩子", "type": "text", "required": false, "maxLength": 18 }
      ],
      "audio": { "voice": "female_zh_01", "bgm": "", "loudness": -14 },
      "subtitles": { "style": "bold_yellow", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "off" }
    }'::jsonb),
    ('product_seed_v1', '{
      "template": "product_seed_v1",
      "type": "assembly",
      "aspect": "9:16",
      "duration": { "min": 15, "max": 30 },
      "brand_kit": "default",
      "slots": [
        { "key": "hook", "label": "开头钩子", "type": "text", "required": true, "maxLength": 18 },
        { "key": "product_images", "label": "商品图", "type": "image_list", "required": true, "countMin": 3, "countMax": 5 },
        { "key": "selling_points", "label": "卖点", "type": "text_list", "required": true, "countMin": 3, "countMax": 5 },
        { "key": "price_tag", "label": "价格贴", "type": "text", "required": false, "maxLength": 20 },
        { "key": "cta", "label": "行动号召", "type": "text", "required": true, "maxLength": 12 }
      ],
      "audio": { "voice": "female_zh_01", "bgm": "upbeat_01", "loudness": -14 },
      "subtitles": { "style": "bold_yellow", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "if_generated" }
    }'::jsonb),
    ('talking_head_v1', '{
      "template": "talking_head_v1",
      "type": "generation",
      "aspect": "9:16",
      "duration": { "min": 30, "max": 90 },
      "brand_kit": "default",
      "slots": [
        { "key": "script", "label": "口播脚本", "type": "text", "required": true, "maxLength": 800 },
        { "key": "anchor_image", "label": "主播形象", "type": "image", "required": false },
        { "key": "cta", "label": "行动号召", "type": "text", "required": false, "maxLength": 12 }
      ],
      "audio": { "voice": "female_zh_01", "bgm": "", "loudness": -14 },
      "subtitles": { "style": "clean_white", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "if_generated" }
    }'::jsonb),
    ('image_text_v1', '{
      "template": "image_text_v1",
      "type": "assembly",
      "aspect": "9:16",
      "duration": { "min": 20, "max": 40 },
      "brand_kit": "default",
      "slots": [
        { "key": "images", "label": "图片", "type": "image_list", "required": true, "countMin": 6, "countMax": 12 },
        { "key": "copy", "label": "文案", "type": "text", "required": true, "maxLength": 300 },
        { "key": "bgm", "label": "背景音乐", "type": "select", "required": false, "options": ["upbeat_01", "warm_01"] }
      ],
      "audio": { "voice": "female_zh_01", "bgm": "warm_01", "loudness": -14 },
      "subtitles": { "style": "clean_white", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "if_generated" }
    }'::jsonb),
    ('batch_mashup_v1', '{
      "template": "batch_mashup_v1",
      "type": "assembly",
      "aspect": "9:16",
      "duration": { "min": 15, "max": 30 },
      "brand_kit": "default",
      "slots": [
        { "key": "material_clips", "label": "素材片段", "type": "video_list", "required": true, "countMin": 3, "countMax": 10 },
        { "key": "hook_library", "label": "钩子库", "type": "text_list", "required": false, "countMin": 1, "countMax": 10 },
        { "key": "cta", "label": "行动号召", "type": "text", "required": true, "maxLength": 12 },
        { "key": "dedupe_rule", "label": "去重规则", "type": "select", "required": false, "options": ["strict", "loose"] }
      ],
      "audio": { "voice": "female_zh_01", "bgm": "hype_01", "loudness": -14 },
      "subtitles": { "style": "bold_yellow", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "if_generated" }
    }'::jsonb),
    ('review_compare_v1', '{
      "template": "review_compare_v1",
      "type": "assembly",
      "aspect": "9:16",
      "duration": { "min": 30, "max": 60 },
      "brand_kit": "default",
      "slots": [
        { "key": "product_a", "label": "商品 A", "type": "text", "required": true, "maxLength": 80 },
        { "key": "product_b", "label": "商品 B", "type": "text", "required": true, "maxLength": 80 },
        { "key": "compare_metrics", "label": "对比维度", "type": "text_list", "required": true, "countMin": 2, "countMax": 8 },
        { "key": "conclusion", "label": "结论", "type": "text", "required": true, "maxLength": 120 }
      ],
      "audio": { "voice": "male_zh_01", "bgm": "warm_01", "loudness": -14 },
      "subtitles": { "style": "clean_white", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "off" }
    }'::jsonb),
    ('tutorial_steps_v1', '{
      "template": "tutorial_steps_v1",
      "type": "assembly",
      "aspect": "9:16",
      "duration": { "min": 30, "max": 60 },
      "brand_kit": "default",
      "slots": [
        { "key": "steps", "label": "步骤", "type": "text_list", "required": true, "countMin": 3, "countMax": 8 },
        { "key": "screenshots", "label": "步骤截图", "type": "image_list", "required": true, "countMin": 3, "countMax": 8 },
        { "key": "intro", "label": "开场", "type": "text", "required": false, "maxLength": 60 }
      ],
      "audio": { "voice": "female_zh_01", "bgm": "warm_01", "loudness": -14 },
      "subtitles": { "style": "clean_white", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "off" }
    }'::jsonb),
    ('report_teaser_v1', '{
      "template": "report_teaser_v1",
      "type": "assembly",
      "aspect": "9:16",
      "duration": { "min": 15, "max": 30 },
      "brand_kit": "default",
      "slots": [
        { "key": "metric_cards", "label": "指标卡", "type": "json", "required": true },
        { "key": "countdown_days", "label": "倒计时天数", "type": "number", "required": false },
        { "key": "cta", "label": "行动号召", "type": "text", "required": false, "maxLength": 12 }
      ],
      "audio": { "voice": "male_zh_01", "bgm": "hype_01", "loudness": -14 },
      "subtitles": { "style": "bold_yellow", "safe_area": true },
      "rules": { "banned_words_check": "hard", "brand_logo": "bottom_right", "ai_label": "off" }
    }'::jsonb)
  ) AS v(code, dsl)
  JOIN public.video_templates t ON t.tenant_id = 1 AND t.code = v.code
ON CONFLICT (template_id, version) DO NOTHING;

-- ── RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'brand_kits', 'voice_profiles', 'bgm_library', 'subtitle_styles',
    'video_templates', 'template_versions', 'video_projects', 'shot_items',
    'render_jobs', 'render_outputs'
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
