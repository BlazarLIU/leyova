--
-- leyova 数据库结构（schema-only，由迁移系统自动生成）
--
-- 生成方式：node database/generate-schema.js（pg_dump --schema-only --no-owner --no-privileges）
-- 基    准：全部迁移应用后的数据库真实状态
-- 生成日期：2026-11-16
-- 兼容版本：PostgreSQL 14+
--
-- 已移除：SET 配置指令、pg_dump 元数据注释、对象 OWNER / PRIVILEGE 声明
--
-- ⚠️ 本文件由 database/generate-schema.js 自动生成，请勿手改；
--    如需修改结构，请新增迁移文件，然后重新生成本文件。
--
-- 关闭函数体校验：函数体引用的辅助函数可能在后续语句中才创建
SET check_function_bodies = false;

-- ===== sequence (148) =====
CREATE SEQUENCE public.ad_plan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ad_plan_receipts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.agg_shop_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.agg_trade_day_platform_channel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.agg_traffic_day_live_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_action_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_analysis_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_analysis_steps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_context_bindings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_eval_case_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_eval_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_tool_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_v2_claim_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_v2_evidence_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_v2_llm_call_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_v2_step_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.alert_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.alert_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.anchor_capabilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.anchor_script_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.anchor_training_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.anchor_training_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.anchors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.campaign_plan_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.campaign_plan_template_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.canonical_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.canonical_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.canonical_refund_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.clean_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.clean_rule_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.cleaning_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.competitor_brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.competitor_price_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.compliance_activity_reminder_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.compliance_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.compliance_risk_assessment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.compliance_rule_change_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.compliance_rule_snapshot_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.content_assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.content_attribution_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.content_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.content_providers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.content_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.content_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.data_exports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.data_quality_issues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.data_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dict_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_brand_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_cs_agent_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_dept_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_kol_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_product_channel_listing_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_shop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_sku_mapping_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dim_team_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.douyin_anchor_daily_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.douyin_channel_daily_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.dq_quarantine_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.entity_aliases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_ad_spend_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_after_sale_tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_content_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_cs_session_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_fulfillment_waybill_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_gl_entry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_gl_voucher_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_inventory_ledger_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_inventory_reservation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_inventory_stock_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_kol_cooperation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_order_event_stream_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_order_rma_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_search_keyword_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_selection_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_selection_recommendation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_settlement_cycles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_trade_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.fact_traffic_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.field_mapping_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.goal_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.import_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.import_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.improvement_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ingest_sync_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.issue_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.kuaishou_fans_ops_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.land_raw_dedup_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.live_registrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.live_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.live_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.metric_definition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.multi_room_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.operators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.order_status_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.overview_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.overview_daily_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_caliber_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_capability_matrix_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_members_summary_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_sla_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.platform_source_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.publish_reversals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.publish_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.raw_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.reconciliation_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.review_actions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.role_module_grants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.role_platform_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.room_health_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.script_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_anchor_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_channel_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_live_basic_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_overview_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_plan_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_product_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_product_skus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_short_video_traffic_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.session_staff_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.signal_source_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.staff_day_status_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sys_custom_field_definition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sys_custom_field_value_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sys_role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sys_role_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.sys_user_role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.system_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.system_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.taobao_order_hierarchy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.target_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.upload_column_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.user_module_overrides_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.user_platform_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.validation_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.video_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.xhs_note_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ===== table (238) =====
CREATE TABLE public.anchor_capabilities (
    id integer NOT NULL,
    anchor_id integer NOT NULL,
    expression smallint DEFAULT 0 NOT NULL,
    interaction smallint DEFAULT 0 NOT NULL,
    conversion smallint DEFAULT 0 NOT NULL,
    professionalism smallint DEFAULT 0 NOT NULL,
    overall smallint DEFAULT 0 NOT NULL,
    evaluated_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public._deprecated_session_product_details (
    id integer CONSTRAINT session_product_details_id_not_null NOT NULL,
    session_id integer,
    room_id integer,
    business_date date CONSTRAINT session_product_details_business_date_not_null NOT NULL,
    product_order integer DEFAULT 0,
    product_name character varying(500) CONSTRAINT session_product_details_product_name_not_null NOT NULL,
    product_id character varying(100) DEFAULT ''::character varying,
    product_image character varying(500) DEFAULT ''::character varying,
    payment_amount numeric(14,2) DEFAULT 0,
    sold_count integer DEFAULT 0,
    buyer_count integer DEFAULT 0,
    order_count integer DEFAULT 0,
    pre_sale_orders integer DEFAULT 0,
    pre_sale_amount numeric(14,2) DEFAULT 0,
    exposure_users integer DEFAULT 0,
    click_users integer DEFAULT 0,
    exposure_click_rate numeric(8,4) DEFAULT 0,
    click_deal_rate numeric(8,4) DEFAULT 0,
    refund_users integer DEFAULT 0,
    refund_amount numeric(14,2) DEFAULT 0,
    refund_orders integer DEFAULT 0,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT session_product_details_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT session_product_details_updated_at_not_null NOT NULL
);

CREATE TABLE public._deprecated_session_product_skus (
    id integer CONSTRAINT session_product_skus_id_not_null NOT NULL,
    product_id integer,
    sku_name character varying(500) CONSTRAINT session_product_skus_sku_name_not_null NOT NULL,
    sku_image character varying(500) DEFAULT ''::character varying,
    payment_amount numeric(14,2) DEFAULT 0,
    sold_count integer DEFAULT 0,
    buyer_count integer DEFAULT 0,
    order_count integer DEFAULT 0,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT session_product_skus_created_at_not_null NOT NULL
);

CREATE TABLE public.live_sessions (
    id integer NOT NULL,
    room_id integer,
    anchor_id integer,
    title character varying(200) DEFAULT ''::character varying NOT NULL,
    date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    gmv numeric(12,2) DEFAULT 0 NOT NULL,
    orders integer DEFAULT 0 NOT NULL,
    online_peak integer DEFAULT 0 NOT NULL,
    duration_min integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    operator_id integer,
    return_amount numeric(12,2) DEFAULT 0 NOT NULL,
    gsv numeric(12,2) DEFAULT 0 NOT NULL,
    remark text DEFAULT ''::text NOT NULL,
    ad_platform character varying(100) DEFAULT ''::character varying NOT NULL,
    ad_type character varying(100) DEFAULT ''::character varying NOT NULL,
    ad_cost numeric(12,2) DEFAULT 0 NOT NULL,
    ad_gsv numeric(12,2) DEFAULT 0 NOT NULL,
    ad_status smallint DEFAULT 1 NOT NULL,
    gmv_per_hour numeric(10,2) DEFAULT 0 NOT NULL,
    avg_item_price numeric(10,2) DEFAULT 0 NOT NULL,
    buyer_count integer DEFAULT 0 NOT NULL,
    avg_online integer DEFAULT 0 NOT NULL,
    uv_value numeric(6,2) DEFAULT 0 NOT NULL,
    exposure_view_rate numeric(5,2) DEFAULT 0 NOT NULL,
    retention_rate numeric(5,2) DEFAULT 0 NOT NULL,
    interaction_rate numeric(5,2) DEFAULT 0 NOT NULL,
    new_fans integer DEFAULT 0 NOT NULL,
    view_follow_rate numeric(5,2) DEFAULT 0 NOT NULL,
    new_group_members integer DEFAULT 0 NOT NULL,
    audience_profile text,
    gpm numeric(10,2) DEFAULT 0 NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    platform_code character varying(32),
    data_source character varying(30),
    project_id integer,
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT chk_live_sessions_source CHECK (((data_source IS NULL) OR ((data_source)::text = ANY ((ARRAY['official_api'::character varying, 'manual_upload'::character varying, 'legacy'::character varying, 'bridge'::character varying])::text[])))),
    CONSTRAINT live_sessions_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('live'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.session_staff_assignments (
    id bigint NOT NULL,
    session_id integer NOT NULL,
    role_code character varying(24) NOT NULL,
    staff_id integer,
    staff_name character varying(64) NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.staff_day_status (
    id bigint NOT NULL,
    staff_name character varying(64) NOT NULL,
    biz_date date NOT NULL,
    status character varying(16) NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_day_status_status_check CHECK (((status)::text = ANY ((ARRAY['work'::character varying, 'rest'::character varying, 'leave'::character varying, 'sick'::character varying])::text[])))
);

CREATE TABLE public.staff_role_dict (
    code character varying(24) NOT NULL,
    name character varying(32) NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    color character varying(24) DEFAULT 'slate'::character varying NOT NULL,
    is_multi boolean DEFAULT false NOT NULL,
    description text DEFAULT ''::text,
    requires_attendance boolean DEFAULT false NOT NULL
);

CREATE TABLE public.ad_plan (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    plan_no character varying(64) NOT NULL,
    session_id integer,
    shop_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    ad_tool_code character varying(50) NOT NULL,
    plan_name character varying(150) NOT NULL,
    plan_date date NOT NULL,
    planned_budget numeric(14,2) DEFAULT 0 NOT NULL,
    target_roi numeric(6,2) DEFAULT 2.00 NOT NULL,
    pre_heat_ratio numeric(5,2) DEFAULT 0.20 NOT NULL,
    live_peak_ratio numeric(5,2) DEFAULT 0.60 NOT NULL,
    tail_push_ratio numeric(5,2) DEFAULT 0.20 NOT NULL,
    targeting_tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    bid_strategy character varying(50) DEFAULT 'auto_bid'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ad_plan_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'approved'::character varying, 'active'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);

CREATE TABLE public.ad_plan_receipts (
    id bigint NOT NULL,
    plan_id bigint NOT NULL,
    biz_date date NOT NULL,
    actual_spend numeric(14,2) DEFAULT 0 NOT NULL,
    actual_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    net_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    attributed_orders integer DEFAULT 0 NOT NULL,
    receipt_source character varying(50) DEFAULT 'manual_entry'::character varying NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_plan_receipts_receipt_source_check CHECK (((receipt_source)::text = ANY ((ARRAY['manual_entry'::character varying, 'fact_sync'::character varying, 'api_push'::character varying])::text[])))
);

CREATE TABLE public.ad_tool_dict (
    code character varying(50) NOT NULL,
    name character varying(80) NOT NULL,
    platform_code character varying(32) NOT NULL,
    default_attribution_hours integer,
    has_indirect boolean DEFAULT false,
    description text DEFAULT ''::text,
    impression_window_hours integer DEFAULT 24 NOT NULL,
    supported_windows character varying(64) DEFAULT '7d'::character varying NOT NULL,
    settlement_cycle_days integer DEFAULT 7 NOT NULL,
    is_verified boolean DEFAULT true NOT NULL
);

CREATE TABLE public.agg_shop_daily (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    total_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    total_pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_order_count integer DEFAULT 0 NOT NULL,
    total_buyer_count integer DEFAULT 0 NOT NULL,
    total_refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_sales numeric(14,2) DEFAULT 0 NOT NULL,
    total_ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    overall_roi numeric(8,2) DEFAULT 0 NOT NULL,
    total_impressions bigint DEFAULT 0 NOT NULL,
    total_clicks bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.agg_trade_day_platform_channel (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32) NOT NULL,
    channel_name character varying(100) DEFAULT 'main'::character varying NOT NULL,
    shop_id bigint,
    total_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    total_pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total_order_count integer DEFAULT 0 NOT NULL,
    total_buyer_count integer DEFAULT 0 NOT NULL,
    total_refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_sales numeric(14,2) DEFAULT 0 NOT NULL,
    total_ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    overall_roi numeric(8,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.agg_traffic_day_live (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32),
    room_id integer,
    shop_id bigint,
    session_count integer DEFAULT 0 NOT NULL,
    total_duration_min integer DEFAULT 0 NOT NULL,
    total_views bigint DEFAULT 0 NOT NULL,
    total_buyers integer DEFAULT 0 NOT NULL,
    peak_online_max integer DEFAULT 0 NOT NULL,
    avg_online integer DEFAULT 0 NOT NULL,
    total_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    avg_gpm numeric(10,2) DEFAULT 0 NOT NULL,
    new_fans integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_action_approvals (
    id integer NOT NULL,
    tool_log_id integer NOT NULL,
    requested_by integer NOT NULL,
    approved_by integer,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone,
    approved_at timestamp with time zone,
    executed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_action_approvals_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text])))
);

CREATE TABLE public.ai_analysis_runs (
    id bigint NOT NULL,
    conversation_id bigint,
    user_id integer,
    mode character varying(30) DEFAULT 'S1_query'::character varying NOT NULL,
    question text NOT NULL,
    plan jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'completed'::character varying NOT NULL,
    verdict jsonb DEFAULT '{}'::jsonb,
    duration_ms integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_analysis_steps (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    seq integer NOT NULL,
    role character varying(20) NOT NULL,
    tool_name character varying(60) NOT NULL,
    input jsonb DEFAULT '{}'::jsonb,
    output_ref jsonb DEFAULT '{}'::jsonb,
    snapshot_hash character varying(64),
    row_count integer DEFAULT 0,
    duration_ms integer DEFAULT 0,
    status character varying(20) DEFAULT 'ok'::character varying NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_config (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_context_bindings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    scope_type character varying(20) DEFAULT 'user'::character varying NOT NULL,
    scope_id character varying(100) NOT NULL,
    openviking_account character varying(100),
    openviking_user character varying(100),
    anythingllm_workspace character varying(100),
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    knowledge_role_workspace character varying(100),
    knowledge_public_workspace character varying(100),
    CONSTRAINT ai_context_bindings_scope_type_check CHECK (((scope_type)::text = ANY (ARRAY[('user'::character varying)::text, ('room'::character varying)::text, ('role'::character varying)::text, ('org'::character varying)::text]))),
    CONSTRAINT ai_context_bindings_visibility_check CHECK (((visibility)::text = ANY (ARRAY[('private'::character varying)::text, ('role'::character varying)::text, ('public'::character varying)::text])))
);

CREATE TABLE public.ai_conversations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(200) DEFAULT '新对话'::character varying NOT NULL,
    model_name character varying(50) DEFAULT 'claude-sonnet-4-6'::character varying NOT NULL,
    temperature real DEFAULT 0.7 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deerflow_thread_id character varying(64),
    CONSTRAINT ai_conversations_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('archived'::character varying)::text, ('deleted'::character varying)::text])))
);

