--
-- leyova 数据库结构（schema-only，由迁移系统自动生成）
--
-- 生成方式：node database/generate-schema.js（pg_dump --schema-only --no-owner --no-privileges）
-- 基    准：全部迁移应用后的数据库真实状态
-- 生成日期：2026-11-28
-- 兼容版本：PostgreSQL 14+
--
-- 已移除：SET 配置指令、pg_dump 元数据注释、对象 OWNER / PRIVILEGE 声明
--
-- ⚠️ 本文件由 database/generate-schema.js 自动生成，请勿手改；
--    如需修改结构，请新增迁移文件，然后重新生成本文件。
--
-- 关闭函数体校验：函数体引用的辅助函数可能在后续语句中才创建
SET check_function_bodies = false;

-- 确保非超管 RLS 应用角色 leyova_app 在全新 PostgreSQL 集群中预先存在（策略 CREATE POLICY ... TO leyova_app 依赖该角色）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'leyova_app') THEN
    CREATE ROLE leyova_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
  END IF;
  IF current_user <> 'leyova_app' THEN
    BEGIN
      EXECUTE format('GRANT leyova_app TO %I', current_user);
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END IF;
END
$$;

-- ===== extension (2) =====
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ===== sequence (171) =====
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

CREATE SEQUENCE public.agent_configs_id_seq
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

CREATE SEQUENCE public.ai_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_model_profile_id_seq
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

CREATE SEQUENCE public.ai_tool_policy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.ai_v2_citation_id_seq
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

CREATE SEQUENCE public.ai_v2_event_id_seq
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

CREATE SEQUENCE public.anchor_competency_profiles_id_seq
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

CREATE SEQUENCE public.anchors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.assistant_memory_audit_id_seq
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

CREATE SEQUENCE public.biz_targets_id_seq
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

CREATE SEQUENCE public.compliance_learning_tasks_id_seq
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

CREATE SEQUENCE public.compliance_script_check_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.compliance_sensitive_replacements_id_seq
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

CREATE SEQUENCE public.decision_case_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.decision_cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.decision_data_gates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.decision_evidence_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.decision_memo_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.decision_metric_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.decision_reviews_id_seq
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

CREATE SEQUENCE public.dim_product_cost_versions_id_seq
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

CREATE SEQUENCE public.fact_jd_settlement_fees_id_seq
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

CREATE SEQUENCE public.hrbp_auditions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.hrbp_candidates_id_seq
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

CREATE SEQUENCE public.integration_call_logs_id_seq
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

CREATE SEQUENCE public.jd_purchase_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.kb_banned_words_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE public.kb_feedback_id_seq
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

CREATE SEQUENCE public.pdd_group_buy_id_seq
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

CREATE SEQUENCE public.promotion_rules_id_seq
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

CREATE UNLOGGED SEQUENCE public.stg_order_import_id_seq
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

CREATE SEQUENCE public.sys_deprecation_access_logs_id_seq
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

CREATE SEQUENCE public.system_module_parameters_id_seq
    AS integer
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

CREATE SEQUENCE public.tenant_subscriptions_id_seq
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

-- ===== table (306) =====
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

CREATE TABLE public._deprecated_fact_jd_settlement_fees (
    id bigint CONSTRAINT fact_jd_settlement_fees_id_not_null NOT NULL,
    tenant_id integer DEFAULT 1 CONSTRAINT fact_jd_settlement_fees_tenant_id_not_null NOT NULL,
    shop_id bigint CONSTRAINT fact_jd_settlement_fees_shop_id_not_null NOT NULL,
    business_mode character varying(32) CONSTRAINT fact_jd_settlement_fees_business_mode_not_null NOT NULL,
    biz_month character varying(7) CONSTRAINT fact_jd_settlement_fees_biz_month_not_null NOT NULL,
    fee_code character varying(40) CONSTRAINT fact_jd_settlement_fees_fee_code_not_null NOT NULL,
    fee_name character varying(64) CONSTRAINT fact_jd_settlement_fees_fee_name_not_null NOT NULL,
    direction character varying(16) DEFAULT 'deduct'::character varying CONSTRAINT fact_jd_settlement_fees_direction_not_null NOT NULL,
    amount numeric(14,2) DEFAULT 0 CONSTRAINT fact_jd_settlement_fees_amount_not_null NOT NULL,
    note text DEFAULT ''::text CONSTRAINT fact_jd_settlement_fees_note_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT fact_jd_settlement_fees_created_at_not_null NOT NULL,
    CONSTRAINT fact_jd_settlement_fees_business_mode_check CHECK (((business_mode)::text = ANY (ARRAY[('self_operated'::character varying)::text, ('pop_sop'::character varying)::text, ('pop_fbp'::character varying)::text]))),
    CONSTRAINT fact_jd_settlement_fees_direction_check CHECK (((direction)::text = ANY (ARRAY[('deduct'::character varying)::text, ('rebate'::character varying)::text]))),
    CONSTRAINT fact_jd_settlement_fees_fee_code_check CHECK (((fee_code)::text = ANY (ARRAY[('gross_margin_guarantee'::character varying)::text, ('rebate'::character varying)::text, ('tc_freight'::character varying)::text, ('label_fee'::character varying)::text, ('quality_deposit'::character varying)::text, ('commission'::character varying)::text])))
);

CREATE TABLE public._deprecated_jd_purchase_order (
    id bigint CONSTRAINT jd_purchase_order_id_not_null NOT NULL,
    biz_date date CONSTRAINT jd_purchase_order_biz_date_not_null NOT NULL,
    shop_id bigint CONSTRAINT jd_purchase_order_shop_id_not_null NOT NULL,
    po_number character varying(64) CONSTRAINT jd_purchase_order_po_number_not_null NOT NULL,
    sku_code character varying(64) DEFAULT ''::character varying,
    sku_name character varying(300) DEFAULT ''::character varying,
    business_mode character varying(30) DEFAULT 'self_operated'::character varying CONSTRAINT jd_purchase_order_business_mode_not_null NOT NULL,
    supply_price numeric(14,2) DEFAULT 0 CONSTRAINT jd_purchase_order_supply_price_not_null NOT NULL,
    retail_price numeric(14,2) DEFAULT 0 CONSTRAINT jd_purchase_order_retail_price_not_null NOT NULL,
    quantity integer DEFAULT 0 CONSTRAINT jd_purchase_order_quantity_not_null NOT NULL,
    settle_amount numeric(14,2) DEFAULT 0 CONSTRAINT jd_purchase_order_settle_amount_not_null NOT NULL,
    gross_margin numeric(14,2) DEFAULT 0 CONSTRAINT jd_purchase_order_gross_margin_not_null NOT NULL,
    settle_cycle_days integer,
    source character varying(20) DEFAULT 'manual'::character varying CONSTRAINT jd_purchase_order_source_not_null NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public._deprecated_pdd_group_buy (
    id bigint CONSTRAINT pdd_group_buy_id_not_null NOT NULL,
    biz_date date CONSTRAINT pdd_group_buy_biz_date_not_null NOT NULL,
    shop_id bigint CONSTRAINT pdd_group_buy_shop_id_not_null NOT NULL,
    group_id character varying(64) CONSTRAINT pdd_group_buy_group_id_not_null NOT NULL,
    product_id character varying(64),
    product_name character varying(300) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'waiting'::character varying CONSTRAINT pdd_group_buy_status_not_null NOT NULL,
    group_size_required integer DEFAULT 2 CONSTRAINT pdd_group_buy_group_size_required_not_null NOT NULL,
    group_size_actual integer DEFAULT 0 CONSTRAINT pdd_group_buy_group_size_actual_not_null NOT NULL,
    member_count integer DEFAULT 0 CONSTRAINT pdd_group_buy_member_count_not_null NOT NULL,
    pay_amount numeric(14,2) DEFAULT 0 CONSTRAINT pdd_group_buy_pay_amount_not_null NOT NULL,
    refund_amount numeric(14,2) DEFAULT 0 CONSTRAINT pdd_group_buy_refund_amount_not_null NOT NULL,
    grouped_at timestamp with time zone,
    expired_at timestamp with time zone,
    source character varying(20) DEFAULT 'manual'::character varying CONSTRAINT pdd_group_buy_source_not_null NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public._deprecated_tenant_subscriptions (
    id integer CONSTRAINT tenant_subscriptions_id_not_null NOT NULL,
    tenant_id integer CONSTRAINT tenant_subscriptions_tenant_id_not_null NOT NULL,
    plan character varying(30) CONSTRAINT tenant_subscriptions_plan_not_null NOT NULL,
    billing_cycle character varying(10) DEFAULT 'monthly'::character varying,
    unit_price numeric(10,2) DEFAULT 0.00,
    started_at date CONSTRAINT tenant_subscriptions_started_at_not_null NOT NULL,
    expires_at date,
    payment_ref character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now()
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
    CONSTRAINT ad_plan_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('approved'::character varying)::text, ('active'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
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
    CONSTRAINT ad_plan_receipts_receipt_source_check CHECK (((receipt_source)::text = ANY (ARRAY[('manual_entry'::character varying)::text, ('fact_sync'::character varying)::text, ('api_push'::character varying)::text])))
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

CREATE TABLE public.agent_configs (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    agent_key character varying(64) NOT NULL,
    name character varying(64) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    system_prompt text DEFAULT ''::text NOT NULL,
    tool_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    risk_ceiling character varying(8) DEFAULT 'R2'::character varying NOT NULL,
    output_contract jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    tenant_id integer NOT NULL,
    payload_digest character varying(64),
    public_id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt jsonb,
    decision_reason text,
    requested_risk text,
    attempts integer DEFAULT 0 NOT NULL,
    executed_by integer,
    CONSTRAINT ai_action_approvals_status_check CHECK (((status)::text = ANY (ARRAY['pending'::text, 'approved'::text, 'executing'::text, 'executed'::text, 'failed'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text])))
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

CREATE TABLE public.ai_generation_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    template_id uuid,
    template_key character varying(64) DEFAULT ''::character varying NOT NULL,
    template_version integer DEFAULT 0 NOT NULL,
    scene character varying(32) DEFAULT 'script'::character varying NOT NULL,
    platform character varying(32) DEFAULT 'all'::character varying NOT NULL,
    business_key character varying(120) DEFAULT ''::character varying NOT NULL,
    title character varying(255) DEFAULT ''::character varying NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb NOT NULL,
    compliance jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'pending_review'::character varying NOT NULL,
    review_note character varying(500) DEFAULT ''::character varying NOT NULL,
    reviewed_by bigint,
    reviewed_at timestamp with time zone,
    final_script_id integer,
    model character varying(120) DEFAULT ''::character varying NOT NULL,
    tokens_used integer DEFAULT 0 NOT NULL,
    cost_cny numeric(12,6) DEFAULT 0 NOT NULL,
    latency_ms integer DEFAULT 0 NOT NULL,
    degraded boolean DEFAULT false NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_generation_scene CHECK (((scene)::text = ANY (ARRAY[('script'::character varying)::text, ('copy'::character varying)::text, ('title'::character varying)::text, ('reply'::character varying)::text, ('analysis'::character varying)::text]))),
    CONSTRAINT ck_generation_status CHECK (((status)::text = ANY (ARRAY[('pending_review'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('blocked'::character varying)::text])))
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

CREATE TABLE public.ai_model_profile (
    id integer NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    profile_key text NOT NULL,
    name text NOT NULL,
    protocol text DEFAULT 'openai'::text NOT NULL,
    api_base text NOT NULL,
    api_key_enc text DEFAULT ''::text,
    model text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    timeout_ms integer DEFAULT 60000 NOT NULL,
    max_output_tokens integer DEFAULT 2000 NOT NULL,
    requests_per_minute integer DEFAULT 60 NOT NULL,
    is_fallback boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_model_profile_protocol_check CHECK ((protocol = ANY (ARRAY['openai'::text, 'anthropic'::text])))
);

CREATE TABLE public.ai_model_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    profile text DEFAULT 'fast-chat'::text NOT NULL,
    provider text NOT NULL,
    base_url text NOT NULL,
    model_name text NOT NULL,
    api_key_enc text,
    enabled boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    last_test_ok boolean,
    last_tested_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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

CREATE TABLE public.ai_tool_policy (
    id integer NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    tool_name text NOT NULL,
    risk_tier text DEFAULT 'R2'::text NOT NULL,
    effect text DEFAULT 'inherit'::text NOT NULL,
    required_permission text,
    max_calls_per_run integer,
    note text DEFAULT ''::text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_tool_policy_effect_check CHECK ((effect = ANY (ARRAY['inherit'::text, 'allow'::text, 'require_approval'::text, 'deny'::text]))),
    CONSTRAINT ai_tool_policy_risk_tier_check CHECK ((risk_tier = ANY (ARRAY['R0'::text, 'R1'::text, 'R2'::text, 'R3'::text, 'R4'::text])))
);

CREATE TABLE public.ai_v2_citation (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    seq integer NOT NULL,
    chunk_id character varying(128) DEFAULT ''::character varying NOT NULL,
    document_id character varying(128) DEFAULT ''::character varying NOT NULL,
    document_name character varying(255) DEFAULT ''::character varying NOT NULL,
    snippet text DEFAULT ''::text NOT NULL,
    score numeric(6,4) DEFAULT 0 NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    local_chunk_id uuid,
    collection_id uuid,
    doc_version integer,
    page_no integer,
    start_ms integer
);

CREATE TABLE public.ai_v2_claim (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    seq integer DEFAULT 1 NOT NULL,
    headline text,
    text text NOT NULL,
    evidence_ids text[] DEFAULT '{}'::text[] NOT NULL,
    kind character varying(32) DEFAULT 'fact'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer NOT NULL
);

CREATE TABLE public.ai_v2_event (
    id bigint NOT NULL,
    run_id character varying(64) NOT NULL,
    seq integer NOT NULL,
    type character varying(48) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer NOT NULL
);

CREATE TABLE public.ai_v2_llm_call (
    id bigint NOT NULL,
    run_id character varying(64),
    step_seq integer DEFAULT 1 NOT NULL,
    operation_name character varying(64) NOT NULL,
    request_model character varying(64) NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cost_cny numeric(10,6) DEFAULT 0 NOT NULL,
    latency_ms integer DEFAULT 0 NOT NULL,
    finish_reason character varying(32) DEFAULT 'stop'::character varying NOT NULL,
    error_code character varying(32),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    conversation_id character varying(64),
    provider character varying(32) DEFAULT 'openai-compatible'::character varying NOT NULL,
    status character varying(16) DEFAULT 'success'::character varying NOT NULL,
    error text,
    prompt_chars integer DEFAULT 0 NOT NULL,
    completion_chars integer DEFAULT 0 NOT NULL,
    profile_key text,
    is_fallback boolean DEFAULT false NOT NULL
);

CREATE TABLE public.ai_v2_run (
    id character varying(64) NOT NULL,
    tenant_id integer NOT NULL,
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id integer,
    agent_key character varying(64) DEFAULT 'business_analyst'::character varying NOT NULL,
    trigger_type character varying(32) DEFAULT 'chat'::character varying NOT NULL,
    idempotency_key character varying(160),
    cursor integer DEFAULT 0 NOT NULL,
    checkpoint jsonb DEFAULT '{}'::jsonb NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    error text,
    cancel_requested boolean DEFAULT false NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    token_budget integer DEFAULT 60000 NOT NULL,
    tokens_used integer DEFAULT 0 NOT NULL,
    fallback_used boolean DEFAULT false NOT NULL
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer NOT NULL
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
    ack_status text DEFAULT 'pending'::text NOT NULL,
    ack_by integer,
    ack_at timestamp with time zone,
    ack_note text,
    CONSTRAINT alert_events_ack_status_check CHECK ((ack_status = ANY (ARRAY['pending'::text, 'acknowledged'::text, 'false_positive'::text]))),
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

CREATE TABLE public.anchor_competency_profiles (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    anchor_name text NOT NULL,
    suitable_categories text[] DEFAULT '{}'::text[] NOT NULL,
    style_tags text[] DEFAULT '{}'::text[] NOT NULL,
    hourly_rate numeric(12,2) DEFAULT 0,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anchor_competency_profiles_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
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

CREATE TABLE public.assistant_memory_audit (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    memory_id uuid,
    action text NOT NULL,
    actor_user_id integer,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.assistant_memory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer NOT NULL,
    scope text NOT NULL,
    owner_user_id integer,
    role_key text,
    memory_key text NOT NULL,
    content text NOT NULL,
    confidence numeric(3,2) DEFAULT 0.70 NOT NULL,
    sensitivity text DEFAULT 'normal'::text NOT NULL,
    source_type text NOT NULL,
    source_id text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_to timestamp with time zone,
    supersedes_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    retention_class text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assistant_memory_items_scope_check CHECK ((scope = ANY (ARRAY['session'::text, 'personal'::text, 'role'::text, 'org'::text]))),
    CONSTRAINT assistant_memory_items_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'superseded'::text, 'deleted'::text])))
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

CREATE TABLE public.bgm_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    code character varying(60) NOT NULL,
    title character varying(160) NOT NULL,
    file_path text DEFAULT ''::text NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    mood character varying(40) DEFAULT 'upbeat'::character varying NOT NULL,
    bpm integer DEFAULT 0 NOT NULL,
    loudness numeric(5,2) DEFAULT '-14.00'::numeric NOT NULL,
    license character varying(80) DEFAULT ''::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.biz_targets (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    period_type text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    scope_type text NOT NULL,
    scope_id bigint,
    metric_code text NOT NULL,
    target_value numeric(18,2) NOT NULL,
    currency text DEFAULT 'CNY'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    note text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT biz_targets_period_check CHECK ((period_end >= period_start)),
    CONSTRAINT biz_targets_period_type_check CHECK ((period_type = ANY (ARRAY['day'::text, 'week'::text, 'month'::text, 'campaign'::text]))),
    CONSTRAINT biz_targets_scope_check CHECK (((scope_type = 'company'::text) OR (scope_id IS NOT NULL))),
    CONSTRAINT biz_targets_scope_type_check CHECK ((scope_type = ANY (ARRAY['company'::text, 'shop'::text, 'live_room'::text, 'anchor'::text, 'product'::text]))),
    CONSTRAINT biz_targets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'superseded'::text, 'archived'::text])))
);

CREATE TABLE public.brand_kits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    primary_color character varying(16) DEFAULT '#111827'::character varying NOT NULL,
    secondary_color character varying(16) DEFAULT '#F59E0B'::character varying NOT NULL,
    font_family character varying(80) DEFAULT 'Source Han Sans SC'::character varying NOT NULL,
    logo_path text DEFAULT ''::text NOT NULL,
    intro_path text DEFAULT ''::text NOT NULL,
    outro_path text DEFAULT ''::text NOT NULL,
    watermark jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    CONSTRAINT campaign_plan_approval_status_check CHECK (((approval_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    updated_at timestamp with time zone DEFAULT now(),
    room_id bigint,
    live_session_id bigint
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
    CONSTRAINT compliance_activity_reminder_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('reminded'::character varying)::text, ('done'::character varying)::text, ('expired'::character varying)::text])))
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
    CONSTRAINT compliance_events_severity_check CHECK (((severity)::text = ANY (ARRAY[('info'::character varying)::text, ('warning'::character varying)::text, ('critical'::character varying)::text]))),
    CONSTRAINT compliance_events_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('remediating'::character varying)::text, ('resolved'::character varying)::text, ('appealed'::character varying)::text])))
);

CREATE TABLE public.compliance_learning_tasks (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    title text NOT NULL,
    rule_reference text,
    assignee_id integer,
    assignee_name text,
    due_date date,
    status text DEFAULT 'PENDING'::text NOT NULL,
    completion_notes text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_learning_tasks_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
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
    CONSTRAINT compliance_rule_change_change_type_check CHECK (((change_type)::text = ANY (ARRAY[('new'::character varying)::text, ('revised'::character varying)::text, ('repealed'::character varying)::text]))),
    CONSTRAINT compliance_rule_change_severity_check CHECK (((severity)::text = ANY (ARRAY[('critical'::character varying)::text, ('high'::character varying)::text, ('medium'::character varying)::text, ('low'::character varying)::text])))
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
    CONSTRAINT compliance_rule_snapshot_fetch_method_check CHECK (((fetch_method)::text = ANY (ARRAY[('html_direct'::character varying)::text, ('rss'::character varying)::text, ('json_api'::character varying)::text, ('headless'::character varying)::text, ('manual'::character varying)::text])))
);

