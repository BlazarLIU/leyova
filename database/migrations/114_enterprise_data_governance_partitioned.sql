-- ============================================================================
-- Migration: 114_enterprise_data_governance_partitioned.sql
-- Description: 企业级数据清洗与质量校验引擎底座（千万级物理分区与高可用版）
-- Target Scale: 年营收 10 亿+，数据量 5000 万级
-- ============================================================================

-- 1. 导入批次主表 (非分区，存放批次元数据)
CREATE TABLE IF NOT EXISTS public.import_batches (
    id bigserial PRIMARY KEY,
    batch_no varchar(64) UNIQUE NOT NULL,
    source_platform varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    store_id bigint NOT NULL REFERENCES public.dim_shop(id),
    dataset_type varchar(32) NOT NULL, -- 'orders'|'refunds'|'traffic'|'ad_spend'|'live_sessions'
    source_channel varchar(20) NOT NULL, -- 'api' | 'manual_file'
    status varchar(30) DEFAULT 'PROCESSING' NOT NULL, -- 'PROCESSING'|'PROVISIONAL'|'FINAL'|'PARTIAL'|'BLOCKED'|'SUPERSEDED'
    file_hash varchar(64),
    total_raw_rows integer DEFAULT 0,
    clean_candidate_rows integer DEFAULT 0,
    validated_rows integer DEFAULT 0,
    published_rows integer DEFAULT 0,
    error_summary text,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. 导入文件元数据表 (仅 manual_file 上传时使用)
CREATE TABLE IF NOT EXISTS public.import_files (
    id bigserial PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    original_filename varchar(255) NOT NULL,
    file_size_bytes bigint NOT NULL,
    mime_type varchar(100),
    sha256 varchar(64) NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 3. 不可变原始记录表 (按月物理范围分区，解决 TOAST 膨胀)
CREATE TABLE IF NOT EXISTS public.raw_records (
    id bigserial,
    batch_id bigint NOT NULL,
    biz_date date NOT NULL,
    sheet_name varchar(100) DEFAULT 'Sheet1',
    row_no integer NOT NULL,
    raw_payload jsonb NOT NULL,
    payload_hash varchar(64) NOT NULL,
    source_business_key varchar(200),
    ingested_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id),
    CONSTRAINT uk_raw_batch_row UNIQUE (biz_date, batch_id, sheet_name, row_no)
) PARTITION BY RANGE (biz_date);

-- 启用 raw_payload 高压缩存储 (LZ4)
ALTER TABLE public.raw_records ALTER COLUMN raw_payload SET STORAGE EXTENDED;

-- 4. 字段映射规则表 (版本化管理)
CREATE TABLE IF NOT EXISTS public.field_mapping_rules (
    id serial PRIMARY KEY,
    mapping_code varchar(64) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    source_platform varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    dataset_type varchar(32) NOT NULL,
    source_field varchar(100) NOT NULL,
    canonical_field varchar(100) NOT NULL,
    transform varchar(50) DEFAULT 'identity', -- 'identity'|'money_yuan'|'money_fen'|'timestamp_cn'|'enum_map'
    required boolean DEFAULT false,
    approval_status varchar(20) DEFAULT 'approved' NOT NULL, -- 'draft'|'approved'|'deprecated'
    created_at timestamptz DEFAULT now(),
    UNIQUE (source_platform, dataset_type, mapping_code, version, source_field)
);

-- 5. 清洗任务运行表
CREATE TABLE IF NOT EXISTS public.cleaning_runs (
    id bigserial PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    mapping_version varchar(64) NOT NULL,
    cleaning_rule_version varchar(64) NOT NULL,
    status varchar(20) DEFAULT 'QUEUED' NOT NULL, -- 'QUEUED'|'RUNNING'|'COMPLETED'|'FAILED'
    input_count integer DEFAULT 0,
    candidate_count integer DEFAULT 0,
    quarantine_count integer DEFAULT 0,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz
);

-- 6. 标准化候选记录表 (按月物理范围分区)
CREATE TABLE IF NOT EXISTS public.clean_records (
    id bigserial,
    biz_date date NOT NULL,
    batch_id bigint NOT NULL,
    raw_record_id bigint NOT NULL,
    source_platform varchar(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id varchar(100) NOT NULL,
    source_sub_order_id varchar(100) DEFAULT '0',
    paid_amount numeric(18, 4) NOT NULL,
    currency_code varchar(10) DEFAULT 'CNY' NOT NULL,
    cleaning_status varchar(20) DEFAULT 'CANDIDATE' NOT NULL, -- 'CANDIDATE'|'QUARANTINED'
    canonical_payload jsonb NOT NULL,
    quarantine_reason text,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id),
    CONSTRAINT uk_clean_order_item UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id)
) PARTITION BY RANGE (biz_date);