CREATE TABLE public.ai_eval_case (
    id integer NOT NULL,
    code character varying(64) NOT NULL,
    category character varying(32) NOT NULL,
    question text NOT NULL,
    expected_intent character varying(32) NOT NULL,
    expected_metrics text[] NOT NULL,
    expected_dimensions text[] DEFAULT '{}'::text[] NOT NULL,
    assertions jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_eval_run (
    id bigint NOT NULL,
    batch_id character varying(64) NOT NULL,
    case_id integer,
    passed boolean NOT NULL,
    actual_intent character varying(32),
    actual_metrics text[] DEFAULT '{}'::text[] NOT NULL,
    evidence_count integer DEFAULT 0 NOT NULL,
    claim_count integer DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    token_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id integer,
    tool_calls jsonb,
    tool_results jsonb,
    CONSTRAINT ai_messages_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);

CREATE TABLE public.ai_tool_logs (
    id integer NOT NULL,
    conversation_id integer,
    actor_user_id integer,
    scope_type character varying(20) DEFAULT 'user'::character varying NOT NULL,
    scope_id character varying(100) NOT NULL,
    skill_code character varying(100),
    tool_name character varying(100) NOT NULL,
    risk_level character varying(20) DEFAULT 'read_only'::character varying NOT NULL,
    input_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result_summary text,
    approval_status character varying(20) DEFAULT 'auto'::character varying NOT NULL,
    duration_ms integer,
    status character varying(20) DEFAULT 'success'::character varying NOT NULL,
    error_code character varying(50),
    model_name character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_tool_logs_approval_status_check CHECK (((approval_status)::text = ANY (ARRAY[('auto'::character varying)::text, ('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text]))),
    CONSTRAINT ai_tool_logs_risk_level_check CHECK (((risk_level)::text = ANY (ARRAY[('read_only'::character varying)::text, ('write_with_approval'::character varying)::text, ('admin_only'::character varying)::text, ('forbidden'::character varying)::text]))),
    CONSTRAINT ai_tool_logs_scope_type_check CHECK (((scope_type)::text = ANY (ARRAY[('user'::character varying)::text, ('room'::character varying)::text, ('role'::character varying)::text, ('org'::character varying)::text]))),
    CONSTRAINT ai_tool_logs_status_check CHECK (((status)::text = ANY (ARRAY[('success'::character varying)::text, ('failed'::character varying)::text, ('rejected'::character varying)::text, ('timeout'::character varying)::text])))
);

CREATE TABLE public.ai_v2_claim (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    seq integer DEFAULT 1 NOT NULL,
    headline text,
    text text NOT NULL,
    evidence_ids text[] DEFAULT '{}'::text[] NOT NULL,
    kind character varying(32) DEFAULT 'fact'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_v2_evidence (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    evidence_key character varying(32) NOT NULL,
    kind character varying(32) NOT NULL,
    metric character varying(64) NOT NULL,
    label character varying(128) NOT NULL,
    unit character varying(32) DEFAULT ''::character varying NOT NULL,
    value numeric(18,4) NOT NULL,
    scope character varying(128) DEFAULT 'all'::character varying NOT NULL,
    time_range character varying(64) DEFAULT ''::character varying NOT NULL,
    parents text[] DEFAULT '{}'::text[] NOT NULL,
    sql_snapshot text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_v2_llm_call (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    step_seq integer DEFAULT 1 NOT NULL,
    operation_name character varying(64) NOT NULL,
    request_model character varying(64) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cost_cny numeric(10,6) DEFAULT 0 NOT NULL,
    latency_ms integer DEFAULT 0 NOT NULL,
    finish_reason character varying(32) DEFAULT 'stop'::character varying NOT NULL,
    error_code character varying(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_v2_run (
    id character varying(64) NOT NULL,
    tenant_id integer,
    conversation_id character varying(64),
    question text NOT NULL,
    engine character varying(16) DEFAULT 'rule'::character varying NOT NULL,
    prompt_version character varying(32) DEFAULT 'v2.0'::character varying NOT NULL,
    plan jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(32) DEFAULT 'completed'::character varying NOT NULL,
    verdict character varying(32) DEFAULT 'verified'::character varying NOT NULL,
    rejection_reason text,
    duration_ms integer DEFAULT 0 NOT NULL,
    cost_cny numeric(10,6) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_v2_step (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    seq integer NOT NULL,
    role character varying(32) NOT NULL,
    tool character varying(64),
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    output_ref jsonb DEFAULT '{}'::jsonb NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'success'::character varying NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.alert_events (
    id integer NOT NULL,
    severity character varying(20) DEFAULT 'warning'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    description text DEFAULT ''::text,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_events_severity_check CHECK (((severity)::text = ANY (ARRAY[('critical'::character varying)::text, ('warning'::character varying)::text, ('info'::character varying)::text]))),
    CONSTRAINT alert_events_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('resolved'::character varying)::text])))
);

CREATE TABLE public.alert_rules (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    metric character varying(100) NOT NULL,
    method character varying(50) DEFAULT '阈值检测'::character varying NOT NULL,
    params character varying(200) DEFAULT ''::character varying,
    severity character varying(20) DEFAULT '警告'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shop_id bigint,
    platform_code character varying(32),
    condition character varying(16) DEFAULT 'gt'::character varying,
    threshold numeric(14,4) DEFAULT 0.00,
    notify_channels jsonb DEFAULT '[]'::jsonb,
    last_triggered_at timestamp with time zone
);

CREATE TABLE public.amount_type_dict (
    code character varying(40) NOT NULL,
    name character varying(80) NOT NULL,
    description text DEFAULT ''::text,
    is_comparable boolean DEFAULT true NOT NULL
);

CREATE TABLE public.anchor_profiles (
    id integer NOT NULL,
    level character varying(20) DEFAULT 'B级'::character varying NOT NULL,
    followers bigint DEFAULT 0 NOT NULL,
    join_date date,
    email character varying(100) DEFAULT ''::character varying,
    phone character varying(30) DEFAULT ''::character varying,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_script_templates (
    id integer NOT NULL,
    category character varying(50) DEFAULT ''::character varying NOT NULL,
    title character varying(200) NOT NULL,
    scenario text DEFAULT ''::text,
    content text DEFAULT ''::text NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    last_used date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.anchor_training_plans (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    anchor_count integer DEFAULT 0 NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    progress smallint DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'in_progress'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anchor_training_plans_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT anchor_training_plans_status_check CHECK (((status)::text = ANY (ARRAY[('in_progress'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.anchor_training_records (
    id integer NOT NULL,
    plan_id integer,
    anchor_name character varying(100) NOT NULL,
    date date NOT NULL,
    project character varying(200) DEFAULT ''::character varying NOT NULL,
    duration_hours numeric(4,1) DEFAULT 0 NOT NULL,
    completion character varying(20) DEFAULT 'partial'::character varying NOT NULL,
    score smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anchor_training_records_completion_check CHECK (((completion)::text = ANY (ARRAY[('full'::character varying)::text, ('partial'::character varying)::text, ('absent'::character varying)::text]))),
    CONSTRAINT anchor_training_records_score_check CHECK (((score >= 0) AND (score <= 100)))
);

CREATE TABLE public.anchors (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    platform character varying(50) DEFAULT '抖音'::character varying NOT NULL,
    level character varying(20) DEFAULT 'B级'::character varying,
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    platform_code character varying(32),
    user_id integer,
    CONSTRAINT anchors_status_check CHECK ((status = ANY (ARRAY[0, 1])))
);

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_user_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(50) DEFAULT ''::character varying NOT NULL,
    resource_id character varying(100) DEFAULT ''::character varying,
    before_data jsonb DEFAULT '{}'::jsonb,
    after_data jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(45) DEFAULT ''::character varying,
    user_agent text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.campaign_plan (
    id bigint NOT NULL,
    plan_no character varying(40) NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    template_id integer,
    template_version smallint DEFAULT 1 CONSTRAINT campaign_plan_template_version_not_null1 NOT NULL,
    shop_id bigint,
    category_code character varying(40),
    plan_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_recommendation_id bigint,
    approval_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by integer,
    approved_at timestamp with time zone,
    generated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    dispatched_at timestamp with time zone,
    dispatched_by integer,
    dispatch_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT campaign_plan_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

CREATE TABLE public.campaign_plan_template (
    id integer NOT NULL,
    template_code character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    category_code character varying(40),
    platform_code character varying(32),
    version smallint DEFAULT 1 NOT NULL,
    blocks jsonb DEFAULT '{}'::jsonb NOT NULL,
    compliance_rules_version character varying(40) DEFAULT 'v1.0'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.canonical_order_items (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    source_sub_order_id character varying(100) NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 NOT NULL,
    item_paid_amount numeric(18,2) NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying NOT NULL
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.canonical_order_items_default (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202608 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202609 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202610 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202611 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202612 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202701 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202702 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202703 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202704 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202705 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_order_items_y202706 (
    id bigint DEFAULT nextval('public.canonical_order_items_id_seq'::regclass) CONSTRAINT canonical_order_items_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_order_items_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_order_items_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_order_items_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_order_items_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) CONSTRAINT canonical_order_items_source_sub_order_id_not_null NOT NULL,
    platform_sku_id character varying(100),
    internal_sku_id bigint,
    product_name character varying(255),
    quantity numeric(12,2) DEFAULT 1 CONSTRAINT canonical_order_items_quantity_not_null NOT NULL,
    item_paid_amount numeric(18,2) CONSTRAINT canonical_order_items_item_paid_amount_not_null NOT NULL,
    item_discount_allocated numeric(18,2) DEFAULT 0.00,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_order_items_maturity_status_not_null NOT NULL
);

CREATE TABLE public.canonical_orders (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    order_status character varying(30) NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying NOT NULL,
    paid_amount numeric(18,2) NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.canonical_orders_default (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202608 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202609 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202610 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202611 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202612 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202701 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202702 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202703 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202704 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202705 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_orders_y202706 (
    id bigint DEFAULT nextval('public.canonical_orders_id_seq'::regclass) CONSTRAINT canonical_orders_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_orders_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_orders_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_orders_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_orders_source_order_id_not_null NOT NULL,
    order_status character varying(30) CONSTRAINT canonical_orders_order_status_not_null NOT NULL,
    raw_status character varying(50),
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT canonical_orders_currency_code_not_null NOT NULL,
    paid_amount numeric(18,2) CONSTRAINT canonical_orders_paid_amount_not_null NOT NULL,
    total_discount numeric(18,2) DEFAULT 0.00,
    freight_fee numeric(18,2) DEFAULT 0.00,
    buyer_user_id character varying(100),
    created_at_source timestamp with time zone,
    paid_at_source timestamp with time zone,
    source_updated_at timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_orders_maturity_status_not_null NOT NULL,
    ingested_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_refund_id character varying(100) NOT NULL,
    source_order_id character varying(100) NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) NOT NULL,
    refund_amount numeric(18,2) NOT NULL,
    refund_status character varying(30) NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.canonical_refund_events_default (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202608 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202609 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202610 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202611 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202612 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202701 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202702 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202703 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202704 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202705 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.canonical_refund_events_y202706 (
    id bigint DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass) CONSTRAINT canonical_refund_events_id_not_null NOT NULL,
    biz_date date CONSTRAINT canonical_refund_events_biz_date_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT canonical_refund_events_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT canonical_refund_events_store_id_not_null NOT NULL,
    source_refund_id character varying(100) CONSTRAINT canonical_refund_events_source_refund_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT canonical_refund_events_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100),
    refund_type character varying(30) CONSTRAINT canonical_refund_events_refund_type_not_null NOT NULL,
    refund_amount numeric(18,2) CONSTRAINT canonical_refund_events_refund_amount_not_null NOT NULL,
    refund_status character varying(30) CONSTRAINT canonical_refund_events_refund_status_not_null NOT NULL,
    refunded_at_source timestamp with time zone,
    batch_id bigint,
    maturity_status character varying(20) DEFAULT 'FINAL'::character varying CONSTRAINT canonical_refund_events_maturity_status_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    batch_id bigint NOT NULL,
    raw_record_id bigint NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying NOT NULL,
    canonical_payload jsonb NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.clean_records_default (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202608 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202609 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202610 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202611 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202612 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202701 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202702 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202703 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202704 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202705 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_records_y202706 (
    id bigint DEFAULT nextval('public.clean_records_id_seq'::regclass) CONSTRAINT clean_records_id_not_null NOT NULL,
    biz_date date CONSTRAINT clean_records_biz_date_not_null NOT NULL,
    batch_id bigint CONSTRAINT clean_records_batch_id_not_null NOT NULL,
    raw_record_id bigint CONSTRAINT clean_records_raw_record_id_not_null NOT NULL,
    source_platform character varying(32) CONSTRAINT clean_records_source_platform_not_null NOT NULL,
    store_id bigint CONSTRAINT clean_records_store_id_not_null NOT NULL,
    source_order_id character varying(100) CONSTRAINT clean_records_source_order_id_not_null NOT NULL,
    source_sub_order_id character varying(100) DEFAULT '0'::character varying,
    paid_amount numeric(18,4) CONSTRAINT clean_records_paid_amount_not_null NOT NULL,
    currency_code character varying(10) DEFAULT 'CNY'::character varying CONSTRAINT clean_records_currency_code_not_null NOT NULL,
    cleaning_status character varying(20) DEFAULT 'CANDIDATE'::character varying CONSTRAINT clean_records_cleaning_status_not_null NOT NULL,
    canonical_payload jsonb CONSTRAINT clean_records_canonical_payload_not_null NOT NULL,
    quarantine_reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.clean_rule_sets (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    platform_code character varying(32) NOT NULL,
    description text DEFAULT ''::text,
    is_system boolean DEFAULT false NOT NULL,
    rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.cleaning_runs (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    mapping_version character varying(64) NOT NULL,
    cleaning_rule_version character varying(64) NOT NULL,
    status character varying(20) DEFAULT 'QUEUED'::character varying NOT NULL,
    input_count integer DEFAULT 0,
    candidate_count integer DEFAULT 0,
    quarantine_count integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);

CREATE TABLE public.competitor_brands (
    id integer NOT NULL,
    brand character varying(200) NOT NULL,
    industry character varying(100) DEFAULT ''::character varying NOT NULL,
    monitored_products integer DEFAULT 0 NOT NULL,
    avg_price character varying(50) DEFAULT ''::character varying,
    estimated_sales character varying(100) DEFAULT ''::character varying,
    trend character varying(20) DEFAULT 'stable'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT competitor_brands_trend_check CHECK (((trend)::text = ANY (ARRAY[('up'::character varying)::text, ('down'::character varying)::text, ('stable'::character varying)::text])))
);

CREATE TABLE public.competitor_price_data (
    id integer NOT NULL,
    brand_id integer NOT NULL,
    label character varying(100) NOT NULL,
    ours numeric(10,2) DEFAULT 0 NOT NULL,
    theirs numeric(10,2) DEFAULT 0 NOT NULL,
    data_type character varying(20) DEFAULT 'price'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT competitor_price_data_data_type_check CHECK (((data_type)::text = ANY (ARRAY[('price'::character varying)::text, ('sales'::character varying)::text])))
);

CREATE TABLE public.compliance_activity_reminder (
    id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    activity_name character varying(200) NOT NULL,
    activity_type character varying(50) DEFAULT '大促活动'::character varying NOT NULL,
    signup_deadline timestamp with time zone NOT NULL,
    activity_start timestamp with time zone,
    activity_end timestamp with time zone,
    requirements text DEFAULT ''::text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_activity_reminder_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'reminded'::character varying, 'done'::character varying, 'expired'::character varying])::text[])))
);

CREATE TABLE public.compliance_events (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint,
    regulation_code character varying(60) NOT NULL,
    event_type character varying(80) NOT NULL,
    severity character varying(20) DEFAULT 'warning'::character varying NOT NULL,
    credit_points_deducted integer DEFAULT 0 NOT NULL,
    traffic_restricted boolean DEFAULT false NOT NULL,
    auto_price_follow_risk boolean DEFAULT false NOT NULL,
    entity_consistency_ok boolean DEFAULT true NOT NULL,
    summary text NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_events_severity_check CHECK (((severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[]))),
    CONSTRAINT compliance_events_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'remediating'::character varying, 'resolved'::character varying, 'appealed'::character varying])::text[])))
);

CREATE TABLE public.compliance_risk_assessment (
    id bigint NOT NULL,
    change_id bigint NOT NULL,
    affected_shops integer[] DEFAULT '{}'::integer[],
    risk_summary text NOT NULL,
    operational_impact text NOT NULL,
    recommended_actions text[] DEFAULT '{}'::text[],
    evidence_refs jsonb DEFAULT '[]'::jsonb,
    assessed_by character varying(40) DEFAULT 'AI_RISK_ENGINE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.compliance_rule_change (
    id bigint NOT NULL,
    snapshot_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    external_id character varying(120) NOT NULL,
    change_type character varying(20) NOT NULL,
    diff_summary text DEFAULT ''::text NOT NULL,
    severity character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    read_by integer,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_rule_change_change_type_check CHECK (((change_type)::text = ANY ((ARRAY['new'::character varying, 'revised'::character varying, 'repealed'::character varying])::text[]))),
    CONSTRAINT compliance_rule_change_severity_check CHECK (((severity)::text = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[])))
);

CREATE TABLE public.compliance_rule_snapshot (
    id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    external_id character varying(120) NOT NULL,
    title character varying(300) NOT NULL,
    category character varying(60) DEFAULT '通用规则'::character varying NOT NULL,
    source_url character varying(500) NOT NULL,
    published_at timestamp with time zone,
    effective_at timestamp with time zone,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    fetch_method character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    content_text text NOT NULL,
    content_hash character varying(64) NOT NULL,
    raw_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_rule_snapshot_fetch_method_check CHECK (((fetch_method)::text = ANY ((ARRAY['html_direct'::character varying, 'rss'::character varying, 'json_api'::character varying, 'headless'::character varying, 'manual'::character varying])::text[])))
);

CREATE TABLE public.content_assets (
    id bigint NOT NULL,
    project_id integer,
    task_id bigint,
    asset_type character varying(30) DEFAULT 'video'::character varying NOT NULL,
    name character varying(200) NOT NULL,
    url text,
    local_path text,
    size_bytes bigint DEFAULT 0,
    duration_seconds integer DEFAULT 0,
    provider character varying(50) DEFAULT 'comfyui'::character varying,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL,
    parent_asset_id bigint,
    source_platform character varying(32),
    distribution_status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    compliance_status character varying(30) DEFAULT 'pending'::character varying NOT NULL
);

CREATE TABLE public.content_attribution_ledger (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    content_id character varying(100) NOT NULL,
    schedule_id bigint,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    biz_date date NOT NULL,
    attribution_channel character varying(30) DEFAULT 'in_site'::character varying NOT NULL,
    attribution_window_hours integer DEFAULT 168 NOT NULL,
    views bigint DEFAULT 0 NOT NULL,
    engagements bigint DEFAULT 0 NOT NULL,
    search_back_count integer DEFAULT 0 NOT NULL,
    attributed_orders integer DEFAULT 0 NOT NULL,
    attributed_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    settled_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_attribution_ledger_attribution_channel_check CHECK (((attribution_channel)::text = ANY ((ARRAY['in_site'::character varying, 'hongmao'::character varying, 'hongjing'::character varying, 'honglian'::character varying, 'qianchuan'::character varying, 'juguang'::character varying, 'organic_search'::character varying])::text[])))
);

CREATE TABLE public.content_projects (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text DEFAULT ''::text,
    platform_code character varying(32),
    shop_id bigint,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.content_providers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    provider_type character varying(30) DEFAULT 'comfyui'::character varying NOT NULL,
    base_url character varying(500) NOT NULL,
    api_key character varying(255),
    is_enabled boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    capabilities jsonb DEFAULT '{}'::jsonb,
    last_checked_at timestamp with time zone,
    last_check_result character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.content_schedules (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    project_id integer,
    title character varying(200) NOT NULL,
    topic_category character varying(80) DEFAULT '商品测评'::character varying NOT NULL,
    stage character varying(30) DEFAULT 'topic_planned'::character varying NOT NULL,
    platform_code character varying(32) NOT NULL,
    target_platforms text[] DEFAULT '{}'::text[] NOT NULL,
    script_summary text DEFAULT ''::text NOT NULL,
    owner_user_id integer,
    reviewer_user_id integer,
    planned_publish_at timestamp with time zone,
    published_at timestamp with time zone,
    asset_id bigint,
    external_content_id character varying(100) DEFAULT ''::character varying NOT NULL,
    compliance_checked boolean DEFAULT false NOT NULL,
    compliance_note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_schedules_stage_check CHECK (((stage)::text = ANY ((ARRAY['topic_planned'::character varying, 'script_drafted'::character varying, 'shooting'::character varying, 'editing'::character varying, 'compliance_review'::character varying, 'approved'::character varying, 'scheduled'::character varying, 'published'::character varying])::text[])))
);

CREATE TABLE public.content_tasks (
    id bigint NOT NULL,
    project_id integer,
    provider_id integer,
    task_type character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    prompt text DEFAULT ''::text,
    workflow jsonb DEFAULT '{}'::jsonb,
    comfy_prompt_id character varying(100),
    progress integer DEFAULT 0,
    output_url text,
    output_assets jsonb DEFAULT '[]'::jsonb,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.data_exports (
    id integer NOT NULL,
    export_name character varying(500) NOT NULL,
    format character varying(20) DEFAULT 'xlsx'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT data_exports_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.data_quality_issues (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    biz_date date NOT NULL,
    rule_id character varying(50) NOT NULL,
    severity character varying(10) NOT NULL,
    scope character varying(20) NOT NULL,
    source_business_key character varying(200),
    target_field character varying(50),
    raw_value text,
    cleaned_value text,
    issue_message text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    assignee integer,
    resolution_code character varying(30),
    resolved_at timestamp with time zone
);

CREATE TABLE public.data_uploads (
    id integer NOT NULL,
    file_name character varying(500) NOT NULL,
    file_type character varying(50) DEFAULT 'xlsx'::character varying NOT NULL,
    file_size character varying(20) DEFAULT ''::character varying NOT NULL,
    upload_time timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'processing'::character varying NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    data_type character varying(80),
    business_date date,
    source_path character varying(500),
    error_message text,
    platform_code character varying(32),
    clean_rule_set_id integer,
    CONSTRAINT data_uploads_status_check CHECK (((status)::text = ANY (ARRAY[('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.dict_items (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT '启用'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dim_accounting_subject (
    account_code character varying(32) NOT NULL,
    account_name character varying(64) NOT NULL,
    category character varying(32) NOT NULL,
    direction character varying(10) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dim_accounting_subject_category_check CHECK (((category)::text = ANY ((ARRAY['asset'::character varying, 'liability'::character varying, 'equity'::character varying, 'revenue'::character varying, 'expense'::character varying])::text[]))),
    CONSTRAINT dim_accounting_subject_direction_check CHECK (((direction)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[])))
);

CREATE TABLE public.dim_brand (
    id bigint NOT NULL,
    brand_name character varying(100) NOT NULL,
    brand_code character varying(50),
    operate_mode character varying(20) DEFAULT 'self'::character varying,
    logo_url text,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.dim_category (
    code character varying(40) NOT NULL,
    parent_code character varying(40),
    level smallint NOT NULL,
    name character varying(80) NOT NULL,
    weather_sensitivity character varying(10) DEFAULT 'low'::character varying NOT NULL,
    lifecycle_days integer DEFAULT 60,
    seasonal_peak character varying(20)[] DEFAULT '{}'::character varying[],
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    remark text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dim_category_level_check CHECK ((level = ANY (ARRAY[1, 2]))),
    CONSTRAINT dim_category_weather_sensitivity_check CHECK (((weather_sensitivity)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[])))
);

CREATE TABLE public.dim_cs_agent (
    id bigint NOT NULL,
    user_id bigint,
    agent_code character varying(40) NOT NULL,
    agent_name character varying(80) NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    shift_group character varying(30) DEFAULT 'day'::character varying NOT NULL,
    status character varying(20) DEFAULT 'online'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dim_cs_agent_shift_group_check CHECK (((shift_group)::text = ANY ((ARRAY['day'::character varying, 'night'::character varying, 'all'::character varying])::text[]))),
    CONSTRAINT dim_cs_agent_status_check CHECK (((status)::text = ANY ((ARRAY['online'::character varying, 'busy'::character varying, 'offline'::character varying])::text[])))
);

CREATE TABLE public.dim_dept (
    id integer NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    dept_code character varying(64) NOT NULL,
    dept_name character varying(128) NOT NULL,
    parent_id integer,
    leader_id integer,
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dim_kol (
    id bigint NOT NULL,
    kol_name character varying(100) NOT NULL,
    platform_code character varying(32) NOT NULL,
    platform_uid character varying(100) DEFAULT ''::character varying NOT NULL,
    tier character varying(30) DEFAULT 'waist'::character varying NOT NULL,
    fans_count integer DEFAULT 0 NOT NULL,
    category character varying(80) DEFAULT '时尚穿搭'::character varying NOT NULL,
    contact_info character varying(150) DEFAULT ''::character varying NOT NULL,
    default_commission_rate numeric(6,4) DEFAULT 0.1500 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dim_kol_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'paused'::character varying, 'blacklist'::character varying])::text[]))),
    CONSTRAINT dim_kol_tier_check CHECK (((tier)::text = ANY ((ARRAY['head'::character varying, 'waist'::character varying, 'tail'::character varying, 'koc'::character varying])::text[])))
);

CREATE TABLE public.dim_product (
    id bigint NOT NULL,
    spu_code character varying(64) NOT NULL,
    sku_code character varying(64) NOT NULL,
    product_name character varying(200) NOT NULL,
    category character varying(80) DEFAULT '通用服饰'::character varying NOT NULL,
    brand_name character varying(80) DEFAULT 'Leyova自营'::character varying NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0 NOT NULL,
    retail_price numeric(12,2) DEFAULT 0 NOT NULL,
    safety_stock integer DEFAULT 20 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    specs jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category_code character varying(40),
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT dim_product_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'discontinued'::character varying])::text[])))
);

CREATE TABLE public.dim_product_channel_listing (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    product_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    channel_sku_id character varying(100) NOT NULL,
    channel_price numeric(10,2) NOT NULL,
    allocated_stock integer DEFAULT 0 NOT NULL,
    reserved_stock integer DEFAULT 0 NOT NULL,
    safety_stock integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_allocated_gte_reserved CHECK ((allocated_stock >= reserved_stock))
);

CREATE TABLE public.dim_shop (
    id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_name character varying(100) NOT NULL,
    external_shop_id character varying(100),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    auth_status character varying(20) DEFAULT 'manual_only'::character varying NOT NULL,
    auth_token_info jsonb DEFAULT '{}'::jsonb,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    business_mode character varying(30),
    shop_type character varying(40),
    brand_id bigint,
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE TABLE public.dim_sku_mapping (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    platform_item_id character varying(100) NOT NULL,
    platform_sku_id character varying(100) NOT NULL,
    platform_sku_name character varying(200) DEFAULT ''::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dim_team (
    id integer NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    dept_id integer NOT NULL,
    team_code character varying(64) NOT NULL,
    team_name character varying(128) NOT NULL,
    leader_id integer,
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dim_traffic_source (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    level1 character varying(30) NOT NULL,
    level2 character varying(30),
    description text DEFAULT ''::text,
    sort_order integer DEFAULT 0
);

CREATE TABLE public.douyin_anchor_daily_metrics (
    id integer NOT NULL,
    business_date date NOT NULL,
    account_name character varying(200) DEFAULT ''::character varying NOT NULL,
    anchor_name character varying(100) NOT NULL,
    anchor_id integer,
    live_duration_seconds integer,
    payment_amount numeric(14,2) DEFAULT 0 NOT NULL,
    hourly_payment numeric(14,2),
    peak_online integer DEFAULT 0 NOT NULL,
    avg_online integer DEFAULT 0 NOT NULL,
    avg_item_price numeric(14,2),
    exposure_view_rate numeric(8,6),
    retention_rate numeric(8,6),
    interaction_rate numeric(8,6),
    new_followers integer DEFAULT 0 NOT NULL,
    watch_follow_rate numeric(8,6),
    group_joiners integer DEFAULT 0 NOT NULL,
    uv_value numeric(14,2),
    buyers integer,
    strategy_audience_top3 text,
    gender_top3 text,
    age_top3 text,
    city_tier_top3 text,
    region_top3 text,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.douyin_channel_daily_metrics (
    id integer NOT NULL,
    business_date date NOT NULL,
    channel_name character varying(120) NOT NULL,
    live_duration_seconds integer,
    avg_watch_seconds integer,
    impressions bigint DEFAULT 0 NOT NULL,
    viewers bigint DEFAULT 0 NOT NULL,
    interactions bigint DEFAULT 0 NOT NULL,
    new_followers integer DEFAULT 0 NOT NULL,
    product_impressions bigint DEFAULT 0 NOT NULL,
    product_clicks bigint DEFAULT 0 NOT NULL,
    order_count integer DEFAULT 0 NOT NULL,
    buyer_count integer DEFAULT 0 NOT NULL,
    payment_amount numeric(14,2) DEFAULT 0 NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    thousand_view_payment numeric(14,2),
    avg_order_value numeric(14,2),
    ad_cost_bound numeric(14,2) DEFAULT 0 NOT NULL,
    ad_cost_promoted numeric(14,2) DEFAULT 0 NOT NULL,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.dq_quarantine (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    row_num integer NOT NULL,
    rule_code character varying(50) NOT NULL,
    severity character varying(20) DEFAULT 'error'::character varying NOT NULL,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    failure_reason text NOT NULL,
    status character varying(20) DEFAULT 'quarantined'::character varying NOT NULL,
    resolved_by character varying(64) DEFAULT ''::character varying NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dq_quarantine_rule_code_check CHECK (((rule_code)::text = ANY ((ARRAY['RULE_LINE_COUNT_CONSERVED'::character varying, 'RULE_AMOUNT_CONSERVED'::character varying, 'RULE_BATCH_KEY_UNIQUE'::character varying, 'RULE_ENUM_LEGAL'::character varying, 'RULE_TIME_CONTINUOUS'::character varying, 'RULE_CROSS_TABLE_RECONCILE'::character varying, 'RULE_PLATFORM_RECONCILE'::character varying, 'RULE_FRESHNESS_SLA'::character varying])::text[]))),
    CONSTRAINT dq_quarantine_severity_check CHECK (((severity)::text = ANY ((ARRAY['warning'::character varying, 'error'::character varying, 'fatal'::character varying])::text[]))),
    CONSTRAINT dq_quarantine_status_check CHECK (((status)::text = ANY ((ARRAY['quarantined'::character varying, 'resolved'::character varying, 'ignored'::character varying])::text[])))
);

CREATE TABLE public.entity_aliases (
    id bigint NOT NULL,
    entity_type character varying(30) NOT NULL,
    source_platform character varying(32) NOT NULL,
    external_id character varying(100) NOT NULL,
    external_name character varying(255),
    internal_id bigint NOT NULL,
    internal_code character varying(100),
    valid_from date DEFAULT '2020-01-01'::date NOT NULL,
    valid_to date DEFAULT '2099-12-31'::date NOT NULL,
    approved_by integer,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fact_ad_spend_daily (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    biz_date date NOT NULL,
    ad_tool_code character varying(50) NOT NULL,
    attribution_window_hours integer DEFAULT 168 NOT NULL,
    ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    impressions bigint DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    attributed_orders integer DEFAULT 0 NOT NULL,
    attributed_gross_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    attributed_settled_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    refund_reserve_amount numeric(14,2) DEFAULT 0 NOT NULL,
    settlement_cycle_days integer DEFAULT 7 NOT NULL,
    estimated_settle_date date NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    direct_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    indirect_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    net_gmv numeric(14,2) DEFAULT 0 NOT NULL
);

CREATE TABLE public.fact_after_sale_tickets (
    id bigint NOT NULL,
    ticket_no character varying(80) NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    source_refund_id character varying(100) NOT NULL,
    product_id bigint,
    refund_type character varying(30) NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    reason_category character varying(50) NOT NULL,
    reason_detail text DEFAULT ''::text NOT NULL,
    ticket_status character varying(30) DEFAULT 'pending_audit'::character varying NOT NULL,
    shop_experience_score numeric(3,2) DEFAULT 4.80,
    autonomy_protected boolean DEFAULT false NOT NULL,
    audit_deadline_at timestamp with time zone,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    assignee_id bigint,
    resolution_note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_after_sale_tickets_reason_category_check CHECK (((reason_category)::text = ANY ((ARRAY['size_mismatch'::character varying, 'quality_defect'::character varying, 'logistics_slow'::character varying, 'not_as_described'::character varying, 'buyer_remorse'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT fact_after_sale_tickets_refund_type_check CHECK (((refund_type)::text = ANY ((ARRAY['only_refund'::character varying, 'return_refund'::character varying, 'exchange'::character varying])::text[]))),
    CONSTRAINT fact_after_sale_tickets_ticket_status_check CHECK (((ticket_status)::text = ANY ((ARRAY['pending_audit'::character varying, 'waiting_return'::character varying, 'approved'::character varying, 'rejected'::character varying, 'platform_intervened'::character varying, 'closed'::character varying])::text[])))
);

CREATE TABLE public.fact_content_daily (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    content_id character varying(100) NOT NULL,
    title character varying(255) DEFAULT ''::character varying,
    content_type character varying(30) DEFAULT 'short_video'::character varying,
    views bigint DEFAULT 0 NOT NULL,
    likes bigint DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    collects integer DEFAULT 0 NOT NULL,
    attributed_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.fact_cs_session (
    id bigint NOT NULL,
    session_date date NOT NULL,
    agent_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    shift_type character varying(20) DEFAULT 'day'::character varying NOT NULL,
    total_sessions integer DEFAULT 0 NOT NULL,
    responded_sessions integer DEFAULT 0 NOT NULL,
    timeout_sessions integer DEFAULT 0 NOT NULL,
    avg_first_response_sec numeric(8,2) DEFAULT 0 NOT NULL,
    inquiry_buyers integer DEFAULT 0 NOT NULL,
    converted_buyers integer DEFAULT 0 NOT NULL,
    converted_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    satisfaction_rate numeric(5,2) DEFAULT 95.00 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_cs_session_shift_type_check CHECK (((shift_type)::text = ANY ((ARRAY['day'::character varying, 'night'::character varying])::text[])))
);

CREATE TABLE public.fact_fulfillment_waybill (
    id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    order_no character varying(100) NOT NULL,
    waybill_no character varying(100),
    carrier_code character varying(40) DEFAULT 'SF'::character varying,
    product_id bigint,
    order_amount numeric(12,2) DEFAULT 0 NOT NULL,
    is_custom_presale boolean DEFAULT false NOT NULL,
    paid_at timestamp with time zone NOT NULL,
    ship_deadline_at timestamp with time zone NOT NULL,
    shipped_at timestamp with time zone,
    pickup_at timestamp with time zone,
    signed_at timestamp with time zone,
    fulfillment_status character varying(30) DEFAULT 'pending_ship'::character varying NOT NULL,
    is_ship_delayed boolean DEFAULT false NOT NULL,
    is_fake_ship_risk boolean DEFAULT false NOT NULL,
    estimated_penalty_amount numeric(12,2) DEFAULT 0 NOT NULL,
    sla_risk_reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_fulfillment_waybill_fulfillment_status_check CHECK (((fulfillment_status)::text = ANY ((ARRAY['pending_ship'::character varying, 'shipped_no_pickup'::character varying, 'in_transit'::character varying, 'signed'::character varying, 'cancelled'::character varying])::text[])))
);

CREATE TABLE public.fact_gl_entry (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    voucher_id bigint NOT NULL,
    voucher_no character varying(64) NOT NULL,
    line_no integer NOT NULL,
    account_code character varying(32) NOT NULL,
    direction character varying(10) NOT NULL,
    debit_amount numeric(18,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(18,2) DEFAULT 0 NOT NULL,
    shop_id bigint,
    platform_code character varying(32),
    session_id integer,
    remark text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_entry_amount CHECK (((((direction)::text = 'debit'::text) AND (debit_amount > (0)::numeric) AND (credit_amount = (0)::numeric)) OR (((direction)::text = 'credit'::text) AND (credit_amount > (0)::numeric) AND (debit_amount = (0)::numeric)))),
    CONSTRAINT fact_gl_entry_credit_amount_check CHECK ((credit_amount >= (0)::numeric)),
    CONSTRAINT fact_gl_entry_debit_amount_check CHECK ((debit_amount >= (0)::numeric)),
    CONSTRAINT fact_gl_entry_direction_check CHECK (((direction)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[])))
);

CREATE TABLE public.fact_gl_voucher (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    voucher_no character varying(64) NOT NULL,
    biz_date date NOT NULL,
    period character varying(7) NOT NULL,
    voucher_type character varying(32) NOT NULL,
    shop_id bigint,
    platform_code character varying(32),
    session_id integer,
    ref_type character varying(32) DEFAULT ''::character varying NOT NULL,
    ref_id character varying(64) DEFAULT ''::character varying NOT NULL,
    total_debit numeric(18,2) DEFAULT 0 NOT NULL,
    total_credit numeric(18,2) DEFAULT 0 NOT NULL,
    is_balanced boolean DEFAULT true NOT NULL,
    status character varying(20) DEFAULT 'posted'::character varying NOT NULL,
    created_by character varying(64) DEFAULT 'system'::character varying NOT NULL,
    posted_at timestamp with time zone DEFAULT now(),
    summary text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_voucher_balanced CHECK ((((status)::text <> 'posted'::text) OR ((total_debit = total_credit) AND (total_debit > (0)::numeric)))),
    CONSTRAINT fact_gl_voucher_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'posted'::character varying, 'voided'::character varying])::text[]))),
    CONSTRAINT fact_gl_voucher_voucher_type_check CHECK (((voucher_type)::text = ANY ((ARRAY['session_settle'::character varying, 'ad_spend'::character varying, 'order_revenue'::character varying, 'inventory_cogs'::character varying, 'refund_loss'::character varying, 'logistics_fee'::character varying, 'commission_fee'::character varying, 'manual_adjust'::character varying])::text[])))
);

CREATE TABLE public.fact_inventory_ledger (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    warehouse_code character varying(50) NOT NULL,
    change_type character varying(30) NOT NULL,
    delta_qty integer NOT NULL,
    before_on_hand integer NOT NULL,
    after_on_hand integer NOT NULL,
    ref_type character varying(40) DEFAULT 'manual_adjust'::character varying NOT NULL,
    ref_id character varying(100) DEFAULT ''::character varying NOT NULL,
    operator_id bigint,
    remark text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_inventory_ledger_change_type_check CHECK (((change_type)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying, 'lock'::character varying, 'unlock'::character varying, 'adjust'::character varying, 'return_in'::character varying])::text[])))
);

CREATE TABLE public.fact_inventory_reservation (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    reservation_no character varying(64) NOT NULL,
    order_no character varying(100) NOT NULL,
    product_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    warehouse_code character varying(50) DEFAULT 'MAIN_WH'::character varying NOT NULL,
    channel_listing_id bigint,
    reserved_qty integer NOT NULL,
    status character varying(20) DEFAULT 'reserved'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    committed_at timestamp with time zone,
    released_at timestamp with time zone,
    release_reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_inventory_reservation_reserved_qty_check CHECK ((reserved_qty > 0)),
    CONSTRAINT fact_inventory_reservation_status_check CHECK (((status)::text = ANY ((ARRAY['reserved'::character varying, 'committed'::character varying, 'released'::character varying])::text[])))
);

CREATE TABLE public.fact_inventory_stock (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    warehouse_code character varying(50) DEFAULT 'MAIN_WH'::character varying NOT NULL,
    warehouse_name character varying(100) DEFAULT '华东中心仓'::character varying NOT NULL,
    shop_id bigint,
    on_hand_qty integer DEFAULT 0 NOT NULL,
    locked_qty integer DEFAULT 0 NOT NULL,
    in_transit_qty integer DEFAULT 0 NOT NULL,
    available_qty integer GENERATED ALWAYS AS (GREATEST((on_hand_qty - locked_qty), 0)) STORED,
    safety_stock integer DEFAULT 20 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fact_kol_cooperation (
    id bigint NOT NULL,
    kol_id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    product_id bigint,
    coop_type character varying(30) DEFAULT 'live_slot'::character varying NOT NULL,
    campaign_name character varying(150) NOT NULL,
    publish_date date NOT NULL,
    pit_fee numeric(12,2) DEFAULT 0 NOT NULL,
    commission_rate numeric(6,4) DEFAULT 0.1500 NOT NULL,
    gmv numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    net_gmv numeric(14,2) GENERATED ALWAYS AS (GREATEST((gmv - refund_amount), (0)::numeric)) STORED,
    commission_amount numeric(12,2) DEFAULT 0 NOT NULL,
    settlement_status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    settled_at timestamp with time zone,
    remark text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_kol_cooperation_coop_type_check CHECK (((coop_type)::text = ANY ((ARRAY['live_slot'::character varying, 'short_video'::character varying, 'xhs_note'::character varying, 'cps_only'::character varying])::text[]))),
    CONSTRAINT fact_kol_cooperation_settlement_status_check CHECK (((settlement_status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'paid'::character varying, 'disputed'::character varying])::text[])))
);

CREATE TABLE public.fact_order_event_stream (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    event_type character varying(50) NOT NULL,
    from_status character varying(50) DEFAULT ''::character varying NOT NULL,
    to_status character varying(50) NOT NULL,
    operator_type character varying(30) DEFAULT 'system'::character varying NOT NULL,
    operator_name character varying(100) DEFAULT 'system'::character varying NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_order_event_stream_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['order_placed'::character varying, 'payment_confirmed'::character varying, 'inventory_locked'::character varying, 'inventory_released'::character varying, 'shipped'::character varying, 'delivered'::character varying, 'rma_created'::character varying, 'item_refunded'::character varying, 'order_completed'::character varying, 'order_closed'::character varying])::text[]))),
    CONSTRAINT fact_order_event_stream_operator_type_check CHECK (((operator_type)::text = ANY ((ARRAY['system'::character varying, 'user'::character varying, 'operator'::character varying, 'staff'::character varying, 'platform_webhook'::character varying, 'customer_service'::character varying])::text[])))
);

CREATE TABLE public.fact_order_rma_item (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    rma_no character varying(64) NOT NULL,
    biz_date date DEFAULT CURRENT_DATE NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    source_sub_order_id character varying(100) NOT NULL,
    internal_sku_id bigint,
    product_name character varying(255) NOT NULL,
    rma_type character varying(30) NOT NULL,
    return_quantity numeric(12,2) DEFAULT 1 NOT NULL,
    refund_amount numeric(18,2) DEFAULT 0 NOT NULL,
    reason_category character varying(50) NOT NULL,
    reason_detail text DEFAULT ''::text NOT NULL,
    return_tracking_no character varying(100) DEFAULT ''::character varying NOT NULL,
    return_logistics_company character varying(50) DEFAULT ''::character varying NOT NULL,
    inspection_status character varying(30) DEFAULT 'pending_inspection'::character varying NOT NULL,
    restock_status character varying(30) DEFAULT 'not_restocked'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    handled_by character varying(64) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_order_rma_item_inspection_status_check CHECK (((inspection_status)::text = ANY ((ARRAY['pending_inspection'::character varying, 'passed'::character varying, 'failed_damaged'::character varying, 'waived'::character varying])::text[]))),
    CONSTRAINT fact_order_rma_item_reason_category_check CHECK (((reason_category)::text = ANY ((ARRAY['size_mismatch'::character varying, 'quality_issue'::character varying, 'change_mind'::character varying, 'logistics_damage'::character varying, 'fake_goods'::character varying, 'wrong_item'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT fact_order_rma_item_refund_amount_check CHECK ((refund_amount >= (0)::numeric)),
    CONSTRAINT fact_order_rma_item_restock_status_check CHECK (((restock_status)::text = ANY ((ARRAY['not_restocked'::character varying, 'restocked_to_warehouse'::character varying, 'scrapped'::character varying])::text[]))),
    CONSTRAINT fact_order_rma_item_return_quantity_check CHECK ((return_quantity > (0)::numeric)),
    CONSTRAINT fact_order_rma_item_rma_type_check CHECK (((rma_type)::text = ANY ((ARRAY['refund_only'::character varying, 'return_and_refund'::character varying, 'exchange'::character varying])::text[]))),
    CONSTRAINT fact_order_rma_item_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);

CREATE TABLE public.fact_search_keyword_daily (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    biz_date date NOT NULL,
    keyword character varying(120) NOT NULL,
    product_id bigint,
    sku_code character varying(64) DEFAULT ''::character varying NOT NULL,
    note_id character varying(100) DEFAULT ''::character varying NOT NULL,
    impressions bigint DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    search_rank integer DEFAULT 99 NOT NULL,
    search_share_pct numeric(6,2) DEFAULT 0 NOT NULL,
    orders integer DEFAULT 0 NOT NULL,
    search_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    cvr numeric(6,2) DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fact_selection_item (
    id bigint NOT NULL,
    recommendation_id bigint NOT NULL,
    rank_no smallint DEFAULT 1 NOT NULL,
    product_id bigint,
    suggested_name character varying(200) NOT NULL,
    suggested_specs character varying(200) DEFAULT ''::character varying,
    match_score numeric(5,2) DEFAULT 0.00 NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    suggested_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    estimated_margin_rate numeric(5,4) DEFAULT 0.00 NOT NULL,
    risk_flags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.fact_selection_recommendation (
    id bigint NOT NULL,
    recommendation_no character varying(40) NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    category_code character varying(40) NOT NULL,
    platform_code character varying(32),
    shop_id bigint,
    city character varying(40) DEFAULT '全国'::character varying NOT NULL,
    signals_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    strategy character varying(20) DEFAULT 'trend_led'::character varying NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    insufficient_reason text DEFAULT ''::text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fact_selection_recommendation_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'adopted'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT fact_selection_recommendation_strategy_check CHECK (((strategy)::text = ANY ((ARRAY['weather_led'::character varying, 'trend_led'::character varying, 'degraded'::character varying])::text[])))
);

CREATE TABLE public.fact_settlement_cycles (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    order_date date NOT NULL,
    settle_date date NOT NULL,
    settlement_cycle_days integer DEFAULT 7 NOT NULL,
    gross_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    settled_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    refund_deducted numeric(14,2) DEFAULT 0 NOT NULL,
    reserve_held numeric(14,2) DEFAULT 0 NOT NULL,
    platform_fee numeric(14,2) DEFAULT 0 NOT NULL,
    ad_spend numeric(14,2) DEFAULT 0 NOT NULL,
    net_profit numeric(14,2) DEFAULT 0 NOT NULL,
    settlement_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_mode character varying(32) DEFAULT 'standard'::character varying NOT NULL,
    CONSTRAINT fact_settlement_cycles_business_mode_check CHECK (((business_mode)::text = ANY ((ARRAY['standard'::character varying, 'pop'::character varying, 'self_operated'::character varying])::text[]))),
    CONSTRAINT fact_settlement_cycles_settlement_status_check CHECK (((settlement_status)::text = ANY ((ARRAY['pending'::character varying, 'partial'::character varying, 'settled'::character varying, 'frozen'::character varying])::text[])))
);

CREATE TABLE public.fact_trade_daily (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    paid_order_count integer DEFAULT 0 NOT NULL,
    paid_buyer_count integer DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_count integer DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.fact_trade_daily_default (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y202608 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y2026m09 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y2026m10 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y2026m11 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y2026m12 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y202702 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_trade_daily_y2027m01 (
    id bigint DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass) CONSTRAINT fact_trade_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_trade_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_trade_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_trade_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    gmv numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_gmv_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_pay_amount_not_null NOT NULL,
    paid_order_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_order_count_not_null NOT NULL,
    paid_buyer_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_paid_buyer_count_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_trade_daily_refund_amount_not_null NOT NULL,
    refund_count integer DEFAULT 0 CONSTRAINT fact_trade_daily_refund_count_not_null NOT NULL,
    source character varying(20) DEFAULT 'demo'::character varying CONSTRAINT fact_trade_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    amount_type character varying(40) DEFAULT 'gross_paid'::character varying CONSTRAINT fact_trade_daily_amount_type_not_null NOT NULL,
    attribution_window_hours integer,
    source_code character varying(50),
    content_id character varying(100),
    is_demo boolean DEFAULT false CONSTRAINT fact_trade_daily_is_demo_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    batch_version bigint DEFAULT 1
);

CREATE TABLE public.fact_traffic_daily (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    visitors bigint DEFAULT 0 NOT NULL,
    avg_stay_seconds integer DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false NOT NULL
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.fact_traffic_daily_default (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y202608 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y202609 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y2026m10 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y2026m11 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y2026m12 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y202701 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.fact_traffic_daily_y202702 (
    id bigint DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass) CONSTRAINT fact_traffic_daily_id_not_null NOT NULL,
    biz_date date CONSTRAINT fact_traffic_daily_biz_date_not_null NOT NULL,
    platform_code character varying(32) CONSTRAINT fact_traffic_daily_platform_code_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_traffic_daily_shop_id_not_null NOT NULL,
    channel_name character varying(100) DEFAULT '默认渠道'::character varying,
    impressions bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_impressions_not_null NOT NULL,
    clicks bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_clicks_not_null NOT NULL,
    visitors bigint DEFAULT 0 CONSTRAINT fact_traffic_daily_visitors_not_null NOT NULL,
    avg_stay_seconds integer DEFAULT 0 CONSTRAINT fact_traffic_daily_avg_stay_seconds_not_null NOT NULL,
    source character varying(20) DEFAULT 'api'::character varying CONSTRAINT fact_traffic_daily_source_not_null NOT NULL,
    upload_id integer,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    source_code character varying(50),
    is_demo boolean DEFAULT false CONSTRAINT fact_traffic_daily_is_demo_not_null NOT NULL
);

CREATE TABLE public.field_mapping_rules (
    id integer NOT NULL,
    mapping_code character varying(64) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    source_platform character varying(32) NOT NULL,
    dataset_type character varying(32) NOT NULL,
    source_field character varying(100) NOT NULL,
    canonical_field character varying(100) NOT NULL,
    transform character varying(50) DEFAULT 'identity'::character varying,
    required boolean DEFAULT false,
    approval_status character varying(20) DEFAULT 'approved'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.goal_tracking (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    target numeric(12,2) DEFAULT 0 NOT NULL,
    current_val numeric(12,2) DEFAULT 0 NOT NULL,
    unit character varying(20) DEFAULT '元'::character varying NOT NULL,
    progress smallint DEFAULT 0 NOT NULL,
    category character varying(50) DEFAULT '营收'::character varying NOT NULL,
    period character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_template_id integer
);

CREATE TABLE public.import_batches (
    id bigint NOT NULL,
    batch_no character varying(64) NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    dataset_type character varying(32) NOT NULL,
    source_channel character varying(20) NOT NULL,
    status character varying(30) DEFAULT 'PROCESSING'::character varying NOT NULL,
    file_hash character varying(64),
    total_raw_rows integer DEFAULT 0,
    clean_candidate_rows integer DEFAULT 0,
    validated_rows integer DEFAULT 0,
    published_rows integer DEFAULT 0,
    error_summary text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.import_files (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    storage_path text NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_size_bytes bigint NOT NULL,
    mime_type character varying(100),
    sha256 character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.improvement_tasks (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    assignee character varying(100) DEFAULT '运营团队'::character varying,
    priority character varying(10) DEFAULT 'medium'::character varying,
    source character varying(50) DEFAULT 'manual'::character varying,
    source_id character varying(50),
    due_date date DEFAULT (CURRENT_DATE + 7),
    progress integer DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT improvement_tasks_priority_check CHECK (((priority)::text = ANY (ARRAY[('high'::character varying)::text, ('medium'::character varying)::text, ('low'::character varying)::text]))),
    CONSTRAINT improvement_tasks_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT improvement_tasks_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('in_progress'::character varying)::text, ('completed'::character varying)::text])))
);

CREATE TABLE public.ingest_sync_jobs (
    id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    job_type character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    watermark_from text,
    watermark_to text,
    input_rows integer DEFAULT 0,
    success_rows integer DEFAULT 0,
    dropped_rows integer DEFAULT 0,
    marked_rows integer DEFAULT 0,
    error_summary text,
    clean_rule_set_id integer,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);

CREATE TABLE public.issue_library (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    category character varying(50) DEFAULT ''::character varying NOT NULL,
    solution text DEFAULT ''::text NOT NULL,
    occurrence_count integer DEFAULT 0 NOT NULL,
    detailed_solution text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kuaishou_fans_ops (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    shop_id bigint NOT NULL,
    account_id character varying(64) NOT NULL,
    account_name character varying(100) DEFAULT ''::character varying,
    new_followers integer DEFAULT 0 NOT NULL,
    total_followers integer DEFAULT 0 NOT NULL,
    fans_team_joiners integer DEFAULT 0 NOT NULL,
    fans_team_total integer DEFAULT 0 NOT NULL,
    close_friends integer DEFAULT 0 NOT NULL,
    follow_page_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    discover_page_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    other_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    direct_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    indirect_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.land_raw_dedup (
    id bigint NOT NULL,
    source_platform character varying(32) NOT NULL,
    payload_hash character(64) NOT NULL,
    batch_id bigint,
    biz_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.live_registrations (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    anchor_id integer,
    room_id integer,
    operator_id integer,
    title character varying(200) DEFAULT ''::character varying,
    start_time time without time zone,
    end_time time without time zone,
    duration_min integer,
    status character varying(20) DEFAULT 'completed'::character varying,
    gmv numeric(14,2) DEFAULT 0,
    orders integer DEFAULT 0,
    buyer_count integer DEFAULT 0,
    return_amount numeric(14,2) DEFAULT 0,
    remark text DEFAULT ''::text,
    registered_by integer,
    registered_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entry_source character varying(20) DEFAULT 'manual_entry'::character varying NOT NULL,
    project_id integer
);

CREATE TABLE public.live_rooms (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    platform character varying(50) DEFAULT '抖音'::character varying NOT NULL,
    status character varying(20) DEFAULT 'inactive'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    shop_id bigint,
    platform_code character varying(32),
    CONSTRAINT live_rooms_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.metric_definition (
    id integer NOT NULL,
    metric_code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    unit character varying(20) DEFAULT ''::character varying,
    category character varying(30) DEFAULT 'trade'::character varying,
    formula text,
    description text,
    supported_platforms text[] DEFAULT '{}'::text[],
    is_additive boolean DEFAULT true NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    fact_table character varying(32) DEFAULT 'trade'::character varying,
    caliber character varying(32) DEFAULT 'standard'::character varying,
    version character varying(16) DEFAULT 'v1'::character varying,
    status character varying(16) DEFAULT 'active'::character varying,
    synonyms text[] DEFAULT '{}'::text[] NOT NULL,
    owner character varying(64) DEFAULT 'data_team'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.multi_room_status (
    id integer NOT NULL,
    room_id integer NOT NULL,
    online_users integer DEFAULT 0 NOT NULL,
    realtime_gmv numeric(12,2) DEFAULT 0 NOT NULL,
    total_views integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'offline'::character varying NOT NULL,
    conversion_rate numeric(5,2) DEFAULT 0 NOT NULL,
    avg_order_value numeric(10,2) DEFAULT 0 NOT NULL,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT multi_room_status_status_check CHECK (((status)::text = ANY (ARRAY[('live'::character varying)::text, ('ended'::character varying)::text, ('scheduled'::character varying)::text, ('offline'::character varying)::text])))
);

CREATE TABLE public.operators (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    employee_id character varying(50) DEFAULT ''::character varying,
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT operators_status_check CHECK ((status = ANY (ARRAY[0, 1])))
);

CREATE TABLE public.order_status_config (
    id integer NOT NULL,
    platform_code character varying(32) NOT NULL,
    status_code character varying(40) NOT NULL,
    status_name character varying(60) NOT NULL,
    is_final boolean DEFAULT false NOT NULL,
    counts_as_gmv boolean DEFAULT true NOT NULL,
    counts_as_order boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    description text DEFAULT ''::text
);

CREATE TABLE public.overview_activities (
    id integer NOT NULL,
    title character varying(300) NOT NULL,
    time_desc character varying(50) DEFAULT '刚刚'::character varying NOT NULL,
    activity_type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT overview_activities_activity_type_check CHECK (((activity_type)::text = ANY (ARRAY[('gmv_milestone'::character varying)::text, ('order_placed'::character varying)::text, ('viewer_peak'::character varying)::text, ('session_update'::character varying)::text, ('system_notify'::character varying)::text, ('info'::character varying)::text])))
);

CREATE TABLE public.overview_daily_stats (
    id integer NOT NULL,
    date date NOT NULL,
    today_gmv numeric(12,2) DEFAULT 0 NOT NULL,
    today_orders integer DEFAULT 0 NOT NULL,
    active_rooms integer DEFAULT 0 NOT NULL,
    online_viewers integer DEFAULT 0 NOT NULL,
    growth_rate numeric(5,1) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.overview_daily_stats_archive (
    id integer,
    date date NOT NULL,
    today_gmv numeric(12,2) DEFAULT 0 NOT NULL,
    today_orders integer DEFAULT 0 NOT NULL,
    active_rooms integer DEFAULT 0 NOT NULL,
    online_viewers integer DEFAULT 0 NOT NULL,
    growth_rate numeric(5,1) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.platform_caliber_config (
    id integer NOT NULL,
    platform_code character varying(32) NOT NULL,
    metric_code character varying(50) DEFAULT 'gmv'::character varying NOT NULL,
    amount_type character varying(40) NOT NULL,
    attribution_window_hours integer,
    attribution_type character varying(30) DEFAULT 'last_click'::character varying,
    is_default boolean DEFAULT false NOT NULL,
    display_note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.platform_capability_matrix (
    id bigint NOT NULL,
    platform_code character varying(32) NOT NULL,
    module_code character varying(64) NOT NULL,
    is_applicable boolean DEFAULT true NOT NULL,
    needs_dedicated_page boolean DEFAULT false NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.platform_members_summary (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint NOT NULL,
    biz_date date NOT NULL,
    member_tier character varying(40) DEFAULT 'all'::character varying NOT NULL,
    total_members integer DEFAULT 0 NOT NULL,
    new_members integer DEFAULT 0 NOT NULL,
    active_buyers integer DEFAULT 0 NOT NULL,
    repurchase_orders integer DEFAULT 0 NOT NULL,
    repurchase_rate numeric(6,2) DEFAULT 0 NOT NULL,
    followers_gmv_share numeric(6,2) DEFAULT 0 NOT NULL,
    private_domain_cvr numeric(6,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.platform_sla_config (
    id integer NOT NULL,
    platform_code character varying(32) NOT NULL,
    sla_type character varying(40) NOT NULL,
    sla_name character varying(80) NOT NULL,
    threshold_hours integer NOT NULL,
    business_hours_only boolean DEFAULT false,
    business_hour_start integer,
    business_hour_end integer,
    penalty_note text DEFAULT ''::text,
    is_verified boolean DEFAULT false,
    pickup_threshold_hours integer DEFAULT 24 NOT NULL,
    penalty_fixed_amount numeric(10,2) DEFAULT 0 NOT NULL,
    penalty_rate numeric(8,4) DEFAULT 0 NOT NULL,
    penalty_min_amount numeric(10,2) DEFAULT 0 NOT NULL,
    penalty_max_amount numeric(10,2) DEFAULT 0 NOT NULL,
    autonomy_min_score numeric(4,2)
);

CREATE TABLE public.platform_source_mapping (
    id integer NOT NULL,
    platform_code character varying(32) NOT NULL,
    raw_source character varying(200) NOT NULL,
    source_code character varying(50) NOT NULL,
    match_type character varying(10) DEFAULT 'exact'::character varying,
    priority integer DEFAULT 0,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pricing_rules (
    id integer NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint,
    rule_layer smallint NOT NULL,
    rule_name character varying(128) NOT NULL,
    discount_mode character varying(40) NOT NULL,
    discount_value numeric(10,4) NOT NULL,
    is_exclusive boolean DEFAULT false NOT NULL,
    merchant_cost_ratio numeric(6,4) DEFAULT 1.0000 NOT NULL,
    platform_cost_ratio numeric(6,4) DEFAULT 0.0000 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_rules_discount_mode_check CHECK (((discount_mode)::text = ANY ((ARRAY['official_reduction'::character varying, 'store_coupon'::character varying, 'category_coupon'::character varying, 'vip_discount'::character varying, 'national_subsidy'::character varying, 'red_packet'::character varying, 'multi_piece_exclusive'::character varying])::text[]))),
    CONSTRAINT pricing_rules_rule_layer_check CHECK (((rule_layer >= 1) AND (rule_layer <= 5)))
);

CREATE TABLE public.promotions (
    id integer NOT NULL,
    name character varying(200) DEFAULT ''::character varying NOT NULL,
    type character varying(100) DEFAULT ''::character varying NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    applicable_rooms jsonb DEFAULT '[]'::jsonb NOT NULL,
    applicable_anchors jsonb DEFAULT '[]'::jsonb NOT NULL,
    target_gmv numeric(15,2) DEFAULT 0 NOT NULL,
    current_gmv numeric(15,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'preparing'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.publish_reversals (
    id bigint NOT NULL,
    publish_run_id bigint NOT NULL,
    reversal_reason text NOT NULL,
    reversed_by integer NOT NULL,
    records_affected integer NOT NULL,
    reversed_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.publish_runs (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    validation_run_id bigint NOT NULL,
    published_by integer,
    policy_version character varying(50) NOT NULL,
    target_table character varying(64) NOT NULL,
    records_published integer NOT NULL,
    status character varying(20) DEFAULT 'SUCCESS'::character varying NOT NULL,
    published_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    biz_date date NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer NOT NULL,
    raw_payload jsonb NOT NULL,
    payload_hash character varying(64) NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
)
PARTITION BY RANGE (biz_date);

CREATE TABLE public.raw_records_default (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202608 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202609 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202610 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202611 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202612 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202701 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202702 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202703 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202704 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202705 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.raw_records_y202706 (
    id bigint DEFAULT nextval('public.raw_records_id_seq'::regclass) CONSTRAINT raw_records_id_not_null NOT NULL,
    batch_id bigint CONSTRAINT raw_records_batch_id_not_null NOT NULL,
    biz_date date CONSTRAINT raw_records_biz_date_not_null NOT NULL,
    sheet_name character varying(100) DEFAULT 'Sheet1'::character varying,
    row_no integer CONSTRAINT raw_records_row_no_not_null NOT NULL,
    raw_payload jsonb CONSTRAINT raw_records_raw_payload_not_null NOT NULL,
    payload_hash character varying(64) CONSTRAINT raw_records_payload_hash_not_null NOT NULL,
    source_business_key character varying(200),
    ingested_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.reconciliation_runs (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    reconcile_level character varying(20) NOT NULL,
    metric_code character varying(50) NOT NULL,
    source_control_value numeric(18,2) NOT NULL,
    system_calculated_value numeric(18,2) NOT NULL,
    difference numeric(18,2) NOT NULL,
    tolerance numeric(18,2) DEFAULT 0.00,
    status character varying(20) NOT NULL,
    reconciled_at timestamp with time zone DEFAULT now(),
    publish_run_id bigint
);

CREATE TABLE public.review_actions (
    id bigint NOT NULL,
    issue_id bigint NOT NULL,
    reviewer_id integer NOT NULL,
    decision character varying(20) NOT NULL,
    decision_reason text NOT NULL,
    before_value jsonb,
    after_value jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.role_module_grants (
    id bigint NOT NULL,
    role_code character varying(50) NOT NULL,
    module_code character varying(64) NOT NULL,
    effect character varying(8) DEFAULT 'allow'::character varying NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT role_module_grants_effect_check CHECK (((effect)::text = ANY ((ARRAY['allow'::character varying, 'deny'::character varying])::text[])))
);

CREATE TABLE public.role_modules (
    role_code character varying(50) NOT NULL,
    module_code character varying(50) NOT NULL
);

CREATE TABLE public.role_platform_permissions (
    id integer NOT NULL,
    role_id integer NOT NULL,
    platform_code character varying(32) NOT NULL,
    allowed_modules text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.roles (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.room_health (
    id integer NOT NULL,
    room_id integer NOT NULL,
    health_score smallint DEFAULT 0 NOT NULL,
    interaction_score smallint DEFAULT 0 NOT NULL,
    conversion_score smallint DEFAULT 0 NOT NULL,
    content_score smallint DEFAULT 0 NOT NULL,
    traffic_score smallint DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'healthy'::character varying NOT NULL,
    evaluated_at date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT room_health_status_check CHECK (((status)::text = ANY (ARRAY[('healthy'::character varying)::text, ('warning'::character varying)::text, ('critical'::character varying)::text])))
);

CREATE TABLE public.schema_migrations (
    version character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.script_library (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    category character varying(50) DEFAULT ''::character varying NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    use_count integer DEFAULT 0 NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session_anchor_metrics (
    id integer NOT NULL,
    date date NOT NULL,
    anchor_id integer NOT NULL,
    room_id integer NOT NULL,
    duration_min integer DEFAULT 0 NOT NULL,
    gmv numeric(12,2) DEFAULT 0 NOT NULL,
    gmv_per_hour numeric(10,2) DEFAULT 0 NOT NULL,
    online_peak integer DEFAULT 0 NOT NULL,
    avg_online integer DEFAULT 0 NOT NULL,
    avg_item_price numeric(10,2) DEFAULT 0 NOT NULL,
    exposure_view_rate numeric(5,2) DEFAULT 0 NOT NULL,
    retention_rate numeric(5,2) DEFAULT 0 NOT NULL,
    interaction_rate numeric(5,2) DEFAULT 0 NOT NULL,
    new_fans integer DEFAULT 0 NOT NULL,
    view_follow_rate numeric(5,2) DEFAULT 0 NOT NULL,
    new_group_members integer DEFAULT 0 NOT NULL,
    uv_value numeric(6,2) DEFAULT 0 NOT NULL,
    buyer_count integer DEFAULT 0 NOT NULL,
    audience_profile text,
    gpm numeric(10,2) DEFAULT 0 NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    title character varying(200) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session_channel_metrics (
    id integer NOT NULL,
    session_id integer,
    channel character varying(50) NOT NULL,
    avg_watch_sec integer DEFAULT 0 NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    exposure_view_rate numeric(5,2) DEFAULT 0 NOT NULL,
    interactions integer DEFAULT 0 NOT NULL,
    view_interaction_rate numeric(5,2) DEFAULT 0 NOT NULL,
    new_fans integer DEFAULT 0 NOT NULL,
    product_impressions integer DEFAULT 0 NOT NULL,
    product_clicks integer DEFAULT 0 NOT NULL,
    product_click_rate numeric(5,2) DEFAULT 0 NOT NULL,
    product_deal_rate numeric(5,2) DEFAULT 0 NOT NULL,
    orders integer DEFAULT 0 NOT NULL,
    buyer_count integer DEFAULT 0 NOT NULL,
    gmv numeric(12,2) DEFAULT 0 NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    gpm numeric(10,2) DEFAULT 0 NOT NULL,
    avg_order_value numeric(10,2) DEFAULT 0 NOT NULL,
    ad_spend numeric(10,2) DEFAULT 0 NOT NULL,
    period_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    platform_code character varying(32),
    source_code character varying(64),
    shop_id bigint
);

CREATE TABLE public.session_live_basic_info (
    id integer NOT NULL,
    session_id integer,
    room_id integer,
    business_date date NOT NULL,
    fans_before_broadcast bigint DEFAULT 0,
    live_date date,
    live_start_time time without time zone,
    live_end_time time without time zone,
    live_duration_min integer DEFAULT 0,
    live_platform character varying(50) DEFAULT '抖音'::character varying,
    payment_amount numeric(14,2) DEFAULT 0,
    gpm numeric(14,2) DEFAULT 0,
    disposal_count integer DEFAULT 0,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session_overview_metrics (
    id integer NOT NULL,
    session_id integer,
    room_id integer,
    business_date date NOT NULL,
    viewers integer DEFAULT 0,
    exposure_view_rate numeric(8,4) DEFAULT 0,
    avg_online integer DEFAULT 0,
    peak_online integer DEFAULT 0,
    product_click_users integer DEFAULT 0,
    product_exposure_click_rate numeric(8,4) DEFAULT 0,
    avg_watch_seconds integer DEFAULT 0,
    new_followers integer DEFAULT 0,
    view_follow_rate numeric(8,4) DEFAULT 0,
    interaction_rate numeric(8,4) DEFAULT 0,
    avg_comments_per_person numeric(8,2) DEFAULT 0,
    conversion_rate numeric(8,4) DEFAULT 0,
    product_click_deal_rate numeric(8,4) DEFAULT 0,
    avg_order_value numeric(14,2) DEFAULT 0,
    refund_amount numeric(14,2) DEFAULT 0,
    refund_orders integer DEFAULT 0,
    refund_users integer DEFAULT 0,
    exposure_users integer DEFAULT 0,
    enter_users integer DEFAULT 0,
    product_exposure_users integer DEFAULT 0,
    product_click_persons integer DEFAULT 0,
    deal_users integer DEFAULT 0,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session_plan_products (
    id integer NOT NULL,
    plan_id integer,
    group_letter character(1),
    product_code character varying(100) DEFAULT ''::character varying,
    price numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id integer,
    room_id integer,
    business_date date,
    product_order integer,
    product_name character varying(255),
    product_id character varying(255),
    product_image character varying(500),
    upload_id integer,
    payment_amount numeric(14,2) DEFAULT 0,
    sold_count integer DEFAULT 0,
    buyer_count integer DEFAULT 0,
    order_count integer DEFAULT 0,
    pre_sale_orders integer DEFAULT 0,
    pre_sale_amount numeric(14,2) DEFAULT 0,
    exposure_users integer DEFAULT 0,
    click_users integer DEFAULT 0,
    exposure_click_rate numeric(9,4),
    click_deal_rate numeric(9,4),
    refund_users integer DEFAULT 0,
    refund_amount numeric(14,2) DEFAULT 0,
    refund_orders integer DEFAULT 0,
    sku_snapshot_jsonb jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT session_plan_products_semantics_check CHECK ((((plan_id IS NOT NULL) AND (product_code IS NOT NULL)) OR ((product_id IS NOT NULL) AND (product_name IS NOT NULL))))
);

CREATE TABLE public.session_plans (
    id integer NOT NULL,
    room_id integer NOT NULL,
    plan_date date NOT NULL,
    anchor_id integer NOT NULL,
    campaign_id integer,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.session_short_video_traffic (
    id integer NOT NULL,
    session_id integer,
    room_id integer,
    business_date date NOT NULL,
    video_name character varying(500) DEFAULT ''::character varying NOT NULL,
    post_time timestamp with time zone,
    live_entry_impressions bigint DEFAULT 0,
    traffic_to_live integer DEFAULT 0,
    entry_click_rate numeric(8,4) DEFAULT 0,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.signal_source (
    id bigint NOT NULL,
    code character varying(40) NOT NULL,
    category_code character varying(40) NOT NULL,
    weight numeric(5,4) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb,
    remark text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT signal_source_weight_check CHECK (((weight >= (0)::numeric) AND (weight <= (1)::numeric)))
);

CREATE TABLE public.sys_custom_field_definition (
    id integer NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    entity_type character varying(32) NOT NULL,
    field_key character varying(64) NOT NULL,
    field_label character varying(100) NOT NULL,
    data_type character varying(20) NOT NULL,
    platform_code character varying(32),
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    default_value text DEFAULT ''::text NOT NULL,
    validation_regex text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sys_custom_field_definition_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['string'::character varying, 'number'::character varying, 'boolean'::character varying, 'date'::character varying, 'select'::character varying, 'json'::character varying])::text[]))),
    CONSTRAINT sys_custom_field_definition_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['product'::character varying, 'shop'::character varying, 'live_session'::character varying, 'order'::character varying, 'ad_plan'::character varying, 'channel_listing'::character varying])::text[])))
);

CREATE TABLE public.sys_custom_field_value (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    field_id integer NOT NULL,
    entity_type character varying(32) NOT NULL,
    entity_id character varying(64) NOT NULL,
    field_key character varying(64) NOT NULL,
    field_value_text text DEFAULT ''::text NOT NULL,
    field_value_number numeric(18,4),
    field_value_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sys_role (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text DEFAULT ''::text,
    is_system boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sys_role_permission (
    id bigint NOT NULL,
    role_code character varying(50) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) DEFAULT '*'::character varying NOT NULL,
    effect character varying(10) DEFAULT 'allow'::character varying NOT NULL,
    scope_type character varying(20) DEFAULT 'tenant'::character varying NOT NULL,
    condition jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.sys_user_role (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    role_code character varying(50) NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.system_config (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text DEFAULT ''::text NOT NULL,
    config_type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.system_jobs (
    id bigint NOT NULL,
    job_type character varying(50) NOT NULL,
    job_name character varying(200) DEFAULT ''::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    input_payload jsonb DEFAULT '{}'::jsonb,
    result_payload jsonb DEFAULT '{}'::jsonb,
    error_message text DEFAULT ''::text,
    run_at timestamp with time zone,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT system_jobs_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('running'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.system_modules (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(50) DEFAULT ''::character varying,
    sort_order smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.system_platform_configs (
    platform_code character varying(32) NOT NULL,
    platform_name character varying(50) NOT NULL,
    category character varying(20) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    icon character varying(50) DEFAULT ''::character varying,
    api_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.taobao_order_hierarchy (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    shop_id bigint NOT NULL,
    parent_order_id character varying(64) NOT NULL,
    sub_order_id character varying(64) NOT NULL,
    sku_code character varying(64) DEFAULT ''::character varying,
    pay_amount numeric(14,2) DEFAULT 0 NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    terminal character varying(20) DEFAULT 'wireless'::character varying,
    buyer_id_masked character varying(64) DEFAULT ''::character varying,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.target_templates (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metrics jsonb DEFAULT '[]'::jsonb CONSTRAINT target_templates_metrics_new_not_null NOT NULL,
    period character varying(20) DEFAULT 'monthly'::character varying NOT NULL
);

CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(50) NOT NULL,
    plan character varying(30) DEFAULT 'starter'::character varying,
    max_projects integer DEFAULT 10,
    max_users integer DEFAULT 20,
    max_anchors integer DEFAULT 50,
    status character varying(20) DEFAULT 'active'::character varying,
    trial_ends_at timestamp with time zone,
    billing_email character varying(200),
    logo_url text,
    custom_domain character varying(200),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.upload_column_mappings (
    id integer NOT NULL,
    template_code character varying(50) NOT NULL,
    platform_code character varying(32) NOT NULL,
    file_header_fingerprint character varying(64) NOT NULL,
    column_mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_module_overrides (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    module_code character varying(64) NOT NULL,
    effect character varying(8) NOT NULL,
    granted_by integer,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_module_overrides_effect_check CHECK (((effect)::text = ANY ((ARRAY['grant'::character varying, 'revoke'::character varying])::text[])))
);

CREATE TABLE public.user_platform_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_scope bigint[] DEFAULT '{}'::bigint[],
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_sessions (
    id character varying(128) NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    real_name character varying(100) DEFAULT ''::character varying NOT NULL,
    role character varying(20) DEFAULT 'employee'::character varying NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer,
    user_type character varying(20) DEFAULT 'agency_staff'::character varying,
    anchor_id integer,
    operator_id integer,
    data_scope character varying(16) DEFAULT 'self'::character varying,
    dept_id integer,
    team_id integer,
    manager_id integer,
    CONSTRAINT users_data_scope_check CHECK (((data_scope IS NULL) OR ((data_scope)::text = ANY ((ARRAY['self'::character varying, 'team'::character varying, 'org'::character varying, 'all'::character varying])::text[])))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['super_admin'::character varying, 'admin'::character varying, 'ops_director'::character varying, 'ops_staff'::character varying, 'operator'::character varying, 'controller'::character varying, 'ad_buyer'::character varying, 'hrbp'::character varying, 'employee'::character varying, 'brand_viewer'::character varying, 'floor_manager'::character varying, 'video_editor'::character varying, 'director'::character varying, 'cs_agent'::character varying, 'warehouse'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY[0, 1])))
);

CREATE TABLE public.validation_runs (
    id bigint NOT NULL,
    cleaning_run_id bigint NOT NULL,
    rule_set_version character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'RUNNING'::character varying NOT NULL,
    total_checked integer DEFAULT 0,
    p0_issues_count integer DEFAULT 0,
    p1_issues_count integer DEFAULT 0,
    p2_issues_count integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);

CREATE TABLE public.video_metrics (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    platform_code character varying(32) NOT NULL,
    shop_id bigint,
    video_id character varying(100) NOT NULL,
    title character varying(300) DEFAULT ''::character varying,
    content_type character varying(30) DEFAULT 'short_video'::character varying,
    impressions bigint DEFAULT 0 NOT NULL,
    plays bigint DEFAULT 0 NOT NULL,
    complete_rate numeric(6,2) DEFAULT 0 NOT NULL,
    likes bigint DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    collects integer DEFAULT 0 NOT NULL,
    attributed_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.xhs_note (
    id bigint NOT NULL,
    biz_date date NOT NULL,
    shop_id bigint,
    note_id character varying(64) NOT NULL,
    title character varying(300) DEFAULT ''::character varying,
    note_type character varying(20) DEFAULT 'image_text'::character varying,
    author_name character varying(100) DEFAULT ''::character varying,
    impressions bigint DEFAULT 0 NOT NULL,
    reads bigint DEFAULT 0 NOT NULL,
    likes bigint DEFAULT 0 NOT NULL,
    collects bigint DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    follows integer DEFAULT 0 NOT NULL,
    search_impressions bigint DEFAULT 0 NOT NULL,
    recommend_impressions bigint DEFAULT 0 NOT NULL,
    search_keywords text[],
    product_clicks bigint DEFAULT 0 NOT NULL,
    onsite_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    offsite_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- ===== addconstraint (667) =====
ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_plan_no_key UNIQUE (plan_no);

ALTER TABLE ONLY public.ad_plan_receipts
    ADD CONSTRAINT ad_plan_receipts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_tool_dict
    ADD CONSTRAINT ad_tool_dict_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.agg_shop_daily
    ADD CONSTRAINT agg_shop_daily_biz_date_platform_code_shop_id_key UNIQUE (biz_date, platform_code, shop_id);

ALTER TABLE ONLY public.agg_shop_daily
    ADD CONSTRAINT agg_shop_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.agg_trade_day_platform_channel
    ADD CONSTRAINT agg_trade_day_platform_channel_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.agg_traffic_day_live
    ADD CONSTRAINT agg_traffic_day_live_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_analysis_steps
    ADD CONSTRAINT ai_analysis_steps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_config
    ADD CONSTRAINT ai_config_config_key_key UNIQUE (config_key);

ALTER TABLE ONLY public.ai_config
    ADD CONSTRAINT ai_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_context_bindings
    ADD CONSTRAINT ai_context_bindings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_context_bindings
    ADD CONSTRAINT ai_context_bindings_user_id_scope_type_scope_id_key UNIQUE (user_id, scope_type, scope_id);

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_eval_case
    ADD CONSTRAINT ai_eval_case_code_key UNIQUE (code);

ALTER TABLE ONLY public.ai_eval_case
    ADD CONSTRAINT ai_eval_case_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_eval_run
    ADD CONSTRAINT ai_eval_run_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_claim
    ADD CONSTRAINT ai_v2_claim_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_evidence
    ADD CONSTRAINT ai_v2_evidence_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_llm_call
    ADD CONSTRAINT ai_v2_llm_call_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_run
    ADD CONSTRAINT ai_v2_run_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_step
    ADD CONSTRAINT ai_v2_step_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.amount_type_dict
    ADD CONSTRAINT amount_type_dict_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_anchor_id_evaluated_at_key UNIQUE (anchor_id, evaluated_at);

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_profiles
    ADD CONSTRAINT anchor_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_script_templates
    ADD CONSTRAINT anchor_script_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_training_plans
    ADD CONSTRAINT anchor_training_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_training_records
    ADD CONSTRAINT anchor_training_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_plan_no_key UNIQUE (plan_no);

ALTER TABLE ONLY public.campaign_plan_template
    ADD CONSTRAINT campaign_plan_template_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.campaign_plan_template
    ADD CONSTRAINT campaign_plan_template_template_code_key UNIQUE (template_code);

ALTER TABLE ONLY public.canonical_order_items
    ADD CONSTRAINT uk_canonical_item_bizkey UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_default
    ADD CONSTRAINT canonical_order_items_default_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items
    ADD CONSTRAINT canonical_order_items_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_default
    ADD CONSTRAINT canonical_order_items_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202608
    ADD CONSTRAINT canonical_order_items_y202608_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202608
    ADD CONSTRAINT canonical_order_items_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202609
    ADD CONSTRAINT canonical_order_items_y202609_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202609
    ADD CONSTRAINT canonical_order_items_y202609_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202610
    ADD CONSTRAINT canonical_order_items_y202610_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202610
    ADD CONSTRAINT canonical_order_items_y202610_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202611
    ADD CONSTRAINT canonical_order_items_y202611_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202611
    ADD CONSTRAINT canonical_order_items_y202611_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202612
    ADD CONSTRAINT canonical_order_items_y202612_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202612
    ADD CONSTRAINT canonical_order_items_y202612_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202701
    ADD CONSTRAINT canonical_order_items_y202701_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202701
    ADD CONSTRAINT canonical_order_items_y202701_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202702
    ADD CONSTRAINT canonical_order_items_y202702_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202702
    ADD CONSTRAINT canonical_order_items_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202703
    ADD CONSTRAINT canonical_order_items_y202703_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202703
    ADD CONSTRAINT canonical_order_items_y202703_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202704
    ADD CONSTRAINT canonical_order_items_y202704_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202704
    ADD CONSTRAINT canonical_order_items_y202704_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202705
    ADD CONSTRAINT canonical_order_items_y202705_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202705
    ADD CONSTRAINT canonical_order_items_y202705_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_order_items_y202706
    ADD CONSTRAINT canonical_order_items_y202706_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.canonical_order_items_y202706
    ADD CONSTRAINT canonical_order_items_y202706_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders
    ADD CONSTRAINT uk_canonical_order_bizkey UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_default
    ADD CONSTRAINT canonical_orders_default_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders
    ADD CONSTRAINT canonical_orders_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_default
    ADD CONSTRAINT canonical_orders_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202608
    ADD CONSTRAINT canonical_orders_y202608_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202608
    ADD CONSTRAINT canonical_orders_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202609
    ADD CONSTRAINT canonical_orders_y202609_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202609
    ADD CONSTRAINT canonical_orders_y202609_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202610
    ADD CONSTRAINT canonical_orders_y202610_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202610
    ADD CONSTRAINT canonical_orders_y202610_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202611
    ADD CONSTRAINT canonical_orders_y202611_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202611
    ADD CONSTRAINT canonical_orders_y202611_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202612
    ADD CONSTRAINT canonical_orders_y202612_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202612
    ADD CONSTRAINT canonical_orders_y202612_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202701
    ADD CONSTRAINT canonical_orders_y202701_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202701
    ADD CONSTRAINT canonical_orders_y202701_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202702
    ADD CONSTRAINT canonical_orders_y202702_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202702
    ADD CONSTRAINT canonical_orders_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202703
    ADD CONSTRAINT canonical_orders_y202703_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202703
    ADD CONSTRAINT canonical_orders_y202703_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202704
    ADD CONSTRAINT canonical_orders_y202704_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202704
    ADD CONSTRAINT canonical_orders_y202704_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202705
    ADD CONSTRAINT canonical_orders_y202705_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202705
    ADD CONSTRAINT canonical_orders_y202705_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_orders_y202706
    ADD CONSTRAINT canonical_orders_y202706_biz_date_source_platform_store_id__key UNIQUE (biz_date, source_platform, store_id, source_order_id);

ALTER TABLE ONLY public.canonical_orders_y202706
    ADD CONSTRAINT canonical_orders_y202706_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events
    ADD CONSTRAINT uk_canonical_refund_bizkey UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_default
    ADD CONSTRAINT canonical_refund_events_defau_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events
    ADD CONSTRAINT canonical_refund_events_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_default
    ADD CONSTRAINT canonical_refund_events_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202608
    ADD CONSTRAINT canonical_refund_events_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202609
    ADD CONSTRAINT canonical_refund_events_y202609_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202610
    ADD CONSTRAINT canonical_refund_events_y202610_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202611
    ADD CONSTRAINT canonical_refund_events_y202611_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202612
    ADD CONSTRAINT canonical_refund_events_y202612_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202609
    ADD CONSTRAINT canonical_refund_events_y2026_biz_date_source_platform_sto_key1 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202610
    ADD CONSTRAINT canonical_refund_events_y2026_biz_date_source_platform_sto_key2 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202611
    ADD CONSTRAINT canonical_refund_events_y2026_biz_date_source_platform_sto_key3 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202612
    ADD CONSTRAINT canonical_refund_events_y2026_biz_date_source_platform_sto_key4 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202608
    ADD CONSTRAINT canonical_refund_events_y2026_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202701
    ADD CONSTRAINT canonical_refund_events_y202701_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202702
    ADD CONSTRAINT canonical_refund_events_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202703
    ADD CONSTRAINT canonical_refund_events_y202703_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202704
    ADD CONSTRAINT canonical_refund_events_y202704_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202705
    ADD CONSTRAINT canonical_refund_events_y202705_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202706
    ADD CONSTRAINT canonical_refund_events_y202706_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.canonical_refund_events_y202702
    ADD CONSTRAINT canonical_refund_events_y2027_biz_date_source_platform_sto_key1 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202703
    ADD CONSTRAINT canonical_refund_events_y2027_biz_date_source_platform_sto_key2 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202704
    ADD CONSTRAINT canonical_refund_events_y2027_biz_date_source_platform_sto_key3 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202705
    ADD CONSTRAINT canonical_refund_events_y2027_biz_date_source_platform_sto_key4 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202706
    ADD CONSTRAINT canonical_refund_events_y2027_biz_date_source_platform_sto_key5 UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.canonical_refund_events_y202701
    ADD CONSTRAINT canonical_refund_events_y2027_biz_date_source_platform_stor_key UNIQUE (biz_date, source_platform, store_id, source_refund_id);

ALTER TABLE ONLY public.clean_records
    ADD CONSTRAINT uk_clean_order_item UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_default
    ADD CONSTRAINT clean_records_default_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records
    ADD CONSTRAINT clean_records_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_default
    ADD CONSTRAINT clean_records_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202608
    ADD CONSTRAINT clean_records_y202608_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202608
    ADD CONSTRAINT clean_records_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202609
    ADD CONSTRAINT clean_records_y202609_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202609
    ADD CONSTRAINT clean_records_y202609_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202610
    ADD CONSTRAINT clean_records_y202610_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202610
    ADD CONSTRAINT clean_records_y202610_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202611
    ADD CONSTRAINT clean_records_y202611_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202611
    ADD CONSTRAINT clean_records_y202611_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202612
    ADD CONSTRAINT clean_records_y202612_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202612
    ADD CONSTRAINT clean_records_y202612_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202701
    ADD CONSTRAINT clean_records_y202701_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202701
    ADD CONSTRAINT clean_records_y202701_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202702
    ADD CONSTRAINT clean_records_y202702_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202702
    ADD CONSTRAINT clean_records_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202703
    ADD CONSTRAINT clean_records_y202703_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202703
    ADD CONSTRAINT clean_records_y202703_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202704
    ADD CONSTRAINT clean_records_y202704_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202704
    ADD CONSTRAINT clean_records_y202704_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202705
    ADD CONSTRAINT clean_records_y202705_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202705
    ADD CONSTRAINT clean_records_y202705_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_records_y202706
    ADD CONSTRAINT clean_records_y202706_biz_date_source_platform_store_id_sou_key UNIQUE (biz_date, source_platform, store_id, source_order_id, source_sub_order_id);

ALTER TABLE ONLY public.clean_records_y202706
    ADD CONSTRAINT clean_records_y202706_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.clean_rule_sets
    ADD CONSTRAINT clean_rule_sets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cleaning_runs
    ADD CONSTRAINT cleaning_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.competitor_brands
    ADD CONSTRAINT competitor_brands_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.competitor_price_data
    ADD CONSTRAINT competitor_price_data_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_activity_reminder
    ADD CONSTRAINT compliance_activity_reminder_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_risk_assessment
    ADD CONSTRAINT compliance_risk_assessment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_rule_change
    ADD CONSTRAINT compliance_rule_change_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_rule_snapshot
    ADD CONSTRAINT compliance_rule_snapshot_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_tenant_id_content_id_platform_co_key UNIQUE (tenant_id, content_id, platform_code, shop_id, biz_date, attribution_channel);

ALTER TABLE ONLY public.content_projects
    ADD CONSTRAINT content_projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_providers
    ADD CONSTRAINT content_providers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_tasks
    ADD CONSTRAINT content_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_exports
    ADD CONSTRAINT data_exports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_uploads
    ADD CONSTRAINT data_uploads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dict_items
    ADD CONSTRAINT dict_items_code_key UNIQUE (code);

ALTER TABLE ONLY public.dict_items
    ADD CONSTRAINT dict_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_accounting_subject
    ADD CONSTRAINT dim_accounting_subject_pkey PRIMARY KEY (account_code);

ALTER TABLE ONLY public.dim_brand
    ADD CONSTRAINT dim_brand_brand_code_key UNIQUE (brand_code);

ALTER TABLE ONLY public.dim_brand
    ADD CONSTRAINT dim_brand_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_category
    ADD CONSTRAINT dim_category_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.dim_cs_agent
    ADD CONSTRAINT dim_cs_agent_agent_code_key UNIQUE (agent_code);

ALTER TABLE ONLY public.dim_cs_agent
    ADD CONSTRAINT dim_cs_agent_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_dept
    ADD CONSTRAINT dim_dept_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_dept
    ADD CONSTRAINT dim_dept_tenant_id_dept_code_key UNIQUE (tenant_id, dept_code);

ALTER TABLE ONLY public.dim_kol
    ADD CONSTRAINT dim_kol_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT dim_product_channel_listing_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_product
    ADD CONSTRAINT dim_product_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_product
    ADD CONSTRAINT dim_product_sku_code_key UNIQUE (sku_code);

ALTER TABLE ONLY public.dim_shop
    ADD CONSTRAINT dim_shop_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_sku_mapping
    ADD CONSTRAINT dim_sku_mapping_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_sku_mapping
    ADD CONSTRAINT dim_sku_mapping_platform_code_shop_id_platform_sku_id_key UNIQUE (platform_code, shop_id, platform_sku_id);

ALTER TABLE ONLY public.dim_team
    ADD CONSTRAINT dim_team_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dim_team
    ADD CONSTRAINT dim_team_tenant_id_team_code_key UNIQUE (tenant_id, team_code);

ALTER TABLE ONLY public.dim_traffic_source
    ADD CONSTRAINT dim_traffic_source_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_business_date_account_name_anch_key UNIQUE (business_date, account_name, anchor_name);

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.douyin_channel_daily_metrics
    ADD CONSTRAINT douyin_channel_daily_metrics_business_date_channel_name_key UNIQUE (business_date, channel_name);

ALTER TABLE ONLY public.douyin_channel_daily_metrics
    ADD CONSTRAINT douyin_channel_daily_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dq_quarantine
    ADD CONSTRAINT dq_quarantine_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT entity_aliases_entity_type_source_platform_external_id_vali_key UNIQUE (entity_type, source_platform, external_id, valid_from);

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT entity_aliases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_ad_spend_daily
    ADD CONSTRAINT fact_ad_spend_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_ad_spend_daily
    ADD CONSTRAINT fact_ad_spend_daily_tenant_id_platform_code_shop_id_biz_dat_key UNIQUE (tenant_id, platform_code, shop_id, biz_date, ad_tool_code);

ALTER TABLE ONLY public.fact_after_sale_tickets
    ADD CONSTRAINT fact_after_sale_tickets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_after_sale_tickets
    ADD CONSTRAINT fact_after_sale_tickets_ticket_no_key UNIQUE (ticket_no);

ALTER TABLE ONLY public.fact_content_daily
    ADD CONSTRAINT fact_content_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_cs_session
    ADD CONSTRAINT fact_cs_session_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_cs_session
    ADD CONSTRAINT fact_cs_session_session_date_agent_id_shift_type_key UNIQUE (session_date, agent_id, shift_type);

ALTER TABLE ONLY public.fact_fulfillment_waybill
    ADD CONSTRAINT fact_fulfillment_waybill_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_fulfillment_waybill
    ADD CONSTRAINT fact_fulfillment_waybill_platform_code_shop_id_order_no_key UNIQUE (platform_code, shop_id, order_no);

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_gl_voucher
    ADD CONSTRAINT fact_gl_voucher_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_gl_voucher
    ADD CONSTRAINT fact_gl_voucher_voucher_no_key UNIQUE (voucher_no);

ALTER TABLE ONLY public.fact_inventory_ledger
    ADD CONSTRAINT fact_inventory_ledger_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_reservation_no_key UNIQUE (reservation_no);

ALTER TABLE ONLY public.fact_inventory_stock
    ADD CONSTRAINT fact_inventory_stock_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_inventory_stock
    ADD CONSTRAINT fact_inventory_stock_product_id_warehouse_code_key UNIQUE (product_id, warehouse_code);

ALTER TABLE ONLY public.fact_kol_cooperation
    ADD CONSTRAINT fact_kol_cooperation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_order_event_stream
    ADD CONSTRAINT fact_order_event_stream_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_order_rma_item
    ADD CONSTRAINT fact_order_rma_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_order_rma_item
    ADD CONSTRAINT fact_order_rma_item_rma_no_key UNIQUE (rma_no);

ALTER TABLE ONLY public.fact_search_keyword_daily
    ADD CONSTRAINT fact_search_keyword_daily_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_search_keyword_daily
    ADD CONSTRAINT fact_search_keyword_daily_tenant_id_platform_code_shop_id_b_key UNIQUE (tenant_id, platform_code, shop_id, biz_date, keyword);

ALTER TABLE ONLY public.fact_selection_item
    ADD CONSTRAINT fact_selection_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_recommendation_no_key UNIQUE (recommendation_no);

ALTER TABLE ONLY public.fact_settlement_cycles
    ADD CONSTRAINT fact_settlement_cycles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fact_settlement_cycles
    ADD CONSTRAINT fact_settlement_cycles_tenant_id_platform_code_shop_id_orde_key UNIQUE (tenant_id, platform_code, shop_id, order_date);

ALTER TABLE ONLY public.fact_trade_daily
    ADD CONSTRAINT uq_trade_daily_caliber_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_default
    ADD CONSTRAINT fact_trade_daily_default_biz_date_platform_code_shop_id_cha_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily
    ADD CONSTRAINT fact_trade_daily_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_default
    ADD CONSTRAINT fact_trade_daily_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y202608
    ADD CONSTRAINT fact_trade_daily_y202608_biz_date_platform_code_shop_id_cha_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y202608
    ADD CONSTRAINT fact_trade_daily_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y2026m09
    ADD CONSTRAINT fact_trade_daily_y2026m09_biz_date_platform_code_shop_id_ch_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y2026m09
    ADD CONSTRAINT fact_trade_daily_y2026m09_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y2026m10
    ADD CONSTRAINT fact_trade_daily_y2026m10_biz_date_platform_code_shop_id_ch_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y2026m10
    ADD CONSTRAINT fact_trade_daily_y2026m10_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y2026m11
    ADD CONSTRAINT fact_trade_daily_y2026m11_biz_date_platform_code_shop_id_ch_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y2026m11
    ADD CONSTRAINT fact_trade_daily_y2026m11_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y2026m12
    ADD CONSTRAINT fact_trade_daily_y2026m12_biz_date_platform_code_shop_id_ch_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y2026m12
    ADD CONSTRAINT fact_trade_daily_y2026m12_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y202702
    ADD CONSTRAINT fact_trade_daily_y202702_biz_date_platform_code_shop_id_cha_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y202702
    ADD CONSTRAINT fact_trade_daily_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_trade_daily_y2027m01
    ADD CONSTRAINT fact_trade_daily_y2027m01_biz_date_platform_code_shop_id_ch_key UNIQUE (biz_date, platform_code, shop_id, channel_name, amount_type);

ALTER TABLE ONLY public.fact_trade_daily_y2027m01
    ADD CONSTRAINT fact_trade_daily_y2027m01_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily
    ADD CONSTRAINT uq_traffic_daily_caliber_key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_default
    ADD CONSTRAINT fact_traffic_daily_default_biz_date_platform_code_shop_id_c_key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily
    ADD CONSTRAINT fact_traffic_daily_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_default
    ADD CONSTRAINT fact_traffic_daily_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y202608
    ADD CONSTRAINT fact_traffic_daily_y202608_biz_date_platform_code_shop_id_c_key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y202608
    ADD CONSTRAINT fact_traffic_daily_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y202609
    ADD CONSTRAINT fact_traffic_daily_y202609_biz_date_platform_code_shop_id_c_key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y202609
    ADD CONSTRAINT fact_traffic_daily_y202609_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y2026m10
    ADD CONSTRAINT fact_traffic_daily_y2026m10_biz_date_platform_code_shop_id__key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y2026m10
    ADD CONSTRAINT fact_traffic_daily_y2026m10_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y2026m11
    ADD CONSTRAINT fact_traffic_daily_y2026m11_biz_date_platform_code_shop_id__key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y2026m11
    ADD CONSTRAINT fact_traffic_daily_y2026m11_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y2026m12
    ADD CONSTRAINT fact_traffic_daily_y2026m12_biz_date_platform_code_shop_id__key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y2026m12
    ADD CONSTRAINT fact_traffic_daily_y2026m12_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y202701
    ADD CONSTRAINT fact_traffic_daily_y202701_biz_date_platform_code_shop_id_c_key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y202701
    ADD CONSTRAINT fact_traffic_daily_y202701_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.fact_traffic_daily_y202702
    ADD CONSTRAINT fact_traffic_daily_y202702_biz_date_platform_code_shop_id_c_key UNIQUE (biz_date, platform_code, shop_id, channel_name);

ALTER TABLE ONLY public.fact_traffic_daily_y202702
    ADD CONSTRAINT fact_traffic_daily_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.field_mapping_rules
    ADD CONSTRAINT field_mapping_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.field_mapping_rules
    ADD CONSTRAINT field_mapping_rules_source_platform_dataset_type_mapping_co_key UNIQUE (source_platform, dataset_type, mapping_code, version, source_field);

ALTER TABLE ONLY public.goal_tracking
    ADD CONSTRAINT goal_tracking_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_batch_no_key UNIQUE (batch_no);

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.import_files
    ADD CONSTRAINT import_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.improvement_tasks
    ADD CONSTRAINT improvement_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.issue_library
    ADD CONSTRAINT issue_library_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kuaishou_fans_ops
    ADD CONSTRAINT kuaishou_fans_ops_biz_date_shop_id_account_id_key UNIQUE (biz_date, shop_id, account_id);

ALTER TABLE ONLY public.kuaishou_fans_ops
    ADD CONSTRAINT kuaishou_fans_ops_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.land_raw_dedup
    ADD CONSTRAINT land_raw_dedup_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.live_registrations
    ADD CONSTRAINT live_registrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.live_rooms
    ADD CONSTRAINT live_rooms_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.metric_definition
    ADD CONSTRAINT metric_definition_metric_code_key UNIQUE (metric_code);

ALTER TABLE ONLY public.metric_definition
    ADD CONSTRAINT metric_definition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.multi_room_status
    ADD CONSTRAINT multi_room_status_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operators
    ADD CONSTRAINT operators_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_status_config
    ADD CONSTRAINT order_status_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_status_config
    ADD CONSTRAINT order_status_config_platform_code_status_code_key UNIQUE (platform_code, status_code);

ALTER TABLE ONLY public.overview_activities
    ADD CONSTRAINT overview_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.overview_daily_stats_archive
    ADD CONSTRAINT overview_daily_stats_archive_pkey PRIMARY KEY (date);

ALTER TABLE ONLY public.overview_daily_stats
    ADD CONSTRAINT overview_daily_stats_date_key UNIQUE (date);

ALTER TABLE ONLY public.overview_daily_stats
    ADD CONSTRAINT overview_daily_stats_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_caliber_config
    ADD CONSTRAINT platform_caliber_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_caliber_config
    ADD CONSTRAINT platform_caliber_config_platform_code_metric_code_amount_ty_key UNIQUE (platform_code, metric_code, amount_type);

ALTER TABLE ONLY public.platform_capability_matrix
    ADD CONSTRAINT platform_capability_matrix_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_capability_matrix
    ADD CONSTRAINT platform_capability_matrix_platform_code_module_code_key UNIQUE (platform_code, module_code);

ALTER TABLE ONLY public.platform_members_summary
    ADD CONSTRAINT platform_members_summary_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_members_summary
    ADD CONSTRAINT platform_members_summary_tenant_id_platform_code_shop_id_bi_key UNIQUE (tenant_id, platform_code, shop_id, biz_date, member_tier);

ALTER TABLE ONLY public.platform_sla_config
    ADD CONSTRAINT platform_sla_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_sla_config
    ADD CONSTRAINT platform_sla_config_platform_code_sla_type_key UNIQUE (platform_code, sla_type);

ALTER TABLE ONLY public.platform_source_mapping
    ADD CONSTRAINT platform_source_mapping_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_source_mapping
    ADD CONSTRAINT platform_source_mapping_platform_code_raw_source_key UNIQUE (platform_code, raw_source);

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.publish_reversals
    ADD CONSTRAINT publish_reversals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.publish_runs
    ADD CONSTRAINT publish_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.raw_records
    ADD CONSTRAINT uk_raw_batch_row UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_default
    ADD CONSTRAINT raw_records_default_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records
    ADD CONSTRAINT raw_records_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_default
    ADD CONSTRAINT raw_records_default_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202608
    ADD CONSTRAINT raw_records_y202608_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202608
    ADD CONSTRAINT raw_records_y202608_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202609
    ADD CONSTRAINT raw_records_y202609_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202609
    ADD CONSTRAINT raw_records_y202609_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202610
    ADD CONSTRAINT raw_records_y202610_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202610
    ADD CONSTRAINT raw_records_y202610_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202611
    ADD CONSTRAINT raw_records_y202611_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202611
    ADD CONSTRAINT raw_records_y202611_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202612
    ADD CONSTRAINT raw_records_y202612_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202612
    ADD CONSTRAINT raw_records_y202612_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202701
    ADD CONSTRAINT raw_records_y202701_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202701
    ADD CONSTRAINT raw_records_y202701_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202702
    ADD CONSTRAINT raw_records_y202702_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202702
    ADD CONSTRAINT raw_records_y202702_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202703
    ADD CONSTRAINT raw_records_y202703_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202703
    ADD CONSTRAINT raw_records_y202703_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202704
    ADD CONSTRAINT raw_records_y202704_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202704
    ADD CONSTRAINT raw_records_y202704_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202705
    ADD CONSTRAINT raw_records_y202705_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202705
    ADD CONSTRAINT raw_records_y202705_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.raw_records_y202706
    ADD CONSTRAINT raw_records_y202706_biz_date_batch_id_sheet_name_row_no_key UNIQUE (biz_date, batch_id, sheet_name, row_no);

ALTER TABLE ONLY public.raw_records_y202706
    ADD CONSTRAINT raw_records_y202706_pkey PRIMARY KEY (biz_date, id);

ALTER TABLE ONLY public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.review_actions
    ADD CONSTRAINT review_actions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_module_grants
    ADD CONSTRAINT role_module_grants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_module_grants
    ADD CONSTRAINT role_module_grants_role_module_key UNIQUE (role_code, module_code);

ALTER TABLE ONLY public.role_modules
    ADD CONSTRAINT role_modules_pkey PRIMARY KEY (role_code, module_code);

ALTER TABLE ONLY public.role_platform_permissions
    ADD CONSTRAINT role_platform_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_platform_permissions
    ADD CONSTRAINT role_platform_permissions_role_id_platform_code_key UNIQUE (role_id, platform_code);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_room_id_evaluated_at_key UNIQUE (room_id, evaluated_at);

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);

ALTER TABLE ONLY public.script_library
    ADD CONSTRAINT script_library_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_date_anchor_id_key UNIQUE (date, anchor_id);

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_channel_metrics
    ADD CONSTRAINT session_channel_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_room_id_business_date_key UNIQUE (room_id, business_date);

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_room_id_business_date_key UNIQUE (room_id, business_date);

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public._deprecated_session_product_details
    ADD CONSTRAINT session_product_details_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public._deprecated_session_product_details
    ADD CONSTRAINT session_product_details_room_id_business_date_product_id_key UNIQUE (room_id, business_date, product_id);

ALTER TABLE ONLY public._deprecated_session_product_skus
    ADD CONSTRAINT session_product_skus_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public._deprecated_session_product_skus
    ADD CONSTRAINT session_product_skus_product_id_sku_name_key UNIQUE (product_id, sku_name);

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_room_id_business_date_video_nam_key UNIQUE (room_id, business_date, video_name);

ALTER TABLE ONLY public.session_staff_assignments
    ADD CONSTRAINT session_staff_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_staff_assignments
    ADD CONSTRAINT session_staff_assignments_session_id_role_code_staff_name_key UNIQUE (session_id, role_code, staff_name);

ALTER TABLE ONLY public.signal_source
    ADD CONSTRAINT signal_source_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.staff_day_status
    ADD CONSTRAINT staff_day_status_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.staff_day_status
    ADD CONSTRAINT staff_day_status_staff_name_biz_date_key UNIQUE (staff_name, biz_date);

ALTER TABLE ONLY public.staff_role_dict
    ADD CONSTRAINT staff_role_dict_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.stg_order_import
    ADD CONSTRAINT stg_order_import_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_custom_field_definition
    ADD CONSTRAINT sys_custom_field_definition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_custom_field_value
    ADD CONSTRAINT sys_custom_field_value_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_role
    ADD CONSTRAINT sys_role_code_key UNIQUE (code);

ALTER TABLE ONLY public.sys_role_permission
    ADD CONSTRAINT sys_role_permission_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_role
    ADD CONSTRAINT sys_role_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_user_role
    ADD CONSTRAINT sys_user_role_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_config_key_key UNIQUE (config_key);

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_jobs
    ADD CONSTRAINT system_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.system_platform_configs
    ADD CONSTRAINT system_platform_configs_pkey PRIMARY KEY (platform_code);

ALTER TABLE ONLY public.taobao_order_hierarchy
    ADD CONSTRAINT taobao_order_hierarchy_parent_order_id_sub_order_id_key UNIQUE (parent_order_id, sub_order_id);

ALTER TABLE ONLY public.taobao_order_hierarchy
    ADD CONSTRAINT taobao_order_hierarchy_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.target_templates
    ADD CONSTRAINT target_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.upload_column_mappings
    ADD CONSTRAINT upload_column_mappings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.upload_column_mappings
    ADD CONSTRAINT upload_column_mappings_platform_code_file_header_fingerprin_key UNIQUE (platform_code, file_header_fingerprint);

ALTER TABLE ONLY public.ad_plan_receipts
    ADD CONSTRAINT uq_ad_plan_receipts_plan_date UNIQUE (plan_id, biz_date);

ALTER TABLE ONLY public.agg_trade_day_platform_channel
    ADD CONSTRAINT uq_agg_platform_channel UNIQUE (biz_date, platform_code, channel_name, shop_id);

ALTER TABLE ONLY public.agg_shop_daily
    ADD CONSTRAINT uq_agg_shop_daily_key UNIQUE (biz_date, platform_code, shop_id);

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT uq_channel_listing_sku UNIQUE (shop_id, platform_code, channel_sku_id);

ALTER TABLE ONLY public.fact_content_daily
    ADD CONSTRAINT uq_content_daily_biz_key UNIQUE (biz_date, platform_code, shop_id, content_id);

ALTER TABLE ONLY public.sys_custom_field_value
    ADD CONSTRAINT uq_custom_field_val UNIQUE (field_id, entity_type, entity_id);

ALTER TABLE ONLY public.land_raw_dedup
    ADD CONSTRAINT uq_raw_dedup_hash UNIQUE (source_platform, payload_hash);

ALTER TABLE ONLY public.compliance_rule_snapshot
    ADD CONSTRAINT uq_rule_snapshot UNIQUE (platform_code, external_id, content_hash);

ALTER TABLE ONLY public.session_channel_metrics
    ADD CONSTRAINT uq_session_channel_session_channel UNIQUE (session_id, channel);

ALTER TABLE ONLY public.signal_source
    ADD CONSTRAINT uq_signal_category UNIQUE (code, category_code);

ALTER TABLE ONLY public.sys_role_permission
    ADD CONSTRAINT uq_sys_role_perm UNIQUE (role_code, resource, action);

ALTER TABLE ONLY public.sys_user_role
    ADD CONSTRAINT uq_sys_user_role UNIQUE (user_id, role_code, tenant_id);

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT uq_voucher_line UNIQUE (voucher_id, line_no);

ALTER TABLE ONLY public.user_module_overrides
    ADD CONSTRAINT user_module_overrides_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_module_overrides
    ADD CONSTRAINT user_module_overrides_user_id_module_code_key UNIQUE (user_id, module_code);

ALTER TABLE ONLY public.user_platform_permissions
    ADD CONSTRAINT user_platform_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_platform_permissions
    ADD CONSTRAINT user_platform_permissions_user_id_platform_code_key UNIQUE (user_id, platform_code);

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE ONLY public.validation_runs
    ADD CONSTRAINT validation_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.video_metrics
    ADD CONSTRAINT video_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.video_metrics
    ADD CONSTRAINT video_metrics_platform_code_video_id_biz_date_key UNIQUE (platform_code, video_id, biz_date);

ALTER TABLE ONLY public.xhs_note
    ADD CONSTRAINT xhs_note_biz_date_note_id_key UNIQUE (biz_date, note_id);

ALTER TABLE ONLY public.xhs_note
    ADD CONSTRAINT xhs_note_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_ad_tool_code_fkey FOREIGN KEY (ad_tool_code) REFERENCES public.ad_tool_dict(code) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_plan_receipts
    ADD CONSTRAINT ad_plan_receipts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.ad_plan(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ad_tool_dict
    ADD CONSTRAINT ad_tool_dict_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.agg_shop_daily
    ADD CONSTRAINT agg_shop_daily_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.agg_shop_daily
    ADD CONSTRAINT agg_shop_daily_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id);

ALTER TABLE ONLY public.agg_trade_day_platform_channel
    ADD CONSTRAINT agg_trade_day_platform_channel_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.agg_trade_day_platform_channel
    ADD CONSTRAINT agg_trade_day_platform_channel_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agg_traffic_day_live
    ADD CONSTRAINT agg_traffic_day_live_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.agg_traffic_day_live
    ADD CONSTRAINT agg_traffic_day_live_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.agg_traffic_day_live
    ADD CONSTRAINT agg_traffic_day_live_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_tool_log_id_fkey FOREIGN KEY (tool_log_id) REFERENCES public.ai_tool_logs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_analysis_runs
    ADD CONSTRAINT ai_analysis_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_analysis_steps
    ADD CONSTRAINT ai_analysis_steps_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_analysis_runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_context_bindings
    ADD CONSTRAINT ai_context_bindings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_eval_run
    ADD CONSTRAINT ai_eval_run_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.ai_eval_case(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_v2_claim
    ADD CONSTRAINT ai_v2_claim_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_evidence
    ADD CONSTRAINT ai_v2_evidence_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_llm_call
    ADD CONSTRAINT ai_v2_llm_call_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_run
    ADD CONSTRAINT ai_v2_run_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_v2_step
    ADD CONSTRAINT ai_v2_step_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_profiles
    ADD CONSTRAINT anchor_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.anchors(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_training_records
    ADD CONSTRAINT anchor_training_records_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.anchor_training_plans(id);

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.dim_category(code) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_dispatched_by_fkey FOREIGN KEY (dispatched_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_source_recommendation_id_fkey FOREIGN KEY (source_recommendation_id) REFERENCES public.fact_selection_recommendation(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan_template
    ADD CONSTRAINT campaign_plan_template_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.dim_category(code) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan_template
    ADD CONSTRAINT campaign_plan_template_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.campaign_plan_template(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan_template
    ADD CONSTRAINT campaign_plan_template_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.campaign_plan
    ADD CONSTRAINT campaign_plan_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clean_rule_sets
    ADD CONSTRAINT clean_rule_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.clean_rule_sets
    ADD CONSTRAINT clean_rule_sets_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.cleaning_runs
    ADD CONSTRAINT cleaning_runs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.competitor_price_data
    ADD CONSTRAINT competitor_price_data_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.competitor_brands(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_activity_reminder
    ADD CONSTRAINT compliance_activity_reminder_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.compliance_events
    ADD CONSTRAINT compliance_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_risk_assessment
    ADD CONSTRAINT compliance_risk_assessment_change_id_fkey FOREIGN KEY (change_id) REFERENCES public.compliance_rule_change(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_rule_change
    ADD CONSTRAINT compliance_rule_change_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_rule_change
    ADD CONSTRAINT compliance_rule_change_read_by_fkey FOREIGN KEY (read_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.compliance_rule_change
    ADD CONSTRAINT compliance_rule_change_snapshot_id_fkey FOREIGN KEY (snapshot_id) REFERENCES public.compliance_rule_snapshot(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_rule_snapshot
    ADD CONSTRAINT compliance_rule_snapshot_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_parent_asset_id_fkey FOREIGN KEY (parent_asset_id) REFERENCES public.content_assets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.content_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.content_tasks(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.content_schedules(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_projects
    ADD CONSTRAINT content_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_projects
    ADD CONSTRAINT content_projects_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_projects
    ADD CONSTRAINT content_projects_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.content_assets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.content_projects(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_schedules
    ADD CONSTRAINT content_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_tasks
    ADD CONSTRAINT content_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.content_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.content_tasks
    ADD CONSTRAINT content_tasks_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.content_providers(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_assignee_fkey FOREIGN KEY (assignee) REFERENCES public.users(id);

ALTER TABLE ONLY public.data_quality_issues
    ADD CONSTRAINT data_quality_issues_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.data_uploads
    ADD CONSTRAINT data_uploads_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.dim_category
    ADD CONSTRAINT dim_category_parent_code_fkey FOREIGN KEY (parent_code) REFERENCES public.dim_category(code) ON DELETE SET NULL;

ALTER TABLE ONLY public.dim_cs_agent
    ADD CONSTRAINT dim_cs_agent_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_cs_agent
    ADD CONSTRAINT dim_cs_agent_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_cs_agent
    ADD CONSTRAINT dim_cs_agent_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dim_dept
    ADD CONSTRAINT dim_dept_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.dim_dept(id);

ALTER TABLE ONLY public.dim_kol
    ADD CONSTRAINT dim_kol_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_product
    ADD CONSTRAINT dim_product_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.dim_category(code) ON DELETE SET NULL;

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT dim_product_channel_listing_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT dim_product_channel_listing_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT dim_product_channel_listing_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT dim_product_channel_listing_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_shop
    ADD CONSTRAINT dim_shop_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.dim_brand(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dim_shop
    ADD CONSTRAINT dim_shop_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.dim_sku_mapping
    ADD CONSTRAINT dim_sku_mapping_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_sku_mapping
    ADD CONSTRAINT dim_sku_mapping_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_sku_mapping
    ADD CONSTRAINT dim_sku_mapping_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_team
    ADD CONSTRAINT dim_team_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.dim_dept(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.douyin_channel_daily_metrics
    ADD CONSTRAINT douyin_channel_daily_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.dq_quarantine
    ADD CONSTRAINT dq_quarantine_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT entity_aliases_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT entity_aliases_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.fact_ad_spend_daily
    ADD CONSTRAINT fact_ad_spend_daily_ad_tool_code_fkey FOREIGN KEY (ad_tool_code) REFERENCES public.ad_tool_dict(code) ON DELETE RESTRICT;

ALTER TABLE ONLY public.fact_ad_spend_daily
    ADD CONSTRAINT fact_ad_spend_daily_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_ad_spend_daily
    ADD CONSTRAINT fact_ad_spend_daily_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_ad_spend_daily
    ADD CONSTRAINT fact_ad_spend_daily_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_after_sale_tickets
    ADD CONSTRAINT fact_after_sale_tickets_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_after_sale_tickets
    ADD CONSTRAINT fact_after_sale_tickets_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_after_sale_tickets
    ADD CONSTRAINT fact_after_sale_tickets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_after_sale_tickets
    ADD CONSTRAINT fact_after_sale_tickets_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_content_daily
    ADD CONSTRAINT fact_content_daily_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.fact_content_daily
    ADD CONSTRAINT fact_content_daily_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id);

ALTER TABLE ONLY public.fact_cs_session
    ADD CONSTRAINT fact_cs_session_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.dim_cs_agent(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_cs_session
    ADD CONSTRAINT fact_cs_session_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_cs_session
    ADD CONSTRAINT fact_cs_session_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_fulfillment_waybill
    ADD CONSTRAINT fact_fulfillment_waybill_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_fulfillment_waybill
    ADD CONSTRAINT fact_fulfillment_waybill_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_fulfillment_waybill
    ADD CONSTRAINT fact_fulfillment_waybill_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_account_code_fkey FOREIGN KEY (account_code) REFERENCES public.dim_accounting_subject(account_code);

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_gl_entry
    ADD CONSTRAINT fact_gl_entry_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.fact_gl_voucher(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_gl_voucher
    ADD CONSTRAINT fact_gl_voucher_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_gl_voucher
    ADD CONSTRAINT fact_gl_voucher_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_gl_voucher
    ADD CONSTRAINT fact_gl_voucher_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_gl_voucher
    ADD CONSTRAINT fact_gl_voucher_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_inventory_ledger
    ADD CONSTRAINT fact_inventory_ledger_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_inventory_ledger
    ADD CONSTRAINT fact_inventory_ledger_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_channel_listing_id_fkey FOREIGN KEY (channel_listing_id) REFERENCES public.dim_product_channel_listing(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_inventory_reservation
    ADD CONSTRAINT fact_inventory_reservation_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_inventory_stock
    ADD CONSTRAINT fact_inventory_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_inventory_stock
    ADD CONSTRAINT fact_inventory_stock_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_kol_cooperation
    ADD CONSTRAINT fact_kol_cooperation_kol_id_fkey FOREIGN KEY (kol_id) REFERENCES public.dim_kol(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_kol_cooperation
    ADD CONSTRAINT fact_kol_cooperation_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_kol_cooperation
    ADD CONSTRAINT fact_kol_cooperation_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_kol_cooperation
    ADD CONSTRAINT fact_kol_cooperation_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_order_event_stream
    ADD CONSTRAINT fact_order_event_stream_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_order_event_stream
    ADD CONSTRAINT fact_order_event_stream_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_order_event_stream
    ADD CONSTRAINT fact_order_event_stream_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_order_rma_item
    ADD CONSTRAINT fact_order_rma_item_internal_sku_id_fkey FOREIGN KEY (internal_sku_id) REFERENCES public.dim_product(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_order_rma_item
    ADD CONSTRAINT fact_order_rma_item_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_order_rma_item
    ADD CONSTRAINT fact_order_rma_item_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_order_rma_item
    ADD CONSTRAINT fact_order_rma_item_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_search_keyword_daily
    ADD CONSTRAINT fact_search_keyword_daily_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_search_keyword_daily
    ADD CONSTRAINT fact_search_keyword_daily_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_search_keyword_daily
    ADD CONSTRAINT fact_search_keyword_daily_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_search_keyword_daily
    ADD CONSTRAINT fact_search_keyword_daily_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_selection_item
    ADD CONSTRAINT fact_selection_item_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_selection_item
    ADD CONSTRAINT fact_selection_item_recommendation_id_fkey FOREIGN KEY (recommendation_id) REFERENCES public.fact_selection_recommendation(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.dim_category(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fact_selection_recommendation
    ADD CONSTRAINT fact_selection_recommendation_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_settlement_cycles
    ADD CONSTRAINT fact_settlement_cycles_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_settlement_cycles
    ADD CONSTRAINT fact_settlement_cycles_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.fact_settlement_cycles
    ADD CONSTRAINT fact_settlement_cycles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.field_mapping_rules
    ADD CONSTRAINT field_mapping_rules_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.dim_shop(id);

ALTER TABLE ONLY public.import_files
    ADD CONSTRAINT import_files_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_clean_rule_set_id_fkey FOREIGN KEY (clean_rule_set_id) REFERENCES public.clean_rule_sets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kuaishou_fans_ops
    ADD CONSTRAINT kuaishou_fans_ops_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.land_raw_dedup
    ADD CONSTRAINT land_raw_dedup_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.land_raw_dedup
    ADD CONSTRAINT land_raw_dedup_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.live_registrations
    ADD CONSTRAINT live_registrations_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.live_registrations
    ADD CONSTRAINT live_registrations_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.live_registrations
    ADD CONSTRAINT live_registrations_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.live_registrations
    ADD CONSTRAINT live_registrations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.live_rooms
    ADD CONSTRAINT live_rooms_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.live_rooms
    ADD CONSTRAINT live_rooms_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id);

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id);

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.operators(id);

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id);

ALTER TABLE ONLY public.multi_room_status
    ADD CONSTRAINT multi_room_status_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_status_config
    ADD CONSTRAINT order_status_config_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_caliber_config
    ADD CONSTRAINT platform_caliber_config_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_capability_matrix
    ADD CONSTRAINT platform_capability_matrix_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_members_summary
    ADD CONSTRAINT platform_members_summary_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_members_summary
    ADD CONSTRAINT platform_members_summary_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_members_summary
    ADD CONSTRAINT platform_members_summary_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_sla_config
    ADD CONSTRAINT platform_sla_config_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_source_mapping
    ADD CONSTRAINT platform_source_mapping_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_source_mapping
    ADD CONSTRAINT platform_source_mapping_source_code_fkey FOREIGN KEY (source_code) REFERENCES public.dim_traffic_source(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.publish_reversals
    ADD CONSTRAINT publish_reversals_publish_run_id_fkey FOREIGN KEY (publish_run_id) REFERENCES public.publish_runs(id);

ALTER TABLE ONLY public.publish_reversals
    ADD CONSTRAINT publish_reversals_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.publish_runs
    ADD CONSTRAINT publish_runs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.publish_runs
    ADD CONSTRAINT publish_runs_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id);

ALTER TABLE ONLY public.publish_runs
    ADD CONSTRAINT publish_runs_validation_run_id_fkey FOREIGN KEY (validation_run_id) REFERENCES public.validation_runs(id);

ALTER TABLE ONLY public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reconciliation_runs
    ADD CONSTRAINT reconciliation_runs_publish_run_id_fkey FOREIGN KEY (publish_run_id) REFERENCES public.publish_runs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.review_actions
    ADD CONSTRAINT review_actions_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.data_quality_issues(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.review_actions
    ADD CONSTRAINT review_actions_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.role_module_grants
    ADD CONSTRAINT role_module_grants_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_modules
    ADD CONSTRAINT role_modules_module_code_fkey FOREIGN KEY (module_code) REFERENCES public.system_modules(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_modules
    ADD CONSTRAINT role_modules_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_platform_permissions
    ADD CONSTRAINT role_platform_permissions_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.role_platform_permissions
    ADD CONSTRAINT role_platform_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id);

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id);

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.session_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id);

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.promotions(id);

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id);

ALTER TABLE ONLY public._deprecated_session_product_details
    ADD CONSTRAINT session_product_details_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public._deprecated_session_product_details
    ADD CONSTRAINT session_product_details_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public._deprecated_session_product_details
    ADD CONSTRAINT session_product_details_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public._deprecated_session_product_skus
    ADD CONSTRAINT session_product_skus_product_id_fkey FOREIGN KEY (product_id) REFERENCES public._deprecated_session_product_details(id) ON DELETE CASCADE;

ALTER TABLE ONLY public._deprecated_session_product_skus
    ADD CONSTRAINT session_product_skus_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.session_staff_assignments
    ADD CONSTRAINT session_staff_assignments_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.staff_role_dict(code) ON DELETE RESTRICT;

ALTER TABLE ONLY public.session_staff_assignments
    ADD CONSTRAINT session_staff_assignments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.signal_source
    ADD CONSTRAINT signal_source_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.dim_category(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.stg_order_import
    ADD CONSTRAINT stg_order_import_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_custom_field_definition
    ADD CONSTRAINT sys_custom_field_definition_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_custom_field_definition
    ADD CONSTRAINT sys_custom_field_definition_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_custom_field_value
    ADD CONSTRAINT sys_custom_field_value_field_id_fkey FOREIGN KEY (field_id) REFERENCES public.sys_custom_field_definition(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_custom_field_value
    ADD CONSTRAINT sys_custom_field_value_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_role_permission
    ADD CONSTRAINT sys_role_permission_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.sys_role(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_user_role
    ADD CONSTRAINT sys_user_role_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.sys_role(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.sys_user_role
    ADD CONSTRAINT sys_user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.taobao_order_hierarchy
    ADD CONSTRAINT taobao_order_hierarchy_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.upload_column_mappings
    ADD CONSTRAINT upload_column_mappings_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_module_overrides
    ADD CONSTRAINT user_module_overrides_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.user_module_overrides
    ADD CONSTRAINT user_module_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_platform_permissions
    ADD CONSTRAINT user_platform_permissions_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_platform_permissions
    ADD CONSTRAINT user_platform_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_dept_id_fkey FOREIGN KEY (dept_id) REFERENCES public.dim_dept(id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.dim_team(id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.validation_runs
    ADD CONSTRAINT validation_runs_cleaning_run_id_fkey FOREIGN KEY (cleaning_run_id) REFERENCES public.cleaning_runs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.video_metrics
    ADD CONSTRAINT video_metrics_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.video_metrics
    ADD CONSTRAINT video_metrics_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.video_metrics
    ADD CONSTRAINT video_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.xhs_note
    ADD CONSTRAINT xhs_note_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

-- ===== matview (1) =====
CREATE MATERIALIZED VIEW public.agg_platform_monthly AS
 SELECT (row_number() OVER (ORDER BY (to_char((biz_date)::timestamp with time zone, 'YYYY-MM'::text)), platform_code))::integer AS id,
    (to_char((biz_date)::timestamp with time zone, 'YYYY-MM'::text))::character varying(7) AS year_month,
    platform_code,
    (COALESCE(sum(total_gmv), (0)::numeric))::numeric(14,2) AS total_gmv,
    (COALESCE(sum(total_refund_amount), (0)::numeric))::numeric(14,2) AS total_refund_amount,
    (COALESCE(sum(net_sales), (0)::numeric))::numeric(14,2) AS net_sales,
    (COALESCE(sum(total_ad_spend), (0)::numeric))::numeric(14,2) AS total_ad_spend,
        CASE
            WHEN (COALESCE(sum(total_ad_spend), (0)::numeric) > (0)::numeric) THEN round((sum(total_gmv) / sum(total_ad_spend)), 2)
            ELSE (0)::numeric
        END AS overall_roi,
    COALESCE(max(updated_at), now()) AS updated_at
   FROM public.agg_shop_daily
  GROUP BY (to_char((biz_date)::timestamp with time zone, 'YYYY-MM'::text)), platform_code
  WITH NO DATA;

-- ===== view (10) =====
CREATE VIEW public._deprecated_anchor_rankings WITH (security_invoker='true') AS
 SELECT id,
    anchor_id,
    overall,
    expression,
    interaction,
    conversion,
    professionalism,
    evaluated_at AS rank_date,
    created_at
   FROM public.anchor_capabilities;

CREATE VIEW public._deprecated_v_schedule_by_role AS
 SELECT s.date AS biz_date,
    sa.role_code,
    d.name AS role_name,
    d.sort_order,
    sa.staff_name,
    (count(DISTINCT s.id))::integer AS sessions,
    min(s.start_time) AS first_start,
    max(s.end_time) AS last_end,
    COALESCE(ds.status, 'work'::character varying) AS day_status
   FROM (((public.session_staff_assignments sa
     JOIN public.live_sessions s ON ((s.id = sa.session_id)))
     JOIN public.staff_role_dict d ON (((d.code)::text = (sa.role_code)::text)))
     LEFT JOIN public.staff_day_status ds ON ((((ds.staff_name)::text = (sa.staff_name)::text) AND (ds.biz_date = s.date))))
  WHERE (s.date IS NOT NULL)
  GROUP BY s.date, sa.role_code, d.name, d.sort_order, sa.staff_name, COALESCE(ds.status, 'work'::character varying);

CREATE VIEW public.fact_ad_daily WITH (security_invoker='true') AS
 SELECT f.id,
    f.biz_date,
    f.platform_code,
    f.shop_id,
    f.id AS plan_id,
    (COALESCE(d.name, f.ad_tool_code))::character varying(128) AS plan_name,
    f.ad_spend,
    f.attributed_gross_gmv AS ad_gmv,
        CASE
            WHEN (f.ad_spend > (0)::numeric) THEN round((f.attributed_gross_gmv / f.ad_spend), 2)
            ELSE (0)::numeric
        END AS ad_roi,
    f.impressions,
    (f.clicks)::integer AS clicks,
    f.attributed_orders AS conversions,
    'fact_ad_spend_daily'::character varying(32) AS source,
    f.created_at,
    f.attribution_window_hours,
    'last_click'::character varying(32) AS attribution_type,
    f.direct_gmv,
    f.indirect_gmv,
    f.net_gmv,
    (COALESCE(d.name, f.ad_tool_code))::character varying(64) AS ad_tool
   FROM (public.fact_ad_spend_daily f
     LEFT JOIN public.ad_tool_dict d ON (((d.code)::text = (f.ad_tool_code)::text)));

CREATE VIEW public.metric_catalog AS
 SELECT id,
    metric_code AS code,
    metric_code,
    name AS label,
    name,
    unit,
    category,
    formula AS expr,
    formula,
    description,
    fact_table,
    is_additive,
    caliber,
    version,
    status,
    supported_platforms,
    supported_platforms AS platform_scope,
    synonyms,
    owner,
    extra,
    created_at,
    updated_at
   FROM public.metric_definition;

CREATE VIEW public.session_product_details AS
 SELECT id,
    session_id,
    room_id,
    business_date,
    product_order,
    product_name,
    product_id,
    product_image,
    payment_amount,
    sold_count,
    buyer_count,
    order_count,
    pre_sale_orders,
    pre_sale_amount,
    exposure_users,
    click_users,
    exposure_click_rate,
    click_deal_rate,
    refund_users,
    refund_amount,
    refund_orders,
    upload_id,
    created_at,
    updated_at
   FROM public.session_plan_products
  WHERE (plan_id IS NULL);

CREATE VIEW public.session_product_skus AS
 SELECT ((elem.value ->> 'id'::text))::bigint AS id,
    p.id AS product_id,
    (elem.value ->> 'sku_name'::text) AS sku_name,
    (elem.value ->> 'sku_image'::text) AS sku_image,
    ((elem.value ->> 'payment_amount'::text))::numeric(14,2) AS payment_amount,
    ((elem.value ->> 'sold_count'::text))::integer AS sold_count,
    ((elem.value ->> 'buyer_count'::text))::integer AS buyer_count,
    ((elem.value ->> 'order_count'::text))::integer AS order_count,
    ((elem.value ->> 'upload_id'::text))::integer AS upload_id
   FROM public.session_plan_products p,
    LATERAL jsonb_array_elements(COALESCE(p.sku_snapshot_jsonb, '[]'::jsonb)) elem(value)
  WHERE (p.plan_id IS NULL);

CREATE VIEW public.v_ad_plan_comparison AS
 SELECT p.id AS plan_id,
    p.plan_no,
    p.tenant_id,
    p.session_id,
    p.shop_id,
    ds.shop_name,
    p.platform_code,
    sp.platform_name,
    p.ad_tool_code,
    atd.name AS ad_tool_name,
    p.plan_name,
    p.plan_date,
    p.planned_budget,
    p.target_roi,
    p.status,
    (COALESCE(r.actual_spend, a.ad_spend, (0)::numeric))::numeric(14,2) AS actual_spend,
    (COALESCE(r.actual_gmv, a.attributed_gross_gmv, (0)::numeric))::numeric(14,2) AS actual_gross_gmv,
    (COALESCE(r.net_gmv, a.net_gmv, (0)::numeric))::numeric(14,2) AS net_gmv,
        CASE
            WHEN (COALESCE(r.actual_spend, a.ad_spend, (0)::numeric) > (0)::numeric) THEN round((COALESCE(r.actual_gmv, a.attributed_gross_gmv, (0)::numeric) / COALESCE(r.actual_spend, a.ad_spend)), 2)
            ELSE (0)::numeric
        END AS actual_roi,
        CASE
            WHEN (COALESCE(r.actual_spend, a.ad_spend, (0)::numeric) > (0)::numeric) THEN round((COALESCE(r.net_gmv, a.net_gmv, (0)::numeric) / COALESCE(r.actual_spend, a.ad_spend)), 2)
            ELSE (0)::numeric
        END AS net_roi,
        CASE
            WHEN (p.planned_budget > (0)::numeric) THEN round(((COALESCE(r.actual_spend, a.ad_spend, (0)::numeric) / p.planned_budget) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS budget_utilization_pct,
    p.created_at,
    p.updated_at
   FROM (((((public.ad_plan p
     JOIN public.dim_shop ds ON ((ds.id = p.shop_id)))
     LEFT JOIN public.system_platform_configs sp ON (((sp.platform_code)::text = (p.platform_code)::text)))
     LEFT JOIN public.ad_tool_dict atd ON (((atd.code)::text = (p.ad_tool_code)::text)))
     LEFT JOIN public.ad_plan_receipts r ON ((r.plan_id = p.id)))
     LEFT JOIN LATERAL ( SELECT sum(fact_ad_spend_daily.ad_spend) AS ad_spend,
            sum(fact_ad_spend_daily.attributed_gross_gmv) AS attributed_gross_gmv,
            sum(fact_ad_spend_daily.net_gmv) AS net_gmv
           FROM public.fact_ad_spend_daily
          WHERE ((fact_ad_spend_daily.shop_id = p.shop_id) AND (fact_ad_spend_daily.biz_date = p.plan_date) AND ((fact_ad_spend_daily.ad_tool_code)::text = (p.ad_tool_code)::text))) a ON (true));

CREATE VIEW public.v_fact_trade_default AS
 SELECT f.id,
    f.biz_date,
    f.platform_code,
    f.shop_id,
    f.channel_name,
    f.gmv,
    f.pay_amount,
    f.paid_order_count,
    f.paid_buyer_count,
    f.refund_amount,
    f.refund_count,
    f.source,
    f.upload_id,
    f.extra,
    f.created_at,
    f.amount_type,
    f.attribution_window_hours,
    f.source_code,
    f.content_id,
    f.is_demo
   FROM (public.fact_trade_daily f
     JOIN public.platform_caliber_config pcc ON ((((pcc.platform_code)::text = (f.platform_code)::text) AND ((pcc.metric_code)::text = 'gmv'::text) AND (pcc.is_default = true))))
  WHERE ((f.amount_type)::text = (pcc.amount_type)::text);

CREATE VIEW public.v_session_cost AS
 WITH sess AS (
         SELECT s.id AS session_id,
            s.room_id,
            r.shop_id,
            r.platform_code,
            s.date AS biz_date,
            COALESCE(s.gmv, (0)::numeric) AS gmv,
            COALESCE(s.return_amount, (0)::numeric) AS return_amount,
            COALESCE(s.ad_cost, (0)::numeric) AS session_ad_cost
           FROM (public.live_sessions s
             JOIN public.live_rooms r ON ((r.id = s.room_id)))
        ), fee AS (
         SELECT c_1.shop_id,
            c_1.order_date AS biz_date,
            sum(c_1.platform_fee) AS platform_fee,
            sum(c_1.ad_spend) AS settle_ad_spend,
            sum(c_1.reserve_held) AS reserve_held
           FROM public.fact_settlement_cycles c_1
          GROUP BY c_1.shop_id, c_1.order_date
        ), ad AS (
         SELECT a.shop_id,
            a.biz_date,
            sum(a.ad_spend) AS ad_spend
           FROM public.fact_ad_spend_daily a
          GROUP BY a.shop_id, a.biz_date
        ), ko AS (
         SELECT k.shop_id,
            k.publish_date AS biz_date,
            sum(k.pit_fee) AS pit_fee,
            sum(k.commission_amount) AS commission_amount
           FROM public.fact_kol_cooperation k
          GROUP BY k.shop_id, k.publish_date
        ), cnt AS (
         SELECT s.room_id,
            s.date AS biz_date,
            (count(*))::numeric AS n
           FROM public.live_sessions s
          GROUP BY s.room_id, s.date
        )
 SELECT sess.session_id,
    sess.room_id,
    sess.shop_id,
    sess.platform_code,
    sess.biz_date,
    sess.gmv,
    sess.return_amount,
    (sess.gmv - sess.return_amount) AS net_revenue,
    round((COALESCE(fee.platform_fee, (0)::numeric) / GREATEST(c.n, (1)::numeric)), 2) AS platform_fee_alloc,
    round((COALESCE(ad.ad_spend, sess.session_ad_cost) / GREATEST(c.n, (1)::numeric)), 2) AS ad_spend_alloc,
    round((COALESCE(ko.pit_fee, (0)::numeric) / GREATEST(c.n, (1)::numeric)), 2) AS kol_pit_fee_alloc,
    round((COALESCE(ko.commission_amount, (0)::numeric) / GREATEST(c.n, (1)::numeric)), 2) AS kol_commission_alloc,
    round(((((COALESCE(fee.platform_fee, (0)::numeric) / GREATEST(c.n, (1)::numeric)) + (COALESCE(ad.ad_spend, sess.session_ad_cost) / GREATEST(c.n, (1)::numeric))) + (COALESCE(ko.pit_fee, (0)::numeric) / GREATEST(c.n, (1)::numeric))) + (COALESCE(ko.commission_amount, (0)::numeric) / GREATEST(c.n, (1)::numeric))), 2) AS total_cost_alloc,
    round(((sess.gmv - sess.return_amount) - ((((COALESCE(fee.platform_fee, (0)::numeric) / GREATEST(c.n, (1)::numeric)) + (COALESCE(ad.ad_spend, sess.session_ad_cost) / GREATEST(c.n, (1)::numeric))) + (COALESCE(ko.pit_fee, (0)::numeric) / GREATEST(c.n, (1)::numeric))) + (COALESCE(ko.commission_amount, (0)::numeric) / GREATEST(c.n, (1)::numeric)))), 2) AS net_profit_alloc
   FROM ((((sess
     LEFT JOIN fee ON (((fee.shop_id = sess.shop_id) AND (fee.biz_date = sess.biz_date))))
     LEFT JOIN ad ON (((ad.shop_id = sess.shop_id) AND (ad.biz_date = sess.biz_date))))
     LEFT JOIN ko ON (((ko.shop_id = sess.shop_id) AND (ko.biz_date = sess.biz_date))))
     LEFT JOIN cnt c ON (((c.room_id = sess.room_id) AND (c.biz_date = sess.biz_date))));

CREATE VIEW public.v_staff_attendance AS
 WITH dedup_expected AS (
         SELECT DISTINCT sa.staff_name,
            s.date AS biz_date,
            sa.role_code,
            s.id AS session_id,
            s.room_id,
            s.status AS session_status
           FROM (public.session_staff_assignments sa
             JOIN public.live_sessions s ON ((s.id = sa.session_id)))
          WHERE (s.date IS NOT NULL)
        ), actual AS (
         SELECT a.name AS staff_name,
            lr.biz_date,
            lr.room_id,
            (count(*))::integer AS actual_rows
           FROM (public.live_registrations lr
             JOIN public.anchors a ON ((a.id = lr.anchor_id)))
          GROUP BY a.name, lr.biz_date, lr.room_id
        ), day_status AS (
         SELECT staff_day_status.staff_name,
            staff_day_status.biz_date,
            staff_day_status.status
           FROM public.staff_day_status
        )
 SELECT de.staff_name,
    de.biz_date,
    de.role_code,
    de.session_id,
    de.session_status,
    1 AS expected_sessions,
    COALESCE(ac.actual_rows, 0) AS actual_sessions,
    COALESCE(ds.status, 'work'::character varying) AS day_status,
        CASE
            WHEN ((COALESCE(ds.status, 'work'::character varying))::text = ANY ((ARRAY['rest'::character varying, 'leave'::character varying, 'sick'::character varying])::text[])) THEN false
            WHEN ((de.session_status)::text = 'cancelled'::text) THEN true
            WHEN (((de.session_status)::text = 'scheduled'::text) AND (de.biz_date < CURRENT_DATE)) THEN true
            WHEN (((de.role_code)::text = 'anchor'::text) AND ((de.session_status)::text = ANY ((ARRAY['completed'::character varying, 'live'::character varying])::text[])) AND (COALESCE(ac.actual_rows, 0) = 0)) THEN true
            ELSE false
        END AS is_absent,
        CASE
            WHEN ((COALESCE(ds.status, 'work'::character varying))::text = ANY ((ARRAY['rest'::character varying, 'leave'::character varying, 'sick'::character varying])::text[])) THEN (('当日为'::text || (COALESCE(ds.status, ''::character varying))::text) || '，不计缺勤'::text)
            WHEN ((de.session_status)::text = 'cancelled'::text) THEN '场次已取消'::text
            WHEN (((de.session_status)::text = 'scheduled'::text) AND (de.biz_date < CURRENT_DATE)) THEN '场次过期未开播'::text
            WHEN (((de.role_code)::text = 'anchor'::text) AND ((de.session_status)::text = ANY ((ARRAY['completed'::character varying, 'live'::character varying])::text[])) AND (COALESCE(ac.actual_rows, 0) = 0)) THEN '场次已开播但无直播登记'::text
            ELSE ''::text
        END AS absence_note
   FROM ((dedup_expected de
     LEFT JOIN actual ac ON ((((ac.staff_name)::text = (de.staff_name)::text) AND (ac.biz_date = de.biz_date) AND (ac.room_id = de.room_id))))
     LEFT JOIN day_status ds ON ((((ds.staff_name)::text = (de.staff_name)::text) AND (ds.biz_date = de.biz_date))));

-- ===== index (221) =====
CREATE INDEX idx_canonical_order_items_store_date ON ONLY public.canonical_order_items USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_default_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_default USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202608_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202608 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202609_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202609 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202610_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202610 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202611_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202611 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202612_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202612 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202701_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202701 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202702_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202702 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202703_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202703 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202704_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202704 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202705_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202705 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX canonical_order_items_y202706_store_id_biz_date_internal_sk_idx ON public.canonical_order_items_y202706 USING btree (store_id, biz_date, internal_sku_id);

CREATE INDEX idx_trade_daily_ps ON ONLY public.fact_trade_daily USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_default_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_default USING btree (biz_date, platform_code, shop_id);

CREATE INDEX idx_trade_daily_amount_type ON ONLY public.fact_trade_daily USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_default_platform_code_amount_type_biz_date_idx ON public.fact_trade_daily_default USING btree (platform_code, amount_type, biz_date);

CREATE INDEX idx_trade_daily_source ON ONLY public.fact_trade_daily USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_default_source_code_biz_date_idx ON public.fact_trade_daily_default USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y202608_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y202608 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y202608_platform_code_amount_type_biz_date_idx ON public.fact_trade_daily_y202608 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y202608_source_code_biz_date_idx ON public.fact_trade_daily_y202608 USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y2026m09_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y2026m09 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y2026m09_platform_code_amount_type_biz_dat_idx ON public.fact_trade_daily_y2026m09 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y2026m09_source_code_biz_date_idx ON public.fact_trade_daily_y2026m09 USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y2026m10_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y2026m10 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y2026m10_platform_code_amount_type_biz_dat_idx ON public.fact_trade_daily_y2026m10 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y2026m10_source_code_biz_date_idx ON public.fact_trade_daily_y2026m10 USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y2026m11_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y2026m11 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y2026m11_platform_code_amount_type_biz_dat_idx ON public.fact_trade_daily_y2026m11 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y2026m11_source_code_biz_date_idx ON public.fact_trade_daily_y2026m11 USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y2026m12_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y2026m12 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y2026m12_platform_code_amount_type_biz_dat_idx ON public.fact_trade_daily_y2026m12 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y2026m12_source_code_biz_date_idx ON public.fact_trade_daily_y2026m12 USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y202702_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y202702 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y202702_platform_code_amount_type_biz_date_idx ON public.fact_trade_daily_y202702 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y202702_source_code_biz_date_idx ON public.fact_trade_daily_y202702 USING btree (source_code, biz_date);

CREATE INDEX fact_trade_daily_y2027m01_biz_date_platform_code_shop_id_idx ON public.fact_trade_daily_y2027m01 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_trade_daily_y2027m01_platform_code_amount_type_biz_dat_idx ON public.fact_trade_daily_y2027m01 USING btree (platform_code, amount_type, biz_date);

CREATE INDEX fact_trade_daily_y2027m01_source_code_biz_date_idx ON public.fact_trade_daily_y2027m01 USING btree (source_code, biz_date);

CREATE INDEX idx_traffic_daily_ps ON ONLY public.fact_traffic_daily USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_default_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_default USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y202608_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y202608 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y202609_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y202609 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y2026m10_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y2026m10 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y2026m11_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y2026m11 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y2026m12_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y2026m12 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y202701_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y202701 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX fact_traffic_daily_y202702_biz_date_platform_code_shop_id_idx ON public.fact_traffic_daily_y202702 USING btree (biz_date, platform_code, shop_id);

CREATE INDEX idx_activity_reminder_status ON public.compliance_activity_reminder USING btree (signup_deadline) WHERE ((status)::text <> 'done'::text);

CREATE INDEX idx_ad_plan_session ON public.ad_plan USING btree (session_id);

CREATE INDEX idx_ad_plan_shop_date ON public.ad_plan USING btree (shop_id, plan_date);

CREATE INDEX idx_ad_plan_status ON public.ad_plan USING btree (status);

CREATE INDEX idx_ad_spend_daily_dates ON public.fact_ad_spend_daily USING btree (tenant_id, biz_date, estimated_settle_date);

CREATE INDEX idx_after_sale_reason ON public.fact_after_sale_tickets USING btree (platform_code, reason_category, applied_at DESC);

CREATE INDEX idx_after_sale_status_deadline ON public.fact_after_sale_tickets USING btree (ticket_status, audit_deadline_at);

CREATE INDEX idx_agg_plat_channel_date ON public.agg_trade_day_platform_channel USING btree (biz_date DESC);

CREATE INDEX idx_agg_plat_channel_plat ON public.agg_trade_day_platform_channel USING btree (platform_code, shop_id);

CREATE INDEX idx_agg_shop_daily_date ON public.agg_shop_daily USING btree (biz_date DESC);

CREATE INDEX idx_agg_traffic_live_date ON public.agg_traffic_day_live USING btree (biz_date DESC);

CREATE INDEX idx_agg_traffic_live_room ON public.agg_traffic_day_live USING btree (room_id);

CREATE INDEX idx_ai_action_approvals_requested_by ON public.ai_action_approvals USING btree (requested_by);

CREATE INDEX idx_ai_action_approvals_status ON public.ai_action_approvals USING btree (status);

CREATE INDEX idx_ai_action_approvals_tool_log ON public.ai_action_approvals USING btree (tool_log_id);

CREATE INDEX idx_ai_context_bindings_scope ON public.ai_context_bindings USING btree (scope_type, scope_id);

CREATE INDEX idx_ai_context_bindings_user ON public.ai_context_bindings USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_conversations_deerflow_thread ON public.ai_conversations USING btree (deerflow_thread_id) WHERE (deerflow_thread_id IS NOT NULL);

CREATE INDEX idx_ai_conversations_status ON public.ai_conversations USING btree (status);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations USING btree (user_id);

CREATE INDEX idx_ai_eval_case_cat ON public.ai_eval_case USING btree (category);

CREATE INDEX idx_ai_eval_run_batch ON public.ai_eval_run USING btree (batch_id, passed);

CREATE INDEX idx_ai_messages_conv ON public.ai_messages USING btree (conversation_id);

CREATE INDEX idx_ai_messages_user ON public.ai_messages USING btree (user_id);

CREATE INDEX idx_ai_runs_conv ON public.ai_analysis_runs USING btree (conversation_id, created_at DESC);

CREATE INDEX idx_ai_runs_user ON public.ai_analysis_runs USING btree (user_id, created_at DESC);

CREATE INDEX idx_ai_steps_run ON public.ai_analysis_steps USING btree (run_id, seq);

CREATE INDEX idx_ai_tool_logs_actor ON public.ai_tool_logs USING btree (actor_user_id);

CREATE INDEX idx_ai_tool_logs_conv ON public.ai_tool_logs USING btree (conversation_id);

CREATE INDEX idx_ai_tool_logs_created ON public.ai_tool_logs USING btree (created_at DESC);

CREATE INDEX idx_ai_tool_logs_tool ON public.ai_tool_logs USING btree (tool_name);

CREATE INDEX idx_ai_v2_claim_run ON public.ai_v2_claim USING btree (run_id);

CREATE INDEX idx_ai_v2_evidence_key ON public.ai_v2_evidence USING btree (run_id, evidence_key);

CREATE INDEX idx_ai_v2_evidence_run ON public.ai_v2_evidence USING btree (run_id);

CREATE INDEX idx_ai_v2_llm_run ON public.ai_v2_llm_call USING btree (run_id);

CREATE INDEX idx_ai_v2_run_conv ON public.ai_v2_run USING btree (conversation_id);

CREATE INDEX idx_ai_v2_run_created ON public.ai_v2_run USING btree (created_at DESC);

CREATE INDEX idx_ai_v2_step_run ON public.ai_v2_step USING btree (run_id, seq);

CREATE INDEX idx_alert_events_status ON public.alert_events USING btree (status);

CREATE INDEX idx_alert_events_time ON public.alert_events USING btree (event_time DESC);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id);

CREATE INDEX idx_audit_logs_actor_action ON public.audit_logs USING btree (actor_user_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);

CREATE INDEX idx_basic_info_room_date ON public.session_live_basic_info USING btree (room_id, business_date DESC);

CREATE INDEX idx_caliber_platform ON public.platform_caliber_config USING btree (platform_code, metric_code);

CREATE INDEX idx_campaign_plan_dispatched_at ON public.campaign_plan USING btree (dispatched_at);

CREATE INDEX idx_campaign_plan_shop ON public.campaign_plan USING btree (shop_id);

CREATE INDEX idx_campaign_plan_tenant ON public.campaign_plan USING btree (tenant_id);

CREATE INDEX idx_channel_listing_active ON public.dim_product_channel_listing USING btree (is_active);

CREATE INDEX idx_channel_listing_prod ON public.dim_product_channel_listing USING btree (product_id);

CREATE INDEX idx_channel_listing_shop_platform ON public.dim_product_channel_listing USING btree (shop_id, platform_code);

CREATE INDEX idx_compliance_status ON public.compliance_events USING btree (tenant_id, status, occurred_at DESC);

CREATE INDEX idx_content_daily_ps ON public.fact_content_daily USING btree (biz_date, platform_code, shop_id);

CREATE INDEX idx_content_schedules_stage ON public.content_schedules USING btree (tenant_id, stage, planned_publish_at DESC);

CREATE INDEX idx_content_tasks_project ON public.content_tasks USING btree (project_id);

CREATE INDEX idx_content_tasks_status ON public.content_tasks USING btree (status, created_at DESC);

CREATE INDEX idx_cs_session_date_platform ON public.fact_cs_session USING btree (session_date DESC, platform_code);

CREATE INDEX idx_custom_field_entity_plat ON public.sys_custom_field_definition USING btree (entity_type, platform_code, is_active);

CREATE INDEX idx_custom_val_entity ON public.sys_custom_field_value USING btree (entity_type, entity_id);

CREATE INDEX idx_custom_val_key ON public.sys_custom_field_value USING btree (field_key);

CREATE INDEX idx_dim_category_level ON public.dim_category USING btree (level);

CREATE INDEX idx_dim_category_parent ON public.dim_category USING btree (parent_code);

CREATE INDEX idx_dim_product_category_code ON public.dim_product USING btree (category_code);

CREATE INDEX idx_dim_product_spu ON public.dim_product USING btree (spu_code);

CREATE INDEX idx_dim_shop_brand_id ON public.dim_shop USING btree (brand_id);

CREATE INDEX idx_dim_shop_tenant_id ON public.dim_shop USING btree (tenant_id);

CREATE INDEX idx_dim_sku_mapping_product ON public.dim_sku_mapping USING btree (product_id);

CREATE INDEX idx_dim_team_dept ON public.dim_team USING btree (dept_id);

CREATE INDEX idx_douyin_anchor_daily_anchor ON public.douyin_anchor_daily_metrics USING btree (anchor_name, business_date DESC);

CREATE INDEX idx_douyin_anchor_daily_date ON public.douyin_anchor_daily_metrics USING btree (business_date DESC);

CREATE INDEX idx_douyin_channel_daily_date ON public.douyin_channel_daily_metrics USING btree (business_date DESC);

CREATE INDEX idx_fact_inventory_ledger_prod_time ON public.fact_inventory_ledger USING btree (product_id, created_at DESC);

CREATE INDEX idx_fact_inventory_low_stock ON public.fact_inventory_stock USING btree (available_qty, safety_stock);

CREATE INDEX idx_gl_entry_account ON public.fact_gl_entry USING btree (account_code);

CREATE INDEX idx_gl_entry_session ON public.fact_gl_entry USING btree (session_id);

CREATE INDEX idx_gl_entry_shop_date ON public.fact_gl_entry USING btree (shop_id, created_at);

CREATE INDEX idx_gl_entry_voucher ON public.fact_gl_entry USING btree (voucher_id, line_no);

CREATE INDEX idx_gl_voucher_date_period ON public.fact_gl_voucher USING btree (biz_date, period);

CREATE INDEX idx_gl_voucher_ref ON public.fact_gl_voucher USING btree (ref_type, ref_id);

CREATE INDEX idx_gl_voucher_session ON public.fact_gl_voucher USING btree (session_id);

CREATE INDEX idx_gl_voucher_shop_plat ON public.fact_gl_voucher USING btree (shop_id, platform_code);

CREATE INDEX idx_goal_tracking_source ON public.goal_tracking USING btree (source_template_id);

CREATE INDEX idx_issues_batch_sev ON public.data_quality_issues USING btree (batch_id, severity, status);

CREATE INDEX idx_kol_coop_date_status ON public.fact_kol_cooperation USING btree (publish_date DESC, settlement_status);

CREATE INDEX idx_ks_fans_date ON public.kuaishou_fans_ops USING btree (biz_date DESC);

CREATE INDEX idx_land_dedup_batch ON public.land_raw_dedup USING btree (batch_id);

CREATE INDEX idx_land_dedup_date ON public.land_raw_dedup USING btree (biz_date DESC);

CREATE INDEX idx_live_reg_anchor ON public.live_registrations USING btree (anchor_id, biz_date DESC);

CREATE INDEX idx_live_reg_date ON public.live_registrations USING btree (biz_date DESC);

CREATE INDEX idx_live_reg_room ON public.live_registrations USING btree (room_id, biz_date DESC);

CREATE INDEX idx_live_registrations_project_id ON public.live_registrations USING btree (project_id);

CREATE INDEX idx_live_sessions_anchor ON public.live_sessions USING btree (anchor_id);

CREATE INDEX idx_live_sessions_date ON public.live_sessions USING btree (date);

CREATE INDEX idx_live_sessions_operator ON public.live_sessions USING btree (operator_id);

CREATE INDEX idx_live_sessions_project_id ON public.live_sessions USING btree (project_id);

CREATE INDEX idx_live_sessions_room ON public.live_sessions USING btree (room_id);

CREATE INDEX idx_live_sessions_status ON public.live_sessions USING btree (status);

CREATE INDEX idx_multi_room_status_room ON public.multi_room_status USING btree (room_id);

CREATE INDEX idx_order_events_lookup ON public.fact_order_event_stream USING btree (source_platform, store_id, source_order_id, occurred_at);

CREATE INDEX idx_order_events_type ON public.fact_order_event_stream USING btree (event_type, occurred_at);

CREATE INDEX idx_overview_activities_created ON public.overview_activities USING btree (created_at DESC);

CREATE INDEX idx_overview_room_date ON public.session_overview_metrics USING btree (room_id, business_date DESC);

CREATE INDEX idx_platform_capability_platform ON public.platform_capability_matrix USING btree (platform_code) WHERE (is_applicable = true);

CREATE INDEX idx_product_room_date ON public._deprecated_session_product_details USING btree (room_id, business_date DESC);

CREATE INDEX idx_quarantine_batch ON public.dq_quarantine USING btree (batch_id, status);

CREATE INDEX idx_quarantine_rule ON public.dq_quarantine USING btree (rule_code, severity);

CREATE INDEX idx_reservation_order ON public.fact_inventory_reservation USING btree (order_no);

CREATE INDEX idx_reservation_prod_wh ON public.fact_inventory_reservation USING btree (product_id, warehouse_code);

CREATE INDEX idx_reservation_shop_plat ON public.fact_inventory_reservation USING btree (shop_id, platform_code);

CREATE INDEX idx_reservation_status_expires ON public.fact_inventory_reservation USING btree (status, expires_at);

CREATE INDEX idx_risk_assessment_change ON public.compliance_risk_assessment USING btree (change_id);

CREATE INDEX idx_rma_order_sub ON public.fact_order_rma_item USING btree (source_order_id, source_sub_order_id);

CREATE INDEX idx_rma_status ON public.fact_order_rma_item USING btree (status, inspection_status);

CREATE INDEX idx_rma_store_platform ON public.fact_order_rma_item USING btree (store_id, source_platform);

CREATE INDEX idx_rule_change_severity ON public.compliance_rule_change USING btree (severity, created_at DESC);

CREATE INDEX idx_rule_change_unread ON public.compliance_rule_change USING btree (platform_code, is_read, created_at DESC);

CREATE INDEX idx_rule_snapshot_fetched ON public.compliance_rule_snapshot USING btree (fetched_at DESC);

CREATE INDEX idx_rule_snapshot_hash ON public.compliance_rule_snapshot USING btree (content_hash);

CREATE INDEX idx_rule_snapshot_pf_ext ON public.compliance_rule_snapshot USING btree (platform_code, external_id);

CREATE INDEX idx_search_kw_lookup ON public.fact_search_keyword_daily USING btree (tenant_id, platform_code, biz_date DESC);

CREATE INDEX idx_selection_item_rec ON public.fact_selection_item USING btree (recommendation_id, rank_no);

CREATE INDEX idx_selection_rec_created ON public.fact_selection_recommendation USING btree (created_at DESC);

CREATE INDEX idx_selection_rec_shop ON public.fact_selection_recommendation USING btree (shop_id);

CREATE INDEX idx_selection_rec_tenant_cat ON public.fact_selection_recommendation USING btree (tenant_id, category_code);

CREATE INDEX idx_session_anchor_metrics_anchor ON public.session_anchor_metrics USING btree (anchor_id);

CREATE INDEX idx_session_anchor_metrics_date ON public.session_anchor_metrics USING btree (date);

CREATE INDEX idx_session_channel_channel ON public.session_channel_metrics USING btree (channel);

CREATE INDEX idx_session_channel_date ON public.session_channel_metrics USING btree (period_date);

CREATE INDEX idx_session_channel_platform ON public.session_channel_metrics USING btree (platform_code, period_date);

CREATE INDEX idx_session_channel_session ON public.session_channel_metrics USING btree (session_id);

CREATE INDEX idx_session_channel_shop ON public.session_channel_metrics USING btree (shop_id, period_date);

CREATE INDEX idx_session_plan_products_plan ON public.session_plan_products USING btree (plan_id);

CREATE INDEX idx_session_plan_products_room_date ON public.session_plan_products USING btree (room_id, business_date DESC) WHERE (plan_id IS NULL);

CREATE INDEX idx_session_plans_date ON public.session_plans USING btree (plan_date);

CREATE INDEX idx_session_plans_room ON public.session_plans USING btree (room_id);

CREATE INDEX idx_session_staff_role ON public.session_staff_assignments USING btree (role_code);

CREATE INDEX idx_session_staff_session ON public.session_staff_assignments USING btree (session_id);

CREATE INDEX idx_settlement_cycles_timeline ON public.fact_settlement_cycles USING btree (tenant_id, order_date, settle_date, settlement_status);

CREATE INDEX idx_signal_source_cat ON public.signal_source USING btree (category_code);

CREATE INDEX idx_sku_product ON public._deprecated_session_product_skus USING btree (product_id);

CREATE INDEX idx_source_map_platform ON public.platform_source_mapping USING btree (platform_code, priority DESC);

CREATE INDEX idx_staff_day_status_date ON public.staff_day_status USING btree (biz_date);

CREATE INDEX idx_staff_day_status_name ON public.staff_day_status USING btree (staff_name);

CREATE INDEX idx_stg_order_batch ON public.stg_order_import USING btree (batch_id, validation_status);

CREATE INDEX idx_stg_order_bizkey ON public.stg_order_import USING btree (batch_id, source_platform, store_id, source_order_id);

CREATE INDEX idx_sync_jobs_shop ON public.ingest_sync_jobs USING btree (shop_id, status);

CREATE INDEX idx_system_jobs_run_at ON public.system_jobs USING btree (run_at);

CREATE INDEX idx_system_jobs_status ON public.system_jobs USING btree (status);

CREATE INDEX idx_system_jobs_type ON public.system_jobs USING btree (job_type);

CREATE INDEX idx_tb_order_date ON public.taobao_order_hierarchy USING btree (biz_date DESC, shop_id);

CREATE INDEX idx_user_module_overrides_user ON public.user_module_overrides USING btree (user_id);

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);

CREATE INDEX idx_users_role ON public.users USING btree (role);

CREATE INDEX idx_users_status ON public.users USING btree (status);

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);

CREATE INDEX idx_users_username ON public.users USING btree (username);

CREATE INDEX idx_video_metrics_date ON public.video_metrics USING btree (biz_date DESC, platform_code);

CREATE INDEX idx_video_room_date ON public.session_short_video_traffic USING btree (room_id, business_date DESC);

CREATE INDEX idx_waybill_risk ON public.fact_fulfillment_waybill USING btree (is_ship_delayed, is_fake_ship_risk) WHERE ((is_ship_delayed = true) OR (is_fake_ship_risk = true));

CREATE INDEX idx_waybill_status_deadline ON public.fact_fulfillment_waybill USING btree (fulfillment_status, ship_deadline_at);

CREATE INDEX idx_xhs_note_date ON public.xhs_note USING btree (biz_date DESC);

CREATE INDEX idx_xhs_note_shop ON public.xhs_note USING btree (shop_id, biz_date DESC);

CREATE UNIQUE INDEX session_plan_products_plan_group_uidx ON public.session_plan_products USING btree (plan_id, group_letter) WHERE ((plan_id IS NOT NULL) AND (group_letter IS NOT NULL));

CREATE UNIQUE INDEX session_plan_products_room_date_product_uidx ON public.session_plan_products USING btree (room_id, business_date, product_id) WHERE ((plan_id IS NULL) AND (room_id IS NOT NULL) AND (product_id IS NOT NULL));

CREATE UNIQUE INDEX uidx_agg_platform_monthly_ym_plat ON public.agg_platform_monthly USING btree (year_month, platform_code);

CREATE UNIQUE INDEX uq_agg_traffic_live_idx ON public.agg_traffic_day_live USING btree (biz_date, COALESCE(platform_code, '__all__'::character varying), COALESCE(room_id, 0), COALESCE(shop_id, (0)::bigint));

CREATE UNIQUE INDEX uq_custom_field_def_idx ON public.sys_custom_field_definition USING btree (entity_type, field_key, COALESCE(platform_code, '__all__'::character varying));

CREATE UNIQUE INDEX uq_dim_kol_platform_name ON public.dim_kol USING btree (platform_code, kol_name);

-- ===== tableattach (76) =====
ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_default DEFAULT;

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202609 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202610 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202611 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202612 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202701 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202703 FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202704 FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202705 FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

ALTER TABLE ONLY public.canonical_order_items ATTACH PARTITION public.canonical_order_items_y202706 FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_default DEFAULT;

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202609 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202610 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202611 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202612 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202701 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202703 FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202704 FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202705 FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

ALTER TABLE ONLY public.canonical_orders ATTACH PARTITION public.canonical_orders_y202706 FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_default DEFAULT;

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202609 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202610 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202611 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202612 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202701 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202703 FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202704 FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202705 FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

ALTER TABLE ONLY public.canonical_refund_events ATTACH PARTITION public.canonical_refund_events_y202706 FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_default DEFAULT;

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202609 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202610 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202611 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202612 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202701 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202703 FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202704 FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202705 FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

ALTER TABLE ONLY public.clean_records ATTACH PARTITION public.clean_records_y202706 FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_default DEFAULT;

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y2026m09 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y2026m10 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y2026m11 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y2026m12 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.fact_trade_daily ATTACH PARTITION public.fact_trade_daily_y2027m01 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_default DEFAULT;

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y202609 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y2026m10 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y2026m11 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y2026m12 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y202701 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.fact_traffic_daily ATTACH PARTITION public.fact_traffic_daily_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_default DEFAULT;

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202608 FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202609 FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202610 FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202611 FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202612 FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202701 FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202702 FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202703 FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202704 FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202705 FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');

ALTER TABLE ONLY public.raw_records ATTACH PARTITION public.raw_records_y202706 FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');

-- ===== attach (196) =====
ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_default_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_default_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_default_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202608_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202608_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202608_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202609_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202609_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202609_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202610_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202610_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202610_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202611_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202611_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202611_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202612_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202612_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202612_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202701_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202701_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202701_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202702_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202702_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202702_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202703_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202703_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202703_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202704_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202704_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202704_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202705_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202705_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202705_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_item_bizkey ATTACH PARTITION public.canonical_order_items_y202706_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_order_items_pkey ATTACH PARTITION public.canonical_order_items_y202706_pkey;

ALTER INDEX public.idx_canonical_order_items_store_date ATTACH PARTITION public.canonical_order_items_y202706_store_id_biz_date_internal_sk_idx;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_default_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_default_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202608_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202608_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202609_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202609_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202610_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202610_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202611_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202611_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202612_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202612_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202701_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202701_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202702_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202702_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202703_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202703_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202704_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202704_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202705_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202705_pkey;

ALTER INDEX public.uk_canonical_order_bizkey ATTACH PARTITION public.canonical_orders_y202706_biz_date_source_platform_store_id__key;

ALTER INDEX public.canonical_orders_pkey ATTACH PARTITION public.canonical_orders_y202706_pkey;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_defau_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_default_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202608_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202609_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202610_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202611_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202612_pkey;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2026_biz_date_source_platform_sto_key1;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2026_biz_date_source_platform_sto_key2;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2026_biz_date_source_platform_sto_key3;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2026_biz_date_source_platform_sto_key4;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2026_biz_date_source_platform_stor_key;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202701_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202702_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202703_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202704_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202705_pkey;

ALTER INDEX public.canonical_refund_events_pkey ATTACH PARTITION public.canonical_refund_events_y202706_pkey;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2027_biz_date_source_platform_sto_key1;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2027_biz_date_source_platform_sto_key2;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2027_biz_date_source_platform_sto_key3;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2027_biz_date_source_platform_sto_key4;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2027_biz_date_source_platform_sto_key5;

ALTER INDEX public.uk_canonical_refund_bizkey ATTACH PARTITION public.canonical_refund_events_y2027_biz_date_source_platform_stor_key;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_default_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_default_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202608_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202608_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202609_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202609_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202610_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202610_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202611_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202611_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202612_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202612_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202701_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202701_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202702_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202702_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202703_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202703_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202704_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202704_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202705_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202705_pkey;

ALTER INDEX public.uk_clean_order_item ATTACH PARTITION public.clean_records_y202706_biz_date_source_platform_store_id_sou_key;

ALTER INDEX public.clean_records_pkey ATTACH PARTITION public.clean_records_y202706_pkey;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_default_biz_date_platform_code_shop_id_cha_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_default_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_default_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_default_platform_code_amount_type_biz_date_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_default_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y202608_biz_date_platform_code_shop_id_cha_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y202608_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y202608_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y202608_platform_code_amount_type_biz_date_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y202608_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y2026m09_biz_date_platform_code_shop_id_ch_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y2026m09_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y2026m09_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y2026m09_platform_code_amount_type_biz_dat_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y2026m09_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y2026m10_biz_date_platform_code_shop_id_ch_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y2026m10_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y2026m10_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y2026m10_platform_code_amount_type_biz_dat_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y2026m10_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y2026m11_biz_date_platform_code_shop_id_ch_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y2026m11_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y2026m11_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y2026m11_platform_code_amount_type_biz_dat_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y2026m11_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y2026m12_biz_date_platform_code_shop_id_ch_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y2026m12_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y2026m12_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y2026m12_platform_code_amount_type_biz_dat_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y2026m12_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y202702_biz_date_platform_code_shop_id_cha_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y202702_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y202702_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y202702_platform_code_amount_type_biz_date_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y202702_source_code_biz_date_idx;

ALTER INDEX public.uq_trade_daily_caliber_key ATTACH PARTITION public.fact_trade_daily_y2027m01_biz_date_platform_code_shop_id_ch_key;

ALTER INDEX public.idx_trade_daily_ps ATTACH PARTITION public.fact_trade_daily_y2027m01_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_trade_daily_pkey ATTACH PARTITION public.fact_trade_daily_y2027m01_pkey;

ALTER INDEX public.idx_trade_daily_amount_type ATTACH PARTITION public.fact_trade_daily_y2027m01_platform_code_amount_type_biz_dat_idx;

ALTER INDEX public.idx_trade_daily_source ATTACH PARTITION public.fact_trade_daily_y2027m01_source_code_biz_date_idx;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_default_biz_date_platform_code_shop_id_c_key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_default_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_default_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y202608_biz_date_platform_code_shop_id_c_key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y202608_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y202608_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y202609_biz_date_platform_code_shop_id_c_key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y202609_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y202609_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y2026m10_biz_date_platform_code_shop_id__key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y2026m10_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y2026m10_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y2026m11_biz_date_platform_code_shop_id__key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y2026m11_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y2026m11_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y2026m12_biz_date_platform_code_shop_id__key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y2026m12_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y2026m12_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y202701_biz_date_platform_code_shop_id_c_key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y202701_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y202701_pkey;

ALTER INDEX public.uq_traffic_daily_caliber_key ATTACH PARTITION public.fact_traffic_daily_y202702_biz_date_platform_code_shop_id_c_key;

ALTER INDEX public.idx_traffic_daily_ps ATTACH PARTITION public.fact_traffic_daily_y202702_biz_date_platform_code_shop_id_idx;

ALTER INDEX public.fact_traffic_daily_pkey ATTACH PARTITION public.fact_traffic_daily_y202702_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_default_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_default_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202608_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202608_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202609_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202609_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202610_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202610_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202611_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202611_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202612_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202612_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202701_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202701_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202702_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202702_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202703_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202703_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202704_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202704_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202705_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202705_pkey;

ALTER INDEX public.uk_raw_batch_row ATTACH PARTITION public.raw_records_y202706_biz_date_batch_id_sheet_name_row_no_key;

ALTER INDEX public.raw_records_pkey ATTACH PARTITION public.raw_records_y202706_pkey;

-- ===== function (25) =====
CREATE FUNCTION public.check_caliber_gap() RETURNS TABLE(platform_code character varying, reason text)
    LANGUAGE sql STABLE
    AS $$
  -- ① 启用了但没配默认口径
  SELECT p.platform_code, '未配置 is_default=true 的 gmv 口径'::text
    FROM public.system_platform_configs p
   WHERE p.is_enabled = true
     AND NOT EXISTS (
       SELECT 1 FROM public.platform_caliber_config c
        WHERE c.platform_code = p.platform_code
          AND c.metric_code = 'gmv' AND c.is_default = true
     )
  UNION ALL
  -- ② 配了默认口径但事实表里没有该 amount_type 的数据
  SELECT c.platform_code, '默认口径配置为 ' || c.amount_type || '，但事实表无此口径数据'::text
    FROM public.platform_caliber_config c
   WHERE c.metric_code = 'gmv' AND c.is_default = true
     AND NOT EXISTS (
       SELECT 1 FROM public.fact_trade_daily f
        WHERE f.platform_code = c.platform_code
          AND f.amount_type = c.amount_type
     );
$$;

CREATE FUNCTION public.check_platform_grant_gap() RETURNS TABLE(platform_code character varying, enabled boolean, granted_role_count bigint)
    LANGUAGE sql STABLE
    AS $$
  SELECT p.platform_code,
         p.is_enabled,
         COUNT(DISTINCT rpp.role_id) AS granted_role_count
    FROM public.system_platform_configs p
    LEFT JOIN public.role_platform_permissions rpp ON rpp.platform_code = p.platform_code
   WHERE p.is_enabled = true
   GROUP BY p.platform_code, p.is_enabled
  HAVING COUNT(DISTINCT rpp.role_id) = 0;
$$;

CREATE FUNCTION public.rls_allowed_project_ids() RETURNS integer[]
    LANGUAGE sql STABLE
    AS $_$
  SELECT CASE
    WHEN COALESCE(NULLIF(current_setting('app.allowed_project_ids', true), ''), '') = ''
      THEN ARRAY[]::integer[]
    ELSE (
      SELECT COALESCE(array_agg(x::integer), ARRAY[]::integer[])
      FROM unnest(string_to_array(current_setting('app.allowed_project_ids', true), ',')) AS x
      WHERE x ~ '^[0-9]+$'
    )
  END;
$_$;

CREATE FUNCTION public.rls_anchor_id() RETURNS integer
    LANGUAGE sql STABLE
    AS $_$
  SELECT CASE
    WHEN COALESCE(current_setting('app.anchor_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.anchor_id', true)::integer
    ELSE NULL
  END;
$_$;

CREATE FUNCTION public.rls_brand_client_id() RETURNS integer
    LANGUAGE sql STABLE
    AS $_$
  SELECT CASE
    WHEN COALESCE(current_setting('app.brand_client_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.brand_client_id', true)::integer
    ELSE NULL
  END;
$_$;

CREATE FUNCTION public.rls_can_access_shop(s_id bigint) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_user_id() IS NOT NULL AND (
    s_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.dim_shop ds
      WHERE ds.id = s_id
        AND (
          (public.rls_role() = 'super_admin' AND public.rls_is_agency_staff())
          OR ds.tenant_id = public.rls_tenant_id()
        )
        AND public.rls_has_platform(ds.platform_code)
    )
  );
$$;

CREATE FUNCTION public.rls_can_view_anchors() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(current_setting('app.can_view_anchors', true), '') = 'true';
$$;

CREATE FUNCTION public.rls_can_view_cost() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(current_setting('app.can_view_cost', true), '') = 'true';
$$;

CREATE FUNCTION public.rls_check_permission(p_resource text, p_action text DEFAULT '*'::text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT
    CASE
      WHEN public.rls_user_id() IS NULL THEN false
      WHEN public.rls_role() = 'super_admin' THEN true
      ELSE (
        NOT EXISTS (
          SELECT 1 FROM public.sys_role_permission
          WHERE role_code = public.rls_role()
            AND (resource = p_resource OR resource = '*' OR p_resource LIKE resource || ':%')
            AND (action = p_action OR action = '*')
            AND effect = 'deny'
        )
        AND (
          EXISTS (
            SELECT 1 FROM public.sys_role_permission
            WHERE role_code = public.rls_role()
              AND (resource = p_resource OR resource = '*' OR p_resource LIKE resource || ':%')
              AND (action = p_action OR action = '*')
              AND effect = 'allow'
          )
          OR public.rls_is_agency_staff()
        )
      )
    END;
$$;

CREATE FUNCTION public.rls_check_scope(p_resource text DEFAULT NULL::text, p_platform text DEFAULT NULL::text, p_shop_id integer DEFAULT NULL::integer, p_tenant_id integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT
    public.rls_user_id() IS NOT NULL
    AND (
      public.rls_is_super_admin()
      OR (
        (
          p_tenant_id IS NULL
          OR public.rls_tenant_id() = 0
          OR p_tenant_id = public.rls_tenant_id()
        )
        AND (
          p_platform IS NULL
          OR public.rls_has_platform(p_platform)
        )
        AND (
          p_shop_id IS NULL
          OR public.rls_can_access_shop(p_shop_id)
        )
        AND (
          p_resource IS NULL
          OR public.rls_check_permission(p_resource, 'read')
        )
      )
    );
$$;

CREATE FUNCTION public.rls_data_scope() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.data_scope', true), ''), 'self');
$$;

CREATE FUNCTION public.rls_has_platform(p_code text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE
    WHEN public.rls_user_id() IS NULL THEN false
    WHEN COALESCE(current_setting('app.allowed_platforms', true), '') = '*' THEN true
    WHEN COALESCE(NULLIF(p_code, ''), '') = '' THEN true
    WHEN COALESCE(NULLIF(current_setting('app.allowed_platforms', true), ''), '') = '' THEN false
    ELSE p_code = ANY(string_to_array(current_setting('app.allowed_platforms', true), ','))
  END;
$$;

CREATE FUNCTION public.rls_has_project(proj_id integer) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT proj_id IS NOT NULL AND proj_id = ANY(public.rls_allowed_project_ids());
$$;

CREATE FUNCTION public.rls_is_agency_staff() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_user_id() IS NOT NULL AND public.rls_user_type() <> 'brand_viewer';
$$;

CREATE FUNCTION public.rls_is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_role() = 'super_admin';
$$;

CREATE FUNCTION public.rls_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_role', true), ''), '');
$$;

CREATE FUNCTION public.rls_tenant_id() RETURNS integer
    LANGUAGE sql STABLE
    AS $_$
  SELECT CASE
    WHEN COALESCE(current_setting('app.tenant_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.tenant_id', true)::integer
    ELSE 0
  END;
$_$;

CREATE FUNCTION public.rls_user_id() RETURNS integer
    LANGUAGE sql STABLE
    AS $_$
  SELECT CASE
    WHEN COALESCE(current_setting('app.user_id', true), '') ~ '^[0-9]+$'
      THEN current_setting('app.user_id', true)::integer
    ELSE NULL
  END;
$_$;

CREATE FUNCTION public.rls_user_type() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_type', true), ''), '');
$$;

CREATE FUNCTION public.rls_visible_dept_ids() RETURNS integer[]
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE
    WHEN public.rls_data_scope() = 'all' THEN
      ARRAY(SELECT id FROM public.dim_dept WHERE status = 1)
    ELSE
      ARRAY(
        SELECT dept_id FROM public.users
         WHERE id = NULLIF(current_setting('app.user_id', true), '')::int
           AND dept_id IS NOT NULL
      )
  END;
$$;

CREATE FUNCTION public.rls_visible_team_ids() RETURNS integer[]
    LANGUAGE sql STABLE
    AS $$
  SELECT CASE
    WHEN public.rls_data_scope() = 'all' THEN
      ARRAY(SELECT id FROM public.dim_team WHERE status = 1)
    WHEN public.rls_data_scope() = 'org' THEN
      ARRAY(
        SELECT t.id FROM public.dim_team t
         WHERE t.dept_id = ANY(public.rls_visible_dept_ids())
      )
    ELSE
      ARRAY(
        SELECT team_id FROM public.users
         WHERE id = NULLIF(current_setting('app.user_id', true), '')::int
           AND team_id IS NOT NULL
      )
  END;
$$;

CREATE FUNCTION public.sync_role_grants_to_sys_perm() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type)
    VALUES (NEW.role_code, 'module:' || NEW.module_code, '*', NEW.effect, 'tenant')
    ON CONFLICT (role_code, resource, action) DO UPDATE SET effect = NEW.effect;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_role_permission
    WHERE role_code = OLD.role_code AND resource = 'module:' || OLD.module_code;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.sync_role_modules_to_sys_perm() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type)
    VALUES (NEW.role_code, 'module:' || NEW.module_code, '*', 'allow', 'tenant')
    ON CONFLICT (role_code, resource, action) DO UPDATE SET effect = 'allow';
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_role_permission
    WHERE role_code = OLD.role_code AND resource = 'module:' || OLD.module_code;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.sync_roles_to_sys_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sys_role (id, code, name, description, is_system, created_at, updated_at)
    VALUES (NEW.id, NEW.code, NEW.name, COALESCE(NEW.description, ''), (NEW.code IN ('super_admin', 'admin')), NEW.created_at, now())
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.sys_role
    SET code = NEW.code, name = NEW.name, description = COALESCE(NEW.description, ''), updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_role WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.sync_user_to_sys_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL THEN
      INSERT INTO public.sys_user_role (user_id, role_code, tenant_id)
      VALUES (NEW.id, NEW.role, COALESCE(NEW.tenant_id, 1))
      ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      DELETE FROM public.sys_user_role WHERE user_id = OLD.id;
      IF NEW.role IS NOT NULL THEN
        INSERT INTO public.sys_user_role (user_id, role_code, tenant_id)
        VALUES (NEW.id, NEW.role, COALESCE(NEW.tenant_id, 1))
        ON CONFLICT (user_id, role_code, tenant_id) DO NOTHING;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.sys_user_role WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- ===== trigger (4) =====
CREATE TRIGGER trg_sync_role_grants_to_sys_perm AFTER INSERT OR DELETE OR UPDATE ON public.role_module_grants FOR EACH ROW EXECUTE FUNCTION public.sync_role_grants_to_sys_perm();

CREATE TRIGGER trg_sync_role_modules_to_sys_perm AFTER INSERT OR DELETE ON public.role_modules FOR EACH ROW EXECUTE FUNCTION public.sync_role_modules_to_sys_perm();

CREATE TRIGGER trg_sync_roles_to_sys_role AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.sync_roles_to_sys_role();

CREATE TRIGGER trg_sync_user_to_sys_user_role AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_to_sys_user_role();

-- ===== alter (403) =====
ALTER TABLE ONLY public.ad_plan FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.ad_plan_id_seq OWNED BY public.ad_plan.id;

ALTER TABLE ONLY public.ad_plan_receipts FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.ad_plan_receipts_id_seq OWNED BY public.ad_plan_receipts.id;

ALTER SEQUENCE public.agg_shop_daily_id_seq OWNED BY public.agg_shop_daily.id;

ALTER TABLE ONLY public.agg_trade_day_platform_channel FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.agg_trade_day_platform_channel_id_seq OWNED BY public.agg_trade_day_platform_channel.id;

ALTER TABLE ONLY public.agg_traffic_day_live FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.agg_traffic_day_live_id_seq OWNED BY public.agg_traffic_day_live.id;

ALTER SEQUENCE public.ai_action_approvals_id_seq OWNED BY public.ai_action_approvals.id;

ALTER SEQUENCE public.ai_analysis_runs_id_seq OWNED BY public.ai_analysis_runs.id;

ALTER SEQUENCE public.ai_analysis_steps_id_seq OWNED BY public.ai_analysis_steps.id;

ALTER SEQUENCE public.ai_config_id_seq OWNED BY public.ai_config.id;

ALTER SEQUENCE public.ai_context_bindings_id_seq OWNED BY public.ai_context_bindings.id;

ALTER SEQUENCE public.ai_conversations_id_seq OWNED BY public.ai_conversations.id;

ALTER SEQUENCE public.ai_eval_case_id_seq OWNED BY public.ai_eval_case.id;

ALTER SEQUENCE public.ai_eval_run_id_seq OWNED BY public.ai_eval_run.id;

ALTER SEQUENCE public.ai_messages_id_seq OWNED BY public.ai_messages.id;

ALTER SEQUENCE public.ai_tool_logs_id_seq OWNED BY public.ai_tool_logs.id;

ALTER SEQUENCE public.ai_v2_claim_id_seq OWNED BY public.ai_v2_claim.id;

ALTER SEQUENCE public.ai_v2_evidence_id_seq OWNED BY public.ai_v2_evidence.id;

ALTER SEQUENCE public.ai_v2_llm_call_id_seq OWNED BY public.ai_v2_llm_call.id;

ALTER SEQUENCE public.ai_v2_step_id_seq OWNED BY public.ai_v2_step.id;

ALTER SEQUENCE public.alert_events_id_seq OWNED BY public.alert_events.id;

ALTER SEQUENCE public.alert_rules_id_seq OWNED BY public.alert_rules.id;

ALTER SEQUENCE public.anchor_capabilities_id_seq OWNED BY public.anchor_capabilities.id;

ALTER SEQUENCE public.anchor_script_templates_id_seq OWNED BY public.anchor_script_templates.id;

ALTER SEQUENCE public.anchor_training_plans_id_seq OWNED BY public.anchor_training_plans.id;

ALTER SEQUENCE public.anchor_training_records_id_seq OWNED BY public.anchor_training_records.id;

ALTER SEQUENCE public.anchors_id_seq OWNED BY public.anchors.id;

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

ALTER TABLE ONLY public.campaign_plan FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.campaign_plan_id_seq OWNED BY public.campaign_plan.id;

ALTER TABLE ONLY public.campaign_plan_template FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.campaign_plan_template_id_seq OWNED BY public.campaign_plan_template.id;

ALTER TABLE ONLY public.canonical_order_items FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.canonical_order_items_id_seq OWNED BY public.canonical_order_items.id;

ALTER SEQUENCE public.canonical_orders_id_seq OWNED BY public.canonical_orders.id;

ALTER SEQUENCE public.canonical_refund_events_id_seq OWNED BY public.canonical_refund_events.id;

ALTER SEQUENCE public.clean_records_id_seq OWNED BY public.clean_records.id;

ALTER SEQUENCE public.clean_rule_sets_id_seq OWNED BY public.clean_rule_sets.id;

ALTER SEQUENCE public.cleaning_runs_id_seq OWNED BY public.cleaning_runs.id;

ALTER SEQUENCE public.competitor_brands_id_seq OWNED BY public.competitor_brands.id;

ALTER SEQUENCE public.competitor_price_data_id_seq OWNED BY public.competitor_price_data.id;

ALTER TABLE ONLY public.compliance_activity_reminder FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_activity_reminder_id_seq OWNED BY public.compliance_activity_reminder.id;

ALTER TABLE ONLY public.compliance_events FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_events_id_seq OWNED BY public.compliance_events.id;

ALTER TABLE ONLY public.compliance_risk_assessment FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_risk_assessment_id_seq OWNED BY public.compliance_risk_assessment.id;

ALTER TABLE ONLY public.compliance_rule_change FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_rule_change_id_seq OWNED BY public.compliance_rule_change.id;

ALTER TABLE ONLY public.compliance_rule_snapshot FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_rule_snapshot_id_seq OWNED BY public.compliance_rule_snapshot.id;

ALTER SEQUENCE public.content_assets_id_seq OWNED BY public.content_assets.id;

ALTER TABLE ONLY public.content_attribution_ledger FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.content_attribution_ledger_id_seq OWNED BY public.content_attribution_ledger.id;

ALTER SEQUENCE public.content_projects_id_seq OWNED BY public.content_projects.id;

ALTER SEQUENCE public.content_providers_id_seq OWNED BY public.content_providers.id;

ALTER TABLE ONLY public.content_schedules FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.content_schedules_id_seq OWNED BY public.content_schedules.id;

ALTER SEQUENCE public.content_tasks_id_seq OWNED BY public.content_tasks.id;

ALTER SEQUENCE public.data_exports_id_seq OWNED BY public.data_exports.id;

ALTER SEQUENCE public.data_quality_issues_id_seq OWNED BY public.data_quality_issues.id;

ALTER SEQUENCE public.data_uploads_id_seq OWNED BY public.data_uploads.id;

ALTER SEQUENCE public.dict_items_id_seq OWNED BY public.dict_items.id;

ALTER TABLE ONLY public.dim_accounting_subject FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dim_brand_id_seq OWNED BY public.dim_brand.id;

ALTER TABLE ONLY public.dim_category FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dim_cs_agent_id_seq OWNED BY public.dim_cs_agent.id;

ALTER SEQUENCE public.dim_dept_id_seq OWNED BY public.dim_dept.id;

ALTER SEQUENCE public.dim_kol_id_seq OWNED BY public.dim_kol.id;

ALTER TABLE ONLY public.dim_product_channel_listing FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dim_product_channel_listing_id_seq OWNED BY public.dim_product_channel_listing.id;

ALTER SEQUENCE public.dim_product_id_seq OWNED BY public.dim_product.id;

ALTER SEQUENCE public.dim_shop_id_seq OWNED BY public.dim_shop.id;

ALTER SEQUENCE public.dim_sku_mapping_id_seq OWNED BY public.dim_sku_mapping.id;

ALTER SEQUENCE public.dim_team_id_seq OWNED BY public.dim_team.id;

ALTER SEQUENCE public.douyin_anchor_daily_metrics_id_seq OWNED BY public.douyin_anchor_daily_metrics.id;

ALTER SEQUENCE public.douyin_channel_daily_metrics_id_seq OWNED BY public.douyin_channel_daily_metrics.id;

ALTER TABLE ONLY public.dq_quarantine FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dq_quarantine_id_seq OWNED BY public.dq_quarantine.id;

ALTER SEQUENCE public.entity_aliases_id_seq OWNED BY public.entity_aliases.id;

ALTER TABLE ONLY public.fact_ad_spend_daily FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_ad_spend_daily_id_seq OWNED BY public.fact_ad_spend_daily.id;

ALTER SEQUENCE public.fact_after_sale_tickets_id_seq OWNED BY public.fact_after_sale_tickets.id;

ALTER SEQUENCE public.fact_content_daily_id_seq OWNED BY public.fact_content_daily.id;

ALTER SEQUENCE public.fact_cs_session_id_seq OWNED BY public.fact_cs_session.id;

ALTER SEQUENCE public.fact_fulfillment_waybill_id_seq OWNED BY public.fact_fulfillment_waybill.id;

ALTER TABLE ONLY public.fact_gl_entry FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_gl_entry_id_seq OWNED BY public.fact_gl_entry.id;

ALTER TABLE ONLY public.fact_gl_voucher FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_gl_voucher_id_seq OWNED BY public.fact_gl_voucher.id;

ALTER SEQUENCE public.fact_inventory_ledger_id_seq OWNED BY public.fact_inventory_ledger.id;

ALTER TABLE ONLY public.fact_inventory_reservation FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_inventory_reservation_id_seq OWNED BY public.fact_inventory_reservation.id;

ALTER SEQUENCE public.fact_inventory_stock_id_seq OWNED BY public.fact_inventory_stock.id;

ALTER SEQUENCE public.fact_kol_cooperation_id_seq OWNED BY public.fact_kol_cooperation.id;

ALTER TABLE ONLY public.fact_order_event_stream FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_order_event_stream_id_seq OWNED BY public.fact_order_event_stream.id;

ALTER TABLE ONLY public.fact_order_rma_item FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_order_rma_item_id_seq OWNED BY public.fact_order_rma_item.id;

ALTER TABLE ONLY public.fact_search_keyword_daily FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_search_keyword_daily_id_seq OWNED BY public.fact_search_keyword_daily.id;

ALTER TABLE ONLY public.fact_selection_item FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_selection_item_id_seq OWNED BY public.fact_selection_item.id;

ALTER TABLE ONLY public.fact_selection_recommendation FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_selection_recommendation_id_seq OWNED BY public.fact_selection_recommendation.id;

ALTER TABLE ONLY public.fact_settlement_cycles FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.fact_settlement_cycles_id_seq OWNED BY public.fact_settlement_cycles.id;

ALTER SEQUENCE public.fact_trade_daily_id_seq OWNED BY public.fact_trade_daily.id;

ALTER SEQUENCE public.fact_traffic_daily_id_seq OWNED BY public.fact_traffic_daily.id;

ALTER SEQUENCE public.field_mapping_rules_id_seq OWNED BY public.field_mapping_rules.id;

ALTER SEQUENCE public.goal_tracking_id_seq OWNED BY public.goal_tracking.id;

ALTER SEQUENCE public.import_batches_id_seq OWNED BY public.import_batches.id;

ALTER SEQUENCE public.import_files_id_seq OWNED BY public.import_files.id;

ALTER SEQUENCE public.improvement_tasks_id_seq OWNED BY public.improvement_tasks.id;

ALTER SEQUENCE public.ingest_sync_jobs_id_seq OWNED BY public.ingest_sync_jobs.id;

ALTER SEQUENCE public.issue_library_id_seq OWNED BY public.issue_library.id;

ALTER SEQUENCE public.kuaishou_fans_ops_id_seq OWNED BY public.kuaishou_fans_ops.id;

ALTER TABLE ONLY public.land_raw_dedup FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.land_raw_dedup_id_seq OWNED BY public.land_raw_dedup.id;

ALTER SEQUENCE public.live_registrations_id_seq OWNED BY public.live_registrations.id;

ALTER SEQUENCE public.live_rooms_id_seq OWNED BY public.live_rooms.id;

ALTER SEQUENCE public.live_sessions_id_seq OWNED BY public.live_sessions.id;

ALTER SEQUENCE public.metric_definition_id_seq OWNED BY public.metric_definition.id;

ALTER SEQUENCE public.multi_room_status_id_seq OWNED BY public.multi_room_status.id;

ALTER SEQUENCE public.operators_id_seq OWNED BY public.operators.id;

ALTER SEQUENCE public.order_status_config_id_seq OWNED BY public.order_status_config.id;

ALTER SEQUENCE public.overview_activities_id_seq OWNED BY public.overview_activities.id;

ALTER SEQUENCE public.overview_daily_stats_id_seq OWNED BY public.overview_daily_stats.id;

ALTER SEQUENCE public.platform_caliber_config_id_seq OWNED BY public.platform_caliber_config.id;

ALTER SEQUENCE public.platform_capability_matrix_id_seq OWNED BY public.platform_capability_matrix.id;

ALTER TABLE ONLY public.platform_members_summary FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.platform_members_summary_id_seq OWNED BY public.platform_members_summary.id;

ALTER SEQUENCE public.platform_sla_config_id_seq OWNED BY public.platform_sla_config.id;

ALTER SEQUENCE public.platform_source_mapping_id_seq OWNED BY public.platform_source_mapping.id;

ALTER TABLE ONLY public.pricing_rules FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;

ALTER SEQUENCE public.publish_reversals_id_seq OWNED BY public.publish_reversals.id;

ALTER SEQUENCE public.publish_runs_id_seq OWNED BY public.publish_runs.id;

ALTER SEQUENCE public.raw_records_id_seq OWNED BY public.raw_records.id;

ALTER SEQUENCE public.reconciliation_runs_id_seq OWNED BY public.reconciliation_runs.id;

ALTER SEQUENCE public.review_actions_id_seq OWNED BY public.review_actions.id;

ALTER SEQUENCE public.role_module_grants_id_seq OWNED BY public.role_module_grants.id;

ALTER SEQUENCE public.role_platform_permissions_id_seq OWNED BY public.role_platform_permissions.id;

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

ALTER SEQUENCE public.room_health_id_seq OWNED BY public.room_health.id;

ALTER SEQUENCE public.script_library_id_seq OWNED BY public.script_library.id;

ALTER SEQUENCE public.session_anchor_metrics_id_seq OWNED BY public.session_anchor_metrics.id;

ALTER SEQUENCE public.session_channel_metrics_id_seq OWNED BY public.session_channel_metrics.id;

ALTER SEQUENCE public.session_live_basic_info_id_seq OWNED BY public.session_live_basic_info.id;

ALTER SEQUENCE public.session_overview_metrics_id_seq OWNED BY public.session_overview_metrics.id;

ALTER SEQUENCE public.session_plan_products_id_seq OWNED BY public.session_plan_products.id;

ALTER SEQUENCE public.session_plans_id_seq OWNED BY public.session_plans.id;

ALTER SEQUENCE public.session_product_details_id_seq OWNED BY public._deprecated_session_product_details.id;

ALTER SEQUENCE public.session_product_skus_id_seq OWNED BY public._deprecated_session_product_skus.id;

ALTER SEQUENCE public.session_short_video_traffic_id_seq OWNED BY public.session_short_video_traffic.id;

ALTER SEQUENCE public.session_staff_assignments_id_seq OWNED BY public.session_staff_assignments.id;

ALTER TABLE ONLY public.signal_source FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.signal_source_id_seq OWNED BY public.signal_source.id;

ALTER SEQUENCE public.staff_day_status_id_seq OWNED BY public.staff_day_status.id;

ALTER TABLE ONLY public.stg_order_import FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.stg_order_import_id_seq OWNED BY public.stg_order_import.id;

ALTER TABLE ONLY public.sys_custom_field_definition FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.sys_custom_field_definition_id_seq OWNED BY public.sys_custom_field_definition.id;

ALTER TABLE ONLY public.sys_custom_field_value FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.sys_custom_field_value_id_seq OWNED BY public.sys_custom_field_value.id;

ALTER SEQUENCE public.sys_role_id_seq OWNED BY public.sys_role.id;

ALTER SEQUENCE public.sys_role_permission_id_seq OWNED BY public.sys_role_permission.id;

ALTER SEQUENCE public.sys_user_role_id_seq OWNED BY public.sys_user_role.id;

ALTER SEQUENCE public.system_config_id_seq OWNED BY public.system_config.id;

ALTER SEQUENCE public.system_jobs_id_seq OWNED BY public.system_jobs.id;

ALTER SEQUENCE public.taobao_order_hierarchy_id_seq OWNED BY public.taobao_order_hierarchy.id;

ALTER SEQUENCE public.target_templates_id_seq OWNED BY public.target_templates.id;

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;

ALTER SEQUENCE public.upload_column_mappings_id_seq OWNED BY public.upload_column_mappings.id;

ALTER SEQUENCE public.user_module_overrides_id_seq OWNED BY public.user_module_overrides.id;

ALTER SEQUENCE public.user_platform_permissions_id_seq OWNED BY public.user_platform_permissions.id;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER SEQUENCE public.validation_runs_id_seq OWNED BY public.validation_runs.id;

ALTER SEQUENCE public.video_metrics_id_seq OWNED BY public.video_metrics.id;

ALTER SEQUENCE public.xhs_note_id_seq OWNED BY public.xhs_note.id;

ALTER TABLE ONLY public._deprecated_session_product_details ALTER COLUMN id SET DEFAULT nextval('public.session_product_details_id_seq'::regclass);

ALTER TABLE ONLY public._deprecated_session_product_skus ALTER COLUMN id SET DEFAULT nextval('public.session_product_skus_id_seq'::regclass);

ALTER TABLE ONLY public.ad_plan ALTER COLUMN id SET DEFAULT nextval('public.ad_plan_id_seq'::regclass);

ALTER TABLE ONLY public.ad_plan_receipts ALTER COLUMN id SET DEFAULT nextval('public.ad_plan_receipts_id_seq'::regclass);

ALTER TABLE ONLY public.agg_shop_daily ALTER COLUMN id SET DEFAULT nextval('public.agg_shop_daily_id_seq'::regclass);

ALTER TABLE ONLY public.agg_trade_day_platform_channel ALTER COLUMN id SET DEFAULT nextval('public.agg_trade_day_platform_channel_id_seq'::regclass);

ALTER TABLE ONLY public.agg_traffic_day_live ALTER COLUMN id SET DEFAULT nextval('public.agg_traffic_day_live_id_seq'::regclass);

ALTER TABLE ONLY public.ai_action_approvals ALTER COLUMN id SET DEFAULT nextval('public.ai_action_approvals_id_seq'::regclass);

ALTER TABLE ONLY public.ai_analysis_runs ALTER COLUMN id SET DEFAULT nextval('public.ai_analysis_runs_id_seq'::regclass);

ALTER TABLE ONLY public.ai_analysis_steps ALTER COLUMN id SET DEFAULT nextval('public.ai_analysis_steps_id_seq'::regclass);

ALTER TABLE ONLY public.ai_config ALTER COLUMN id SET DEFAULT nextval('public.ai_config_id_seq'::regclass);

ALTER TABLE ONLY public.ai_context_bindings ALTER COLUMN id SET DEFAULT nextval('public.ai_context_bindings_id_seq'::regclass);

ALTER TABLE ONLY public.ai_conversations ALTER COLUMN id SET DEFAULT nextval('public.ai_conversations_id_seq'::regclass);

ALTER TABLE ONLY public.ai_eval_case ALTER COLUMN id SET DEFAULT nextval('public.ai_eval_case_id_seq'::regclass);

ALTER TABLE ONLY public.ai_eval_run ALTER COLUMN id SET DEFAULT nextval('public.ai_eval_run_id_seq'::regclass);

ALTER TABLE ONLY public.ai_messages ALTER COLUMN id SET DEFAULT nextval('public.ai_messages_id_seq'::regclass);

ALTER TABLE ONLY public.ai_tool_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_tool_logs_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_claim ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_claim_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_evidence ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_evidence_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_llm_call ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_llm_call_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_step ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_step_id_seq'::regclass);

ALTER TABLE ONLY public.alert_events ALTER COLUMN id SET DEFAULT nextval('public.alert_events_id_seq'::regclass);

ALTER TABLE ONLY public.alert_rules ALTER COLUMN id SET DEFAULT nextval('public.alert_rules_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_capabilities ALTER COLUMN id SET DEFAULT nextval('public.anchor_capabilities_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_script_templates ALTER COLUMN id SET DEFAULT nextval('public.anchor_script_templates_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_training_plans ALTER COLUMN id SET DEFAULT nextval('public.anchor_training_plans_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_training_records ALTER COLUMN id SET DEFAULT nextval('public.anchor_training_records_id_seq'::regclass);

ALTER TABLE ONLY public.anchors ALTER COLUMN id SET DEFAULT nextval('public.anchors_id_seq'::regclass);

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.campaign_plan ALTER COLUMN id SET DEFAULT nextval('public.campaign_plan_id_seq'::regclass);

ALTER TABLE ONLY public.campaign_plan_template ALTER COLUMN id SET DEFAULT nextval('public.campaign_plan_template_id_seq'::regclass);

ALTER TABLE ONLY public.canonical_order_items ALTER COLUMN id SET DEFAULT nextval('public.canonical_order_items_id_seq'::regclass);

ALTER TABLE ONLY public.canonical_orders ALTER COLUMN id SET DEFAULT nextval('public.canonical_orders_id_seq'::regclass);

ALTER TABLE ONLY public.canonical_refund_events ALTER COLUMN id SET DEFAULT nextval('public.canonical_refund_events_id_seq'::regclass);

ALTER TABLE ONLY public.clean_records ALTER COLUMN id SET DEFAULT nextval('public.clean_records_id_seq'::regclass);

ALTER TABLE ONLY public.clean_rule_sets ALTER COLUMN id SET DEFAULT nextval('public.clean_rule_sets_id_seq'::regclass);

ALTER TABLE ONLY public.cleaning_runs ALTER COLUMN id SET DEFAULT nextval('public.cleaning_runs_id_seq'::regclass);

ALTER TABLE ONLY public.competitor_brands ALTER COLUMN id SET DEFAULT nextval('public.competitor_brands_id_seq'::regclass);

ALTER TABLE ONLY public.competitor_price_data ALTER COLUMN id SET DEFAULT nextval('public.competitor_price_data_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_activity_reminder ALTER COLUMN id SET DEFAULT nextval('public.compliance_activity_reminder_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_events ALTER COLUMN id SET DEFAULT nextval('public.compliance_events_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_risk_assessment ALTER COLUMN id SET DEFAULT nextval('public.compliance_risk_assessment_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_rule_change ALTER COLUMN id SET DEFAULT nextval('public.compliance_rule_change_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_rule_snapshot ALTER COLUMN id SET DEFAULT nextval('public.compliance_rule_snapshot_id_seq'::regclass);

ALTER TABLE ONLY public.content_assets ALTER COLUMN id SET DEFAULT nextval('public.content_assets_id_seq'::regclass);

ALTER TABLE ONLY public.content_attribution_ledger ALTER COLUMN id SET DEFAULT nextval('public.content_attribution_ledger_id_seq'::regclass);

ALTER TABLE ONLY public.content_projects ALTER COLUMN id SET DEFAULT nextval('public.content_projects_id_seq'::regclass);

ALTER TABLE ONLY public.content_providers ALTER COLUMN id SET DEFAULT nextval('public.content_providers_id_seq'::regclass);

ALTER TABLE ONLY public.content_schedules ALTER COLUMN id SET DEFAULT nextval('public.content_schedules_id_seq'::regclass);

ALTER TABLE ONLY public.content_tasks ALTER COLUMN id SET DEFAULT nextval('public.content_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.data_exports ALTER COLUMN id SET DEFAULT nextval('public.data_exports_id_seq'::regclass);

ALTER TABLE ONLY public.data_quality_issues ALTER COLUMN id SET DEFAULT nextval('public.data_quality_issues_id_seq'::regclass);

ALTER TABLE ONLY public.data_uploads ALTER COLUMN id SET DEFAULT nextval('public.data_uploads_id_seq'::regclass);

ALTER TABLE ONLY public.dict_items ALTER COLUMN id SET DEFAULT nextval('public.dict_items_id_seq'::regclass);

ALTER TABLE ONLY public.dim_brand ALTER COLUMN id SET DEFAULT nextval('public.dim_brand_id_seq'::regclass);

ALTER TABLE ONLY public.dim_cs_agent ALTER COLUMN id SET DEFAULT nextval('public.dim_cs_agent_id_seq'::regclass);

ALTER TABLE ONLY public.dim_dept ALTER COLUMN id SET DEFAULT nextval('public.dim_dept_id_seq'::regclass);

ALTER TABLE ONLY public.dim_kol ALTER COLUMN id SET DEFAULT nextval('public.dim_kol_id_seq'::regclass);

ALTER TABLE ONLY public.dim_product ALTER COLUMN id SET DEFAULT nextval('public.dim_product_id_seq'::regclass);

ALTER TABLE ONLY public.dim_product_channel_listing ALTER COLUMN id SET DEFAULT nextval('public.dim_product_channel_listing_id_seq'::regclass);

ALTER TABLE ONLY public.dim_shop ALTER COLUMN id SET DEFAULT nextval('public.dim_shop_id_seq'::regclass);

ALTER TABLE ONLY public.dim_sku_mapping ALTER COLUMN id SET DEFAULT nextval('public.dim_sku_mapping_id_seq'::regclass);

ALTER TABLE ONLY public.dim_team ALTER COLUMN id SET DEFAULT nextval('public.dim_team_id_seq'::regclass);

ALTER TABLE ONLY public.douyin_anchor_daily_metrics ALTER COLUMN id SET DEFAULT nextval('public.douyin_anchor_daily_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.douyin_channel_daily_metrics ALTER COLUMN id SET DEFAULT nextval('public.douyin_channel_daily_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.dq_quarantine ALTER COLUMN id SET DEFAULT nextval('public.dq_quarantine_id_seq'::regclass);

ALTER TABLE ONLY public.entity_aliases ALTER COLUMN id SET DEFAULT nextval('public.entity_aliases_id_seq'::regclass);

ALTER TABLE ONLY public.fact_ad_spend_daily ALTER COLUMN id SET DEFAULT nextval('public.fact_ad_spend_daily_id_seq'::regclass);

ALTER TABLE ONLY public.fact_after_sale_tickets ALTER COLUMN id SET DEFAULT nextval('public.fact_after_sale_tickets_id_seq'::regclass);

ALTER TABLE ONLY public.fact_content_daily ALTER COLUMN id SET DEFAULT nextval('public.fact_content_daily_id_seq'::regclass);

ALTER TABLE ONLY public.fact_cs_session ALTER COLUMN id SET DEFAULT nextval('public.fact_cs_session_id_seq'::regclass);

ALTER TABLE ONLY public.fact_fulfillment_waybill ALTER COLUMN id SET DEFAULT nextval('public.fact_fulfillment_waybill_id_seq'::regclass);

ALTER TABLE ONLY public.fact_gl_entry ALTER COLUMN id SET DEFAULT nextval('public.fact_gl_entry_id_seq'::regclass);

ALTER TABLE ONLY public.fact_gl_voucher ALTER COLUMN id SET DEFAULT nextval('public.fact_gl_voucher_id_seq'::regclass);

ALTER TABLE ONLY public.fact_inventory_ledger ALTER COLUMN id SET DEFAULT nextval('public.fact_inventory_ledger_id_seq'::regclass);

ALTER TABLE ONLY public.fact_inventory_reservation ALTER COLUMN id SET DEFAULT nextval('public.fact_inventory_reservation_id_seq'::regclass);

ALTER TABLE ONLY public.fact_inventory_stock ALTER COLUMN id SET DEFAULT nextval('public.fact_inventory_stock_id_seq'::regclass);

ALTER TABLE ONLY public.fact_kol_cooperation ALTER COLUMN id SET DEFAULT nextval('public.fact_kol_cooperation_id_seq'::regclass);

ALTER TABLE ONLY public.fact_order_event_stream ALTER COLUMN id SET DEFAULT nextval('public.fact_order_event_stream_id_seq'::regclass);

ALTER TABLE ONLY public.fact_order_rma_item ALTER COLUMN id SET DEFAULT nextval('public.fact_order_rma_item_id_seq'::regclass);

ALTER TABLE ONLY public.fact_search_keyword_daily ALTER COLUMN id SET DEFAULT nextval('public.fact_search_keyword_daily_id_seq'::regclass);

ALTER TABLE ONLY public.fact_selection_item ALTER COLUMN id SET DEFAULT nextval('public.fact_selection_item_id_seq'::regclass);

ALTER TABLE ONLY public.fact_selection_recommendation ALTER COLUMN id SET DEFAULT nextval('public.fact_selection_recommendation_id_seq'::regclass);

ALTER TABLE ONLY public.fact_settlement_cycles ALTER COLUMN id SET DEFAULT nextval('public.fact_settlement_cycles_id_seq'::regclass);

ALTER TABLE ONLY public.fact_trade_daily ALTER COLUMN id SET DEFAULT nextval('public.fact_trade_daily_id_seq'::regclass);

ALTER TABLE ONLY public.fact_traffic_daily ALTER COLUMN id SET DEFAULT nextval('public.fact_traffic_daily_id_seq'::regclass);

ALTER TABLE ONLY public.field_mapping_rules ALTER COLUMN id SET DEFAULT nextval('public.field_mapping_rules_id_seq'::regclass);

ALTER TABLE ONLY public.goal_tracking ALTER COLUMN id SET DEFAULT nextval('public.goal_tracking_id_seq'::regclass);

ALTER TABLE ONLY public.import_batches ALTER COLUMN id SET DEFAULT nextval('public.import_batches_id_seq'::regclass);

ALTER TABLE ONLY public.import_files ALTER COLUMN id SET DEFAULT nextval('public.import_files_id_seq'::regclass);

ALTER TABLE ONLY public.improvement_tasks ALTER COLUMN id SET DEFAULT nextval('public.improvement_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.ingest_sync_jobs ALTER COLUMN id SET DEFAULT nextval('public.ingest_sync_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.issue_library ALTER COLUMN id SET DEFAULT nextval('public.issue_library_id_seq'::regclass);

ALTER TABLE ONLY public.kuaishou_fans_ops ALTER COLUMN id SET DEFAULT nextval('public.kuaishou_fans_ops_id_seq'::regclass);

ALTER TABLE ONLY public.land_raw_dedup ALTER COLUMN id SET DEFAULT nextval('public.land_raw_dedup_id_seq'::regclass);

ALTER TABLE ONLY public.live_registrations ALTER COLUMN id SET DEFAULT nextval('public.live_registrations_id_seq'::regclass);

ALTER TABLE ONLY public.live_rooms ALTER COLUMN id SET DEFAULT nextval('public.live_rooms_id_seq'::regclass);

ALTER TABLE ONLY public.live_sessions ALTER COLUMN id SET DEFAULT nextval('public.live_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.metric_definition ALTER COLUMN id SET DEFAULT nextval('public.metric_definition_id_seq'::regclass);

ALTER TABLE ONLY public.multi_room_status ALTER COLUMN id SET DEFAULT nextval('public.multi_room_status_id_seq'::regclass);

ALTER TABLE ONLY public.operators ALTER COLUMN id SET DEFAULT nextval('public.operators_id_seq'::regclass);

ALTER TABLE ONLY public.order_status_config ALTER COLUMN id SET DEFAULT nextval('public.order_status_config_id_seq'::regclass);

ALTER TABLE ONLY public.overview_activities ALTER COLUMN id SET DEFAULT nextval('public.overview_activities_id_seq'::regclass);

ALTER TABLE ONLY public.overview_daily_stats ALTER COLUMN id SET DEFAULT nextval('public.overview_daily_stats_id_seq'::regclass);

ALTER TABLE ONLY public.platform_caliber_config ALTER COLUMN id SET DEFAULT nextval('public.platform_caliber_config_id_seq'::regclass);

ALTER TABLE ONLY public.platform_capability_matrix ALTER COLUMN id SET DEFAULT nextval('public.platform_capability_matrix_id_seq'::regclass);

ALTER TABLE ONLY public.platform_members_summary ALTER COLUMN id SET DEFAULT nextval('public.platform_members_summary_id_seq'::regclass);

ALTER TABLE ONLY public.platform_sla_config ALTER COLUMN id SET DEFAULT nextval('public.platform_sla_config_id_seq'::regclass);

ALTER TABLE ONLY public.platform_source_mapping ALTER COLUMN id SET DEFAULT nextval('public.platform_source_mapping_id_seq'::regclass);

ALTER TABLE ONLY public.pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.pricing_rules_id_seq'::regclass);

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);

ALTER TABLE ONLY public.publish_reversals ALTER COLUMN id SET DEFAULT nextval('public.publish_reversals_id_seq'::regclass);

ALTER TABLE ONLY public.publish_runs ALTER COLUMN id SET DEFAULT nextval('public.publish_runs_id_seq'::regclass);

ALTER TABLE ONLY public.raw_records ALTER COLUMN id SET DEFAULT nextval('public.raw_records_id_seq'::regclass);

ALTER TABLE ONLY public.reconciliation_runs ALTER COLUMN id SET DEFAULT nextval('public.reconciliation_runs_id_seq'::regclass);

ALTER TABLE ONLY public.review_actions ALTER COLUMN id SET DEFAULT nextval('public.review_actions_id_seq'::regclass);

ALTER TABLE ONLY public.role_module_grants ALTER COLUMN id SET DEFAULT nextval('public.role_module_grants_id_seq'::regclass);

ALTER TABLE ONLY public.role_platform_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_platform_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

ALTER TABLE ONLY public.room_health ALTER COLUMN id SET DEFAULT nextval('public.room_health_id_seq'::regclass);

ALTER TABLE ONLY public.script_library ALTER COLUMN id SET DEFAULT nextval('public.script_library_id_seq'::regclass);

ALTER TABLE ONLY public.session_anchor_metrics ALTER COLUMN id SET DEFAULT nextval('public.session_anchor_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.session_channel_metrics ALTER COLUMN id SET DEFAULT nextval('public.session_channel_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.session_live_basic_info ALTER COLUMN id SET DEFAULT nextval('public.session_live_basic_info_id_seq'::regclass);

ALTER TABLE ONLY public.session_overview_metrics ALTER COLUMN id SET DEFAULT nextval('public.session_overview_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.session_plan_products ALTER COLUMN id SET DEFAULT nextval('public.session_plan_products_id_seq'::regclass);

ALTER TABLE ONLY public.session_plans ALTER COLUMN id SET DEFAULT nextval('public.session_plans_id_seq'::regclass);

ALTER TABLE ONLY public.session_short_video_traffic ALTER COLUMN id SET DEFAULT nextval('public.session_short_video_traffic_id_seq'::regclass);

ALTER TABLE ONLY public.session_staff_assignments ALTER COLUMN id SET DEFAULT nextval('public.session_staff_assignments_id_seq'::regclass);

ALTER TABLE ONLY public.signal_source ALTER COLUMN id SET DEFAULT nextval('public.signal_source_id_seq'::regclass);

ALTER TABLE ONLY public.staff_day_status ALTER COLUMN id SET DEFAULT nextval('public.staff_day_status_id_seq'::regclass);

ALTER TABLE ONLY public.stg_order_import ALTER COLUMN id SET DEFAULT nextval('public.stg_order_import_id_seq'::regclass);

ALTER TABLE ONLY public.sys_custom_field_definition ALTER COLUMN id SET DEFAULT nextval('public.sys_custom_field_definition_id_seq'::regclass);

ALTER TABLE ONLY public.sys_custom_field_value ALTER COLUMN id SET DEFAULT nextval('public.sys_custom_field_value_id_seq'::regclass);

ALTER TABLE ONLY public.sys_role ALTER COLUMN id SET DEFAULT nextval('public.sys_role_id_seq'::regclass);

ALTER TABLE ONLY public.sys_role_permission ALTER COLUMN id SET DEFAULT nextval('public.sys_role_permission_id_seq'::regclass);

ALTER TABLE ONLY public.sys_user_role ALTER COLUMN id SET DEFAULT nextval('public.sys_user_role_id_seq'::regclass);

ALTER TABLE ONLY public.system_config ALTER COLUMN id SET DEFAULT nextval('public.system_config_id_seq'::regclass);

ALTER TABLE ONLY public.system_jobs ALTER COLUMN id SET DEFAULT nextval('public.system_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.taobao_order_hierarchy ALTER COLUMN id SET DEFAULT nextval('public.taobao_order_hierarchy_id_seq'::regclass);

ALTER TABLE ONLY public.target_templates ALTER COLUMN id SET DEFAULT nextval('public.target_templates_id_seq'::regclass);

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);

ALTER TABLE ONLY public.upload_column_mappings ALTER COLUMN id SET DEFAULT nextval('public.upload_column_mappings_id_seq'::regclass);

ALTER TABLE ONLY public.user_module_overrides ALTER COLUMN id SET DEFAULT nextval('public.user_module_overrides_id_seq'::regclass);

ALTER TABLE ONLY public.user_platform_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_platform_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.validation_runs ALTER COLUMN id SET DEFAULT nextval('public.validation_runs_id_seq'::regclass);

ALTER TABLE ONLY public.video_metrics ALTER COLUMN id SET DEFAULT nextval('public.video_metrics_id_seq'::regclass);

ALTER TABLE ONLY public.xhs_note ALTER COLUMN id SET DEFAULT nextval('public.xhs_note_id_seq'::regclass);

ALTER TABLE public.canonical_orders
    ADD CONSTRAINT canonical_orders_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id);

ALTER TABLE public.canonical_orders
    ADD CONSTRAINT canonical_orders_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE public.canonical_orders
    ADD CONSTRAINT canonical_orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.dim_shop(id);

ALTER TABLE public.canonical_refund_events
    ADD CONSTRAINT canonical_refund_events_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id);

ALTER TABLE public.canonical_refund_events
    ADD CONSTRAINT canonical_refund_events_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE public.canonical_refund_events
    ADD CONSTRAINT canonical_refund_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.dim_shop(id);

ALTER TABLE public.fact_trade_daily
    ADD CONSTRAINT fact_trade_daily_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE public.fact_trade_daily
    ADD CONSTRAINT fact_trade_daily_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id);

ALTER TABLE public.fact_trade_daily
    ADD CONSTRAINT fact_trade_daily_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE public.fact_traffic_daily
    ADD CONSTRAINT fact_traffic_daily_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE public.fact_traffic_daily
    ADD CONSTRAINT fact_traffic_daily_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id);

ALTER TABLE public.fact_traffic_daily
    ADD CONSTRAINT fact_traffic_daily_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

ALTER TABLE public.ad_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_plan_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agg_shop_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agg_trade_day_platform_channel ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agg_traffic_day_live ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_eval_case ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_eval_run ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_claim ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_evidence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_llm_call ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_run ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_step ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_capabilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_plan_template ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_activity_reminder ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_risk_assessment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_rule_change ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_rule_snapshot ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_attribution_ledger ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_accounting_subject ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_category ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_product_channel_listing ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_shop ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dq_quarantine ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_ad_spend_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_after_sale_tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_cs_session ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_fulfillment_waybill ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_gl_entry ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_gl_voucher ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_inventory_reservation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_kol_cooperation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_order_event_stream ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_order_rma_item ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_search_keyword_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_selection_item ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_selection_recommendation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_settlement_cycles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.land_raw_dedup ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_members_summary ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.signal_source ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stg_order_import ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_custom_field_definition ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_custom_field_value ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_role_permission ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_user_role ENABLE ROW LEVEL SECURITY;

-- ===== policy (108) =====
CREATE POLICY p_activity_reminder_select ON public.compliance_activity_reminder FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_activity_reminder_write ON public.compliance_activity_reminder TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))));

CREATE POLICY p_ad_plan_receipts_select ON public.ad_plan_receipts FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.ad_plan p
  WHERE ((p.id = ad_plan_receipts.plan_id) AND public.rls_can_access_shop(p.shop_id)))) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost()))));

CREATE POLICY p_ad_plan_receipts_write ON public.ad_plan_receipts USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text]))));

CREATE POLICY p_ad_plan_select ON public.ad_plan FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost()))));

CREATE POLICY p_ad_plan_write ON public.ad_plan USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text]))));

CREATE POLICY p_agg_platform_channel_select ON public.agg_trade_day_platform_channel FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_agg_platform_channel_write ON public.agg_trade_day_platform_channel TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_agg_shop_daily_select ON public.agg_shop_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_agg_shop_daily_write ON public.agg_shop_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_agg_traffic_live_select ON public.agg_traffic_day_live FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_agg_traffic_live_write ON public.agg_traffic_day_live TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_ai_eval_case_read ON public.ai_eval_case USING (true) WITH CHECK (true);

CREATE POLICY p_ai_eval_run_read ON public.ai_eval_run USING (true) WITH CHECK (true);

CREATE POLICY p_ai_v2_claim_tenant ON public.ai_v2_claim USING (true) WITH CHECK (true);

CREATE POLICY p_ai_v2_evidence_tenant ON public.ai_v2_evidence USING (true) WITH CHECK (true);

CREATE POLICY p_ai_v2_llm_tenant ON public.ai_v2_llm_call USING (true) WITH CHECK (true);

CREATE POLICY p_ai_v2_run_tenant ON public.ai_v2_run USING (((tenant_id IS NULL) OR (tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::integer) OR (current_setting('app.current_user_role'::text, true) = ANY (ARRAY['admin'::text, 'superadmin'::text, 'auditor'::text])))) WITH CHECK (((tenant_id IS NULL) OR (tenant_id = (NULLIF(current_setting('app.current_tenant_id'::text, true), ''::text))::integer) OR (current_setting('app.current_user_role'::text, true) = ANY (ARRAY['admin'::text, 'superadmin'::text]))));

CREATE POLICY p_ai_v2_step_tenant ON public.ai_v2_step USING (true) WITH CHECK (true);

CREATE POLICY p_anchor_capabilities_select ON public.anchor_capabilities FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((public.rls_is_agency_staff() AND ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'hrbp'::text])) OR ((public.rls_role() = ANY (ARRAY['employee'::text, 'controller'::text])) AND (anchor_id = public.rls_anchor_id())))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_anchors() AND (EXISTS ( SELECT 1
   FROM public.live_sessions ls
  WHERE ((ls.anchor_id = anchor_capabilities.anchor_id) AND public.rls_has_project(ls.project_id))))))));

CREATE POLICY p_anchor_capabilities_write ON public.anchor_capabilities USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'hrbp'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'hrbp'::text]))));

CREATE POLICY p_audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_audit_logs_select ON public.audit_logs FOR SELECT USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))));

CREATE POLICY p_campaign_plan_select ON public.campaign_plan FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR ((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff()))));

CREATE POLICY p_campaign_plan_template_select ON public.campaign_plan_template FOR SELECT TO leyova_app USING (true);

CREATE POLICY p_campaign_plan_write ON public.campaign_plan TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'operator'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'operator'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_compliance_events_select ON public.compliance_events FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_compliance_events_write ON public.compliance_events TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_content_attribution_ledger_select ON public.content_attribution_ledger FOR SELECT TO leyova_app USING (public.rls_can_access_shop(shop_id));

CREATE POLICY p_content_attribution_ledger_write ON public.content_attribution_ledger TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_content_schedules_select ON public.content_schedules FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_schedules_write ON public.content_schedules TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_custom_field_def_select ON public.sys_custom_field_definition FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_custom_field_def_write ON public.sys_custom_field_definition TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))));

CREATE POLICY p_custom_field_val_select ON public.sys_custom_field_value FOR SELECT TO leyova_app USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_custom_field_val_write ON public.sys_custom_field_value TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'ad_buyer'::text]))));

CREATE POLICY p_dim_accounting_subject_select ON public.dim_accounting_subject FOR SELECT TO leyova_app USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dim_accounting_subject_write ON public.dim_accounting_subject TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))));

CREATE POLICY p_dim_category_select ON public.dim_category FOR SELECT TO leyova_app USING (true);

CREATE POLICY p_dim_product_channel_listing_select ON public.dim_product_channel_listing FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_dim_product_channel_listing_write ON public.dim_product_channel_listing USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_dim_shop_select ON public.dim_shop FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND (((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff()) OR (tenant_id = public.rls_tenant_id()))));

CREATE POLICY p_dim_shop_write ON public.dim_shop USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text])) AND ((public.rls_role() = 'super_admin'::text) OR (tenant_id = public.rls_tenant_id())))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text])) AND ((public.rls_role() = 'super_admin'::text) OR (tenant_id = public.rls_tenant_id()))));

CREATE POLICY p_dq_quarantine_select ON public.dq_quarantine FOR SELECT TO leyova_app USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dq_quarantine_write ON public.dq_quarantine TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))));

CREATE POLICY p_fact_ad_spend_daily_select ON public.fact_ad_spend_daily FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost()))));

CREATE POLICY p_fact_ad_spend_daily_write ON public.fact_ad_spend_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text]))));