CREATE TABLE public.compliance_script_check_logs (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    script_text text NOT NULL,
    risk_level character varying(32) NOT NULL,
    hit_count integer DEFAULT 0 NOT NULL,
    hit_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    checked_by integer,
    checked_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.compliance_sensitive_replacements (
    id bigint NOT NULL,
    tenant_id integer,
    sensitive_word text NOT NULL,
    category text DEFAULT 'EXTREME_WORDS'::text NOT NULL,
    risk_level text NOT NULL,
    suggested_replacement text CONSTRAINT compliance_sensitive_replacement_suggested_replacement_not_null NOT NULL,
    explanation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_sensitive_replacements_risk_level_check CHECK ((risk_level = ANY (ARRAY['BLOCK'::text, 'WARN'::text])))
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
    CONSTRAINT content_attribution_ledger_attribution_channel_check CHECK (((attribution_channel)::text = ANY (ARRAY[('in_site'::character varying)::text, ('hongmao'::character varying)::text, ('hongjing'::character varying)::text, ('honglian'::character varying)::text, ('qianchuan'::character varying)::text, ('juguang'::character varying)::text, ('organic_search'::character varying)::text])))
);

CREATE TABLE public.content_briefs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    idea_id uuid,
    title character varying(200) NOT NULL,
    objective character varying(200) DEFAULT ''::character varying NOT NULL,
    audience text DEFAULT ''::text NOT NULL,
    key_points jsonb DEFAULT '[]'::jsonb NOT NULL,
    constraints text DEFAULT ''::text NOT NULL,
    platform_code character varying(32),
    due_date date,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    ai_generated boolean DEFAULT false NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_content_brief_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('approved'::character varying)::text, ('in_production'::character varying)::text, ('done'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.content_ideas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    title character varying(200) NOT NULL,
    category character varying(80) DEFAULT '通用'::character varying NOT NULL,
    platform_code character varying(32),
    source character varying(24) DEFAULT 'manual'::character varying NOT NULL,
    product_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    opportunity_score numeric(5,2),
    score_detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    missing_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    ai_description text DEFAULT ''::text NOT NULL,
    season_event_id uuid,
    status character varying(16) DEFAULT 'candidate'::character varying NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_content_idea_score CHECK (((opportunity_score IS NULL) OR ((opportunity_score >= (0)::numeric) AND (opportunity_score <= (100)::numeric)))),
    CONSTRAINT ck_content_idea_source CHECK (((source)::text = ANY (ARRAY[('manual'::character varying)::text, ('seasonal'::character varying)::text, ('product'::character varying)::text, ('history'::character varying)::text, ('ai'::character varying)::text]))),
    CONSTRAINT ck_content_idea_status CHECK (((status)::text = ANY (ARRAY[('candidate'::character varying)::text, ('shortlisted'::character varying)::text, ('briefed'::character varying)::text, ('rejected'::character varying)::text, ('published'::character varying)::text])))
);

CREATE TABLE public.content_metrics_link (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    script_version_id uuid,
    idea_id uuid,
    video_id character varying(100) NOT NULL,
    platform_code character varying(32) NOT NULL,
    biz_date date NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
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
    CONSTRAINT content_schedules_stage_check CHECK (((stage)::text = ANY (ARRAY[('topic_planned'::character varying)::text, ('script_drafted'::character varying)::text, ('shooting'::character varying)::text, ('editing'::character varying)::text, ('compliance_review'::character varying)::text, ('approved'::character varying)::text, ('scheduled'::character varying)::text, ('published'::character varying)::text])))
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
    shop_id bigint,
    tenant_id bigint,
    CONSTRAINT data_uploads_status_check CHECK (((status)::text = ANY (ARRAY[('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.decision_case_events (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    tenant_id integer NOT NULL,
    event_type text NOT NULL,
    from_status text,
    to_status text NOT NULL,
    operator_id integer,
    operator_name text,
    note text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.decision_cases (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    case_no text NOT NULL,
    title text NOT NULL,
    problem_statement text DEFAULT ''::text NOT NULL,
    domain text DEFAULT 'live'::text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    chosen_option text,
    expected_impact jsonb DEFAULT '{}'::jsonb NOT NULL,
    risk_level text DEFAULT 'R2'::text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    owner_user_id integer,
    owner_name text,
    approved_by integer,
    approved_at timestamp with time zone,
    applied_at timestamp with time zone,
    measure_after date DEFAULT (CURRENT_DATE + 7) NOT NULL,
    outcome jsonb,
    outcome_status text DEFAULT 'pending'::text NOT NULL,
    fingerprint text,
    created_by_agent text,
    run_id text,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scene_key text DEFAULT 'SCENE-A'::text NOT NULL,
    memo_version integer DEFAULT 1 NOT NULL,
    metric_contract_version text DEFAULT 'v1.1-deterministic'::text NOT NULL,
    amount_state text DEFAULT 'ESTIMATED'::text NOT NULL,
    attribution_grade text DEFAULT 'OBSERVED'::text NOT NULL,
    data_gate_status text DEFAULT 'NOT_EVALUABLE'::text NOT NULL,
    learned_at timestamp with time zone,
    learning_summary text,
    CONSTRAINT decision_cases_amount_state_check CHECK ((amount_state = ANY (ARRAY['ESTIMATED'::text, 'SETTLEMENT_DERIVED'::text, 'FINALIZED'::text]))),
    CONSTRAINT decision_cases_attribution_grade_check CHECK ((attribution_grade = ANY (ARRAY['GRADE_A'::text, 'GRADE_B'::text, 'GRADE_C'::text, 'GRADE_D'::text, 'OBSERVED'::text, 'ADJUSTED'::text, 'EXPERIMENTAL'::text]))),
    CONSTRAINT decision_cases_data_gate_status_check CHECK ((data_gate_status = ANY (ARRAY['PASS'::text, 'FAIL'::text, 'NOT_EVALUABLE'::text]))),
    CONSTRAINT decision_cases_domain_check CHECK ((domain = ANY (ARRAY['live'::text, 'ads'::text, 'assortment'::text, 'finance'::text, 'hr'::text, 'governance'::text]))),
    CONSTRAINT decision_cases_evidence_check CHECK ((jsonb_typeof(evidence) = 'array'::text)),
    CONSTRAINT decision_cases_options_check CHECK (((jsonb_typeof(options) = 'array'::text) AND (jsonb_array_length(options) >= 2))),
    CONSTRAINT decision_cases_outcome_status_check CHECK ((outcome_status = ANY (ARRAY['pending'::text, 'measured'::text, 'inconclusive'::text, 'failed'::text]))),
    CONSTRAINT decision_cases_risk_level_check CHECK ((risk_level = ANY (ARRAY['R0'::text, 'R1'::text, 'R2'::text, 'R3'::text, 'R4'::text]))),
    CONSTRAINT decision_cases_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'INVESTIGATING'::text, 'PROPOSED'::text, 'AWAITING_APPROVAL'::text, 'APPROVED'::text, 'EXECUTING'::text, 'AWAITING_REVIEW'::text, 'REVIEWED'::text, 'LEARNED'::text, 'ARCHIVED'::text, 'DATA_INSUFFICIENT'::text, 'BLOCKED'::text, 'REJECTED'::text, 'CANCELLED'::text])))
);

CREATE TABLE public.decision_data_gates (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    tenant_id integer NOT NULL,
    gate_tier text NOT NULL,
    check_item text NOT NULL,
    status text NOT NULL,
    failure_action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    evaluated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT decision_data_gates_failure_action_check CHECK ((failure_action = ANY (ARRAY['BLOCK'::text, 'REDUCE_CONFIDENCE'::text, 'WARN'::text]))),
    CONSTRAINT decision_data_gates_gate_tier_check CHECK ((gate_tier = ANY (ARRAY['GATE_1_HARD'::text, 'GATE_2_CONFIDENCE'::text, 'GATE_3_EXTENDED'::text]))),
    CONSTRAINT decision_data_gates_status_check CHECK ((status = ANY (ARRAY['PASS'::text, 'FAIL'::text, 'NOT_EVALUABLE'::text])))
);

CREATE TABLE public.decision_evidence_items (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    tenant_id integer NOT NULL,
    metric_code text NOT NULL,
    metric_name text NOT NULL,
    metric_value numeric(18,4),
    unit text DEFAULT ''::text NOT NULL,
    time_window text NOT NULL,
    source_batch_id bigint,
    quality_status text DEFAULT 'PASS'::text NOT NULL,
    calc_version text DEFAULT 'v1.1-deterministic'::text NOT NULL,
    evidence_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT decision_evidence_items_quality_status_check CHECK ((quality_status = ANY (ARRAY['PASS'::text, 'FAIL'::text, 'NOT_EVALUABLE'::text])))
);

CREATE TABLE public.decision_memo_versions (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    tenant_id integer NOT NULL,
    version integer NOT NULL,
    question text NOT NULL,
    facts jsonb DEFAULT '[]'::jsonb NOT NULL,
    hypotheses jsonb DEFAULT '[]'::jsonb NOT NULL,
    forecasts jsonb DEFAULT '[]'::jsonb NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    recommended_option text,
    chosen_option text,
    evidence_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_owners jsonb DEFAULT '[]'::jsonb NOT NULL,
    review_learning jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.decision_metric_snapshots (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    case_id bigint NOT NULL,
    snapshot_stage character varying(32) NOT NULL,
    metric_code character varying(64) NOT NULL,
    metric_value numeric(18,4) NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT decision_metric_snapshots_snapshot_stage_check CHECK (((snapshot_stage)::text = ANY (ARRAY[('BASELINE'::character varying)::text, ('EXECUTION'::character varying)::text, ('REVIEW'::character varying)::text])))
);

CREATE TABLE public.decision_reviews (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    case_id bigint NOT NULL,
    review_date date DEFAULT CURRENT_DATE NOT NULL,
    planned_outcome jsonb DEFAULT '{}'::jsonb NOT NULL,
    actual_outcome jsonb DEFAULT '{}'::jsonb NOT NULL,
    variance_pct numeric(8,2) DEFAULT 0.00,
    learnings text DEFAULT ''::text NOT NULL,
    reviewer_id integer,
    status text DEFAULT 'COMPLETED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT decision_reviews_status_check CHECK ((status = ANY (ARRAY['COMPLETED'::text, 'PENDING'::text])))
);

CREATE TABLE public.dim_accounting_subject (
    account_code character varying(32) NOT NULL,
    account_name character varying(64) NOT NULL,
    category character varying(32) NOT NULL,
    direction character varying(10) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dim_accounting_subject_category_check CHECK (((category)::text = ANY (ARRAY[('asset'::character varying)::text, ('liability'::character varying)::text, ('equity'::character varying)::text, ('revenue'::character varying)::text, ('expense'::character varying)::text]))),
    CONSTRAINT dim_accounting_subject_direction_check CHECK (((direction)::text = ANY (ARRAY[('debit'::character varying)::text, ('credit'::character varying)::text])))
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
    CONSTRAINT dim_category_weather_sensitivity_check CHECK (((weather_sensitivity)::text = ANY (ARRAY[('high'::character varying)::text, ('medium'::character varying)::text, ('low'::character varying)::text])))
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
    CONSTRAINT dim_cs_agent_shift_group_check CHECK (((shift_group)::text = ANY (ARRAY[('day'::character varying)::text, ('night'::character varying)::text, ('all'::character varying)::text]))),
    CONSTRAINT dim_cs_agent_status_check CHECK (((status)::text = ANY (ARRAY[('online'::character varying)::text, ('busy'::character varying)::text, ('offline'::character varying)::text])))
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
    CONSTRAINT dim_kol_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('paused'::character varying)::text, ('blacklist'::character varying)::text]))),
    CONSTRAINT dim_kol_tier_check CHECK (((tier)::text = ANY (ARRAY[('head'::character varying)::text, ('waist'::character varying)::text, ('tail'::character varying)::text, ('koc'::character varying)::text])))
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
    CONSTRAINT dim_product_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('discontinued'::character varying)::text])))
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

CREATE TABLE public.dim_product_cost_versions (
    id bigint NOT NULL,
    tenant_id integer NOT NULL,
    product_id bigint NOT NULL,
    cost_version character varying(32) NOT NULL,
    unit_cost numeric(12,4) NOT NULL,
    effective_from timestamp with time zone NOT NULL,
    effective_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT dim_product_cost_versions_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
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
    CONSTRAINT dq_quarantine_rule_code_check CHECK (((rule_code)::text = ANY (ARRAY[('RULE_LINE_COUNT_CONSERVED'::character varying)::text, ('RULE_AMOUNT_CONSERVED'::character varying)::text, ('RULE_BATCH_KEY_UNIQUE'::character varying)::text, ('RULE_ENUM_LEGAL'::character varying)::text, ('RULE_TIME_CONTINUOUS'::character varying)::text, ('RULE_CROSS_TABLE_RECONCILE'::character varying)::text, ('RULE_PLATFORM_RECONCILE'::character varying)::text, ('RULE_FRESHNESS_SLA'::character varying)::text]))),
    CONSTRAINT dq_quarantine_severity_check CHECK (((severity)::text = ANY (ARRAY[('warning'::character varying)::text, ('error'::character varying)::text, ('fatal'::character varying)::text]))),
    CONSTRAINT dq_quarantine_status_check CHECK (((status)::text = ANY (ARRAY[('quarantined'::character varying)::text, ('resolved'::character varying)::text, ('ignored'::character varying)::text])))
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
    CONSTRAINT fact_after_sale_tickets_reason_category_check CHECK (((reason_category)::text = ANY (ARRAY[('size_mismatch'::character varying)::text, ('quality_defect'::character varying)::text, ('logistics_slow'::character varying)::text, ('not_as_described'::character varying)::text, ('buyer_remorse'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT fact_after_sale_tickets_refund_type_check CHECK (((refund_type)::text = ANY (ARRAY[('only_refund'::character varying)::text, ('return_refund'::character varying)::text, ('exchange'::character varying)::text]))),
    CONSTRAINT fact_after_sale_tickets_ticket_status_check CHECK (((ticket_status)::text = ANY (ARRAY[('pending_audit'::character varying)::text, ('waiting_return'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('platform_intervened'::character varying)::text, ('closed'::character varying)::text])))
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
    CONSTRAINT fact_cs_session_shift_type_check CHECK (((shift_type)::text = ANY (ARRAY[('day'::character varying)::text, ('night'::character varying)::text])))
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
    CONSTRAINT fact_fulfillment_waybill_fulfillment_status_check CHECK (((fulfillment_status)::text = ANY (ARRAY[('pending_ship'::character varying)::text, ('shipped_no_pickup'::character varying)::text, ('in_transit'::character varying)::text, ('signed'::character varying)::text, ('cancelled'::character varying)::text])))
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
    CONSTRAINT fact_gl_entry_direction_check CHECK (((direction)::text = ANY (ARRAY[('debit'::character varying)::text, ('credit'::character varying)::text])))
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
    CONSTRAINT fact_gl_voucher_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('posted'::character varying)::text, ('voided'::character varying)::text]))),
    CONSTRAINT fact_gl_voucher_voucher_type_check CHECK (((voucher_type)::text = ANY (ARRAY[('session_settle'::character varying)::text, ('ad_spend'::character varying)::text, ('order_revenue'::character varying)::text, ('inventory_cogs'::character varying)::text, ('refund_loss'::character varying)::text, ('logistics_fee'::character varying)::text, ('commission_fee'::character varying)::text, ('manual_adjust'::character varying)::text])))
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
    CONSTRAINT fact_inventory_ledger_change_type_check CHECK (((change_type)::text = ANY (ARRAY[('inbound'::character varying)::text, ('outbound'::character varying)::text, ('lock'::character varying)::text, ('unlock'::character varying)::text, ('adjust'::character varying)::text, ('return_in'::character varying)::text])))
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
    CONSTRAINT fact_inventory_reservation_status_check CHECK (((status)::text = ANY (ARRAY[('reserved'::character varying)::text, ('committed'::character varying)::text, ('released'::character varying)::text])))
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
    CONSTRAINT fact_kol_cooperation_coop_type_check CHECK (((coop_type)::text = ANY (ARRAY[('live_slot'::character varying)::text, ('short_video'::character varying)::text, ('cps_only'::character varying)::text]))),
    CONSTRAINT fact_kol_cooperation_settlement_status_check CHECK (((settlement_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('confirmed'::character varying)::text, ('paid'::character varying)::text, ('disputed'::character varying)::text])))
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
    CONSTRAINT fact_order_event_stream_event_type_check CHECK (((event_type)::text = ANY (ARRAY[('order_placed'::character varying)::text, ('payment_confirmed'::character varying)::text, ('inventory_locked'::character varying)::text, ('inventory_released'::character varying)::text, ('shipped'::character varying)::text, ('delivered'::character varying)::text, ('rma_created'::character varying)::text, ('item_refunded'::character varying)::text, ('order_completed'::character varying)::text, ('order_closed'::character varying)::text]))),
    CONSTRAINT fact_order_event_stream_operator_type_check CHECK (((operator_type)::text = ANY (ARRAY[('system'::character varying)::text, ('user'::character varying)::text, ('operator'::character varying)::text, ('staff'::character varying)::text, ('platform_webhook'::character varying)::text, ('customer_service'::character varying)::text])))
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
    CONSTRAINT fact_order_rma_item_inspection_status_check CHECK (((inspection_status)::text = ANY (ARRAY[('pending_inspection'::character varying)::text, ('passed'::character varying)::text, ('failed_damaged'::character varying)::text, ('waived'::character varying)::text]))),
    CONSTRAINT fact_order_rma_item_reason_category_check CHECK (((reason_category)::text = ANY (ARRAY[('size_mismatch'::character varying)::text, ('quality_issue'::character varying)::text, ('change_mind'::character varying)::text, ('logistics_damage'::character varying)::text, ('fake_goods'::character varying)::text, ('wrong_item'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT fact_order_rma_item_refund_amount_check CHECK ((refund_amount >= (0)::numeric)),
    CONSTRAINT fact_order_rma_item_restock_status_check CHECK (((restock_status)::text = ANY (ARRAY[('not_restocked'::character varying)::text, ('restocked_to_warehouse'::character varying)::text, ('scrapped'::character varying)::text]))),
    CONSTRAINT fact_order_rma_item_return_quantity_check CHECK ((return_quantity > (0)::numeric)),
    CONSTRAINT fact_order_rma_item_rma_type_check CHECK (((rma_type)::text = ANY (ARRAY[('refund_only'::character varying)::text, ('return_and_refund'::character varying)::text, ('exchange'::character varying)::text]))),
    CONSTRAINT fact_order_rma_item_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
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
    CONSTRAINT fact_selection_recommendation_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('adopted'::character varying)::text, ('archived'::character varying)::text]))),
    CONSTRAINT fact_selection_recommendation_strategy_check CHECK (((strategy)::text = ANY (ARRAY[('weather_led'::character varying)::text, ('trend_led'::character varying)::text, ('degraded'::character varying)::text])))
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
    cogs_amount numeric(18,2) DEFAULT 0.00,
    CONSTRAINT fact_settlement_cycles_business_mode_check CHECK (((business_mode)::text = ANY (ARRAY[('standard'::character varying)::text, ('pop'::character varying)::text, ('self_operated'::character varying)::text]))),
    CONSTRAINT fact_settlement_cycles_settlement_status_check CHECK (((settlement_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('partial'::character varying)::text, ('settled'::character varying)::text, ('frozen'::character varying)::text])))
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

CREATE TABLE public.hrbp_auditions (
    id integer NOT NULL,
    candidate_id integer NOT NULL,
    audition_date date DEFAULT CURRENT_DATE NOT NULL,
    interviewer character varying(50) NOT NULL,
    camera_presence_score numeric(3,1) DEFAULT 8.0,
    vocal_clarity_score numeric(3,1) DEFAULT 8.0,
    sales_pitch_score numeric(3,1) DEFAULT 8.0,
    script_adaptability_score numeric(3,1) DEFAULT 8.0,
    rhythm_control_score numeric(3,1) DEFAULT 8.0,
    total_score numeric(4,1) DEFAULT 8.0,
    trial_gmv numeric(12,2) DEFAULT 0,
    trial_orders integer DEFAULT 0,
    result character varying(20) DEFAULT 'pass'::character varying NOT NULL,
    comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.hrbp_candidates (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    phone character varying(20),
    target_category character varying(50) NOT NULL,
    experience_years numeric(4,1) DEFAULT 0,
    expected_salary numeric(10,2) DEFAULT 0,
    source character varying(50) DEFAULT 'BOSS直聘'::character varying,
    stage character varying(30) DEFAULT 'resume_screening'::character varying NOT NULL,
    eliminated_reason text,
    anchor_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    decision_case_id bigint,
    expected_impact jsonb,
    measure_at date,
    outcome jsonb,
    outcome_status text,
    CONSTRAINT improvement_tasks_outcome_status_check CHECK (((outcome_status IS NULL) OR (outcome_status = ANY (ARRAY['pending'::text, 'measured'::text, 'inconclusive'::text, 'failed'::text])))),
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

CREATE TABLE public.instance_setup (
    id smallint DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    install_token_hash text,
    install_token_expires_at timestamp with time zone,
    setup_source text,
    plan_snapshot jsonb,
    ai_profile jsonb,
    health_score smallint,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instance_setup_id_check CHECK ((id = 1)),
    CONSTRAINT instance_setup_setup_source_check CHECK ((setup_source = ANY (ARRAY['manual'::text, 'ai'::text]))),
    CONSTRAINT instance_setup_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'locked'::text])))
);

CREATE TABLE public.integration_call_logs (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    connection_id uuid,
    platform character varying(64) NOT NULL,
    operation character varying(100) NOT NULL,
    method character varying(8) DEFAULT 'INTERNAL'::character varying NOT NULL,
    request_summary text DEFAULT ''::text NOT NULL,
    response_summary text DEFAULT ''::text NOT NULL,
    status character varying(16) DEFAULT 'success'::character varying NOT NULL,
    http_status integer,
    error_code character varying(64),
    latency_ms integer DEFAULT 0 NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    actor_user_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_integration_call_status CHECK (((status)::text = ANY (ARRAY[('success'::character varying)::text, ('error'::character varying)::text, ('rate_limited'::character varying)::text, ('skipped'::character varying)::text])))
);

CREATE TABLE public.integration_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform character varying(64) NOT NULL,
    display_name character varying(100) NOT NULL,
    category character varying(32) DEFAULT 'platform'::character varying NOT NULL,
    auth_type character varying(32) DEFAULT 'app_secret'::character varying NOT NULL,
    auth_status character varying(16) DEFAULT 'unconfigured'::character varying NOT NULL,
    capability_keys jsonb DEFAULT '[]'::jsonb NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    credential_id uuid,
    rate_limit_per_min integer DEFAULT 60 NOT NULL,
    health_status character varying(16) DEFAULT 'unknown'::character varying NOT NULL,
    health_detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_checked_at timestamp with time zone,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_integration_auth_status CHECK (((auth_status)::text = ANY (ARRAY[('unconfigured'::character varying)::text, ('configured'::character varying)::text, ('invalid'::character varying)::text]))),
    CONSTRAINT ck_integration_health_status CHECK (((health_status)::text = ANY (ARRAY[('unknown'::character varying)::text, ('healthy'::character varying)::text, ('degraded'::character varying)::text, ('unconfigured'::character varying)::text, ('down'::character varying)::text]))),
    CONSTRAINT ck_integration_rate_limit CHECK (((rate_limit_per_min >= 1) AND (rate_limit_per_min <= 6000)))
);

CREATE TABLE public.integration_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform character varying(64) NOT NULL,
    label character varying(64) DEFAULT 'default'::character varying NOT NULL,
    secret_enc text NOT NULL,
    secret_hint character varying(32) DEFAULT ''::character varying NOT NULL,
    key_version integer DEFAULT 1 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by bigint,
    rotated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_integration_credential_status CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('disabled'::character varying)::text])))
);

CREATE TABLE public.integration_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    platform character varying(64) NOT NULL,
    secret_enc text DEFAULT ''::text NOT NULL,
    replay_window_sec integer DEFAULT 300 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_integration_webhook_window CHECK (((replay_window_sec >= 30) AND (replay_window_sec <= 86400)))
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

CREATE TABLE public.kb_acl (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    collection_id uuid NOT NULL,
    role_code character varying(32) NOT NULL,
    effect character varying(8) DEFAULT 'allow'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kb_acl_effect CHECK (((effect)::text = ANY (ARRAY[('allow'::character varying)::text, ('deny'::character varying)::text])))
);