-- 7. 独立校验任务运行表
CREATE TABLE IF NOT EXISTS public.validation_runs (
    id bigserial PRIMARY KEY,
    cleaning_run_id bigint NOT NULL REFERENCES public.cleaning_runs(id) ON DELETE CASCADE,
    rule_set_version varchar(50) NOT NULL,
    status varchar(20) DEFAULT 'RUNNING' NOT NULL, -- 'RUNNING'|'PASSED'|'FAILED_BLOCKING'|'WARNING'
    total_checked integer DEFAULT 0,
    p0_issues_count integer DEFAULT 0,
    p1_issues_count integer DEFAULT 0,
    p2_issues_count integer DEFAULT 0,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz
);

-- 8. 质量问题与人工审核表
CREATE TABLE IF NOT EXISTS public.data_quality_issues (
    id bigserial PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    biz_date date NOT NULL,
    rule_id varchar(50) NOT NULL,
    severity varchar(10) NOT NULL, -- 'P0'|'P1'|'P2'|'P3'
    scope varchar(20) NOT NULL, -- 'record'|'partition'|'batch'|'metric'
    source_business_key varchar(200),
    target_field varchar(50),
    raw_value text,
    cleaned_value text,
    issue_message text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb,
    status varchar(20) DEFAULT 'OPEN' NOT NULL, -- 'OPEN'|'RESOLVED'|'IGNORED'
    assignee integer REFERENCES public.users(id),
    resolution_code varchar(30),
    resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_issues_batch_sev ON public.data_quality_issues (batch_id, severity, status);

-- 9. 人工审核操作记录表
CREATE TABLE IF NOT EXISTS public.review_actions (
    id bigserial PRIMARY KEY,
    issue_id bigint NOT NULL REFERENCES public.data_quality_issues(id) ON DELETE CASCADE,
    reviewer_id integer NOT NULL REFERENCES public.users(id),
    decision varchar(20) NOT NULL, -- 'CONFIRM_FIX'|'REJECT'|'OVERRIDE_ALLOW'
    decision_reason text NOT NULL,
    before_value jsonb,
    after_value jsonb,
    created_at timestamptz DEFAULT now()
);

-- 10. 对账运行表
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id bigserial PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    reconcile_level varchar(20) NOT NULL, -- 'file'|'record'|'amount'|'grouped'|'metric'
    metric_code varchar(50) NOT NULL,
    source_control_value numeric(18,2) NOT NULL,
    system_calculated_value numeric(18,2) NOT NULL,
    difference numeric(18,2) NOT NULL,
    tolerance numeric(18,2) DEFAULT 0.00,
    status varchar(20) NOT NULL, -- 'MATCHED'|'PROVISIONAL_DIFF'|'MISMATCH_BLOCKED'
    reconciled_at timestamptz DEFAULT now()
);

-- 11. 正式发布记录表与反向冲正记录表
CREATE TABLE IF NOT EXISTS public.publish_runs (
    id bigserial PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    validation_run_id bigint NOT NULL REFERENCES public.validation_runs(id),
    published_by integer REFERENCES public.users(id),
    policy_version varchar(50) NOT NULL,
    target_table varchar(64) NOT NULL,
    records_published integer NOT NULL,
    status varchar(20) DEFAULT 'SUCCESS' NOT NULL,
    published_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.publish_reversals (
    id bigserial PRIMARY KEY,
    publish_run_id bigint NOT NULL REFERENCES public.publish_runs(id),
    reversal_reason text NOT NULL,
    reversed_by integer NOT NULL REFERENCES public.users(id),
    records_affected integer NOT NULL,
    reversed_at timestamptz DEFAULT now()
);

-- 12. 规范事实明细表 (按月物理范围分区，业务唯一键强约束)
CREATE TABLE IF NOT EXISTS public.canonical_orders (
    id bigserial,
    biz_date date NOT NULL,
    source_platform varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    store_id bigint NOT NULL REFERENCES public.dim_shop(id),
    source_order_id varchar(100) NOT NULL,
    order_status varchar(30) NOT NULL,
    raw_status varchar(50),
    currency_code varchar(10) DEFAULT 'CNY' NOT NULL,
    paid_amount numeric(18, 2) NOT NULL,
    total_discount numeric(18, 2) DEFAULT 0.00,
    freight_fee numeric(18, 2) DEFAULT 0.00,
    buyer_user_id varchar(100),
    created_at_source timestamptz,
    paid_at_source timestamptz,
    source_updated_at timestamptz,
    batch_id bigint REFERENCES public.import_batches(id),
    maturity_status varchar(20) DEFAULT 'FINAL' NOT NULL, -- 'PROVISIONAL'|'FINAL'
    ingested_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id),
    CONSTRAINT uk_canonical_order_bizkey UNIQUE (biz_date, source_platform, store_id, source_order_id)
) PARTITION BY RANGE (biz_date);