CREATE POLICY p_fact_after_sale_tickets_select ON public.fact_after_sale_tickets FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_after_sale_tickets_write ON public.fact_after_sale_tickets USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_cs_session_select ON public.fact_cs_session FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_cs_session_write ON public.fact_cs_session USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_fulfillment_waybill_select ON public.fact_fulfillment_waybill FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_fulfillment_waybill_write ON public.fact_fulfillment_waybill USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_inventory_reservation_select ON public.fact_inventory_reservation FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_inventory_reservation_write ON public.fact_inventory_reservation USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_kol_cooperation_select ON public.fact_kol_cooperation FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_kol_cooperation_write ON public.fact_kol_cooperation USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_search_keyword_daily_select ON public.fact_search_keyword_daily FOR SELECT TO leyova_app USING (public.rls_can_access_shop(shop_id));

CREATE POLICY p_fact_search_keyword_daily_write ON public.fact_search_keyword_daily TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_fact_settlement_cycles_select ON public.fact_settlement_cycles FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost()))));

CREATE POLICY p_fact_settlement_cycles_write ON public.fact_settlement_cycles USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text]))));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_gl_entry_select ON public.fact_gl_entry FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_gl_entry_write ON public.fact_gl_entry TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_gl_voucher_select ON public.fact_gl_voucher FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_gl_voucher_write ON public.fact_gl_voucher TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ad_buyer'::text, 'operator'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_land_dedup_select ON public.land_raw_dedup FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text)));