CREATE TABLE public.kb_banned_words (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    word character varying(64) NOT NULL,
    normalized character varying(64) NOT NULL,
    category character varying(32) DEFAULT 'absolute'::character varying NOT NULL,
    severity character varying(8) DEFAULT 'high'::character varying NOT NULL,
    action character varying(16) DEFAULT 'block'::character varying NOT NULL,
    platform character varying(32) DEFAULT 'all'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    word_version integer DEFAULT 1 NOT NULL,
    effective_from timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kb_banned_action CHECK (((action)::text = ANY (ARRAY[('block'::character varying)::text, ('warn'::character varying)::text, ('rewrite'::character varying)::text]))),
    CONSTRAINT ck_kb_banned_category CHECK (((category)::text = ANY (ARRAY[('absolute'::character varying)::text, ('medical'::character varying)::text, ('financial'::character varying)::text, ('platform'::character varying)::text, ('politics'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT ck_kb_banned_severity CHECK (((severity)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text])))
);

CREATE TABLE public.kb_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    collection_id uuid NOT NULL,
    document_id uuid NOT NULL,
    seq integer DEFAULT 0 NOT NULL,
    content text NOT NULL,
    token_count integer DEFAULT 0 NOT NULL,
    embedding public.vector,
    embedding_model character varying(120) DEFAULT ''::character varying NOT NULL,
    start_ms integer,
    end_ms integer,
    page_no integer,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    acl_roles jsonb DEFAULT '[]'::jsonb NOT NULL,
    index_version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kb_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    code character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    domain character varying(24) DEFAULT 'document'::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    embedding_model character varying(120) DEFAULT ''::character varying NOT NULL,
    embedding_dim integer DEFAULT 0 NOT NULL,
    chunk_size integer DEFAULT 800 NOT NULL,
    chunk_overlap integer DEFAULT 100 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    document_count integer DEFAULT 0 NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT ck_kb_collection_chunk CHECK (((chunk_size >= 100) AND (chunk_size <= 4000) AND (chunk_overlap >= 0) AND (chunk_overlap < chunk_size))),
    CONSTRAINT ck_kb_collection_domain CHECK (((domain)::text = ANY (ARRAY[('product'::character varying)::text, ('script'::character varying)::text, ('banned'::character varying)::text, ('replay'::character varying)::text, ('document'::character varying)::text]))),
    CONSTRAINT ck_kb_collection_status CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.kb_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    collection_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    source_type character varying(16) DEFAULT 'text'::character varying NOT NULL,
    source_ref text DEFAULT ''::text NOT NULL,
    doc_version integer DEFAULT 1 NOT NULL,
    content_hash character varying(64) DEFAULT ''::character varying NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    business_key character varying(120) DEFAULT ''::character varying NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kb_document_source CHECK (((source_type)::text = ANY (ARRAY[('text'::character varying)::text, ('url'::character varying)::text, ('file'::character varying)::text, ('asr'::character varying)::text, ('structured'::character varying)::text]))),
    CONSTRAINT ck_kb_document_status CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('indexing'::character varying)::text, ('ready'::character varying)::text, ('failed'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.kb_feedback (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    run_id character varying(64),
    chunk_id uuid,
    document_id uuid,
    rating character varying(8) DEFAULT 'up'::character varying NOT NULL,
    comment text DEFAULT ''::text NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kb_feedback_rating CHECK (((rating)::text = ANY (ARRAY[('up'::character varying)::text, ('down'::character varying)::text])))
);

CREATE TABLE public.kb_index_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    collection_id uuid NOT NULL,
    version integer NOT NULL,
    embedding_model character varying(120) DEFAULT ''::character varying NOT NULL,
    embedding_dim integer DEFAULT 0 NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'building'::character varying NOT NULL,
    built_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kb_index_status CHECK (((status)::text = ANY (ARRAY[('building'::character varying)::text, ('active'::character varying)::text, ('retired'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.kb_ingest_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    collection_id uuid NOT NULL,
    document_id uuid,
    status character varying(16) DEFAULT 'queued'::character varying NOT NULL,
    stage character varying(24) DEFAULT 'queued'::character varying NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    chunk_count integer DEFAULT 0 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    created_by bigint,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kb_ingest_progress CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT ck_kb_ingest_stage CHECK (((stage)::text = ANY (ARRAY[('queued'::character varying)::text, ('parse'::character varying)::text, ('clean'::character varying)::text, ('chunk'::character varying)::text, ('embed'::character varying)::text, ('index'::character varying)::text, ('done'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT ck_kb_ingest_status CHECK (((status)::text = ANY (ARRAY[('queued'::character varying)::text, ('running'::character varying)::text, ('succeeded'::character varying)::text, ('failed'::character varying)::text])))
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
    CONSTRAINT chk_live_sessions_source CHECK (((data_source IS NULL) OR ((data_source)::text = ANY (ARRAY[('official_api'::character varying)::text, ('manual_upload'::character varying)::text, ('legacy'::character varying)::text, ('bridge'::character varying)::text])))),
    CONSTRAINT live_sessions_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('live'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.llm_provider_config (
    id smallint DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    protocol character varying(16) DEFAULT 'openai'::character varying NOT NULL,
    api_base character varying(500) NOT NULL,
    api_key_enc text DEFAULT ''::text NOT NULL,
    model character varying(100) NOT NULL,
    updated_by bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_provider_config_id_check CHECK ((id = 1))
);

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    title character varying(255) NOT NULL,
    source_type character varying(16) DEFAULT 'upload'::character varying NOT NULL,
    storage_path text DEFAULT ''::text NOT NULL,
    mime_type character varying(100) DEFAULT ''::character varying NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    width integer,
    height integer,
    has_audio boolean DEFAULT true NOT NULL,
    status character varying(16) DEFAULT 'uploaded'::character varying NOT NULL,
    business_key character varying(120) DEFAULT ''::character varying NOT NULL,
    content_asset_id bigint,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_media_asset_source CHECK (((source_type)::text = ANY (ARRAY[('upload'::character varying)::text, ('url'::character varying)::text, ('record'::character varying)::text]))),
    CONSTRAINT ck_media_asset_status CHECK (((status)::text = ANY (ARRAY[('uploaded'::character varying)::text, ('transcribing'::character varying)::text, ('transcribed'::character varying)::text, ('analysing'::character varying)::text, ('analysed'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.media_draft_exports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    asset_id uuid NOT NULL,
    clip_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    draft_path text DEFAULT ''::text NOT NULL,
    draft_json_path text DEFAULT ''::text NOT NULL,
    clip_count integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'ready'::character varying NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_media_draft_status CHECK (((status)::text = ANY (ARRAY[('ready'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.media_highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    asset_id uuid NOT NULL,
    transcript_id uuid,
    start_ms integer NOT NULL,
    end_ms integer NOT NULL,
    duration_ms integer NOT NULL,
    score numeric(5,2) DEFAULT 0 NOT NULL,
    title character varying(255) DEFAULT ''::character varying NOT NULL,
    reason character varying(500) DEFAULT ''::character varying NOT NULL,
    score_detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'candidate'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_media_highlight_range CHECK (((start_ms >= 0) AND (end_ms > start_ms) AND (duration_ms > 0))),
    CONSTRAINT ck_media_highlight_score CHECK (((score >= (0)::numeric) AND (score <= (100)::numeric))),
    CONSTRAINT ck_media_highlight_status CHECK (((status)::text = ANY (ARRAY[('candidate'::character varying)::text, ('selected'::character varying)::text, ('rejected'::character varying)::text, ('rendered'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.media_render_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    asset_id uuid NOT NULL,
    highlight_id uuid,
    status character varying(16) DEFAULT 'queued'::character varying NOT NULL,
    stage character varying(24) DEFAULT 'queued'::character varying NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    output_path text DEFAULT ''::text NOT NULL,
    cover_path text DEFAULT ''::text NOT NULL,
    subtitle_path text DEFAULT ''::text NOT NULL,
    content_asset_id bigint,
    duration_ms integer DEFAULT 0 NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_media_render_progress CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT ck_media_render_stage CHECK (((stage)::text = ANY (ARRAY[('queued'::character varying)::text, ('probe'::character varying)::text, ('cut'::character varying)::text, ('subtitle'::character varying)::text, ('cover'::character varying)::text, ('done'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT ck_media_render_status CHECK (((status)::text = ANY (ARRAY[('queued'::character varying)::text, ('running'::character varying)::text, ('succeeded'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.media_transcripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    asset_id uuid NOT NULL,
    provider character varying(32) DEFAULT 'manual'::character varying NOT NULL,
    language character varying(16) DEFAULT 'zh'::character varying NOT NULL,
    segment_count integer DEFAULT 0 NOT NULL,
    segments jsonb DEFAULT '[]'::jsonb NOT NULL,
    full_text text DEFAULT ''::text NOT NULL,
    status character varying(16) DEFAULT 'ready'::character varying NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_media_transcript_provider CHECK (((provider)::text = ANY (ARRAY[('manual'::character varying)::text, ('whisper'::character varying)::text, ('volcengine'::character varying)::text, ('dashscope'::character varying)::text]))),
    CONSTRAINT ck_media_transcript_status CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('ready'::character varying)::text, ('failed'::character varying)::text])))
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

CREATE TABLE public.permission_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    user_id integer NOT NULL,
    module_code text NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT permission_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
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
    CONSTRAINT pricing_rules_discount_mode_check CHECK (((discount_mode)::text = ANY (ARRAY[('official_reduction'::character varying)::text, ('store_coupon'::character varying)::text, ('category_coupon'::character varying)::text, ('vip_discount'::character varying)::text, ('national_subsidy'::character varying)::text, ('red_packet'::character varying)::text, ('multi_piece_exclusive'::character varying)::text]))),
    CONSTRAINT pricing_rules_rule_layer_check CHECK (((rule_layer >= 1) AND (rule_layer <= 5)))
);

CREATE TABLE public.promotion_rules (
    id bigint NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    promotion_id integer,
    platform_code character varying(32) NOT NULL,
    rule_layer integer NOT NULL,
    rule_name character varying(150) NOT NULL,
    discount_mode character varying(40) NOT NULL,
    discount_value numeric(12,4) DEFAULT 0 NOT NULL,
    is_exclusive boolean DEFAULT false NOT NULL,
    merchant_cost_ratio numeric(5,4) DEFAULT 1.0000 NOT NULL,
    platform_cost_ratio numeric(5,4) DEFAULT 0.0000 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promotion_rules_discount_mode_check CHECK (((discount_mode)::text = ANY (ARRAY[('official_reduction'::character varying)::text, ('store_coupon'::character varying)::text, ('category_coupon'::character varying)::text, ('vip_discount'::character varying)::text, ('national_subsidy'::character varying)::text, ('red_packet'::character varying)::text, ('multi_piece_exclusive'::character varying)::text]))),
    CONSTRAINT promotion_rules_rule_layer_check CHECK (((rule_layer >= 1) AND (rule_layer <= 5)))
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

CREATE TABLE public.prompt_eval_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    template_id uuid NOT NULL,
    version integer NOT NULL,
    case_count integer DEFAULT 0 NOT NULL,
    pass_count integer DEFAULT 0 NOT NULL,
    pass_rate numeric(5,2) DEFAULT 0 NOT NULL,
    avg_latency_ms integer DEFAULT 0 NOT NULL,
    total_cost_cny numeric(12,6) DEFAULT 0 NOT NULL,
    detail jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'completed'::character varying NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_prompt_eval_status CHECK (((status)::text = ANY (ARRAY[('completed'::character varying)::text, ('failed'::character varying)::text])))
);

CREATE TABLE public.prompt_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    key character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    scene character varying(32) DEFAULT 'script'::character varying NOT NULL,
    platform character varying(32) DEFAULT 'all'::character varying NOT NULL,
    category character varying(64) DEFAULT 'all'::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    variables_schema jsonb DEFAULT '[]'::jsonb NOT NULL,
    active_version integer DEFAULT 0 NOT NULL,
    canary_version integer,
    canary_ratio integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_prompt_canary_ratio CHECK (((canary_ratio >= 0) AND (canary_ratio <= 100))),
    CONSTRAINT ck_prompt_template_scene CHECK (((scene)::text = ANY (ARRAY[('script'::character varying)::text, ('copy'::character varying)::text, ('title'::character varying)::text, ('reply'::character varying)::text, ('analysis'::character varying)::text]))),
    CONSTRAINT ck_prompt_template_status CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.prompt_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    template_id uuid NOT NULL,
    version integer NOT NULL,
    system_prompt text DEFAULT ''::text NOT NULL,
    user_template text DEFAULT ''::text NOT NULL,
    output_schema text DEFAULT ''::text NOT NULL,
    notes character varying(500) DEFAULT ''::character varying NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_prompt_version_positive CHECK ((version > 0))
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

CREATE TABLE public.qianchuan_budget_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    plan_id bigint NOT NULL,
    current_budget numeric(14,2) DEFAULT 0 NOT NULL,
    requested_budget numeric(14,2) DEFAULT 0 NOT NULL,
    reason character varying(500) DEFAULT ''::character varying NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by bigint,
    reviewed_at timestamp with time zone,
    review_note character varying(500) DEFAULT ''::character varying NOT NULL,
    applied_at timestamp with time zone,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_qianchuan_budget_positive CHECK ((requested_budget > (0)::numeric)),
    CONSTRAINT ck_qianchuan_budget_status CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('applied'::character varying)::text])))
);

CREATE TABLE public.qianchuan_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    source character varying(16) DEFAULT 'manual'::character varying NOT NULL,
    biz_date_from date,
    biz_date_to date,
    row_count integer DEFAULT 0 NOT NULL,
    inserted_count integer DEFAULT 0 NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    status character varying(16) DEFAULT 'succeeded'::character varying NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_qianchuan_sync_source CHECK (((source)::text = ANY (ARRAY[('manual'::character varying)::text, ('api'::character varying)::text]))),
    CONSTRAINT ck_qianchuan_sync_status CHECK (((status)::text = ANY (ARRAY[('succeeded'::character varying)::text, ('failed'::character varying)::text, ('partial'::character varying)::text])))
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

CREATE TABLE public.render_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    project_id uuid NOT NULL,
    status character varying(16) DEFAULT 'queued'::character varying NOT NULL,
    stage character varying(24) DEFAULT 'queued'::character varying NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    priority integer DEFAULT 5 NOT NULL,
    gate_passed boolean,
    gate_result jsonb DEFAULT '{}'::jsonb NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text DEFAULT ''::text NOT NULL,
    queued_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_by bigint,
    CONSTRAINT ck_render_job_priority CHECK (((priority >= 1) AND (priority <= 9))),
    CONSTRAINT ck_render_job_progress CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT ck_render_job_stage CHECK (((stage)::text = ANY (ARRAY[('queued'::character varying)::text, ('precheck'::character varying)::text, ('assemble'::character varying)::text, ('audio'::character varying)::text, ('subtitle'::character varying)::text, ('qc'::character varying)::text, ('done'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT ck_render_job_status CHECK (((status)::text = ANY (ARRAY[('queued'::character varying)::text, ('running'::character varying)::text, ('succeeded'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE TABLE public.render_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    job_id uuid NOT NULL,
    output_path text DEFAULT ''::text NOT NULL,
    cover_path text DEFAULT ''::text NOT NULL,
    subtitle_path text DEFAULT ''::text NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    width integer DEFAULT 0 NOT NULL,
    height integer DEFAULT 0 NOT NULL,
    size_bytes bigint DEFAULT 0 NOT NULL,
    loudness numeric(5,2),
    content_asset_id bigint,
    qc jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_render_output_duration CHECK ((duration_ms >= 0))
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
    CONSTRAINT role_module_grants_effect_check CHECK (((effect)::text = ANY (ARRAY[('allow'::character varying)::text, ('deny'::character varying)::text])))
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

CREATE TABLE public.role_workbenches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    role_key text NOT NULL,
    variant text DEFAULT 'default'::text NOT NULL,
    name text NOT NULL,
    description text,
    layout jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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

CREATE TABLE public.script_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    brief_id uuid,
    idea_id uuid,
    version integer DEFAULT 1 NOT NULL,
    variant character varying(8) DEFAULT 'A'::character varying NOT NULL,
    title character varying(200) DEFAULT ''::character varying NOT NULL,
    hook text DEFAULT ''::text NOT NULL,
    body jsonb DEFAULT '[]'::jsonb NOT NULL,
    proof text DEFAULT ''::text NOT NULL,
    cta text DEFAULT ''::text NOT NULL,
    words_count integer DEFAULT 0 NOT NULL,
    compliance_status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    compliance_detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_script_compliance CHECK (((compliance_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('passed'::character varying)::text, ('failed'::character varying)::text]))),
    CONSTRAINT ck_script_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('reviewing'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))),
    CONSTRAINT ck_script_version_no CHECK ((version > 0))
);

CREATE TABLE public.seasonal_calendar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    event_code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    event_type character varying(24) DEFAULT 'festival'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    platform_code character varying(32),
    categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    importance integer DEFAULT 3 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_seasonal_event_type CHECK (((event_type)::text = ANY (ARRAY[('festival'::character varying)::text, ('platform_promo'::character varying)::text, ('category_season'::character varying)::text]))),
    CONSTRAINT ck_seasonal_importance CHECK (((importance >= 1) AND (importance <= 5))),
    CONSTRAINT ck_seasonal_range CHECK ((end_date >= start_date))
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

CREATE TABLE public.session_staff_assignments (
    id bigint NOT NULL,
    session_id integer NOT NULL,
    role_code character varying(24) NOT NULL,
    staff_id integer,
    staff_name character varying(64) NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.setup_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    biz_type text NOT NULL,
    name text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    plan jsonb NOT NULL,
    created_by integer,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.shot_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    project_id uuid NOT NULL,
    seq integer DEFAULT 0 NOT NULL,
    shot_type character varying(24) DEFAULT 'scene'::character varying NOT NULL,
    title character varying(200) DEFAULT ''::character varying NOT NULL,
    script_text text DEFAULT ''::text NOT NULL,
    subtitle_text text DEFAULT ''::text NOT NULL,
    asset_path text DEFAULT ''::text NOT NULL,
    media_asset_id uuid,
    duration_ms integer DEFAULT 0 NOT NULL,
    transition character varying(24) DEFAULT 'cut'::character varying NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_shot_duration CHECK ((duration_ms >= 0)),
    CONSTRAINT ck_shot_type CHECK (((shot_type)::text = ANY (ARRAY[('hook'::character varying)::text, ('selling_point'::character varying)::text, ('proof'::character varying)::text, ('cta'::character varying)::text, ('card'::character varying)::text, ('scene'::character varying)::text, ('transition'::character varying)::text])))
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

CREATE TABLE public.staff_day_status (
    id bigint NOT NULL,
    staff_name character varying(64) NOT NULL,
    biz_date date NOT NULL,
    status character varying(16) NOT NULL,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_day_status_status_check CHECK (((status)::text = ANY (ARRAY[('work'::character varying)::text, ('rest'::character varying)::text, ('leave'::character varying)::text, ('sick'::character varying)::text])))
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

CREATE TABLE public.storyboards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    script_version_id uuid NOT NULL,
    seq integer DEFAULT 0 NOT NULL,
    shot_size character varying(20) DEFAULT '中景'::character varying NOT NULL,
    scene text DEFAULT ''::text NOT NULL,
    subtitle_text text DEFAULT ''::text NOT NULL,
    duration_sec integer DEFAULT 0 NOT NULL,
    camera text DEFAULT ''::text NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_storyboard_duration CHECK ((duration_sec >= 0))
);

CREATE TABLE public.subtitle_styles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    font_family character varying(80) DEFAULT 'Source Han Sans SC'::character varying NOT NULL,
    font_size integer DEFAULT 42 NOT NULL,
    color character varying(16) DEFAULT '#FFFFFF'::character varying NOT NULL,
    stroke_color character varying(16) DEFAULT '#000000'::character varying NOT NULL,
    "position" character varying(20) DEFAULT 'bottom'::character varying NOT NULL,
    safe_area boolean DEFAULT true NOT NULL,
    max_chars integer DEFAULT 16 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_subtitle_position CHECK ((("position")::text = ANY (ARRAY[('top'::character varying)::text, ('center'::character varying)::text, ('bottom'::character varying)::text])))
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
    CONSTRAINT sys_custom_field_definition_data_type_check CHECK (((data_type)::text = ANY (ARRAY[('string'::character varying)::text, ('number'::character varying)::text, ('boolean'::character varying)::text, ('date'::character varying)::text, ('select'::character varying)::text, ('json'::character varying)::text]))),
    CONSTRAINT sys_custom_field_definition_entity_type_check CHECK (((entity_type)::text = ANY (ARRAY[('product'::character varying)::text, ('shop'::character varying)::text, ('live_session'::character varying)::text, ('order'::character varying)::text, ('ad_plan'::character varying)::text, ('channel_listing'::character varying)::text])))
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

CREATE TABLE public.sys_deprecation_access_logs (
    id bigint NOT NULL,
    tenant_id integer,
    user_id integer,
    user_role character varying(64),
    method character varying(16) NOT NULL,
    route_path character varying(255) NOT NULL,
    user_agent text,
    ip_address character varying(64),
    accessed_at timestamp with time zone DEFAULT now() NOT NULL
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

CREATE TABLE public.system_module_parameters (
    id integer NOT NULL,
    module_code character varying(50) NOT NULL,
    param_key character varying(100) NOT NULL,
    param_name character varying(100) NOT NULL,
    param_type character varying(30) DEFAULT 'json'::character varying NOT NULL,
    scope_type character varying(30) DEFAULT 'global'::character varying NOT NULL,
    scope_id character varying(50) DEFAULT 'default'::character varying NOT NULL,
    param_value jsonb NOT NULL,
    unit character varying(20) DEFAULT ''::character varying,
    description text,
    updated_by character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.system_modules (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(50) DEFAULT ''::character varying,
    sort_order smallint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_core boolean DEFAULT false NOT NULL
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

CREATE TABLE public.target_templates (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metrics jsonb DEFAULT '[]'::jsonb CONSTRAINT target_templates_metrics_new_not_null NOT NULL,
    period character varying(20) DEFAULT 'monthly'::character varying NOT NULL
);

CREATE TABLE public.template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    template_id uuid NOT NULL,
    version integer NOT NULL,
    dsl jsonb NOT NULL,
    changelog text DEFAULT ''::text NOT NULL,
    status character varying(16) DEFAULT 'draft'::character varying NOT NULL,
    is_canary boolean DEFAULT false NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_template_version_no CHECK ((version > 0)),
    CONSTRAINT ck_template_version_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('published'::character varying)::text, ('archived'::character varying)::text])))
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

CREATE TABLE public.topic_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    idea_id uuid,
    category character varying(80) DEFAULT '通用'::character varying NOT NULL,
    platform_code character varying(32),
    window_start date NOT NULL,
    window_end date NOT NULL,
    sample_size integer DEFAULT 0 NOT NULL,
    avg_plays numeric(14,2) DEFAULT 0 NOT NULL,
    avg_engagement_rate numeric(6,2) DEFAULT 0 NOT NULL,
    avg_gmv numeric(14,2) DEFAULT 0 NOT NULL,
    score numeric(5,2),
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_topic_performance_range CHECK ((window_end >= window_start))
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
    CONSTRAINT user_module_overrides_effect_check CHECK (((effect)::text = ANY (ARRAY[('grant'::character varying)::text, ('revoke'::character varying)::text])))
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
    tenant_id integer DEFAULT 1 NOT NULL,
    user_type character varying(20) DEFAULT 'agency_staff'::character varying,
    anchor_id integer,
    operator_id integer,
    data_scope character varying(16) DEFAULT 'self'::character varying,
    dept_id integer,
    team_id integer,
    manager_id integer,
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT users_data_scope_check CHECK (((data_scope IS NULL) OR ((data_scope)::text = ANY (ARRAY[('self'::character varying)::text, ('team'::character varying)::text, ('org'::character varying)::text, ('all'::character varying)::text])))),
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

CREATE TABLE public.video_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    template_id uuid NOT NULL,
    template_version_id uuid,
    title character varying(200) NOT NULL,
    mode character varying(20) DEFAULT 'template_fill'::character varying NOT NULL,
    aspect character varying(12) DEFAULT '9:16'::character varying NOT NULL,
    status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    slot_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_asset_id uuid,
    business_key character varying(120) DEFAULT ''::character varying NOT NULL,
    automation_level character varying(8) DEFAULT 'L1'::character varying NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_video_project_automation CHECK (((automation_level)::text = ANY (ARRAY[('L1'::character varying)::text, ('L2'::character varying)::text, ('L3'::character varying)::text]))),
    CONSTRAINT ck_video_project_mode CHECK (((mode)::text = ANY (ARRAY[('template_fill'::character varying)::text, ('script_to_video'::character varying)::text, ('mashup'::character varying)::text]))),
    CONSTRAINT ck_video_project_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('assembling'::character varying)::text, ('ready'::character varying)::text, ('rendering'::character varying)::text, ('rendered'::character varying)::text, ('failed'::character varying)::text, ('archived'::character varying)::text])))
);

CREATE TABLE public.video_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(160) NOT NULL,
    category character varying(32) NOT NULL,
    type character varying(16) DEFAULT 'assembly'::character varying NOT NULL,
    aspect character varying(12) DEFAULT '9:16'::character varying NOT NULL,
    min_duration_sec integer DEFAULT 15 NOT NULL,
    max_duration_sec integer DEFAULT 30 NOT NULL,
    brand_kit_id uuid,
    description text DEFAULT ''::text NOT NULL,
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    gray_ratio integer DEFAULT 100 NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_video_template_category CHECK (((category)::text = ANY (ARRAY[('live_highlight'::character varying)::text, ('product_seed'::character varying)::text, ('talking_head'::character varying)::text, ('image_text'::character varying)::text, ('batch_mashup'::character varying)::text, ('review_compare'::character varying)::text, ('tutorial_steps'::character varying)::text, ('report_teaser'::character varying)::text]))),
    CONSTRAINT ck_video_template_duration CHECK (((min_duration_sec > 0) AND (max_duration_sec >= min_duration_sec))),
    CONSTRAINT ck_video_template_gray CHECK (((gray_ratio >= 0) AND (gray_ratio <= 100))),
    CONSTRAINT ck_video_template_status CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('archived'::character varying)::text]))),
    CONSTRAINT ck_video_template_type CHECK (((type)::text = ANY (ARRAY[('selection'::character varying)::text, ('assembly'::character varying)::text, ('generation'::character varying)::text])))
);

CREATE TABLE public.voice_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    provider character varying(32) DEFAULT 'system'::character varying NOT NULL,
    voice_id character varying(120) DEFAULT ''::character varying NOT NULL,
    language character varying(16) DEFAULT 'zh'::character varying NOT NULL,
    speed numeric(4,2) DEFAULT 1.00 NOT NULL,
    pitch numeric(4,2) DEFAULT 1.00 NOT NULL,
    sample_url text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_voice_provider CHECK (((provider)::text = ANY (ARRAY[('system'::character varying)::text, ('tts'::character varying)::text, ('clone'::character varying)::text])))
);

CREATE TABLE public.workbench_widgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workbench_id uuid NOT NULL,
    widget_key text NOT NULL,
    title text NOT NULL,
    description text,
    module_code text,
    route text,
    permission text,
    widget_type text DEFAULT 'link'::text NOT NULL,
    size text DEFAULT 'md'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workbench_widgets_size_check CHECK ((size = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text, 'full'::text]))),
    CONSTRAINT workbench_widgets_widget_type_check CHECK ((widget_type = ANY (ARRAY['link'::text, 'metric'::text, 'action'::text, 'list'::text, 'ai'::text])))
);

-- ===== addconstraint (847) =====
ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_plan
    ADD CONSTRAINT ad_plan_plan_no_key UNIQUE (plan_no);

ALTER TABLE ONLY public.ad_plan_receipts
    ADD CONSTRAINT ad_plan_receipts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ad_tool_dict
    ADD CONSTRAINT ad_tool_dict_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.agent_configs
    ADD CONSTRAINT agent_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.agent_configs
    ADD CONSTRAINT agent_configs_tenant_id_agent_key_key UNIQUE (tenant_id, agent_key);

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

ALTER TABLE ONLY public.ai_generation_drafts
    ADD CONSTRAINT ai_generation_drafts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_model_profile
    ADD CONSTRAINT ai_model_profile_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_model_profile
    ADD CONSTRAINT ai_model_profile_tenant_key UNIQUE (tenant_id, profile_key);

ALTER TABLE ONLY public.ai_model_providers
    ADD CONSTRAINT ai_model_providers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_tool_policy
    ADD CONSTRAINT ai_tool_policy_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_tool_policy
    ADD CONSTRAINT ai_tool_policy_tenant_tool_key UNIQUE (tenant_id, tool_name);

ALTER TABLE ONLY public.ai_v2_citation
    ADD CONSTRAINT ai_v2_citation_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_citation
    ADD CONSTRAINT ai_v2_citation_run_id_seq_key UNIQUE (run_id, seq);

ALTER TABLE ONLY public.ai_v2_claim
    ADD CONSTRAINT ai_v2_claim_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_event
    ADD CONSTRAINT ai_v2_event_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_v2_event
    ADD CONSTRAINT ai_v2_event_run_id_seq_key UNIQUE (run_id, seq);

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

ALTER TABLE ONLY public.anchor_competency_profiles
    ADD CONSTRAINT anchor_competency_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_profiles
    ADD CONSTRAINT anchor_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchor_script_templates
    ADD CONSTRAINT anchor_script_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.assistant_memory_audit
    ADD CONSTRAINT assistant_memory_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.assistant_memory_items
    ADD CONSTRAINT assistant_memory_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bgm_library
    ADD CONSTRAINT bgm_library_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bgm_library
    ADD CONSTRAINT bgm_library_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.biz_targets
    ADD CONSTRAINT biz_targets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.brand_kits
    ADD CONSTRAINT brand_kits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.brand_kits
    ADD CONSTRAINT brand_kits_tenant_id_code_key UNIQUE (tenant_id, code);

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

ALTER TABLE ONLY public.compliance_learning_tasks
    ADD CONSTRAINT compliance_learning_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_risk_assessment
    ADD CONSTRAINT compliance_risk_assessment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_rule_change
    ADD CONSTRAINT compliance_rule_change_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_rule_snapshot
    ADD CONSTRAINT compliance_rule_snapshot_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_script_check_logs
    ADD CONSTRAINT compliance_script_check_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.compliance_sensitive_replacements
    ADD CONSTRAINT compliance_sensitive_replacements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_assets
    ADD CONSTRAINT content_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_attribution_ledger
    ADD CONSTRAINT content_attribution_ledger_tenant_id_content_id_platform_co_key UNIQUE (tenant_id, content_id, platform_code, shop_id, biz_date, attribution_channel);

ALTER TABLE ONLY public.content_briefs
    ADD CONSTRAINT content_briefs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_ideas
    ADD CONSTRAINT content_ideas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.content_metrics_link
    ADD CONSTRAINT content_metrics_link_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.decision_case_events
    ADD CONSTRAINT decision_case_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decision_cases
    ADD CONSTRAINT decision_cases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decision_data_gates
    ADD CONSTRAINT decision_data_gates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decision_evidence_items
    ADD CONSTRAINT decision_evidence_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decision_memo_versions
    ADD CONSTRAINT decision_memo_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decision_metric_snapshots
    ADD CONSTRAINT decision_metric_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.decision_reviews
    ADD CONSTRAINT decision_reviews_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.dim_product_cost_versions
    ADD CONSTRAINT dim_product_cost_versions_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public._deprecated_fact_jd_settlement_fees
    ADD CONSTRAINT fact_jd_settlement_fees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public._deprecated_fact_jd_settlement_fees
    ADD CONSTRAINT fact_jd_settlement_fees_tenant_id_shop_id_biz_month_fee_cod_key UNIQUE (tenant_id, shop_id, biz_month, fee_code);

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

ALTER TABLE ONLY public.hrbp_auditions
    ADD CONSTRAINT hrbp_auditions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.hrbp_candidates
    ADD CONSTRAINT hrbp_candidates_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.instance_setup
    ADD CONSTRAINT instance_setup_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.integration_call_logs
    ADD CONSTRAINT integration_call_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT integration_connections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.integration_credentials
    ADD CONSTRAINT integration_credentials_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT integration_webhooks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.issue_library
    ADD CONSTRAINT issue_library_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public._deprecated_jd_purchase_order
    ADD CONSTRAINT jd_purchase_order_biz_date_shop_id_po_number_key UNIQUE (biz_date, shop_id, po_number);

ALTER TABLE ONLY public._deprecated_jd_purchase_order
    ADD CONSTRAINT jd_purchase_order_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_acl
    ADD CONSTRAINT kb_acl_collection_id_role_code_key UNIQUE (collection_id, role_code);

ALTER TABLE ONLY public.kb_acl
    ADD CONSTRAINT kb_acl_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_banned_words
    ADD CONSTRAINT kb_banned_words_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_chunks
    ADD CONSTRAINT kb_chunks_document_id_seq_key UNIQUE (document_id, seq);

ALTER TABLE ONLY public.kb_chunks
    ADD CONSTRAINT kb_chunks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_collections
    ADD CONSTRAINT kb_collections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_feedback
    ADD CONSTRAINT kb_feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_index_versions
    ADD CONSTRAINT kb_index_versions_collection_id_version_key UNIQUE (collection_id, version);

ALTER TABLE ONLY public.kb_index_versions
    ADD CONSTRAINT kb_index_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kb_ingest_jobs
    ADD CONSTRAINT kb_ingest_jobs_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.llm_provider_config
    ADD CONSTRAINT llm_provider_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_draft_exports
    ADD CONSTRAINT media_draft_exports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_highlights
    ADD CONSTRAINT media_highlights_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_render_jobs
    ADD CONSTRAINT media_render_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.media_transcripts
    ADD CONSTRAINT media_transcripts_asset_id_provider_key UNIQUE (asset_id, provider);

ALTER TABLE ONLY public.media_transcripts
    ADD CONSTRAINT media_transcripts_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public._deprecated_pdd_group_buy
    ADD CONSTRAINT pdd_group_buy_biz_date_shop_id_group_id_key UNIQUE (biz_date, shop_id, group_id);

ALTER TABLE ONLY public._deprecated_pdd_group_buy
    ADD CONSTRAINT pdd_group_buy_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.permission_requests
    ADD CONSTRAINT permission_requests_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prompt_eval_runs
    ADD CONSTRAINT prompt_eval_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prompt_templates
    ADD CONSTRAINT prompt_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_template_id_version_key UNIQUE (template_id, version);

ALTER TABLE ONLY public.publish_reversals
    ADD CONSTRAINT publish_reversals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.publish_runs
    ADD CONSTRAINT publish_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.qianchuan_budget_requests
    ADD CONSTRAINT qianchuan_budget_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.qianchuan_sync_runs
    ADD CONSTRAINT qianchuan_sync_runs_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.render_jobs
    ADD CONSTRAINT render_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.render_outputs
    ADD CONSTRAINT render_outputs_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.role_workbenches
    ADD CONSTRAINT role_workbenches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_workbenches
    ADD CONSTRAINT role_workbenches_tenant_id_role_key_variant_key UNIQUE (tenant_id, role_key, variant);

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

ALTER TABLE ONLY public.script_versions
    ADD CONSTRAINT script_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.seasonal_calendar
    ADD CONSTRAINT seasonal_calendar_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.seasonal_calendar
    ADD CONSTRAINT seasonal_calendar_tenant_id_event_code_key UNIQUE (tenant_id, event_code);

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_date_anchor_id_key UNIQUE (date, anchor_id);

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_channel_metrics
    ADD CONSTRAINT session_channel_metrics_period_date_channel_key UNIQUE (period_date, channel);

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

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_room_id_business_date_video_nam_key UNIQUE (room_id, business_date, video_name);

ALTER TABLE ONLY public.session_staff_assignments
    ADD CONSTRAINT session_staff_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_staff_assignments
    ADD CONSTRAINT session_staff_assignments_session_id_role_code_staff_name_key UNIQUE (session_id, role_code, staff_name);

ALTER TABLE ONLY public.setup_templates
    ADD CONSTRAINT setup_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shot_items
    ADD CONSTRAINT shot_items_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.storyboards
    ADD CONSTRAINT storyboards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subtitle_styles
    ADD CONSTRAINT subtitle_styles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subtitle_styles
    ADD CONSTRAINT subtitle_styles_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.sys_custom_field_definition
    ADD CONSTRAINT sys_custom_field_definition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_custom_field_value
    ADD CONSTRAINT sys_custom_field_value_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sys_deprecation_access_logs
    ADD CONSTRAINT sys_deprecation_access_logs_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.system_module_parameters
    ADD CONSTRAINT system_module_parameters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.system_platform_configs
    ADD CONSTRAINT system_platform_configs_pkey PRIMARY KEY (platform_code);

ALTER TABLE ONLY public.target_templates
    ADD CONSTRAINT target_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.template_versions
    ADD CONSTRAINT template_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.template_versions
    ADD CONSTRAINT template_versions_template_id_version_key UNIQUE (template_id, version);

ALTER TABLE ONLY public._deprecated_tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.topic_performance
    ADD CONSTRAINT topic_performance_pkey PRIMARY KEY (id);

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

ALTER TABLE ONLY public.anchor_competency_profiles
    ADD CONSTRAINT uq_anchor_name_per_tenant UNIQUE (tenant_id, anchor_name);

ALTER TABLE ONLY public.dim_product_channel_listing
    ADD CONSTRAINT uq_channel_listing_sku UNIQUE (shop_id, platform_code, channel_sku_id);

ALTER TABLE ONLY public.fact_content_daily
    ADD CONSTRAINT uq_content_daily_biz_key UNIQUE (biz_date, platform_code, shop_id, content_id);

ALTER TABLE ONLY public.sys_custom_field_value
    ADD CONSTRAINT uq_custom_field_val UNIQUE (field_id, entity_type, entity_id);

ALTER TABLE ONLY public.decision_data_gates
    ADD CONSTRAINT uq_gate_item_per_case UNIQUE (case_id, check_item);

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT uq_integration_connection UNIQUE (tenant_id, platform);

ALTER TABLE ONLY public.integration_credentials
    ADD CONSTRAINT uq_integration_credential UNIQUE (tenant_id, platform, label);

ALTER TABLE ONLY public.integration_webhooks
    ADD CONSTRAINT uq_integration_webhook UNIQUE (tenant_id, platform);

ALTER TABLE ONLY public.kb_banned_words
    ADD CONSTRAINT uq_kb_banned_word UNIQUE (tenant_id, normalized, platform);

ALTER TABLE ONLY public.kb_collections
    ADD CONSTRAINT uq_kb_collection_code UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.decision_memo_versions
    ADD CONSTRAINT uq_memo_version_per_case UNIQUE (case_id, version);

ALTER TABLE ONLY public.system_module_parameters
    ADD CONSTRAINT uq_module_param_scope UNIQUE (module_code, param_key, scope_type, scope_id);

ALTER TABLE ONLY public.dim_product_cost_versions
    ADD CONSTRAINT uq_product_cost_version UNIQUE (tenant_id, product_id, cost_version);

ALTER TABLE ONLY public.prompt_templates
    ADD CONSTRAINT uq_prompt_template_key UNIQUE (tenant_id, key);

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

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.video_templates
    ADD CONSTRAINT video_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.video_templates
    ADD CONSTRAINT video_templates_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.voice_profiles
    ADD CONSTRAINT voice_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.voice_profiles
    ADD CONSTRAINT voice_profiles_tenant_id_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.workbench_widgets
    ADD CONSTRAINT workbench_widgets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workbench_widgets
    ADD CONSTRAINT workbench_widgets_workbench_id_widget_key_key UNIQUE (workbench_id, widget_key);

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

ALTER TABLE ONLY public.agent_configs
    ADD CONSTRAINT agent_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.ai_generation_drafts
    ADD CONSTRAINT ai_generation_drafts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.prompt_templates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_model_providers
    ADD CONSTRAINT ai_model_providers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_v2_citation
    ADD CONSTRAINT ai_v2_citation_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_claim
    ADD CONSTRAINT ai_v2_claim_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_claim
    ADD CONSTRAINT ai_v2_claim_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ai_v2_event
    ADD CONSTRAINT ai_v2_event_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_evidence
    ADD CONSTRAINT ai_v2_evidence_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_evidence
    ADD CONSTRAINT ai_v2_evidence_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ai_v2_llm_call
    ADD CONSTRAINT ai_v2_llm_call_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_llm_call
    ADD CONSTRAINT ai_v2_llm_call_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.ai_v2_run
    ADD CONSTRAINT ai_v2_run_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_v2_run
    ADD CONSTRAINT ai_v2_run_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_v2_step
    ADD CONSTRAINT ai_v2_step_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.ai_v2_run(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_v2_step
    ADD CONSTRAINT ai_v2_step_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_ack_by_fkey FOREIGN KEY (ack_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL;

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_competency_profiles
    ADD CONSTRAINT anchor_competency_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchor_profiles
    ADD CONSTRAINT anchor_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.anchors(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.assistant_memory_items
    ADD CONSTRAINT assistant_memory_items_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.assistant_memory_items(id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.biz_targets
    ADD CONSTRAINT biz_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.biz_targets
    ADD CONSTRAINT biz_targets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.compliance_learning_tasks
    ADD CONSTRAINT compliance_learning_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.compliance_learning_tasks
    ADD CONSTRAINT compliance_learning_tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.compliance_script_check_logs
    ADD CONSTRAINT compliance_script_check_logs_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.compliance_script_check_logs
    ADD CONSTRAINT compliance_script_check_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.compliance_sensitive_replacements
    ADD CONSTRAINT compliance_sensitive_replacements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.content_briefs
    ADD CONSTRAINT content_briefs_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.content_ideas(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_metrics_link
    ADD CONSTRAINT content_metrics_link_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.content_ideas(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.content_metrics_link
    ADD CONSTRAINT content_metrics_link_script_version_id_fkey FOREIGN KEY (script_version_id) REFERENCES public.script_versions(id) ON DELETE SET NULL;

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

ALTER TABLE ONLY public.decision_case_events
    ADD CONSTRAINT decision_case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.decision_cases(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_case_events
    ADD CONSTRAINT decision_case_events_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.decision_case_events
    ADD CONSTRAINT decision_case_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_cases
    ADD CONSTRAINT decision_cases_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.decision_cases
    ADD CONSTRAINT decision_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.decision_cases
    ADD CONSTRAINT decision_cases_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.decision_cases
    ADD CONSTRAINT decision_cases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_data_gates
    ADD CONSTRAINT decision_data_gates_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.decision_cases(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_data_gates
    ADD CONSTRAINT decision_data_gates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_evidence_items
    ADD CONSTRAINT decision_evidence_items_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.decision_cases(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_evidence_items
    ADD CONSTRAINT decision_evidence_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_memo_versions
    ADD CONSTRAINT decision_memo_versions_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.decision_cases(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_memo_versions
    ADD CONSTRAINT decision_memo_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.decision_memo_versions
    ADD CONSTRAINT decision_memo_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_metric_snapshots
    ADD CONSTRAINT decision_metric_snapshots_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.decision_cases(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_metric_snapshots
    ADD CONSTRAINT decision_metric_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_reviews
    ADD CONSTRAINT decision_reviews_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.decision_cases(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.decision_reviews
    ADD CONSTRAINT decision_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.decision_reviews
    ADD CONSTRAINT decision_reviews_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.dim_product_cost_versions
    ADD CONSTRAINT dim_product_cost_versions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.dim_product(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.dim_product_cost_versions
    ADD CONSTRAINT dim_product_cost_versions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public._deprecated_fact_jd_settlement_fees
    ADD CONSTRAINT fact_jd_settlement_fees_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public._deprecated_fact_jd_settlement_fees
    ADD CONSTRAINT fact_jd_settlement_fees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.hrbp_auditions
    ADD CONSTRAINT hrbp_auditions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.hrbp_candidates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hrbp_candidates
    ADD CONSTRAINT hrbp_candidates_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_source_platform_fkey FOREIGN KEY (source_platform) REFERENCES public.system_platform_configs(platform_code);

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.dim_shop(id);

ALTER TABLE ONLY public.import_files
    ADD CONSTRAINT import_files_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.improvement_tasks
    ADD CONSTRAINT improvement_tasks_decision_case_id_fkey FOREIGN KEY (decision_case_id) REFERENCES public.decision_cases(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_clean_rule_set_id_fkey FOREIGN KEY (clean_rule_set_id) REFERENCES public.clean_rule_sets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.ingest_sync_jobs
    ADD CONSTRAINT ingest_sync_jobs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.integration_call_logs
    ADD CONSTRAINT integration_call_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.integration_connections(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.integration_connections
    ADD CONSTRAINT integration_connections_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.integration_credentials(id) ON DELETE SET NULL;

ALTER TABLE ONLY public._deprecated_jd_purchase_order
    ADD CONSTRAINT jd_purchase_order_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_acl
    ADD CONSTRAINT kb_acl_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.kb_collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_chunks
    ADD CONSTRAINT kb_chunks_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.kb_collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_chunks
    ADD CONSTRAINT kb_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.kb_documents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_documents
    ADD CONSTRAINT kb_documents_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.kb_collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_feedback
    ADD CONSTRAINT kb_feedback_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES public.kb_chunks(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kb_feedback
    ADD CONSTRAINT kb_feedback_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.kb_documents(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.kb_index_versions
    ADD CONSTRAINT kb_index_versions_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.kb_collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_ingest_jobs
    ADD CONSTRAINT kb_ingest_jobs_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.kb_collections(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kb_ingest_jobs
    ADD CONSTRAINT kb_ingest_jobs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.kb_documents(id) ON DELETE SET NULL;

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

ALTER TABLE ONLY public.media_draft_exports
    ADD CONSTRAINT media_draft_exports_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.media_highlights
    ADD CONSTRAINT media_highlights_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.media_highlights
    ADD CONSTRAINT media_highlights_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.media_transcripts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.media_render_jobs
    ADD CONSTRAINT media_render_jobs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.media_render_jobs
    ADD CONSTRAINT media_render_jobs_highlight_id_fkey FOREIGN KEY (highlight_id) REFERENCES public.media_highlights(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.media_transcripts
    ADD CONSTRAINT media_transcripts_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.multi_room_status
    ADD CONSTRAINT multi_room_status_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_status_config
    ADD CONSTRAINT order_status_config_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public._deprecated_pdd_group_buy
    ADD CONSTRAINT pdd_group_buy_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.dim_shop(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.permission_requests
    ADD CONSTRAINT permission_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.permission_requests
    ADD CONSTRAINT permission_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.permission_requests
    ADD CONSTRAINT permission_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_platform_code_fkey FOREIGN KEY (platform_code) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE;

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prompt_eval_runs
    ADD CONSTRAINT prompt_eval_runs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.prompt_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prompt_versions
    ADD CONSTRAINT prompt_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.prompt_templates(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.render_jobs
    ADD CONSTRAINT render_jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.video_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.render_outputs
    ADD CONSTRAINT render_outputs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.render_jobs(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.role_workbenches
    ADD CONSTRAINT role_workbenches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.script_versions
    ADD CONSTRAINT script_versions_brief_id_fkey FOREIGN KEY (brief_id) REFERENCES public.content_briefs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.script_versions
    ADD CONSTRAINT script_versions_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.content_ideas(id) ON DELETE SET NULL;

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

ALTER TABLE ONLY public.setup_templates
    ADD CONSTRAINT setup_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shot_items
    ADD CONSTRAINT shot_items_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shot_items
    ADD CONSTRAINT shot_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.video_projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.signal_source
    ADD CONSTRAINT signal_source_category_code_fkey FOREIGN KEY (category_code) REFERENCES public.dim_category(code) ON DELETE CASCADE;

ALTER TABLE ONLY public.stg_order_import
    ADD CONSTRAINT stg_order_import_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.storyboards
    ADD CONSTRAINT storyboards_script_version_id_fkey FOREIGN KEY (script_version_id) REFERENCES public.script_versions(id) ON DELETE CASCADE;

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

ALTER TABLE ONLY public.template_versions
    ADD CONSTRAINT template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.video_templates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public._deprecated_tenant_subscriptions
    ADD CONSTRAINT tenant_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.topic_performance
    ADD CONSTRAINT topic_performance_idea_id_fkey FOREIGN KEY (idea_id) REFERENCES public.content_ideas(id) ON DELETE SET NULL;

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
    ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES public.roles(code) ON UPDATE CASCADE ON DELETE RESTRICT;

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

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_source_asset_id_fkey FOREIGN KEY (source_asset_id) REFERENCES public.media_assets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.video_templates(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_template_version_id_fkey FOREIGN KEY (template_version_id) REFERENCES public.template_versions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.video_templates
    ADD CONSTRAINT video_templates_brand_kit_id_fkey FOREIGN KEY (brand_kit_id) REFERENCES public.brand_kits(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.workbench_widgets
    ADD CONSTRAINT workbench_widgets_workbench_id_fkey FOREIGN KEY (workbench_id) REFERENCES public.role_workbenches(id) ON DELETE CASCADE;

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

-- ===== view (12) =====
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

CREATE VIEW public.anchor_rankings WITH (security_invoker='true') AS
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

CREATE VIEW public.metric_catalog WITH (security_invoker='true') AS
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

CREATE VIEW public.session_product_details WITH (security_invoker='true') AS
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

CREATE VIEW public.session_product_skus WITH (security_invoker='true') AS
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

CREATE VIEW public.v_ad_plan_comparison WITH (security_invoker='true') AS
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

CREATE VIEW public.v_ad_reconciliation AS
 SELECT a.platform_code,
    a.shop_id,
    a.biz_date,
    a.ad_tool,
    a.ad_spend,
    a.ad_gmv AS ad_platform_gmv,
    COALESCE(t.trade_gmv, (0)::numeric) AS merchant_gmv,
        CASE
            WHEN (COALESCE(t.trade_gmv, (0)::numeric) > (0)::numeric) THEN round((((a.ad_gmv - t.trade_gmv) / t.trade_gmv) * (100)::numeric), 2)
            ELSE NULL::numeric
        END AS diff_pct,
        CASE
            WHEN (a.ad_spend > (0)::numeric) THEN round((a.ad_gmv / a.ad_spend), 2)
            ELSE (0)::numeric
        END AS ad_roi,
        CASE
            WHEN ((COALESCE(t.trade_gmv, (0)::numeric) > (0)::numeric) AND (a.ad_spend > (0)::numeric)) THEN round((t.trade_gmv / a.ad_spend), 2)
            ELSE (0)::numeric
        END AS merchant_roi
   FROM (( SELECT fact_ad_daily.platform_code,
            fact_ad_daily.shop_id,
            fact_ad_daily.biz_date,
            fact_ad_daily.ad_tool,
            sum(fact_ad_daily.ad_spend) AS ad_spend,
            sum(fact_ad_daily.ad_gmv) AS ad_gmv
           FROM public.fact_ad_daily
          GROUP BY fact_ad_daily.platform_code, fact_ad_daily.shop_id, fact_ad_daily.biz_date, fact_ad_daily.ad_tool) a
     LEFT JOIN ( SELECT fact_trade_daily.platform_code,
            fact_trade_daily.shop_id,
            fact_trade_daily.biz_date,
            sum(fact_trade_daily.gmv) AS trade_gmv
           FROM public.fact_trade_daily
          GROUP BY fact_trade_daily.platform_code, fact_trade_daily.shop_id, fact_trade_daily.biz_date) t ON ((((t.platform_code)::text = (a.platform_code)::text) AND (t.shop_id = a.shop_id) AND (t.biz_date = a.biz_date))));

CREATE VIEW public.v_fact_trade_default WITH (security_invoker='true') AS
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

CREATE VIEW public.v_rls_force_coverage WITH (security_invoker='true') AS
 WITH whitelist(tablename) AS (
         VALUES ('content_tasks'::text), ('session_plan_products'::text), ('import_batches'::text), ('publish_runs'::text), ('canonical_orders'::text), ('canonical_order_items'::text), ('canonical_refund_events'::text)
        ), expected(tablename) AS (
         SELECT whitelist.tablename
           FROM whitelist
        UNION
         SELECT c.relname
           FROM ((((pg_inherits i
             JOIN pg_class c ON ((c.oid = i.inhrelid)))
             JOIN pg_class p ON ((p.oid = i.inhparent)))
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
             JOIN whitelist w ON ((w.tablename = p.relname)))
          WHERE (n.nspname = 'public'::name)
        ), actual AS (
         SELECT c.relname AS tablename,
            c.relrowsecurity AS rls_enabled,
            c.relforcerowsecurity AS force_enabled,
            ( SELECT count(*) AS count
                   FROM pg_policies p
                  WHERE ((p.schemaname = 'public'::name) AND (p.tablename = c.relname))) AS policy_count
           FROM (pg_class c
             JOIN pg_namespace n ON ((n.oid = c.relnamespace)))
          WHERE ((n.nspname = 'public'::name) AND (c.relkind = ANY (ARRAY['r'::"char", 'p'::"char"])))
        )
 SELECT e.tablename,
    COALESCE(a.rls_enabled, false) AS rls_enabled,
    COALESCE(a.force_enabled, false) AS force_enabled,
    COALESCE(a.policy_count, (0)::bigint) AS policy_count,
    (COALESCE(a.rls_enabled, false) AND COALESCE(a.force_enabled, false) AND (COALESCE(a.policy_count, (0)::bigint) > 0)) AS ok
   FROM (expected e
     LEFT JOIN actual a USING (tablename))
  ORDER BY e.tablename;

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
        ), day_room_stats AS (
         SELECT s.room_id,
            s.date AS biz_date,
            (count(*))::numeric AS session_cnt,
            COALESCE(sum(s.gmv), (0)::numeric) AS day_total_gmv
           FROM public.live_sessions s
          GROUP BY s.room_id, s.date
        ), fee AS (
         SELECT c.shop_id,
            c.order_date AS biz_date,
            sum(c.platform_fee) AS platform_fee,
            sum(c.ad_spend) AS settle_ad_spend,
            sum(c.reserve_held) AS reserve_held
           FROM public.fact_settlement_cycles c
          GROUP BY c.shop_id, c.order_date
        ), ad_pool AS (
         SELECT a.shop_id,
            a.biz_date,
            sum(a.ad_spend) AS day_ad_spend
           FROM public.fact_ad_spend_daily a
          GROUP BY a.shop_id, a.biz_date
        ), ko AS (
         SELECT k.shop_id,
            k.publish_date AS biz_date,
            sum(k.pit_fee) AS pit_fee,
            sum(k.commission_amount) AS commission_amount
           FROM public.fact_kol_cooperation k
          GROUP BY k.shop_id, k.publish_date
        ), cogs AS (
         SELECT sp.session_id,
            sum(((sp.sold_count)::numeric * COALESCE(cv.unit_cost, p.unit_cost, (0)::numeric))) AS session_cogs
           FROM ((public.session_plan_products sp
             LEFT JOIN public.dim_product p ON ((((p.id)::text = (sp.product_id)::text) OR ((p.sku_code)::text = (sp.product_code)::text))))
             LEFT JOIN public.dim_product_cost_versions cv ON (((cv.product_id = p.id) AND (sp.business_date >= (cv.effective_from)::date) AND ((cv.effective_to IS NULL) OR (sp.business_date <= (cv.effective_to)::date)))))
          WHERE (sp.session_id IS NOT NULL)
          GROUP BY sp.session_id
        )
 SELECT sess.session_id,
    sess.room_id,
    sess.shop_id,
    sess.platform_code,
    sess.biz_date,
    sess.gmv,
    sess.return_amount,
    (sess.gmv - sess.return_amount) AS net_revenue,
    round(COALESCE(cogs.session_cogs, (0)::numeric), 2) AS cogs_alloc,
    round((COALESCE(fee.platform_fee, (0)::numeric) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END), 2) AS platform_fee_alloc,
    round(
        CASE
            WHEN (sess.session_ad_cost > (0)::numeric) THEN sess.session_ad_cost
            ELSE (COALESCE(ad_pool.day_ad_spend, (0)::numeric) *
            CASE
                WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
                ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
            END)
        END, 2) AS ad_spend_alloc,
    round((COALESCE(ko.pit_fee, (0)::numeric) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END), 2) AS kol_pit_fee_alloc,
    round((COALESCE(ko.commission_amount, (0)::numeric) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END), 2) AS kol_commission_alloc,
    round((((COALESCE(cogs.session_cogs, (0)::numeric) + (COALESCE(fee.platform_fee, (0)::numeric) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END)) +
        CASE
            WHEN (sess.session_ad_cost > (0)::numeric) THEN sess.session_ad_cost
            ELSE (COALESCE(ad_pool.day_ad_spend, (0)::numeric) *
            CASE
                WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
                ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
            END)
        END) + ((COALESCE(ko.pit_fee, (0)::numeric) + COALESCE(ko.commission_amount, (0)::numeric)) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END)), 2) AS total_cost_alloc,
    round(((sess.gmv - sess.return_amount) - (((COALESCE(cogs.session_cogs, (0)::numeric) + (COALESCE(fee.platform_fee, (0)::numeric) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END)) +
        CASE
            WHEN (sess.session_ad_cost > (0)::numeric) THEN sess.session_ad_cost
            ELSE (COALESCE(ad_pool.day_ad_spend, (0)::numeric) *
            CASE
                WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
                ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
            END)
        END) + ((COALESCE(ko.pit_fee, (0)::numeric) + COALESCE(ko.commission_amount, (0)::numeric)) *
        CASE
            WHEN (dr.day_total_gmv > (0)::numeric) THEN (sess.gmv / dr.day_total_gmv)
            ELSE (1.0 / GREATEST(dr.session_cnt, (1)::numeric))
        END))), 2) AS net_profit_alloc
   FROM (((((sess
     JOIN day_room_stats dr ON (((dr.room_id = sess.room_id) AND (dr.biz_date = sess.biz_date))))
     LEFT JOIN fee ON (((fee.shop_id = sess.shop_id) AND (fee.biz_date = sess.biz_date))))
     LEFT JOIN ad_pool ON (((ad_pool.shop_id = sess.shop_id) AND (ad_pool.biz_date = sess.biz_date))))
     LEFT JOIN ko ON (((ko.shop_id = sess.shop_id) AND (ko.biz_date = sess.biz_date))))
     LEFT JOIN cogs ON ((cogs.session_id = sess.session_id)));

CREATE VIEW public.v_staff_attendance WITH (security_invoker='true') AS
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
            WHEN ((COALESCE(ds.status, 'work'::character varying))::text = ANY (ARRAY[('rest'::character varying)::text, ('leave'::character varying)::text, ('sick'::character varying)::text])) THEN false
            WHEN ((de.session_status)::text = 'cancelled'::text) THEN true
            WHEN (((de.session_status)::text = 'scheduled'::text) AND (de.biz_date < CURRENT_DATE)) THEN true
            WHEN (((de.role_code)::text = 'anchor'::text) AND ((de.session_status)::text = ANY (ARRAY[('completed'::character varying)::text, ('live'::character varying)::text])) AND (COALESCE(ac.actual_rows, 0) = 0)) THEN true
            ELSE false
        END AS is_absent,
        CASE
            WHEN ((COALESCE(ds.status, 'work'::character varying))::text = ANY (ARRAY[('rest'::character varying)::text, ('leave'::character varying)::text, ('sick'::character varying)::text])) THEN (('当日为'::text || (COALESCE(ds.status, ''::character varying))::text) || '，不计缺勤'::text)
            WHEN ((de.session_status)::text = 'cancelled'::text) THEN '场次已取消'::text
            WHEN (((de.session_status)::text = 'scheduled'::text) AND (de.biz_date < CURRENT_DATE)) THEN '场次过期未开播'::text
            WHEN (((de.role_code)::text = 'anchor'::text) AND ((de.session_status)::text = ANY (ARRAY[('completed'::character varying)::text, ('live'::character varying)::text])) AND (COALESCE(ac.actual_rows, 0) = 0)) THEN '场次已开播但无直播登记'::text
            ELSE ''::text
        END AS absence_note
   FROM ((dedup_expected de
     LEFT JOIN actual ac ON ((((ac.staff_name)::text = (de.staff_name)::text) AND (ac.biz_date = de.biz_date) AND (ac.room_id = de.room_id))))
     LEFT JOIN day_status ds ON ((((ds.staff_name)::text = (de.staff_name)::text) AND (ds.biz_date = de.biz_date))));

-- ===== index (328) =====
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

CREATE INDEX idx_ai_action_approvals_status_expires ON public.ai_action_approvals USING btree (status, expires_at);

CREATE INDEX idx_ai_action_approvals_tenant ON public.ai_action_approvals USING btree (tenant_id, status);

CREATE INDEX idx_ai_action_approvals_tool_log ON public.ai_action_approvals USING btree (tool_log_id);

CREATE INDEX idx_ai_context_bindings_scope ON public.ai_context_bindings USING btree (scope_type, scope_id);

CREATE INDEX idx_ai_context_bindings_user ON public.ai_context_bindings USING btree (user_id);

CREATE UNIQUE INDEX idx_ai_conversations_deerflow_thread ON public.ai_conversations USING btree (deerflow_thread_id) WHERE (deerflow_thread_id IS NOT NULL);

CREATE INDEX idx_ai_conversations_status ON public.ai_conversations USING btree (status);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations USING btree (user_id);

CREATE INDEX idx_ai_messages_conv ON public.ai_messages USING btree (conversation_id);

CREATE INDEX idx_ai_messages_user ON public.ai_messages USING btree (user_id);

CREATE INDEX idx_ai_model_profile_route ON public.ai_model_profile USING btree (tenant_id, is_enabled, priority);

CREATE INDEX idx_ai_model_providers_tenant ON public.ai_model_providers USING btree (tenant_id, profile);

CREATE INDEX idx_ai_runs_conv ON public.ai_analysis_runs USING btree (conversation_id, created_at DESC);

CREATE INDEX idx_ai_runs_user ON public.ai_analysis_runs USING btree (user_id, created_at DESC);

CREATE INDEX idx_ai_steps_run ON public.ai_analysis_steps USING btree (run_id, seq);

CREATE INDEX idx_ai_tool_logs_actor ON public.ai_tool_logs USING btree (actor_user_id);

CREATE INDEX idx_ai_tool_logs_conv ON public.ai_tool_logs USING btree (conversation_id);

CREATE INDEX idx_ai_tool_logs_created ON public.ai_tool_logs USING btree (created_at DESC);

CREATE INDEX idx_ai_tool_logs_tool ON public.ai_tool_logs USING btree (tool_name);

CREATE INDEX idx_ai_tool_policy_tenant ON public.ai_tool_policy USING btree (tenant_id, is_enabled);

CREATE INDEX idx_ai_v2_citation_chunk ON public.ai_v2_citation USING btree (local_chunk_id);

CREATE INDEX idx_ai_v2_citation_run ON public.ai_v2_citation USING btree (run_id, seq);

CREATE INDEX idx_ai_v2_claim_run ON public.ai_v2_claim USING btree (run_id);

CREATE INDEX idx_ai_v2_claim_tenant ON public.ai_v2_claim USING btree (tenant_id);

CREATE INDEX idx_ai_v2_event_run_seq ON public.ai_v2_event USING btree (run_id, seq);

CREATE INDEX idx_ai_v2_evidence_key ON public.ai_v2_evidence USING btree (run_id, evidence_key);

CREATE INDEX idx_ai_v2_evidence_run ON public.ai_v2_evidence USING btree (run_id);

CREATE INDEX idx_ai_v2_evidence_tenant ON public.ai_v2_evidence USING btree (tenant_id);

CREATE INDEX idx_ai_v2_llm_call_tenant ON public.ai_v2_llm_call USING btree (tenant_id);

CREATE INDEX idx_ai_v2_llm_conv ON public.ai_v2_llm_call USING btree (conversation_id);

CREATE INDEX idx_ai_v2_llm_created ON public.ai_v2_llm_call USING btree (created_at DESC);

CREATE INDEX idx_ai_v2_llm_run ON public.ai_v2_llm_call USING btree (run_id);

CREATE INDEX idx_ai_v2_llm_tenant ON public.ai_v2_llm_call USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_ai_v2_run_conv ON public.ai_v2_run USING btree (conversation_id);

CREATE INDEX idx_ai_v2_run_created ON public.ai_v2_run USING btree (created_at DESC);

CREATE INDEX idx_ai_v2_run_status ON public.ai_v2_run USING btree (status, updated_at);

CREATE INDEX idx_ai_v2_run_tenant ON public.ai_v2_run USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_ai_v2_step_run ON public.ai_v2_step USING btree (run_id, seq);

CREATE INDEX idx_ai_v2_step_tenant ON public.ai_v2_step USING btree (tenant_id);

CREATE INDEX idx_alert_events_status ON public.alert_events USING btree (status);

CREATE INDEX idx_alert_events_time ON public.alert_events USING btree (event_time DESC);

CREATE INDEX idx_anchor_profiles_tenant ON public.anchor_competency_profiles USING btree (tenant_id);

CREATE INDEX idx_anchors_platform ON public.anchors USING btree (platform_code);

CREATE INDEX idx_anchors_user ON public.anchors USING btree (user_id);

CREATE INDEX idx_assistant_memory_audit_memory ON public.assistant_memory_audit USING btree (tenant_id, memory_id, created_at DESC);

CREATE INDEX idx_assistant_memory_created ON public.assistant_memory_items USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_assistant_memory_key ON public.assistant_memory_items USING btree (tenant_id, memory_key);

CREATE INDEX idx_assistant_memory_scope ON public.assistant_memory_items USING btree (tenant_id, scope, owner_user_id, role_key, status);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id);

CREATE INDEX idx_audit_logs_actor_action ON public.audit_logs USING btree (actor_user_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);

CREATE INDEX idx_basic_info_room_date ON public.session_live_basic_info USING btree (room_id, business_date DESC);

CREATE INDEX idx_basic_info_session ON public.session_live_basic_info USING btree (session_id);

CREATE INDEX idx_biz_targets_lookup ON public.biz_targets USING btree (tenant_id, metric_code, period_start, period_end) WHERE (status = 'active'::text);

CREATE INDEX idx_caliber_platform ON public.platform_caliber_config USING btree (platform_code, metric_code);

CREATE INDEX idx_campaign_plan_dispatched_at ON public.campaign_plan USING btree (dispatched_at);

CREATE INDEX idx_campaign_plan_shop ON public.campaign_plan USING btree (shop_id);

CREATE INDEX idx_campaign_plan_tenant ON public.campaign_plan USING btree (tenant_id);

CREATE INDEX idx_channel_listing_active ON public.dim_product_channel_listing USING btree (is_active);

CREATE INDEX idx_channel_listing_prod ON public.dim_product_channel_listing USING btree (product_id);

CREATE INDEX idx_channel_listing_shop_platform ON public.dim_product_channel_listing USING btree (shop_id, platform_code);

CREATE INDEX idx_compliance_script_logs_tenant ON public.compliance_script_check_logs USING btree (tenant_id, checked_at);

CREATE INDEX idx_compliance_status ON public.compliance_events USING btree (tenant_id, status, occurred_at DESC);

CREATE INDEX idx_compliance_tasks_tenant ON public.compliance_learning_tasks USING btree (tenant_id, status);

CREATE INDEX idx_content_assets_project ON public.content_assets USING btree (project_id);

CREATE INDEX idx_content_assets_tenant_project ON public.content_assets USING btree (tenant_id, project_id);

CREATE INDEX idx_content_briefs_tenant ON public.content_briefs USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_content_daily_ps ON public.fact_content_daily USING btree (biz_date, platform_code, shop_id);

CREATE INDEX idx_content_ideas_tenant ON public.content_ideas USING btree (tenant_id, status, opportunity_score DESC NULLS LAST);

CREATE INDEX idx_content_metrics_link_version ON public.content_metrics_link USING btree (tenant_id, script_version_id, biz_date DESC);

CREATE INDEX idx_content_schedules_stage ON public.content_schedules USING btree (tenant_id, stage, planned_publish_at DESC);

CREATE INDEX idx_content_tasks_project ON public.content_tasks USING btree (project_id);

CREATE INDEX idx_content_tasks_status ON public.content_tasks USING btree (status, created_at DESC);

CREATE INDEX idx_cs_session_date_platform ON public.fact_cs_session USING btree (session_date DESC, platform_code);

CREATE INDEX idx_custom_field_entity_plat ON public.sys_custom_field_definition USING btree (entity_type, platform_code, is_active);

CREATE INDEX idx_custom_val_entity ON public.sys_custom_field_value USING btree (entity_type, entity_id);

CREATE INDEX idx_custom_val_key ON public.sys_custom_field_value USING btree (field_key);

CREATE INDEX idx_data_uploads_shop ON public.data_uploads USING btree (shop_id, created_at DESC);

CREATE INDEX idx_decision_case_events_lookup ON public.decision_case_events USING btree (tenant_id, case_id, created_at DESC);

CREATE INDEX idx_decision_cases_status ON public.decision_cases USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_decision_cases_tenant ON public.decision_cases USING btree (tenant_id);

CREATE INDEX idx_decision_data_gates_lookup ON public.decision_data_gates USING btree (tenant_id, case_id);

CREATE INDEX idx_decision_reviews_tenant_case ON public.decision_reviews USING btree (tenant_id, case_id);

CREATE INDEX idx_decision_snapshots_tenant_case ON public.decision_metric_snapshots USING btree (tenant_id, case_id);

CREATE INDEX idx_deprecations_accessed ON public.sys_deprecation_access_logs USING btree (accessed_at DESC);

CREATE INDEX idx_deprecations_route ON public.sys_deprecation_access_logs USING btree (route_path, accessed_at DESC);

CREATE INDEX idx_dim_category_level ON public.dim_category USING btree (level);

CREATE INDEX idx_dim_category_parent ON public.dim_category USING btree (parent_code);

CREATE INDEX idx_dim_product_category_code ON public.dim_product USING btree (category_code);

CREATE INDEX idx_dim_product_spu ON public.dim_product USING btree (spu_code);

CREATE INDEX idx_dim_shop_brand_id ON public.dim_shop USING btree (brand_id);

CREATE INDEX idx_dim_shop_tenant_id ON public.dim_shop USING btree (tenant_id);

CREATE INDEX idx_dim_shop_tenant_platform ON public.dim_shop USING btree (tenant_id, platform_code);

CREATE INDEX idx_dim_sku_mapping_product ON public.dim_sku_mapping USING btree (product_id);

CREATE INDEX idx_dim_team_dept ON public.dim_team USING btree (dept_id);

CREATE INDEX idx_douyin_anchor_daily_anchor ON public.douyin_anchor_daily_metrics USING btree (anchor_name, business_date DESC);

CREATE INDEX idx_douyin_anchor_daily_date ON public.douyin_anchor_daily_metrics USING btree (business_date DESC);

CREATE INDEX idx_douyin_channel_daily_date ON public.douyin_channel_daily_metrics USING btree (business_date DESC);

CREATE INDEX idx_evidence_items_case ON public.decision_evidence_items USING btree (tenant_id, case_id);

CREATE INDEX idx_fact_inventory_ledger_prod_time ON public.fact_inventory_ledger USING btree (product_id, created_at DESC);

CREATE INDEX idx_fact_inventory_low_stock ON public.fact_inventory_stock USING btree (available_qty, safety_stock);

CREATE INDEX idx_generation_drafts_template ON public.ai_generation_drafts USING btree (tenant_id, template_key, created_at DESC);

CREATE INDEX idx_generation_drafts_tenant ON public.ai_generation_drafts USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_gl_entry_account ON public.fact_gl_entry USING btree (account_code);

CREATE INDEX idx_gl_entry_session ON public.fact_gl_entry USING btree (session_id);

CREATE INDEX idx_gl_entry_shop_date ON public.fact_gl_entry USING btree (shop_id, created_at);

CREATE INDEX idx_gl_entry_voucher ON public.fact_gl_entry USING btree (voucher_id, line_no);

CREATE INDEX idx_gl_voucher_date_period ON public.fact_gl_voucher USING btree (biz_date, period);

CREATE INDEX idx_gl_voucher_ref ON public.fact_gl_voucher USING btree (ref_type, ref_id);

CREATE INDEX idx_gl_voucher_session ON public.fact_gl_voucher USING btree (session_id);

CREATE INDEX idx_gl_voucher_shop_plat ON public.fact_gl_voucher USING btree (shop_id, platform_code);

CREATE INDEX idx_goal_tracking_source ON public.goal_tracking USING btree (source_template_id);

CREATE INDEX idx_hrbp_auditions_candidate ON public.hrbp_auditions USING btree (candidate_id);

CREATE INDEX idx_hrbp_candidates_anchor ON public.hrbp_candidates USING btree (anchor_id);

CREATE INDEX idx_hrbp_candidates_category ON public.hrbp_candidates USING btree (target_category);

CREATE INDEX idx_hrbp_candidates_stage ON public.hrbp_candidates USING btree (stage);

CREATE INDEX idx_improvement_tasks_decision_case ON public.improvement_tasks USING btree (decision_case_id);

CREATE INDEX idx_improvement_tasks_measure_at ON public.improvement_tasks USING btree (measure_at) WHERE (outcome_status = 'pending'::text);

CREATE INDEX idx_integration_call_logs_platform ON public.integration_call_logs USING btree (tenant_id, platform, created_at DESC);

CREATE INDEX idx_integration_call_logs_tenant_time ON public.integration_call_logs USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_integration_connections_tenant ON public.integration_connections USING btree (tenant_id, category, platform);

CREATE INDEX idx_integration_credentials_platform ON public.integration_credentials USING btree (tenant_id, platform);

CREATE INDEX idx_issues_batch_sev ON public.data_quality_issues USING btree (batch_id, severity, status);

CREATE INDEX idx_jd_po_date ON public._deprecated_jd_purchase_order USING btree (biz_date DESC);

CREATE INDEX idx_jd_po_mode ON public._deprecated_jd_purchase_order USING btree (business_mode, biz_date DESC);

CREATE INDEX idx_jd_settlement_fees_lookup ON public._deprecated_fact_jd_settlement_fees USING btree (tenant_id, shop_id, biz_month, business_mode);

CREATE INDEX idx_kb_banned_words_tenant ON public.kb_banned_words USING btree (tenant_id, enabled, platform);

CREATE INDEX idx_kb_chunks_collection ON public.kb_chunks USING btree (tenant_id, collection_id);

CREATE INDEX idx_kb_chunks_content_trgm ON public.kb_chunks USING gin (content public.gin_trgm_ops);

CREATE INDEX idx_kb_chunks_document ON public.kb_chunks USING btree (document_id, seq);

CREATE INDEX idx_kb_chunks_embedding_null ON public.kb_chunks USING btree (tenant_id) WHERE (embedding IS NOT NULL);

CREATE INDEX idx_kb_collections_tenant ON public.kb_collections USING btree (tenant_id, domain, status);

CREATE INDEX idx_kb_documents_business_key ON public.kb_documents USING btree (tenant_id, business_key);

CREATE INDEX idx_kb_documents_collection ON public.kb_documents USING btree (tenant_id, collection_id, status);

CREATE INDEX idx_kb_feedback_tenant ON public.kb_feedback USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_kb_index_versions_collection ON public.kb_index_versions USING btree (tenant_id, collection_id, status);

CREATE INDEX idx_kb_ingest_jobs_tenant ON public.kb_ingest_jobs USING btree (tenant_id, status, created_at DESC);

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

CREATE INDEX idx_media_assets_tenant ON public.media_assets USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_media_draft_exports_tenant ON public.media_draft_exports USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_media_highlights_asset ON public.media_highlights USING btree (tenant_id, asset_id, score DESC);

CREATE INDEX idx_media_render_jobs_tenant ON public.media_render_jobs USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_media_transcripts_asset ON public.media_transcripts USING btree (tenant_id, asset_id);

CREATE INDEX idx_memo_versions_case_tenant ON public.decision_memo_versions USING btree (tenant_id, case_id);

CREATE INDEX idx_module_param_lookup ON public.system_module_parameters USING btree (module_code, scope_type, scope_id);

CREATE INDEX idx_multi_room_status_room ON public.multi_room_status USING btree (room_id);

CREATE INDEX idx_order_events_lookup ON public.fact_order_event_stream USING btree (source_platform, store_id, source_order_id, occurred_at);

CREATE INDEX idx_order_events_type ON public.fact_order_event_stream USING btree (event_type, occurred_at);

CREATE INDEX idx_overview_activities_created ON public.overview_activities USING btree (created_at DESC);

CREATE INDEX idx_overview_room_date ON public.session_overview_metrics USING btree (room_id, business_date DESC);

CREATE INDEX idx_overview_session ON public.session_overview_metrics USING btree (session_id);

CREATE INDEX idx_pdd_group_shop ON public._deprecated_pdd_group_buy USING btree (shop_id, biz_date DESC);

CREATE INDEX idx_pdd_group_status ON public._deprecated_pdd_group_buy USING btree (status, biz_date DESC);

CREATE INDEX idx_permission_requests_pending ON public.permission_requests USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_permission_requests_user ON public.permission_requests USING btree (tenant_id, user_id, status);

CREATE INDEX idx_platform_capability_platform ON public.platform_capability_matrix USING btree (platform_code) WHERE (is_applicable = true);

CREATE INDEX idx_prod_cost_eff ON public.dim_product_cost_versions USING btree (tenant_id, product_id, effective_from);

CREATE INDEX idx_prompt_eval_template ON public.prompt_eval_runs USING btree (tenant_id, template_id, created_at DESC);

CREATE INDEX idx_prompt_templates_tenant ON public.prompt_templates USING btree (tenant_id, scene, status);

CREATE INDEX idx_prompt_versions_template ON public.prompt_versions USING btree (template_id, version DESC);

CREATE INDEX idx_qianchuan_budget_tenant ON public.qianchuan_budget_requests USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_qianchuan_sync_tenant ON public.qianchuan_sync_runs USING btree (tenant_id, created_at DESC);

CREATE INDEX idx_quarantine_batch ON public.dq_quarantine USING btree (batch_id, status);

CREATE INDEX idx_quarantine_rule ON public.dq_quarantine USING btree (rule_code, severity);

CREATE INDEX idx_render_jobs_tenant ON public.render_jobs USING btree (tenant_id, status, queued_at);

CREATE INDEX idx_render_outputs_job ON public.render_outputs USING btree (tenant_id, job_id);

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

CREATE INDEX idx_script_versions_brief ON public.script_versions USING btree (tenant_id, brief_id, version DESC);

CREATE INDEX idx_search_kw_lookup ON public.fact_search_keyword_daily USING btree (tenant_id, platform_code, biz_date DESC);

CREATE INDEX idx_seasonal_calendar_range ON public.seasonal_calendar USING btree (tenant_id, start_date, end_date);

CREATE INDEX idx_selection_item_rec ON public.fact_selection_item USING btree (recommendation_id, rank_no);

CREATE INDEX idx_selection_rec_created ON public.fact_selection_recommendation USING btree (created_at DESC);

CREATE INDEX idx_selection_rec_shop ON public.fact_selection_recommendation USING btree (shop_id);

CREATE INDEX idx_selection_rec_tenant_cat ON public.fact_selection_recommendation USING btree (tenant_id, category_code);

CREATE INDEX idx_sensitive_replacements_lookup ON public.compliance_sensitive_replacements USING btree (tenant_id, sensitive_word);

CREATE INDEX idx_session_anchor_metrics_anchor ON public.session_anchor_metrics USING btree (anchor_id);

CREATE INDEX idx_session_anchor_metrics_date ON public.session_anchor_metrics USING btree (date);

CREATE INDEX idx_session_channel_channel ON public.session_channel_metrics USING btree (channel);

CREATE INDEX idx_session_channel_date ON public.session_channel_metrics USING btree (period_date);

CREATE INDEX idx_session_channel_platform ON public.session_channel_metrics USING btree (platform_code, period_date);

CREATE INDEX idx_session_channel_session ON public.session_channel_metrics USING btree (session_id);

CREATE INDEX idx_session_channel_shop ON public.session_channel_metrics USING btree (shop_id, period_date);

CREATE INDEX idx_session_plan_products_plan ON public.session_plan_products USING btree (plan_id);

CREATE INDEX idx_session_plan_products_room_date ON public.session_plan_products USING btree (room_id, business_date DESC) WHERE (plan_id IS NULL);

CREATE INDEX idx_session_plan_products_session ON public.session_plan_products USING btree (session_id);

CREATE INDEX idx_session_plans_anchor ON public.session_plans USING btree (anchor_id);

CREATE INDEX idx_session_plans_date ON public.session_plans USING btree (plan_date);

CREATE INDEX idx_session_plans_room ON public.session_plans USING btree (room_id);

CREATE INDEX idx_session_staff_role ON public.session_staff_assignments USING btree (role_code);

CREATE INDEX idx_session_staff_session ON public.session_staff_assignments USING btree (session_id);

CREATE INDEX idx_settlement_cycles_timeline ON public.fact_settlement_cycles USING btree (tenant_id, order_date, settle_date, settlement_status);

CREATE INDEX idx_setup_templates_biz ON public.setup_templates USING btree (biz_type, version DESC);

CREATE INDEX idx_shot_items_project ON public.shot_items USING btree (tenant_id, project_id, seq);

CREATE INDEX idx_signal_source_cat ON public.signal_source USING btree (category_code);

CREATE INDEX idx_source_map_platform ON public.platform_source_mapping USING btree (platform_code, priority DESC);

CREATE INDEX idx_staff_day_status_date ON public.staff_day_status USING btree (biz_date);

CREATE INDEX idx_staff_day_status_name ON public.staff_day_status USING btree (staff_name);

CREATE INDEX idx_stg_order_batch ON public.stg_order_import USING btree (batch_id, validation_status);

CREATE INDEX idx_stg_order_bizkey ON public.stg_order_import USING btree (batch_id, source_platform, store_id, source_order_id);

CREATE INDEX idx_storyboards_script ON public.storyboards USING btree (tenant_id, script_version_id, seq);

CREATE INDEX idx_sync_jobs_shop ON public.ingest_sync_jobs USING btree (shop_id, status);

CREATE INDEX idx_system_jobs_run_at ON public.system_jobs USING btree (run_at);

CREATE INDEX idx_system_jobs_status ON public.system_jobs USING btree (status);

CREATE INDEX idx_system_jobs_type ON public.system_jobs USING btree (job_type);

CREATE INDEX idx_template_versions_template ON public.template_versions USING btree (tenant_id, template_id, version DESC);

CREATE INDEX idx_topic_performance_tenant ON public.topic_performance USING btree (tenant_id, category, window_end DESC);

CREATE INDEX idx_user_module_overrides_user ON public.user_module_overrides USING btree (user_id);

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);

CREATE INDEX idx_users_role ON public.users USING btree (role);

CREATE INDEX idx_users_status ON public.users USING btree (status);

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);

CREATE INDEX idx_users_username ON public.users USING btree (username);

CREATE INDEX idx_video_metrics_date ON public.video_metrics USING btree (biz_date DESC, platform_code);

CREATE INDEX idx_video_projects_tenant ON public.video_projects USING btree (tenant_id, status, created_at DESC);

CREATE INDEX idx_video_room_date ON public.session_short_video_traffic USING btree (room_id, business_date DESC);

CREATE INDEX idx_video_session ON public.session_short_video_traffic USING btree (session_id);

CREATE INDEX idx_video_templates_tenant ON public.video_templates USING btree (tenant_id, status, category);

CREATE INDEX idx_waybill_risk ON public.fact_fulfillment_waybill USING btree (is_ship_delayed, is_fake_ship_risk) WHERE ((is_ship_delayed = true) OR (is_fake_ship_risk = true));

CREATE INDEX idx_waybill_status_deadline ON public.fact_fulfillment_waybill USING btree (fulfillment_status, ship_deadline_at);

CREATE UNIQUE INDEX session_plan_products_plan_group_uidx ON public.session_plan_products USING btree (plan_id, group_letter) WHERE ((plan_id IS NOT NULL) AND (group_letter IS NOT NULL));

CREATE UNIQUE INDEX session_plan_products_room_date_product_uidx ON public.session_plan_products USING btree (room_id, business_date, product_id) WHERE ((plan_id IS NULL) AND (room_id IS NOT NULL) AND (product_id IS NOT NULL));

CREATE UNIQUE INDEX uidx_agg_platform_monthly_ym_plat ON public.agg_platform_monthly USING btree (year_month, platform_code);

CREATE UNIQUE INDEX uq_agg_traffic_live_idx ON public.agg_traffic_day_live USING btree (biz_date, COALESCE(platform_code, '__all__'::character varying), COALESCE(room_id, 0), COALESCE(shop_id, (0)::bigint));

CREATE UNIQUE INDEX uq_ai_action_approvals_public_id ON public.ai_action_approvals USING btree (public_id);

CREATE UNIQUE INDEX uq_ai_model_providers_default ON public.ai_model_providers USING btree (tenant_id, profile) WHERE is_default;

CREATE UNIQUE INDEX uq_ai_v2_run_idempotency ON public.ai_v2_run USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX uq_ai_v2_step_run_seq ON public.ai_v2_step USING btree (run_id, seq);

CREATE UNIQUE INDEX uq_assistant_memory_active ON public.assistant_memory_items USING btree (tenant_id, scope, COALESCE(owner_user_id, 0), COALESCE(role_key, ''::text), memory_key) WHERE (status = 'active'::text);

CREATE UNIQUE INDEX uq_biz_targets_active ON public.biz_targets USING btree (tenant_id, period_type, period_start, scope_type, COALESCE(scope_id, (0)::bigint), metric_code) WHERE (status = 'active'::text);

CREATE UNIQUE INDEX uq_content_metrics_link_video ON public.content_metrics_link USING btree (tenant_id, platform_code, video_id, biz_date);

CREATE UNIQUE INDEX uq_custom_field_def_idx ON public.sys_custom_field_definition USING btree (entity_type, field_key, COALESCE(platform_code, '__all__'::character varying));

CREATE UNIQUE INDEX uq_decision_cases_fingerprint ON public.decision_cases USING btree (tenant_id, fingerprint) WHERE (fingerprint IS NOT NULL);

CREATE UNIQUE INDEX uq_decision_cases_no ON public.decision_cases USING btree (tenant_id, case_no);

CREATE UNIQUE INDEX uq_dim_kol_platform_name ON public.dim_kol USING btree (platform_code, kol_name);

CREATE UNIQUE INDEX uq_permission_requests_pending ON public.permission_requests USING btree (tenant_id, user_id, module_code) WHERE (status = 'pending'::text);

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

-- ===== function (32) =====
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

CREATE FUNCTION public.prompt_versions_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.system_prompt <> OLD.system_prompt
     OR NEW.user_template <> OLD.user_template
     OR NEW.output_schema <> OLD.output_schema
     OR NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'prompt_versions 不可变：请新建版本而不是修改历史版本';
  END IF;
  RETURN NEW;
END;
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

CREATE FUNCTION public.rls_is_content_writer() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','ops_staff');
$$;

CREATE FUNCTION public.rls_is_hr_writer() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','hrbp');
$$;

CREATE FUNCTION public.rls_is_ops_writer() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_is_agency_staff()
     AND public.rls_role() IN ('super_admin','ops_director','ops_staff');
$$;

CREATE FUNCTION public.rls_is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT public.rls_role() = 'super_admin';
$$;

CREATE FUNCTION public.rls_platform_strict(p_code text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT p_code IS NOT NULL AND p_code <> '' AND public.rls_has_platform(p_code);
$$;

CREATE FUNCTION public.rls_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_role', true), ''), '');
$$;

CREATE FUNCTION public.rls_shop_strict(p_shop_id bigint) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT p_shop_id IS NOT NULL AND public.rls_can_access_shop(p_shop_id);
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

CREATE FUNCTION public.session_product_skus_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- 语义约束要求 (product_id + product_name) 或 (plan_id + product_code) 二者其一，
  -- 旧格式数据仅带 product_id，故补一个占位 product_name 以满足约束。
  INSERT INTO public.session_plan_products (
    id, product_id, product_name, payment_amount, sold_count, buyer_count, order_count,
    sku_snapshot_jsonb, created_at
  ) VALUES (
    NEW.id,
    NEW.product_id,
    COALESCE(NEW.sku_name, '标准款'),
    COALESCE(NEW.payment_amount, 0),
    COALESCE(NEW.sold_count, 0),
    COALESCE(NEW.buyer_count, 0),
    COALESCE(NEW.order_count, 0),
    jsonb_build_object('sku_name', COALESCE(NEW.sku_name, '标准款')),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    payment_amount = EXCLUDED.payment_amount,
    sold_count      = EXCLUDED.sold_count,
    buyer_count     = EXCLUDED.buyer_count,
    order_count     = EXCLUDED.order_count;
  RETURN NEW;
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
    VALUES (NEW.id, NEW.code, NEW.name, COALESCE(NEW.description, ''), (NEW.code = 'super_admin'), NEW.created_at, now())
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

-- ===== trigger (6) =====
CREATE TRIGGER session_product_skus_insert_trg INSTEAD OF INSERT ON public.session_product_skus FOR EACH ROW EXECUTE FUNCTION public.session_product_skus_insert();

CREATE TRIGGER trg_prompt_versions_immutable BEFORE UPDATE ON public.prompt_versions FOR EACH ROW EXECUTE FUNCTION public.prompt_versions_immutable();

CREATE TRIGGER trg_sync_role_grants_to_sys_perm AFTER INSERT OR DELETE OR UPDATE ON public.role_module_grants FOR EACH ROW EXECUTE FUNCTION public.sync_role_grants_to_sys_perm();

CREATE TRIGGER trg_sync_role_modules_to_sys_perm AFTER INSERT OR DELETE ON public.role_modules FOR EACH ROW EXECUTE FUNCTION public.sync_role_modules_to_sys_perm();

CREATE TRIGGER trg_sync_roles_to_sys_role AFTER INSERT OR DELETE OR UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.sync_roles_to_sys_role();

CREATE TRIGGER trg_sync_user_to_sys_user_role AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_to_sys_user_role();

-- ===== alter (739) =====
ALTER TABLE ONLY public._deprecated_fact_jd_settlement_fees FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.ad_plan FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.ad_plan_id_seq OWNED BY public.ad_plan.id;

ALTER TABLE ONLY public.ad_plan_receipts FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.ad_plan_receipts_id_seq OWNED BY public.ad_plan_receipts.id;

ALTER SEQUENCE public.agent_configs_id_seq OWNED BY public.agent_configs.id;

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

ALTER SEQUENCE public.ai_messages_id_seq OWNED BY public.ai_messages.id;

ALTER SEQUENCE public.ai_model_profile_id_seq OWNED BY public.ai_model_profile.id;

ALTER SEQUENCE public.ai_tool_logs_id_seq OWNED BY public.ai_tool_logs.id;

ALTER SEQUENCE public.ai_tool_policy_id_seq OWNED BY public.ai_tool_policy.id;

ALTER SEQUENCE public.ai_v2_citation_id_seq OWNED BY public.ai_v2_citation.id;

ALTER SEQUENCE public.ai_v2_claim_id_seq OWNED BY public.ai_v2_claim.id;

ALTER SEQUENCE public.ai_v2_event_id_seq OWNED BY public.ai_v2_event.id;

ALTER SEQUENCE public.ai_v2_evidence_id_seq OWNED BY public.ai_v2_evidence.id;

ALTER SEQUENCE public.ai_v2_llm_call_id_seq OWNED BY public.ai_v2_llm_call.id;

ALTER SEQUENCE public.ai_v2_step_id_seq OWNED BY public.ai_v2_step.id;

ALTER SEQUENCE public.alert_events_id_seq OWNED BY public.alert_events.id;

ALTER SEQUENCE public.alert_rules_id_seq OWNED BY public.alert_rules.id;

ALTER SEQUENCE public.anchor_capabilities_id_seq OWNED BY public.anchor_capabilities.id;

ALTER SEQUENCE public.anchor_competency_profiles_id_seq OWNED BY public.anchor_competency_profiles.id;

ALTER SEQUENCE public.anchor_script_templates_id_seq OWNED BY public.anchor_script_templates.id;

ALTER SEQUENCE public.anchors_id_seq OWNED BY public.anchors.id;

ALTER SEQUENCE public.assistant_memory_audit_id_seq OWNED BY public.assistant_memory_audit.id;

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

ALTER SEQUENCE public.biz_targets_id_seq OWNED BY public.biz_targets.id;

ALTER TABLE ONLY public.campaign_plan FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.campaign_plan_id_seq OWNED BY public.campaign_plan.id;

ALTER TABLE ONLY public.campaign_plan_template FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.campaign_plan_template_id_seq OWNED BY public.campaign_plan_template.id;

ALTER TABLE ONLY public.canonical_order_items FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.canonical_order_items_id_seq OWNED BY public.canonical_order_items.id;

ALTER TABLE ONLY public.canonical_order_items_default FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202608 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202609 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202610 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202611 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202612 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202701 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202702 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202703 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202704 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202705 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_order_items_y202706 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.canonical_orders_id_seq OWNED BY public.canonical_orders.id;

ALTER TABLE ONLY public.canonical_orders_default FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202608 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202609 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202610 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202611 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202612 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202701 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202702 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202703 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202704 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202705 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_orders_y202706 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.canonical_refund_events_id_seq OWNED BY public.canonical_refund_events.id;

ALTER TABLE ONLY public.canonical_refund_events_default FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202608 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202609 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202610 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202611 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202612 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202701 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202702 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202703 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202704 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202705 FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.canonical_refund_events_y202706 FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.clean_records_id_seq OWNED BY public.clean_records.id;

ALTER SEQUENCE public.clean_rule_sets_id_seq OWNED BY public.clean_rule_sets.id;

ALTER SEQUENCE public.cleaning_runs_id_seq OWNED BY public.cleaning_runs.id;

ALTER SEQUENCE public.competitor_brands_id_seq OWNED BY public.competitor_brands.id;

ALTER SEQUENCE public.competitor_price_data_id_seq OWNED BY public.competitor_price_data.id;

ALTER TABLE ONLY public.compliance_activity_reminder FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_activity_reminder_id_seq OWNED BY public.compliance_activity_reminder.id;

ALTER TABLE ONLY public.compliance_events FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_events_id_seq OWNED BY public.compliance_events.id;

ALTER SEQUENCE public.compliance_learning_tasks_id_seq OWNED BY public.compliance_learning_tasks.id;

ALTER TABLE ONLY public.compliance_risk_assessment FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_risk_assessment_id_seq OWNED BY public.compliance_risk_assessment.id;

ALTER TABLE ONLY public.compliance_rule_change FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_rule_change_id_seq OWNED BY public.compliance_rule_change.id;

ALTER TABLE ONLY public.compliance_rule_snapshot FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.compliance_rule_snapshot_id_seq OWNED BY public.compliance_rule_snapshot.id;

ALTER SEQUENCE public.compliance_script_check_logs_id_seq OWNED BY public.compliance_script_check_logs.id;

ALTER SEQUENCE public.compliance_sensitive_replacements_id_seq OWNED BY public.compliance_sensitive_replacements.id;

ALTER SEQUENCE public.content_assets_id_seq OWNED BY public.content_assets.id;

ALTER TABLE ONLY public.content_attribution_ledger FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.content_attribution_ledger_id_seq OWNED BY public.content_attribution_ledger.id;

ALTER TABLE ONLY public.content_briefs FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.content_ideas FORCE ROW LEVEL SECURITY;

ALTER TABLE ONLY public.content_metrics_link FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.content_projects_id_seq OWNED BY public.content_projects.id;

ALTER SEQUENCE public.content_providers_id_seq OWNED BY public.content_providers.id;

ALTER TABLE ONLY public.content_schedules FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.content_schedules_id_seq OWNED BY public.content_schedules.id;

ALTER TABLE ONLY public.content_tasks FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.content_tasks_id_seq OWNED BY public.content_tasks.id;

ALTER SEQUENCE public.data_exports_id_seq OWNED BY public.data_exports.id;

ALTER SEQUENCE public.data_quality_issues_id_seq OWNED BY public.data_quality_issues.id;

ALTER SEQUENCE public.data_uploads_id_seq OWNED BY public.data_uploads.id;

ALTER SEQUENCE public.decision_case_events_id_seq OWNED BY public.decision_case_events.id;

ALTER SEQUENCE public.decision_cases_id_seq OWNED BY public.decision_cases.id;

ALTER SEQUENCE public.decision_data_gates_id_seq OWNED BY public.decision_data_gates.id;

ALTER SEQUENCE public.decision_evidence_items_id_seq OWNED BY public.decision_evidence_items.id;

ALTER SEQUENCE public.decision_memo_versions_id_seq OWNED BY public.decision_memo_versions.id;

ALTER SEQUENCE public.decision_metric_snapshots_id_seq OWNED BY public.decision_metric_snapshots.id;

ALTER SEQUENCE public.decision_reviews_id_seq OWNED BY public.decision_reviews.id;

ALTER TABLE ONLY public.dim_accounting_subject FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dim_brand_id_seq OWNED BY public.dim_brand.id;

ALTER TABLE ONLY public.dim_category FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dim_cs_agent_id_seq OWNED BY public.dim_cs_agent.id;

ALTER SEQUENCE public.dim_dept_id_seq OWNED BY public.dim_dept.id;

ALTER SEQUENCE public.dim_kol_id_seq OWNED BY public.dim_kol.id;

ALTER TABLE ONLY public.dim_product_channel_listing FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.dim_product_channel_listing_id_seq OWNED BY public.dim_product_channel_listing.id;

ALTER SEQUENCE public.dim_product_cost_versions_id_seq OWNED BY public.dim_product_cost_versions.id;

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

ALTER SEQUENCE public.fact_jd_settlement_fees_id_seq OWNED BY public._deprecated_fact_jd_settlement_fees.id;

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

ALTER SEQUENCE public.hrbp_auditions_id_seq OWNED BY public.hrbp_auditions.id;

ALTER SEQUENCE public.hrbp_candidates_id_seq OWNED BY public.hrbp_candidates.id;

ALTER TABLE ONLY public.import_batches FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.import_batches_id_seq OWNED BY public.import_batches.id;

ALTER SEQUENCE public.import_files_id_seq OWNED BY public.import_files.id;

ALTER SEQUENCE public.improvement_tasks_id_seq OWNED BY public.improvement_tasks.id;

ALTER SEQUENCE public.ingest_sync_jobs_id_seq OWNED BY public.ingest_sync_jobs.id;

ALTER SEQUENCE public.integration_call_logs_id_seq OWNED BY public.integration_call_logs.id;

ALTER SEQUENCE public.issue_library_id_seq OWNED BY public.issue_library.id;

ALTER SEQUENCE public.jd_purchase_order_id_seq OWNED BY public._deprecated_jd_purchase_order.id;

ALTER SEQUENCE public.kb_banned_words_id_seq OWNED BY public.kb_banned_words.id;

ALTER SEQUENCE public.kb_feedback_id_seq OWNED BY public.kb_feedback.id;

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

ALTER SEQUENCE public.pdd_group_buy_id_seq OWNED BY public._deprecated_pdd_group_buy.id;

ALTER SEQUENCE public.platform_caliber_config_id_seq OWNED BY public.platform_caliber_config.id;

ALTER SEQUENCE public.platform_capability_matrix_id_seq OWNED BY public.platform_capability_matrix.id;

ALTER TABLE ONLY public.platform_members_summary FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.platform_members_summary_id_seq OWNED BY public.platform_members_summary.id;

ALTER SEQUENCE public.platform_sla_config_id_seq OWNED BY public.platform_sla_config.id;

ALTER SEQUENCE public.platform_source_mapping_id_seq OWNED BY public.platform_source_mapping.id;

ALTER TABLE ONLY public.pricing_rules FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;

ALTER TABLE ONLY public.promotion_rules FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.promotion_rules_id_seq OWNED BY public.promotion_rules.id;

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;

ALTER SEQUENCE public.publish_reversals_id_seq OWNED BY public.publish_reversals.id;

ALTER TABLE ONLY public.publish_runs FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.publish_runs_id_seq OWNED BY public.publish_runs.id;

ALTER SEQUENCE public.raw_records_id_seq OWNED BY public.raw_records.id;

ALTER SEQUENCE public.reconciliation_runs_id_seq OWNED BY public.reconciliation_runs.id;

ALTER SEQUENCE public.review_actions_id_seq OWNED BY public.review_actions.id;

ALTER SEQUENCE public.role_module_grants_id_seq OWNED BY public.role_module_grants.id;

ALTER SEQUENCE public.role_platform_permissions_id_seq OWNED BY public.role_platform_permissions.id;

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

ALTER SEQUENCE public.room_health_id_seq OWNED BY public.room_health.id;

ALTER SEQUENCE public.script_library_id_seq OWNED BY public.script_library.id;

ALTER TABLE ONLY public.seasonal_calendar FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.session_anchor_metrics_id_seq OWNED BY public.session_anchor_metrics.id;

ALTER SEQUENCE public.session_channel_metrics_id_seq OWNED BY public.session_channel_metrics.id;

ALTER SEQUENCE public.session_live_basic_info_id_seq OWNED BY public.session_live_basic_info.id;

ALTER SEQUENCE public.session_overview_metrics_id_seq OWNED BY public.session_overview_metrics.id;

ALTER TABLE ONLY public.session_plan_products FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.session_plan_products_id_seq OWNED BY public.session_plan_products.id;

ALTER SEQUENCE public.session_plans_id_seq OWNED BY public.session_plans.id;

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

ALTER SEQUENCE public.sys_deprecation_access_logs_id_seq OWNED BY public.sys_deprecation_access_logs.id;

ALTER SEQUENCE public.sys_role_id_seq OWNED BY public.sys_role.id;

ALTER SEQUENCE public.sys_role_permission_id_seq OWNED BY public.sys_role_permission.id;

ALTER SEQUENCE public.sys_user_role_id_seq OWNED BY public.sys_user_role.id;

ALTER SEQUENCE public.system_config_id_seq OWNED BY public.system_config.id;

ALTER SEQUENCE public.system_jobs_id_seq OWNED BY public.system_jobs.id;

ALTER SEQUENCE public.system_module_parameters_id_seq OWNED BY public.system_module_parameters.id;

ALTER SEQUENCE public.target_templates_id_seq OWNED BY public.target_templates.id;

ALTER SEQUENCE public.tenant_subscriptions_id_seq OWNED BY public._deprecated_tenant_subscriptions.id;

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;

ALTER TABLE ONLY public.topic_performance FORCE ROW LEVEL SECURITY;

ALTER SEQUENCE public.upload_column_mappings_id_seq OWNED BY public.upload_column_mappings.id;

ALTER SEQUENCE public.user_module_overrides_id_seq OWNED BY public.user_module_overrides.id;

ALTER SEQUENCE public.user_platform_permissions_id_seq OWNED BY public.user_platform_permissions.id;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

ALTER SEQUENCE public.validation_runs_id_seq OWNED BY public.validation_runs.id;

ALTER SEQUENCE public.video_metrics_id_seq OWNED BY public.video_metrics.id;

ALTER TABLE ONLY public._deprecated_fact_jd_settlement_fees ALTER COLUMN id SET DEFAULT nextval('public.fact_jd_settlement_fees_id_seq'::regclass);

ALTER TABLE ONLY public._deprecated_jd_purchase_order ALTER COLUMN id SET DEFAULT nextval('public.jd_purchase_order_id_seq'::regclass);

ALTER TABLE ONLY public._deprecated_pdd_group_buy ALTER COLUMN id SET DEFAULT nextval('public.pdd_group_buy_id_seq'::regclass);

ALTER TABLE ONLY public._deprecated_tenant_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.tenant_subscriptions_id_seq'::regclass);

ALTER TABLE ONLY public.ad_plan ALTER COLUMN id SET DEFAULT nextval('public.ad_plan_id_seq'::regclass);

ALTER TABLE ONLY public.ad_plan_receipts ALTER COLUMN id SET DEFAULT nextval('public.ad_plan_receipts_id_seq'::regclass);

ALTER TABLE ONLY public.agent_configs ALTER COLUMN id SET DEFAULT nextval('public.agent_configs_id_seq'::regclass);

ALTER TABLE ONLY public.agg_shop_daily ALTER COLUMN id SET DEFAULT nextval('public.agg_shop_daily_id_seq'::regclass);

ALTER TABLE ONLY public.agg_trade_day_platform_channel ALTER COLUMN id SET DEFAULT nextval('public.agg_trade_day_platform_channel_id_seq'::regclass);

ALTER TABLE ONLY public.agg_traffic_day_live ALTER COLUMN id SET DEFAULT nextval('public.agg_traffic_day_live_id_seq'::regclass);

ALTER TABLE ONLY public.ai_action_approvals ALTER COLUMN id SET DEFAULT nextval('public.ai_action_approvals_id_seq'::regclass);

ALTER TABLE ONLY public.ai_analysis_runs ALTER COLUMN id SET DEFAULT nextval('public.ai_analysis_runs_id_seq'::regclass);

ALTER TABLE ONLY public.ai_analysis_steps ALTER COLUMN id SET DEFAULT nextval('public.ai_analysis_steps_id_seq'::regclass);

ALTER TABLE ONLY public.ai_config ALTER COLUMN id SET DEFAULT nextval('public.ai_config_id_seq'::regclass);

ALTER TABLE ONLY public.ai_context_bindings ALTER COLUMN id SET DEFAULT nextval('public.ai_context_bindings_id_seq'::regclass);

ALTER TABLE ONLY public.ai_conversations ALTER COLUMN id SET DEFAULT nextval('public.ai_conversations_id_seq'::regclass);

ALTER TABLE ONLY public.ai_messages ALTER COLUMN id SET DEFAULT nextval('public.ai_messages_id_seq'::regclass);

ALTER TABLE ONLY public.ai_model_profile ALTER COLUMN id SET DEFAULT nextval('public.ai_model_profile_id_seq'::regclass);

ALTER TABLE ONLY public.ai_tool_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_tool_logs_id_seq'::regclass);

ALTER TABLE ONLY public.ai_tool_policy ALTER COLUMN id SET DEFAULT nextval('public.ai_tool_policy_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_citation ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_citation_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_claim ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_claim_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_event ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_event_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_evidence ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_evidence_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_llm_call ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_llm_call_id_seq'::regclass);

ALTER TABLE ONLY public.ai_v2_step ALTER COLUMN id SET DEFAULT nextval('public.ai_v2_step_id_seq'::regclass);

ALTER TABLE ONLY public.alert_events ALTER COLUMN id SET DEFAULT nextval('public.alert_events_id_seq'::regclass);

ALTER TABLE ONLY public.alert_rules ALTER COLUMN id SET DEFAULT nextval('public.alert_rules_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_capabilities ALTER COLUMN id SET DEFAULT nextval('public.anchor_capabilities_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_competency_profiles ALTER COLUMN id SET DEFAULT nextval('public.anchor_competency_profiles_id_seq'::regclass);

ALTER TABLE ONLY public.anchor_script_templates ALTER COLUMN id SET DEFAULT nextval('public.anchor_script_templates_id_seq'::regclass);

ALTER TABLE ONLY public.anchors ALTER COLUMN id SET DEFAULT nextval('public.anchors_id_seq'::regclass);

ALTER TABLE ONLY public.assistant_memory_audit ALTER COLUMN id SET DEFAULT nextval('public.assistant_memory_audit_id_seq'::regclass);

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.biz_targets ALTER COLUMN id SET DEFAULT nextval('public.biz_targets_id_seq'::regclass);

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

ALTER TABLE ONLY public.compliance_learning_tasks ALTER COLUMN id SET DEFAULT nextval('public.compliance_learning_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_risk_assessment ALTER COLUMN id SET DEFAULT nextval('public.compliance_risk_assessment_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_rule_change ALTER COLUMN id SET DEFAULT nextval('public.compliance_rule_change_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_rule_snapshot ALTER COLUMN id SET DEFAULT nextval('public.compliance_rule_snapshot_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_script_check_logs ALTER COLUMN id SET DEFAULT nextval('public.compliance_script_check_logs_id_seq'::regclass);

ALTER TABLE ONLY public.compliance_sensitive_replacements ALTER COLUMN id SET DEFAULT nextval('public.compliance_sensitive_replacements_id_seq'::regclass);

ALTER TABLE ONLY public.content_assets ALTER COLUMN id SET DEFAULT nextval('public.content_assets_id_seq'::regclass);

ALTER TABLE ONLY public.content_attribution_ledger ALTER COLUMN id SET DEFAULT nextval('public.content_attribution_ledger_id_seq'::regclass);

ALTER TABLE ONLY public.content_projects ALTER COLUMN id SET DEFAULT nextval('public.content_projects_id_seq'::regclass);

ALTER TABLE ONLY public.content_providers ALTER COLUMN id SET DEFAULT nextval('public.content_providers_id_seq'::regclass);

ALTER TABLE ONLY public.content_schedules ALTER COLUMN id SET DEFAULT nextval('public.content_schedules_id_seq'::regclass);

ALTER TABLE ONLY public.content_tasks ALTER COLUMN id SET DEFAULT nextval('public.content_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.data_exports ALTER COLUMN id SET DEFAULT nextval('public.data_exports_id_seq'::regclass);

ALTER TABLE ONLY public.data_quality_issues ALTER COLUMN id SET DEFAULT nextval('public.data_quality_issues_id_seq'::regclass);

ALTER TABLE ONLY public.data_uploads ALTER COLUMN id SET DEFAULT nextval('public.data_uploads_id_seq'::regclass);

ALTER TABLE ONLY public.decision_case_events ALTER COLUMN id SET DEFAULT nextval('public.decision_case_events_id_seq'::regclass);

ALTER TABLE ONLY public.decision_cases ALTER COLUMN id SET DEFAULT nextval('public.decision_cases_id_seq'::regclass);

ALTER TABLE ONLY public.decision_data_gates ALTER COLUMN id SET DEFAULT nextval('public.decision_data_gates_id_seq'::regclass);

ALTER TABLE ONLY public.decision_evidence_items ALTER COLUMN id SET DEFAULT nextval('public.decision_evidence_items_id_seq'::regclass);

ALTER TABLE ONLY public.decision_memo_versions ALTER COLUMN id SET DEFAULT nextval('public.decision_memo_versions_id_seq'::regclass);

ALTER TABLE ONLY public.decision_metric_snapshots ALTER COLUMN id SET DEFAULT nextval('public.decision_metric_snapshots_id_seq'::regclass);

ALTER TABLE ONLY public.decision_reviews ALTER COLUMN id SET DEFAULT nextval('public.decision_reviews_id_seq'::regclass);

ALTER TABLE ONLY public.dim_brand ALTER COLUMN id SET DEFAULT nextval('public.dim_brand_id_seq'::regclass);

ALTER TABLE ONLY public.dim_cs_agent ALTER COLUMN id SET DEFAULT nextval('public.dim_cs_agent_id_seq'::regclass);

ALTER TABLE ONLY public.dim_dept ALTER COLUMN id SET DEFAULT nextval('public.dim_dept_id_seq'::regclass);

ALTER TABLE ONLY public.dim_kol ALTER COLUMN id SET DEFAULT nextval('public.dim_kol_id_seq'::regclass);

ALTER TABLE ONLY public.dim_product ALTER COLUMN id SET DEFAULT nextval('public.dim_product_id_seq'::regclass);

ALTER TABLE ONLY public.dim_product_channel_listing ALTER COLUMN id SET DEFAULT nextval('public.dim_product_channel_listing_id_seq'::regclass);

ALTER TABLE ONLY public.dim_product_cost_versions ALTER COLUMN id SET DEFAULT nextval('public.dim_product_cost_versions_id_seq'::regclass);

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

ALTER TABLE ONLY public.hrbp_auditions ALTER COLUMN id SET DEFAULT nextval('public.hrbp_auditions_id_seq'::regclass);

ALTER TABLE ONLY public.hrbp_candidates ALTER COLUMN id SET DEFAULT nextval('public.hrbp_candidates_id_seq'::regclass);

ALTER TABLE ONLY public.import_batches ALTER COLUMN id SET DEFAULT nextval('public.import_batches_id_seq'::regclass);

ALTER TABLE ONLY public.import_files ALTER COLUMN id SET DEFAULT nextval('public.import_files_id_seq'::regclass);

ALTER TABLE ONLY public.improvement_tasks ALTER COLUMN id SET DEFAULT nextval('public.improvement_tasks_id_seq'::regclass);

ALTER TABLE ONLY public.ingest_sync_jobs ALTER COLUMN id SET DEFAULT nextval('public.ingest_sync_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.integration_call_logs ALTER COLUMN id SET DEFAULT nextval('public.integration_call_logs_id_seq'::regclass);

ALTER TABLE ONLY public.issue_library ALTER COLUMN id SET DEFAULT nextval('public.issue_library_id_seq'::regclass);

ALTER TABLE ONLY public.kb_banned_words ALTER COLUMN id SET DEFAULT nextval('public.kb_banned_words_id_seq'::regclass);

ALTER TABLE ONLY public.kb_feedback ALTER COLUMN id SET DEFAULT nextval('public.kb_feedback_id_seq'::regclass);

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

ALTER TABLE ONLY public.promotion_rules ALTER COLUMN id SET DEFAULT nextval('public.promotion_rules_id_seq'::regclass);

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

ALTER TABLE ONLY public.sys_deprecation_access_logs ALTER COLUMN id SET DEFAULT nextval('public.sys_deprecation_access_logs_id_seq'::regclass);

ALTER TABLE ONLY public.sys_role ALTER COLUMN id SET DEFAULT nextval('public.sys_role_id_seq'::regclass);

ALTER TABLE ONLY public.sys_role_permission ALTER COLUMN id SET DEFAULT nextval('public.sys_role_permission_id_seq'::regclass);

ALTER TABLE ONLY public.sys_user_role ALTER COLUMN id SET DEFAULT nextval('public.sys_user_role_id_seq'::regclass);

ALTER TABLE ONLY public.system_config ALTER COLUMN id SET DEFAULT nextval('public.system_config_id_seq'::regclass);

ALTER TABLE ONLY public.system_jobs ALTER COLUMN id SET DEFAULT nextval('public.system_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.system_module_parameters ALTER COLUMN id SET DEFAULT nextval('public.system_module_parameters_id_seq'::regclass);

ALTER TABLE ONLY public.target_templates ALTER COLUMN id SET DEFAULT nextval('public.target_templates_id_seq'::regclass);

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);

ALTER TABLE ONLY public.upload_column_mappings ALTER COLUMN id SET DEFAULT nextval('public.upload_column_mappings_id_seq'::regclass);

ALTER TABLE ONLY public.user_module_overrides ALTER COLUMN id SET DEFAULT nextval('public.user_module_overrides_id_seq'::regclass);

ALTER TABLE ONLY public.user_platform_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_platform_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.validation_runs ALTER COLUMN id SET DEFAULT nextval('public.validation_runs_id_seq'::regclass);

ALTER TABLE ONLY public.video_metrics ALTER COLUMN id SET DEFAULT nextval('public.video_metrics_id_seq'::regclass);

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

ALTER TABLE public._deprecated_fact_jd_settlement_fees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_plan_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ad_tool_dict ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agg_shop_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agg_trade_day_platform_channel ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agg_traffic_day_live ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_action_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_analysis_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_analysis_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_context_bindings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_generation_drafts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_model_profile ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_model_providers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_tool_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_tool_policy ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_citation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_claim ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_event ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_evidence ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_llm_call ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_run ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_v2_step ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.amount_type_dict ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_capabilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_competency_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchor_script_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.anchors ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assistant_memory_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assistant_memory_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bgm_library ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.biz_targets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.campaign_plan_template ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202609 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202610 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202611 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202612 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202701 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202703 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202704 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202705 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_order_items_y202706 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202609 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202610 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202611 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202612 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202701 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202703 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202704 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202705 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_orders_y202706 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202609 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202610 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202611 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202612 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202701 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202703 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202704 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202705 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_refund_events_y202706 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202609 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202610 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202611 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202612 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202701 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202703 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202704 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202705 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_records_y202706 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clean_rule_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cleaning_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.competitor_brands ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.competitor_price_data ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_activity_reminder ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_learning_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_risk_assessment ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_rule_change ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_rule_snapshot ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_script_check_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.compliance_sensitive_replacements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_attribution_ledger ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_briefs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_metrics_link ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_providers ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.data_uploads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_case_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_cases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_data_gates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_evidence_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_memo_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_metric_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.decision_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_accounting_subject ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_brand ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_category ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_cs_agent ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_dept ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_kol ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_product ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_product_channel_listing ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_product_cost_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_shop ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_sku_mapping ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_team ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_traffic_source ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.douyin_anchor_daily_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.douyin_channel_daily_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dq_quarantine ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_ad_spend_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_after_sale_tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_content_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_cs_session ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_fulfillment_waybill ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_gl_entry ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_gl_voucher ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_inventory_ledger ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_inventory_reservation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_inventory_stock ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_kol_cooperation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_order_event_stream ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_order_rma_item ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_search_keyword_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_selection_item ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_selection_recommendation ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_settlement_cycles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y2026m09 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y2026m10 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y2026m11 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y2026m12 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_trade_daily_y2027m01 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y202609 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y2026m10 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y2026m11 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y2026m12 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y202701 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fact_traffic_daily_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.field_mapping_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.goal_tracking ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hrbp_auditions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hrbp_candidates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.improvement_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ingest_sync_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.integration_call_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.issue_library ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_acl ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_banned_words ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_collections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_index_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kb_ingest_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kuaishou_fans_ops ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.land_raw_dedup ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.live_registrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.llm_provider_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.media_draft_exports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.media_highlights ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.media_render_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.media_transcripts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.metric_definition ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.multi_room_status ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_status_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.overview_activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.overview_daily_stats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.overview_daily_stats_archive ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.permission_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_caliber_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_capability_matrix ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_members_summary ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_sla_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_source_mapping ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.prompt_eval_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.publish_reversals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.publish_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.qianchuan_budget_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.qianchuan_sync_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_default ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202608 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202609 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202610 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202611 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202612 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202701 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202702 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202703 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202704 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202705 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.raw_records_y202706 ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.render_outputs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_module_grants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_platform_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.role_workbenches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.room_health ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.script_library ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.script_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.seasonal_calendar ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_anchor_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_channel_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_live_basic_info ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_overview_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_plan_products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_short_video_traffic ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.session_staff_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.setup_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shot_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.signal_source ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_day_status ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_role_dict ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stg_order_import ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.storyboards ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subtitle_styles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_custom_field_definition ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_custom_field_value ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_deprecation_access_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_role_permission ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sys_user_role ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_module_parameters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_platform_configs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.target_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.topic_performance ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.upload_column_mappings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_module_overrides ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_platform_permissions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.video_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.video_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workbench_widgets ENABLE ROW LEVEL SECURITY;

-- ===== policy (534) =====
CREATE POLICY anchor_competency_profiles_tenant_isolation ON public.anchor_competency_profiles USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY compliance_learning_tasks_tenant_isolation ON public.compliance_learning_tasks USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY compliance_script_check_logs_tenant_isolation ON public.compliance_script_check_logs USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY compliance_sensitive_replacements_tenant_isolation ON public.compliance_sensitive_replacements USING (((tenant_id IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer))) WITH CHECK (((tenant_id IS NULL) OR (tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)));

CREATE POLICY decision_case_events_tenant_isolation ON public.decision_case_events USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY decision_data_gates_tenant_isolation ON public.decision_data_gates USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY decision_evidence_items_tenant_isolation ON public.decision_evidence_items USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY decision_memo_versions_tenant_isolation ON public.decision_memo_versions USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY decision_metric_snapshots_tenant_isolation ON public.decision_metric_snapshots USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY decision_reviews_tenant_isolation ON public.decision_reviews USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY dim_product_cost_versions_tenant_isolation ON public.dim_product_cost_versions USING ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer)) WITH CHECK ((tenant_id = (NULLIF(current_setting('app.tenant_id'::text, true), ''::text))::integer));

CREATE POLICY p_activity_reminder_select ON public.compliance_activity_reminder FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_activity_reminder_write ON public.compliance_activity_reminder TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))));

CREATE POLICY p_ad_plan_receipts_select ON public.ad_plan_receipts FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.ad_plan p
  WHERE ((p.id = ad_plan_receipts.plan_id) AND public.rls_can_access_shop(p.shop_id)))) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost()))));

CREATE POLICY p_ad_plan_receipts_write ON public.ad_plan_receipts USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))));

CREATE POLICY p_ad_plan_select ON public.ad_plan FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost())) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_ad_plan_write ON public.ad_plan USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_ad_tool_dict_select ON public.ad_tool_dict FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_ad_tool_dict_write ON public.ad_tool_dict USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_agent_configs_tenant ON public.agent_configs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_agg_platform_channel_select ON public.agg_trade_day_platform_channel FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_agg_platform_channel_write ON public.agg_trade_day_platform_channel TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_agg_shop_daily_select ON public.agg_shop_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_agg_shop_daily_write ON public.agg_shop_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_agg_traffic_live_select ON public.agg_traffic_day_live FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_agg_traffic_live_write ON public.agg_traffic_day_live TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_ai_action_approvals_tenant ON public.ai_action_approvals USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_analysis_runs_select ON public.ai_analysis_runs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_ai_analysis_runs_write ON public.ai_analysis_runs USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin()))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_ai_analysis_steps_select ON public.ai_analysis_steps FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_analysis_runs r
  WHERE (r.id = ai_analysis_steps.run_id))));

CREATE POLICY p_ai_analysis_steps_write ON public.ai_analysis_steps USING ((EXISTS ( SELECT 1
   FROM public.ai_analysis_runs r
  WHERE (r.id = ai_analysis_steps.run_id)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ai_analysis_runs r
  WHERE (r.id = ai_analysis_steps.run_id))));

CREATE POLICY p_ai_config_select ON public.ai_config FOR SELECT USING (public.rls_is_super_admin());

CREATE POLICY p_ai_config_write ON public.ai_config USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_ai_context_bindings_select ON public.ai_context_bindings FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_ai_context_bindings_write ON public.ai_context_bindings USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin()))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_ai_conversations_select ON public.ai_conversations FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin() OR ((user_id = 1) AND public.rls_is_agency_staff() AND (((title)::text ~~ 'daily-%'::text) OR ((title)::text ~~ 'patrol-%'::text) OR ((title)::text ~~ 'review-%'::text))))));

CREATE POLICY p_ai_conversations_write ON public.ai_conversations USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin()))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_ai_generation_drafts_tenant ON public.ai_generation_drafts USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_messages_select ON public.ai_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE (c.id = ai_messages.conversation_id))));

CREATE POLICY p_ai_messages_write ON public.ai_messages USING ((EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND ((c.user_id = public.rls_user_id()) OR public.rls_is_super_admin()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND ((c.user_id = public.rls_user_id()) OR public.rls_is_super_admin())))));

CREATE POLICY p_ai_model_profile_tenant ON public.ai_model_profile USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_model_providers_select ON public.ai_model_providers FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_ai_model_providers_write ON public.ai_model_providers USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_ai_tool_logs_select ON public.ai_tool_logs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((actor_user_id = public.rls_user_id()) OR public.rls_is_super_admin() OR (public.rls_role() = 'ops_director'::text))));

CREATE POLICY p_ai_tool_logs_write ON public.ai_tool_logs USING (((public.rls_user_id() IS NOT NULL) AND ((actor_user_id = public.rls_user_id()) OR public.rls_is_super_admin() OR (public.rls_role() = 'ops_director'::text)))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((actor_user_id = public.rls_user_id()) OR public.rls_is_super_admin() OR (public.rls_role() = 'ops_director'::text))));

CREATE POLICY p_ai_tool_policy_tenant ON public.ai_tool_policy USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_citation_tenant ON public.ai_v2_citation USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_claim_tenant ON public.ai_v2_claim USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_event_tenant ON public.ai_v2_event USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_evidence_tenant ON public.ai_v2_evidence USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_llm_tenant ON public.ai_v2_llm_call USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_run_tenant ON public.ai_v2_run USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_ai_v2_step_tenant ON public.ai_v2_step USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_alert_events_select ON public.alert_events FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_alert_events_write ON public.alert_events USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_alert_rules_select ON public.alert_rules FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_alert_rules_write ON public.alert_rules USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_amount_type_dict_select ON public.amount_type_dict FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_amount_type_dict_write ON public.amount_type_dict USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_anchor_capabilities_select ON public.anchor_capabilities FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((public.rls_is_agency_staff() AND ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'hrbp'::text])) OR ((public.rls_role() = ANY (ARRAY['controller'::text])) AND (anchor_id = public.rls_anchor_id())))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_anchors() AND (EXISTS ( SELECT 1
   FROM public.live_sessions ls
  WHERE ((ls.anchor_id = anchor_capabilities.anchor_id) AND public.rls_has_project(ls.project_id))))))));

CREATE POLICY p_anchor_capabilities_write ON public.anchor_capabilities USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'hrbp'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'hrbp'::text]))));

CREATE POLICY p_anchor_profiles_select ON public.anchor_profiles FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = anchor_profiles.id)))));

