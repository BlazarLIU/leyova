-- ============================================================================
-- Migration: 102_content_center.sql
-- Description: 内容中心（ComfyUI 预开发）
--   1. content_providers      生成服务配置（本地 ComfyUI 地址等）
--   2. content_projects       创作项目
--   3. content_tasks          生成任务（文生视频/图生视频/配音/剪辑）
--   4. content_assets         素材与产物
--   5. video_metrics          各平台视频/笔记数据
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_providers (
    id serial PRIMARY KEY,
    name varchar(100) NOT NULL,
    provider_type varchar(30) NOT NULL DEFAULT 'comfyui',  -- 'comfyui' | 'mock'
    base_url varchar(500) NOT NULL,
    api_key varchar(255),
    is_enabled boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    capabilities jsonb DEFAULT '{}'::jsonb,
    last_checked_at timestamptz,
    last_check_result varchar(30),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_projects (
    id serial PRIMARY KEY,
    name varchar(200) NOT NULL,
    description text DEFAULT '',
    platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
    shop_id bigint REFERENCES public.dim_shop(id) ON DELETE SET NULL,
    status varchar(20) DEFAULT 'active' NOT NULL,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_tasks (
    id bigserial PRIMARY KEY,
    project_id integer REFERENCES public.content_projects(id) ON DELETE CASCADE,
    provider_id integer REFERENCES public.content_providers(id) ON DELETE SET NULL,
    task_type varchar(30) NOT NULL,             -- 'text2video' | 'image2video' | 'tts' | 'edit'
    status varchar(20) DEFAULT 'pending' NOT NULL, -- pending|running|completed|failed
    prompt text DEFAULT '',
    workflow jsonb DEFAULT '{}'::jsonb,         -- ComfyUI workflow JSON 模板 + 参数
    comfy_prompt_id varchar(100),
    progress integer DEFAULT 0,
    output_url text,
    output_assets jsonb DEFAULT '[]'::jsonb,
    error_message text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_tasks_status ON public.content_tasks (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_tasks_project ON public.content_tasks (project_id);

CREATE TABLE IF NOT EXISTS public.content_assets (
    id bigserial PRIMARY KEY,
    project_id integer REFERENCES public.content_projects(id) ON DELETE CASCADE,
    task_id bigint REFERENCES public.content_tasks(id) ON DELETE SET NULL,
    asset_type varchar(30) NOT NULL DEFAULT 'video', -- image|video|audio|text
    name varchar(200) NOT NULL,
    url text,
    local_path text,
    size_bytes bigint DEFAULT 0,
    duration_seconds integer DEFAULT 0,
    provider varchar(50) DEFAULT 'comfyui',
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.video_metrics (
    id bigserial PRIMARY KEY,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id bigint REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    video_id varchar(100) NOT NULL,
    title varchar(300) DEFAULT '',
    content_type varchar(30) DEFAULT 'short_video', -- short_video|note|live_clip
    impressions bigint DEFAULT 0 NOT NULL,
    plays bigint DEFAULT 0 NOT NULL,
    complete_rate numeric(6,2) DEFAULT 0 NOT NULL,
    likes bigint DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    collects integer DEFAULT 0 NOT NULL,
    attributed_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source varchar(20) DEFAULT 'manual' NOT NULL,   -- api|manual
    upload_id integer REFERENCES public.data_uploads(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(platform_code, video_id, biz_date)
);
CREATE INDEX IF NOT EXISTS idx_video_metrics_date ON public.video_metrics (biz_date DESC, platform_code);

INSERT INTO public.schema_migrations (version, name)
VALUES ('102_content_center', 'Content center: providers, projects, tasks, assets, video metrics')
ON CONFLICT (version) DO NOTHING;