CREATE POLICY p_land_dedup_write ON public.land_raw_dedup TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))));

CREATE POLICY p_live_sessions_select ON public.live_sessions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND (((public.rls_user_type() = 'brand_viewer'::text) AND (project_id IS NOT NULL) AND public.rls_has_project(project_id)) OR (public.rls_is_agency_staff() AND ((public.rls_role() <> 'employee'::text) OR (anchor_id = public.rls_anchor_id()) OR ((public.rls_anchor_id() IS NULL) AND (operator_id = public.rls_user_id())))))));

CREATE POLICY p_live_sessions_write ON public.live_sessions USING ((public.rls_is_agency_staff() AND ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'controller'::text])) OR ((public.rls_role() = 'employee'::text) AND ((anchor_id = public.rls_anchor_id()) OR ((public.rls_anchor_id() IS NULL) AND (operator_id = public.rls_user_id()))))))) WITH CHECK ((public.rls_is_agency_staff() AND ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'controller'::text])) OR ((public.rls_role() = 'employee'::text) AND ((anchor_id = public.rls_anchor_id()) OR ((public.rls_anchor_id() IS NULL) AND (operator_id = public.rls_user_id())))))));

CREATE POLICY p_order_event_stream_select ON public.fact_order_event_stream FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_event_stream_write ON public.fact_order_event_stream TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_rma_item_select ON public.fact_order_rma_item FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_rma_item_write ON public.fact_order_rma_item TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_platform_members_summary_select ON public.platform_members_summary FOR SELECT TO leyova_app USING (public.rls_can_access_shop(shop_id));