CREATE POLICY p_anchor_profiles_write ON public.anchor_profiles USING (((public.rls_is_ops_writer() OR public.rls_is_hr_writer()) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = anchor_profiles.id))))) WITH CHECK (((public.rls_is_ops_writer() OR public.rls_is_hr_writer()) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = anchor_profiles.id)))));

CREATE POLICY p_anchor_script_templates_select ON public.anchor_script_templates FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_anchor_script_templates_write ON public.anchor_script_templates USING ((public.rls_is_ops_writer() OR public.rls_is_hr_writer())) WITH CHECK ((public.rls_is_ops_writer() OR public.rls_is_hr_writer()));

CREATE POLICY p_anchors_select ON public.anchors FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (((public.rls_role() = 'controller'::text) AND (id = public.rls_anchor_id())) OR (((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((public.rls_is_agency_staff() AND (public.rls_role() <> 'controller'::text)) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_anchors()) OR (user_id = public.rls_user_id()))))));

CREATE POLICY p_anchors_write ON public.anchors USING (((public.rls_is_ops_writer() OR public.rls_is_hr_writer()) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK (((public.rls_is_ops_writer() OR public.rls_is_hr_writer()) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_assistant_memory_audit_tenant ON public.assistant_memory_audit USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_assistant_memory_items_tenant ON public.assistant_memory_items USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_audit_logs_select ON public.audit_logs FOR SELECT USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text]))));

