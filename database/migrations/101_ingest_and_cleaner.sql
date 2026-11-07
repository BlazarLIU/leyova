-- ============================================================================
-- Migration: 101_ingest_and_cleaner.sql
-- Description: Custom data cleaning engine and ingest sync tracking:
--   1. clean_rule_sets: Preserved and user-customizable cleaning rule pipelines
--   2. upload_column_mappings: Intelligent column name mapping definitions
--   3. ingest_sync_jobs: Official API sync and manual upload job tracking
-- ============================================================================

-- 1. Cleaning Rule Sets
CREATE TABLE IF NOT EXISTS public.clean_rule_sets (
    id serial PRIMARY KEY,
    name varchar(100) NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    description text DEFAULT '',
    is_system boolean DEFAULT false NOT NULL,
    rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Seed default official cleaning rules for Douyin, Taobao, Pinduoduo
INSERT INTO public.clean_rule_sets (name, platform_code, description, is_system, rules)
VALUES
(
    '抖音直播与短视频官方清洗模式',
    'douyin',
    '自动解析中文时长（如“2小时30分”）、转换百分比、清洗货币符号并校验 GMV 逻辑',
    true,
    '[
        {"type": "cast_currency", "targetColumn": "成交额", "onError": "drop"},
        {"type": "cast_percent", "targetColumn": "曝光-观看转化率", "onError": "keep"},
        {"type": "cast_duration", "targetColumn": "直播时长", "params": {"unit": "minute"}, "onError": "keep"},
        {"type": "fill_null", "targetColumn": "退款金额", "params": {"defaultValue": 0}, "onError": "keep"},
        {"type": "assert_expr", "targetColumn": "成交额", "params": {"expr": "row.gmv >= row.refund_amount"}, "onError": "mark"}
    ]'::jsonb
),
(
    '淘宝/天猫货架店铺经营清洗模式',
    'taobao',
    '标准化店铺维度指标、清洗买家实付款、去重同商品多 SKU 数据',
    true,
    '[
        {"type": "rename_column", "targetColumn": "买家实付金额(元)", "params": {"newColumn": "pay_amount"}, "onError": "keep"},
        {"type": "cast_currency", "targetColumn": "pay_amount", "onError": "drop"},
        {"type": "cast_percent", "targetColumn": "支付转化率", "onError": "keep"},
        {"type": "dedup_by_keys", "params": {"keys": ["商品ID", "统计日期"], "keep": "latest"}, "onError": "drop"}
    ]'::jsonb
),
(
    '拼多多爆款与仅退款清洗模式',
    'pdd',
    '过滤未成团订单、标准化仅退款比率、截断异常破价数据',
    true,
    '[
        {"type": "cast_currency", "targetColumn": "商家实收金额", "onError": "drop"},
        {"type": "cast_percent", "targetColumn": "成团转化率", "onError": "keep"},
        {"type": "range_clip", "targetColumn": "单品价格", "params": {"min": 0.01, "max": 99999}, "onError": "drop"}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;

-- 2. Upload Column Mappings
CREATE TABLE IF NOT EXISTS public.upload_column_mappings (
    id serial PRIMARY KEY,
    template_code varchar(50) NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    file_header_fingerprint varchar(64) NOT NULL,
    column_mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(platform_code, file_header_fingerprint)
);

-- 3. Ingest Sync Jobs (Track both OpenAPI and manual upload pipeline runs)
CREATE TABLE IF NOT EXISTS public.ingest_sync_jobs (
    id bigserial PRIMARY KEY,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    job_type varchar(30) NOT NULL, -- 'api_sync' | 'manual_upload'
    status varchar(20) DEFAULT 'pending' NOT NULL, -- 'pending' | 'running' | 'completed' | 'failed'
    watermark_from text,
    watermark_to text,
    input_rows integer DEFAULT 0,
    success_rows integer DEFAULT 0,
    dropped_rows integer DEFAULT 0,
    marked_rows integer DEFAULT 0,
    error_summary text,
    clean_rule_set_id integer REFERENCES public.clean_rule_sets(id) ON DELETE SET NULL,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_shop ON public.ingest_sync_jobs (shop_id, status);

-- Record migration in registry
INSERT INTO public.schema_migrations (version, name)
VALUES ('101_ingest_and_cleaner', 'Custom data cleaning engine models, mappings, and sync tracking')
ON CONFLICT (version) DO NOTHING;