CREATE TABLE IF NOT EXISTS public.canonical_order_items (
    id bigserial,
    biz_date date NOT NULL,
    source_platform varchar(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id varchar(100) NOT NULL,
    source_sub_order_id varchar(100) NOT NULL,
    platform_sku_id varchar(100),
    internal_sku_id bigint,
    product_name varchar(255),
    quantity numeric(12, 2) DEFAULT 1 NOT NULL,
    item_paid_amount numeric(18, 2) NOT NULL,
    item_discount_allocated numeric(18, 2) DEFAULT 0.00,
    maturity_status varchar(20) DEFAULT 'FINAL' NOT NULL,
    PRIMARY KEY (biz_date, id),
    CONSTRAINT uk_canonical_item_bizkey UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id)
) PARTITION BY RANGE (biz_date);

CREATE TABLE IF NOT EXISTS public.canonical_refund_events (
    id bigserial,
    biz_date date NOT NULL,
    source_platform varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    store_id bigint NOT NULL REFERENCES public.dim_shop(id),
    source_refund_id varchar(100) NOT NULL,
    source_order_id varchar(100) NOT NULL,
    source_sub_order_id varchar(100),
    refund_type varchar(30) NOT NULL, -- 'only_refund'|'return_and_refund'
    refund_amount numeric(18, 2) NOT NULL,
    refund_status varchar(30) NOT NULL,
    refunded_at_source timestamptz,
    batch_id bigint REFERENCES public.import_batches(id),
    maturity_status varchar(20) DEFAULT 'FINAL' NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id),
    CONSTRAINT uk_canonical_refund_bizkey UNIQUE (biz_date, source_platform, store_id, source_refund_id)
) PARTITION BY RANGE (biz_date);

-- 13. 主数据实体映射与别名表 (Entity Aliases)
CREATE TABLE IF NOT EXISTS public.entity_aliases (
    id bigserial PRIMARY KEY,
    entity_type varchar(30) NOT NULL, -- 'product' | 'sku' | 'anchor' | 'shop'
    source_platform varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    external_id varchar(100) NOT NULL,
    external_name varchar(255),
    internal_id bigint NOT NULL,
    internal_code varchar(100),
    valid_from date DEFAULT '2020-01-01' NOT NULL,
    valid_to date DEFAULT '2099-12-31' NOT NULL,
    approved_by integer REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE (entity_type, source_platform, external_id, valid_from)
);

-- 14. 自动预创建 2026/2027 滚动物理分区 (覆盖 2026-08 至 2027-06)
DO $$
DECLARE
    m text;
    start_date date;
    end_date date;
BEGIN
    FOR i IN 7..17 LOOP
        start_date := ('2026-01-01'::date + (i || ' month')::interval)::date;
        end_date := (start_date + '1 month'::interval)::date;
        m := to_char(start_date, 'YYYYMM');

        EXECUTE format('CREATE TABLE IF NOT EXISTS public.raw_records_y%s PARTITION OF public.raw_records FOR VALUES FROM (%L) TO (%L)', m, start_date, end_date);
        EXECUTE format('CREATE TABLE IF NOT EXISTS public.clean_records_y%s PARTITION OF public.clean_records FOR VALUES FROM (%L) TO (%L)', m, start_date, end_date);
        EXECUTE format('CREATE TABLE IF NOT EXISTS public.canonical_orders_y%s PARTITION OF public.canonical_orders FOR VALUES FROM (%L) TO (%L)', m, start_date, end_date);
        EXECUTE format('CREATE TABLE IF NOT EXISTS public.canonical_order_items_y%s PARTITION OF public.canonical_order_items FOR VALUES FROM (%L) TO (%L)', m, start_date, end_date);
        EXECUTE format('CREATE TABLE IF NOT EXISTS public.canonical_refund_events_y%s PARTITION OF public.canonical_refund_events FOR VALUES FROM (%L) TO (%L)', m, start_date, end_date);
    END LOOP;
END $$;