CREATE POLICY p_bgm_library_tenant ON public.bgm_library USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_biz_targets_select ON public.biz_targets FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_biz_targets_write ON public.biz_targets USING ((public.rls_is_ops_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_ops_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_brand_kits_tenant ON public.brand_kits USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_campaign_plan_select ON public.campaign_plan FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR ((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff()))));

CREATE POLICY p_campaign_plan_template_select ON public.campaign_plan_template FOR SELECT TO leyova_app USING ((true AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_campaign_plan_write ON public.campaign_plan TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_default FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202608 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202609 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202610 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202611 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202612 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202701 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202702 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202703 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202704 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202705 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_select ON public.canonical_order_items_y202706 FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_default USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202608 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202609 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202610 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202611 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202612 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202701 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202702 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202703 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202704 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202705 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_order_items_write ON public.canonical_order_items_y202706 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_default FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202608 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202609 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202610 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202611 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202612 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202701 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202702 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202703 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202704 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202705 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_select ON public.canonical_orders_y202706 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_default USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202608 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202609 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202610 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202611 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202612 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202701 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202702 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202703 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202704 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202705 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_orders_write ON public.canonical_orders_y202706 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_default FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202608 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202609 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202610 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202611 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202612 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202701 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202702 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202703 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202704 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202705 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_select ON public.canonical_refund_events_y202706 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_default USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202608 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202609 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202610 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202611 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202612 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202701 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202702 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202703 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202704 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202705 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_canonical_refund_events_write ON public.canonical_refund_events_y202706 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_default FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202608 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202609 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202610 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202611 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202612 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202701 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202702 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202703 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202704 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202705 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_select ON public.clean_records_y202706 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_default USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202608 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202609 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202610 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202611 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202612 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202701 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202702 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202703 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202704 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202705 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_records_write ON public.clean_records_y202706 USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_clean_rule_sets_select ON public.clean_rule_sets FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_clean_rule_sets_write ON public.clean_rule_sets USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_cleaning_runs_select ON public.cleaning_runs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = cleaning_runs.batch_id)))));