CREATE POLICY p_platform_members_summary_write ON public.platform_members_summary TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_pricing_rules_select ON public.pricing_rules FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_pricing_rules_write ON public.pricing_rules USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'operator'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'operator'::text, 'ad_buyer'::text]))));

CREATE POLICY p_risk_assessment_select ON public.compliance_risk_assessment FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.compliance_rule_change c
  WHERE ((c.id = compliance_risk_assessment.change_id) AND public.rls_has_platform((c.platform_code)::text))))));

CREATE POLICY p_risk_assessment_write ON public.compliance_risk_assessment TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))));

CREATE POLICY p_rule_change_select ON public.compliance_rule_change FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_rule_change_write ON public.compliance_rule_change TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))));

CREATE POLICY p_rule_snapshot_select ON public.compliance_rule_snapshot FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_rule_snapshot_write ON public.compliance_rule_snapshot TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text]))));

CREATE POLICY p_selection_item_select ON public.fact_selection_item FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.fact_selection_recommendation r
  WHERE ((r.id = fact_selection_item.recommendation_id) AND ((r.shop_id IS NULL) OR public.rls_can_access_shop(r.shop_id)) AND ((r.tenant_id = public.rls_tenant_id()) OR ((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff())))))));

CREATE POLICY p_selection_item_write ON public.fact_selection_item TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))));