CREATE POLICY p_cleaning_runs_write ON public.cleaning_runs USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = cleaning_runs.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = cleaning_runs.batch_id)))));

CREATE POLICY p_competitor_brands_select ON public.competitor_brands FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_competitor_brands_write ON public.competitor_brands USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_competitor_price_data_select ON public.competitor_price_data FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_competitor_price_data_write ON public.competitor_price_data USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_compliance_events_select ON public.compliance_events FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_compliance_events_write ON public.compliance_events TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_content_assets_select ON public.content_assets FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text)) AND (public.rls_is_content_writer() OR public.rls_has_project(project_id))));

CREATE POLICY p_content_assets_write ON public.content_assets USING ((public.rls_is_content_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text)))) WITH CHECK ((public.rls_is_content_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text))));

CREATE POLICY p_content_attribution_ledger_select ON public.content_attribution_ledger FOR SELECT TO leyova_app USING ((public.rls_can_access_shop(shop_id) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_attribution_ledger_write ON public.content_attribution_ledger TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_briefs_tenant ON public.content_briefs USING ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_ideas_tenant ON public.content_ideas USING ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_metrics_link_tenant ON public.content_metrics_link USING ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_projects_select ON public.content_projects FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_content_projects_write ON public.content_projects USING ((public.rls_is_content_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_content_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_content_providers_select ON public.content_providers FOR SELECT USING (public.rls_is_content_writer());

CREATE POLICY p_content_providers_write ON public.content_providers USING ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))) WITH CHECK ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])));

CREATE POLICY p_content_schedules_select ON public.content_schedules FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_content_schedules_write ON public.content_schedules TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_content_tasks_select ON public.content_tasks FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND (public.rls_is_content_writer() OR public.rls_has_project(project_id))));

CREATE POLICY p_content_tasks_write ON public.content_tasks USING (public.rls_is_content_writer()) WITH CHECK (public.rls_is_content_writer());

CREATE POLICY p_custom_field_def_select ON public.sys_custom_field_definition FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_custom_field_def_write ON public.sys_custom_field_definition TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))));

CREATE POLICY p_custom_field_val_select ON public.sys_custom_field_value FOR SELECT TO leyova_app USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_custom_field_val_write ON public.sys_custom_field_value TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'ad_buyer'::text]))));

CREATE POLICY p_data_exports_select ON public.data_exports FOR SELECT USING (public.rls_is_ops_writer());

CREATE POLICY p_data_exports_write ON public.data_exports USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_data_quality_issues_select ON public.data_quality_issues FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = data_quality_issues.batch_id)))));

CREATE POLICY p_data_quality_issues_write ON public.data_quality_issues USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = data_quality_issues.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = data_quality_issues.batch_id)))));

CREATE POLICY p_data_uploads_select ON public.data_uploads FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_data_uploads_write ON public.data_uploads USING ((public.rls_is_ops_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_ops_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_decision_cases_select ON public.decision_cases FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND (public.rls_is_ops_writer() OR (owner_user_id = public.rls_user_id()) OR (created_by = public.rls_user_id()))));

CREATE POLICY p_decision_cases_write ON public.decision_cases USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND (public.rls_is_ops_writer() OR (owner_user_id = public.rls_user_id()) OR (created_by = public.rls_user_id())))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND (public.rls_is_ops_writer() OR (owner_user_id = public.rls_user_id()) OR (created_by = public.rls_user_id()))));

CREATE POLICY p_dim_accounting_subject_select ON public.dim_accounting_subject FOR SELECT TO leyova_app USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dim_accounting_subject_write ON public.dim_accounting_subject TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text]))));

CREATE POLICY p_dim_brand_select ON public.dim_brand FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dim_brand_write ON public.dim_brand USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_dim_category_select ON public.dim_category FOR SELECT TO leyova_app USING (true);

CREATE POLICY p_dim_cs_agent_select ON public.dim_cs_agent FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_dim_cs_agent_write ON public.dim_cs_agent USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_dim_dept_select ON public.dim_dept FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_dim_dept_write ON public.dim_dept USING ((public.rls_is_hr_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_hr_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_dim_kol_select ON public.dim_kol FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_dim_kol_write ON public.dim_kol USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_dim_product_channel_listing_select ON public.dim_product_channel_listing FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_dim_product_channel_listing_write ON public.dim_product_channel_listing USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_dim_product_select ON public.dim_product FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dim_product_write ON public.dim_product USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_dim_shop_select ON public.dim_shop FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND (((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff()) OR (tenant_id = public.rls_tenant_id()))));

CREATE POLICY p_dim_shop_write ON public.dim_shop USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])) AND ((public.rls_role() = 'super_admin'::text) OR (tenant_id = public.rls_tenant_id())))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])) AND ((public.rls_role() = 'super_admin'::text) OR (tenant_id = public.rls_tenant_id()))));

CREATE POLICY p_dim_sku_mapping_select ON public.dim_sku_mapping FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_dim_sku_mapping_write ON public.dim_sku_mapping USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_dim_team_select ON public.dim_team FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_dim_team_write ON public.dim_team USING ((public.rls_is_hr_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_hr_writer() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_dim_traffic_source_select ON public.dim_traffic_source FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dim_traffic_source_write ON public.dim_traffic_source USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_douyin_anchor_daily_metrics_select ON public.douyin_anchor_daily_metrics FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (public.rls_is_ops_writer() OR ((anchor_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = douyin_anchor_daily_metrics.anchor_id)))))));

CREATE POLICY p_douyin_anchor_daily_metrics_write ON public.douyin_anchor_daily_metrics USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_douyin_channel_daily_metrics_select ON public.douyin_channel_daily_metrics FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((upload_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.data_uploads u
  WHERE (u.id = douyin_channel_daily_metrics.upload_id)))))));

CREATE POLICY p_douyin_channel_daily_metrics_write ON public.douyin_channel_daily_metrics USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_dq_quarantine_select ON public.dq_quarantine FOR SELECT TO leyova_app USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_dq_quarantine_write ON public.dq_quarantine TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text]))));