CREATE POLICY p_selection_rec_select ON public.fact_selection_recommendation FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR ((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff()))));

CREATE POLICY p_selection_rec_write ON public.fact_selection_recommendation TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))));

CREATE POLICY p_signal_source_select ON public.signal_source FOR SELECT TO leyova_app USING (true);

CREATE POLICY p_stg_import_select ON public.stg_order_import FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_stg_import_write ON public.stg_order_import TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text]))));

CREATE POLICY p_sys_role_modify ON public.sys_role USING ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'admin'::text)))) WITH CHECK ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'admin'::text))));

CREATE POLICY p_sys_role_perm_modify ON public.sys_role_permission USING ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'admin'::text)))) WITH CHECK ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'admin'::text))));

CREATE POLICY p_sys_role_perm_select ON public.sys_role_permission FOR SELECT USING (true);

CREATE POLICY p_sys_role_select ON public.sys_role FOR SELECT USING (true);

CREATE POLICY p_sys_user_role_modify ON public.sys_user_role USING ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'admin'::text)))) WITH CHECK ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'admin'::text))));

CREATE POLICY p_sys_user_role_select ON public.sys_user_role FOR SELECT USING (((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()));

CREATE POLICY session_plan_products_admin_all ON public.session_plan_products USING ((current_setting('app.role'::text, true) = ANY (ARRAY['super_admin'::text, 'admin'::text]))) WITH CHECK ((current_setting('app.role'::text, true) = ANY (ARRAY['super_admin'::text, 'admin'::text])));

CREATE POLICY session_plan_products_read_scope ON public.session_plan_products FOR SELECT USING ((current_setting('app.role'::text, true) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'operator'::text, 'brand_viewer'::text])));

-- ===== other (3) =====
CREATE UNLOGGED TABLE public.stg_order_import (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    row_num integer NOT NULL,
    source_platform character varying(32) NOT NULL,
    store_id bigint NOT NULL,
    source_order_id character varying(100) NOT NULL,
    source_sub_order_id character varying(100) DEFAULT ''::character varying NOT NULL,
    order_status character varying(50) NOT NULL,
    paid_amount numeric(18,2) DEFAULT 0 NOT NULL,
    order_date date NOT NULL,
    payload_hash character(64) NOT NULL,
    raw_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    quarantine_reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNLOGGED SEQUENCE public.stg_order_import_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