CREATE POLICY p_entity_aliases_select ON public.entity_aliases FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text))));

CREATE POLICY p_entity_aliases_write ON public.entity_aliases USING ((public.rls_is_ops_writer() AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text))));

CREATE POLICY p_fact_ad_spend_daily_select ON public.fact_ad_spend_daily FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost())) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_fact_ad_spend_daily_write ON public.fact_ad_spend_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_fact_after_sale_tickets_select ON public.fact_after_sale_tickets FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_after_sale_tickets_write ON public.fact_after_sale_tickets USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_content_daily_select ON public.fact_content_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_fact_content_daily_write ON public.fact_content_daily USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_fact_cs_session_select ON public.fact_cs_session FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_cs_session_write ON public.fact_cs_session USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_fulfillment_waybill_select ON public.fact_fulfillment_waybill FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_fulfillment_waybill_write ON public.fact_fulfillment_waybill USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_inventory_ledger_select ON public.fact_inventory_ledger FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR (operator_id = public.rls_user_id()))));

CREATE POLICY p_fact_inventory_ledger_write ON public.fact_inventory_ledger USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_fact_inventory_reservation_select ON public.fact_inventory_reservation FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_inventory_reservation_write ON public.fact_inventory_reservation USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_inventory_stock_select ON public.fact_inventory_stock FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_fact_inventory_stock_write ON public.fact_inventory_stock USING ((public.rls_is_ops_writer() AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_ops_writer() AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_fact_jd_settlement_fees_select ON public._deprecated_fact_jd_settlement_fees FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost()))));

CREATE POLICY p_fact_jd_settlement_fees_write ON public._deprecated_fact_jd_settlement_fees USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))));

CREATE POLICY p_fact_kol_cooperation_select ON public.fact_kol_cooperation FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_kol_cooperation_write ON public.fact_kol_cooperation USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_search_keyword_daily_select ON public.fact_search_keyword_daily FOR SELECT TO leyova_app USING ((public.rls_can_access_shop(shop_id) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_fact_search_keyword_daily_write ON public.fact_search_keyword_daily TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_fact_settlement_cycles_select ON public.fact_settlement_cycles FOR SELECT USING ((public.rls_can_access_shop(shop_id) AND ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_cost())) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_fact_settlement_cycles_write ON public.fact_settlement_cycles USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_default FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y202608 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y2026m09 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y2026m10 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y2026m11 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y2026m12 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y202702 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_select ON public.fact_trade_daily_y2027m01 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_default USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y202608 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y2026m09 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y2026m10 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y2026m11 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y2026m12 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y202702 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_trade_daily_write ON public.fact_trade_daily_y2027m01 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_default FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y202608 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y202609 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y2026m10 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y2026m11 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y2026m12 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y202701 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_select ON public.fact_traffic_daily_y202702 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_default USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y202608 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y202609 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y2026m10 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y2026m11 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y2026m12 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y202701 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_fact_traffic_daily_write ON public.fact_traffic_daily_y202702 USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND public.rls_has_platform((platform_code)::text) AND public.rls_can_access_shop(shop_id)));

CREATE POLICY p_field_mapping_rules_select ON public.field_mapping_rules FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text))));

CREATE POLICY p_field_mapping_rules_write ON public.field_mapping_rules USING ((public.rls_is_ops_writer() AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((source_platform IS NULL) OR ((source_platform)::text = ''::text) OR public.rls_has_platform((source_platform)::text))));

CREATE POLICY p_gl_entry_select ON public.fact_gl_entry FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_gl_entry_write ON public.fact_gl_entry TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_gl_voucher_select ON public.fact_gl_voucher FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_gl_voucher_write ON public.fact_gl_voucher TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])) AND ((platform_code IS NULL) OR public.rls_has_platform((platform_code)::text)) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id))));

CREATE POLICY p_goal_tracking_select ON public.goal_tracking FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_goal_tracking_write ON public.goal_tracking USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_hrbp_auditions_select ON public.hrbp_auditions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_hr_writer()));

CREATE POLICY p_hrbp_auditions_write ON public.hrbp_auditions USING (public.rls_is_hr_writer()) WITH CHECK (public.rls_is_hr_writer());

CREATE POLICY p_hrbp_candidates_select ON public.hrbp_candidates FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (public.rls_is_hr_writer() OR ((anchor_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = hrbp_candidates.anchor_id)))))));

CREATE POLICY p_hrbp_candidates_write ON public.hrbp_candidates USING (public.rls_is_hr_writer()) WITH CHECK (public.rls_is_hr_writer());

CREATE POLICY p_import_batches_select ON public.import_batches FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_import_batches_write ON public.import_batches USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((source_platform)::text) AND public.rls_shop_strict(store_id)));

CREATE POLICY p_import_files_select ON public.import_files FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = import_files.batch_id)))));

CREATE POLICY p_import_files_write ON public.import_files USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = import_files.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = import_files.batch_id)))));

CREATE POLICY p_improvement_tasks_select ON public.improvement_tasks FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_improvement_tasks_write ON public.improvement_tasks USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_ingest_sync_jobs_select ON public.ingest_sync_jobs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_ingest_sync_jobs_write ON public.ingest_sync_jobs USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_integration_call_logs_tenant ON public.integration_call_logs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_integration_connections_tenant ON public.integration_connections USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_integration_credentials_tenant ON public.integration_credentials USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_integration_webhooks_tenant ON public.integration_webhooks USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_issue_library_select ON public.issue_library FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_issue_library_write ON public.issue_library USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_kb_acl_tenant ON public.kb_acl USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_banned_words_tenant ON public.kb_banned_words USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_chunks_tenant ON public.kb_chunks USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_collections_tenant ON public.kb_collections USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_documents_tenant ON public.kb_documents USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_feedback_tenant ON public.kb_feedback USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_index_versions_tenant ON public.kb_index_versions USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kb_ingest_jobs_tenant ON public.kb_ingest_jobs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_kuaishou_fans_ops_select ON public.kuaishou_fans_ops FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_kuaishou_fans_ops_write ON public.kuaishou_fans_ops USING ((public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_land_dedup_select ON public.land_raw_dedup FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text)));

CREATE POLICY p_land_dedup_write ON public.land_raw_dedup TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text]))));

CREATE POLICY p_live_registrations_select ON public.live_registrations FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR public.rls_has_project(project_id) OR ((anchor_id IS NOT NULL) AND (anchor_id = public.rls_anchor_id())))));

CREATE POLICY p_live_registrations_write ON public.live_registrations USING ((public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((anchor_id IS NOT NULL) AND (anchor_id = public.rls_anchor_id()))) AND ((project_id IS NULL) OR public.rls_is_ops_writer() OR public.rls_has_project(project_id)))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((anchor_id IS NOT NULL) AND (anchor_id = public.rls_anchor_id()))) AND ((project_id IS NULL) OR public.rls_is_ops_writer() OR public.rls_has_project(project_id))));

CREATE POLICY p_live_rooms_select ON public.live_rooms FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_live_rooms_write ON public.live_rooms USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_live_sessions_select ON public.live_sessions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text) AND (((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_anchors() AND (project_id IS NOT NULL) AND public.rls_has_project(project_id)) OR (public.rls_is_agency_staff() AND ((public.rls_role() <> 'controller'::text) OR (anchor_id = public.rls_anchor_id()) OR ((anchor_id IS NULL) AND (operator_id = public.rls_user_id())))))));

CREATE POLICY p_live_sessions_write ON public.live_sessions USING ((public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((public.rls_role() = 'controller'::text) AND ((anchor_id = public.rls_anchor_id()) OR ((anchor_id IS NULL) AND (operator_id = public.rls_user_id()))))))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((public.rls_role() = 'controller'::text) AND ((anchor_id = public.rls_anchor_id()) OR ((anchor_id IS NULL) AND (operator_id = public.rls_user_id())))))));

CREATE POLICY p_llm_provider_config_select ON public.llm_provider_config FOR SELECT USING (public.rls_is_super_admin());

CREATE POLICY p_llm_provider_config_write ON public.llm_provider_config USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_media_assets_tenant ON public.media_assets USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_media_draft_exports_tenant ON public.media_draft_exports USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_media_highlights_tenant ON public.media_highlights USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_media_render_jobs_tenant ON public.media_render_jobs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_media_transcripts_tenant ON public.media_transcripts USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_metric_definition_select ON public.metric_definition FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_metric_definition_write ON public.metric_definition USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_multi_room_status_select ON public.multi_room_status FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((room_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_rooms r
  WHERE (r.id = multi_room_status.room_id)))))));

CREATE POLICY p_multi_room_status_write ON public.multi_room_status USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_operators_select ON public.operators FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_operators_write ON public.operators USING ((public.rls_is_ops_writer() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'hrbp'::text)))) WITH CHECK ((public.rls_is_ops_writer() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'hrbp'::text))));

CREATE POLICY p_order_event_stream_select ON public.fact_order_event_stream FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_event_stream_write ON public.fact_order_event_stream TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_rma_item_select ON public.fact_order_rma_item FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_rma_item_write ON public.fact_order_rma_item TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text, 'customer_service'::text])) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_order_status_config_select ON public.order_status_config FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_order_status_config_write ON public.order_status_config USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_overview_activities_select ON public.overview_activities FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_overview_activities_write ON public.overview_activities USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_overview_daily_stats_archive_select ON public.overview_daily_stats_archive FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_overview_daily_stats_archive_write ON public.overview_daily_stats_archive USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_overview_daily_stats_select ON public.overview_daily_stats FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_overview_daily_stats_write ON public.overview_daily_stats USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_permission_requests_select ON public.permission_requests FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((user_id = public.rls_user_id()) OR (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))));

CREATE POLICY p_permission_requests_write ON public.permission_requests USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((user_id = public.rls_user_id()) OR (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()) AND ((user_id = public.rls_user_id()) OR (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))));

CREATE POLICY p_platform_caliber_config_select ON public.platform_caliber_config FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_caliber_config_write ON public.platform_caliber_config USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_capability_matrix_select ON public.platform_capability_matrix FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_capability_matrix_write ON public.platform_capability_matrix USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_members_summary_select ON public.platform_members_summary FOR SELECT TO leyova_app USING ((public.rls_can_access_shop(shop_id) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_platform_members_summary_write ON public.platform_members_summary TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_platform_sla_config_select ON public.platform_sla_config FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_sla_config_write ON public.platform_sla_config USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_source_mapping_select ON public.platform_source_mapping FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_platform_source_mapping_write ON public.platform_source_mapping USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_pricing_rules_select ON public.pricing_rules FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_pricing_rules_write ON public.pricing_rules USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()) AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ad_buyer'::text]))));

CREATE POLICY p_promotion_rules_select ON public.promotion_rules FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (tenant_id = public.rls_tenant_id()) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_promotion_rules_write ON public.promotion_rules TO leyova_app USING ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id()))) WITH CHECK ((public.rls_is_agency_staff() AND (tenant_id = public.rls_tenant_id())));

CREATE POLICY p_promotions_select ON public.promotions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_promotions_write ON public.promotions USING ((public.rls_is_ops_writer() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'ad_buyer'::text)))) WITH CHECK ((public.rls_is_ops_writer() OR (public.rls_is_agency_staff() AND (public.rls_role() = 'ad_buyer'::text))));

CREATE POLICY p_prompt_eval_runs_tenant ON public.prompt_eval_runs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_prompt_templates_tenant ON public.prompt_templates USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_prompt_versions_tenant ON public.prompt_versions USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_publish_reversals_select ON public.publish_reversals FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.publish_runs pr
  WHERE (pr.id = publish_reversals.publish_run_id)))));

CREATE POLICY p_publish_reversals_write ON public.publish_reversals USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.publish_runs pr
  WHERE (pr.id = publish_reversals.publish_run_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.publish_runs pr
  WHERE (pr.id = publish_reversals.publish_run_id)))));

CREATE POLICY p_publish_runs_select ON public.publish_runs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = publish_runs.batch_id)))));

CREATE POLICY p_publish_runs_write ON public.publish_runs USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = publish_runs.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = publish_runs.batch_id)))));

CREATE POLICY p_qianchuan_budget_requests_tenant ON public.qianchuan_budget_requests USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_qianchuan_sync_runs_tenant ON public.qianchuan_sync_runs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_raw_records_select ON public.raw_records FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_default FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_default.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202608 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202608.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202609 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202609.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202610 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202610.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202611 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202611.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202612 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202612.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202701 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202701.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202702 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202702.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202703 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202703.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202704 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202704.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202705 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202705.batch_id)))));

CREATE POLICY p_raw_records_select ON public.raw_records_y202706 FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202706.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_default USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_default.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_default.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202608 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202608.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202608.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202609 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202609.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202609.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202610 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202610.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202610.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202611 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202611.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202611.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202612 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202612.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202612.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202701 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202701.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202701.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202702 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202702.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202702.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202703 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202703.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202703.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202704 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202704.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202704.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202705 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202705.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202705.batch_id)))));

CREATE POLICY p_raw_records_write ON public.raw_records_y202706 USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202706.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = raw_records_y202706.batch_id)))));

CREATE POLICY p_reconciliation_runs_select ON public.reconciliation_runs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = reconciliation_runs.batch_id)))));

CREATE POLICY p_reconciliation_runs_write ON public.reconciliation_runs USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = reconciliation_runs.batch_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.import_batches b
  WHERE (b.id = reconciliation_runs.batch_id)))));

CREATE POLICY p_render_jobs_tenant ON public.render_jobs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_render_outputs_tenant ON public.render_outputs USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_review_actions_select ON public.review_actions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.data_quality_issues i
  WHERE (i.id = review_actions.issue_id)))));

CREATE POLICY p_review_actions_write ON public.review_actions USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.data_quality_issues i
  WHERE (i.id = review_actions.issue_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.data_quality_issues i
  WHERE (i.id = review_actions.issue_id)))));

CREATE POLICY p_risk_assessment_select ON public.compliance_risk_assessment FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.compliance_rule_change c
  WHERE ((c.id = compliance_risk_assessment.change_id) AND public.rls_has_platform((c.platform_code)::text))))));

CREATE POLICY p_risk_assessment_write ON public.compliance_risk_assessment TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))));

CREATE POLICY p_role_module_grants_select ON public.role_module_grants FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_role_module_grants_write ON public.role_module_grants USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_role_modules_select ON public.role_modules FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_role_modules_write ON public.role_modules USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_role_platform_permissions_select ON public.role_platform_permissions FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_role_platform_permissions_write ON public.role_platform_permissions USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_role_workbenches_select ON public.role_workbenches FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_role_workbenches_write ON public.role_workbenches USING ((public.rls_is_super_admin() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_super_admin() AND ((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_roles_select ON public.roles FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_roles_write ON public.roles USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_room_health_select ON public.room_health FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff() AND (public.rls_is_ops_writer() OR ((room_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_rooms r
  WHERE (r.id = room_health.room_id)))))));

CREATE POLICY p_room_health_write ON public.room_health USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_rule_change_select ON public.compliance_rule_change FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_rule_change_write ON public.compliance_rule_change TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text]))));

CREATE POLICY p_rule_snapshot_select ON public.compliance_rule_snapshot FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_rule_snapshot_write ON public.compliance_rule_snapshot TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))));

CREATE POLICY p_script_library_select ON public.script_library FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_script_library_write ON public.script_library USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_script_versions_tenant ON public.script_versions USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_seasonal_calendar_tenant ON public.seasonal_calendar USING ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_selection_item_select ON public.fact_selection_item FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.fact_selection_recommendation r
  WHERE ((r.id = fact_selection_item.recommendation_id) AND ((r.shop_id IS NULL) OR public.rls_can_access_shop(r.shop_id)) AND ((r.tenant_id = public.rls_tenant_id()) OR ((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff())))))));

CREATE POLICY p_selection_item_write ON public.fact_selection_item TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text]))));

CREATE POLICY p_selection_rec_select ON public.fact_selection_recommendation FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR ((public.rls_role() = 'super_admin'::text) AND public.rls_is_agency_staff())) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_selection_rec_write ON public.fact_selection_recommendation TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])) AND ((shop_id IS NULL) OR public.rls_can_access_shop(shop_id)) AND ((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_session_anchor_metrics_select ON public.session_anchor_metrics FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (public.rls_is_ops_writer() OR ((anchor_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = session_anchor_metrics.anchor_id)))))));

CREATE POLICY p_session_anchor_metrics_write ON public.session_anchor_metrics USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_session_channel_metrics_select ON public.session_channel_metrics FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_session_channel_metrics_write ON public.session_channel_metrics USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_session_live_basic_info_select ON public.session_live_basic_info FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_live_basic_info.session_id)))));

CREATE POLICY p_session_live_basic_info_write ON public.session_live_basic_info USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_live_basic_info.session_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_live_basic_info.session_id)))));

CREATE POLICY p_session_overview_metrics_select ON public.session_overview_metrics FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_overview_metrics.session_id)))));

CREATE POLICY p_session_overview_metrics_write ON public.session_overview_metrics USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_overview_metrics.session_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_overview_metrics.session_id)))));

CREATE POLICY p_session_plan_products_select ON public.session_plan_products FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (public.rls_is_ops_writer() OR ((plan_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.session_plans p
  WHERE (p.id = session_plan_products.plan_id)))) OR ((session_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_plan_products.session_id)))))));

CREATE POLICY p_session_plan_products_write ON public.session_plan_products USING ((public.rls_is_ops_writer() AND (((plan_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.session_plans p
  WHERE (p.id = session_plan_products.plan_id)))) OR ((session_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_plan_products.session_id))))))) WITH CHECK ((public.rls_is_ops_writer() AND (((plan_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.session_plans p
  WHERE (p.id = session_plan_products.plan_id)))) OR ((session_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_plan_products.session_id)))))));

CREATE POLICY p_session_plans_select ON public.session_plans FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (public.rls_is_ops_writer() OR ((public.rls_role() = 'controller'::text) AND (anchor_id IS NOT NULL) AND (anchor_id = public.rls_anchor_id())) OR (public.rls_is_agency_staff() AND (public.rls_role() <> 'controller'::text) AND (((anchor_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = session_plans.anchor_id)))) OR ((room_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_rooms r
  WHERE (r.id = session_plans.room_id)))))) OR ((public.rls_user_type() = 'brand_viewer'::text) AND public.rls_can_view_anchors() AND (anchor_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = session_plans.anchor_id)))))));

CREATE POLICY p_session_plans_write ON public.session_plans USING ((public.rls_is_ops_writer() AND ((anchor_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = session_plans.anchor_id)))))) WITH CHECK ((public.rls_is_ops_writer() AND ((anchor_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.anchors a
  WHERE (a.id = session_plans.anchor_id))))));

CREATE POLICY p_session_short_video_traffic_select ON public.session_short_video_traffic FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_short_video_traffic.session_id)))));

CREATE POLICY p_session_short_video_traffic_write ON public.session_short_video_traffic USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_short_video_traffic.session_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_short_video_traffic.session_id)))));

CREATE POLICY p_session_staff_assignments_select ON public.session_staff_assignments FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_staff_assignments.session_id)))));

CREATE POLICY p_session_staff_assignments_write ON public.session_staff_assignments USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_staff_assignments.session_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.live_sessions s
  WHERE (s.id = session_staff_assignments.session_id)))));

CREATE POLICY p_setup_templates_select ON public.setup_templates FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_setup_templates_write ON public.setup_templates USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_shot_items_tenant ON public.shot_items USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_signal_source_select ON public.signal_source FOR SELECT TO leyova_app USING (true);

CREATE POLICY p_staff_day_status_select ON public.staff_day_status FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_is_agency_staff()));

CREATE POLICY p_staff_day_status_write ON public.staff_day_status USING ((public.rls_is_ops_writer() OR (public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['hrbp'::text, 'ad_buyer'::text]))))) WITH CHECK ((public.rls_is_ops_writer() OR (public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['hrbp'::text, 'ad_buyer'::text])))));

CREATE POLICY p_staff_role_dict_select ON public.staff_role_dict FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_staff_role_dict_write ON public.staff_role_dict USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_stg_import_select ON public.stg_order_import FOR SELECT TO leyova_app USING (((public.rls_user_id() IS NOT NULL) AND public.rls_has_platform((source_platform)::text) AND public.rls_can_access_shop(store_id)));

CREATE POLICY p_stg_import_write ON public.stg_order_import TO leyova_app USING ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text])))) WITH CHECK ((public.rls_is_agency_staff() AND (public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text, 'ops_staff'::text]))));

CREATE POLICY p_storyboards_tenant ON public.storyboards USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_subtitle_styles_tenant ON public.subtitle_styles USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_sys_deprecation_logs_tenant ON public.sys_deprecation_access_logs USING (((tenant_id IS NULL) OR (tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id IS NULL) OR (tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_sys_role_modify ON public.sys_role USING ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_is_super_admin())));

CREATE POLICY p_sys_role_perm_modify ON public.sys_role_permission USING ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_is_super_admin())));

CREATE POLICY p_sys_role_perm_select ON public.sys_role_permission FOR SELECT USING (true);

CREATE POLICY p_sys_role_select ON public.sys_role FOR SELECT USING (true);

CREATE POLICY p_sys_user_role_modify ON public.sys_user_role USING ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_is_super_admin()))) WITH CHECK ((public.rls_is_super_admin() OR (public.rls_is_agency_staff() AND public.rls_is_super_admin())));

CREATE POLICY p_sys_user_role_select ON public.sys_user_role FOR SELECT USING (((tenant_id = public.rls_tenant_id()) OR public.rls_is_super_admin()));

CREATE POLICY p_system_config_select ON public.system_config FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_system_config_write ON public.system_config USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_system_jobs_select ON public.system_jobs FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_system_jobs_write ON public.system_jobs USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_system_module_parameters_select ON public.system_module_parameters FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_system_module_parameters_write ON public.system_module_parameters USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_system_modules_select ON public.system_modules FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_system_modules_write ON public.system_modules USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_system_platform_configs_select ON public.system_platform_configs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_system_platform_configs_write ON public.system_platform_configs USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_target_templates_select ON public.target_templates FOR SELECT USING ((public.rls_user_id() IS NOT NULL));

CREATE POLICY p_target_templates_write ON public.target_templates USING (public.rls_is_ops_writer()) WITH CHECK (public.rls_is_ops_writer());

CREATE POLICY p_template_versions_tenant ON public.template_versions USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_tenants_select ON public.tenants FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((id = public.rls_tenant_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_tenants_write ON public.tenants USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_topic_performance_tenant ON public.topic_performance USING ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text))) WITH CHECK ((((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)) AND public.rls_has_platform((platform_code)::text)));

CREATE POLICY p_upload_column_mappings_select ON public.upload_column_mappings FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_upload_column_mappings_write ON public.upload_column_mappings USING ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text)))) WITH CHECK ((public.rls_is_ops_writer() AND ((platform_code IS NULL) OR ((platform_code)::text = ''::text) OR public.rls_has_platform((platform_code)::text))));

CREATE POLICY p_user_module_overrides_select ON public.user_module_overrides FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_user_module_overrides_write ON public.user_module_overrides USING ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text]))) WITH CHECK ((public.rls_role() = ANY (ARRAY['super_admin'::text, 'ops_director'::text])));

CREATE POLICY p_user_platform_permissions_select ON public.user_platform_permissions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_user_platform_permissions_write ON public.user_platform_permissions USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_user_sessions_select ON public.user_sessions FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_user_sessions_write ON public.user_sessions USING (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin()))) WITH CHECK (((public.rls_user_id() IS NOT NULL) AND ((user_id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_users_select ON public.users FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND ((tenant_id = public.rls_tenant_id()) OR (id = public.rls_user_id()) OR public.rls_is_super_admin())));

CREATE POLICY p_users_write ON public.users USING (public.rls_is_super_admin()) WITH CHECK (public.rls_is_super_admin());

CREATE POLICY p_validation_runs_select ON public.validation_runs FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.cleaning_runs cr
  WHERE (cr.id = validation_runs.cleaning_run_id)))));

CREATE POLICY p_validation_runs_write ON public.validation_runs USING ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.cleaning_runs cr
  WHERE (cr.id = validation_runs.cleaning_run_id))))) WITH CHECK ((public.rls_is_ops_writer() AND (EXISTS ( SELECT 1
   FROM public.cleaning_runs cr
  WHERE (cr.id = validation_runs.cleaning_run_id)))));

CREATE POLICY p_video_metrics_select ON public.video_metrics FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_video_metrics_write ON public.video_metrics USING ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id))) WITH CHECK ((public.rls_is_ops_writer() AND public.rls_platform_strict((platform_code)::text) AND public.rls_shop_strict(shop_id)));

CREATE POLICY p_video_projects_tenant ON public.video_projects USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_video_templates_tenant ON public.video_templates USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_voice_profiles_tenant ON public.voice_profiles USING (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text))) WITH CHECK (((tenant_id = public.rls_tenant_id()) OR (public.rls_role() = 'super_admin'::text)));

CREATE POLICY p_workbench_widgets_select ON public.workbench_widgets FOR SELECT USING (((public.rls_user_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.role_workbenches w
  WHERE (w.id = workbench_widgets.workbench_id)))));

CREATE POLICY p_workbench_widgets_write ON public.workbench_widgets USING ((public.rls_is_super_admin() AND (EXISTS ( SELECT 1
   FROM public.role_workbenches w
  WHERE (w.id = workbench_widgets.workbench_id))))) WITH CHECK ((public.rls_is_super_admin() AND (EXISTS ( SELECT 1
   FROM public.role_workbenches w
  WHERE (w.id = workbench_widgets.workbench_id)))));

-- ===== other (1) =====


-- 确保通过 01_schema.sql 直接建库时 leyova_app 具备 public schema 基础读写权限
GRANT USAGE ON SCHEMA public TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leyova_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO leyova_app;
