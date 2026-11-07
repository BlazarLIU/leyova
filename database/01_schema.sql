--
-- leyova 数据库结构（schema-only）
--
-- 由 PostgreSQL 18 的 pg_dump 导出后清洗，兼容 PostgreSQL 14+。
-- 已移除：vector 扩展（代码未使用）、对象 OWNER、pg_dump 18 专属 \restrict 指令。
--
-- 用法：psql -d leyova -f database/01_schema.sql
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_channel_metrics; Type: TABLE; Schema: public
--

CREATE TABLE public.ad_channel_metrics (
    id integer NOT NULL,
    channel character varying(50) NOT NULL,
    spend numeric(12,2) DEFAULT 0 NOT NULL,
    output numeric(12,2) DEFAULT 0 NOT NULL,
    roi numeric(5,2) DEFAULT 0 NOT NULL,
    conversion_rate numeric(5,2) DEFAULT 0 NOT NULL,
    cpi numeric(10,2) DEFAULT 0 NOT NULL,
    score character varying(20) DEFAULT '一般'::character varying,
    period_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: ad_channel_metrics_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ad_channel_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ad_channel_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ad_channel_metrics_id_seq OWNED BY public.ad_channel_metrics.id;

--
-- Name: ad_plans; Type: TABLE; Schema: public
--

CREATE TABLE public.ad_plans (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    platform character varying(50) DEFAULT '抖音'::character varying NOT NULL,
    budget numeric(12,2) DEFAULT 0 NOT NULL,
    spent numeric(12,2) DEFAULT 0 NOT NULL,
    roi numeric(5,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_plans_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('paused'::character varying)::text, ('finished'::character varying)::text])))
);

--
-- Name: ad_plans_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ad_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ad_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ad_plans_id_seq OWNED BY public.ad_plans.id;

--
-- Name: ai_action_approvals; Type: TABLE; Schema: public
--

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

--
-- Name: ai_action_approvals_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ai_action_approvals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_action_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ai_action_approvals_id_seq OWNED BY public.ai_action_approvals.id;

--
-- Name: ai_config; Type: TABLE; Schema: public
--

CREATE TABLE public.ai_config (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: ai_config_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ai_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ai_config_id_seq OWNED BY public.ai_config.id;

--
-- Name: ai_context_bindings; Type: TABLE; Schema: public
--

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

--
-- Name: ai_context_bindings_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ai_context_bindings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_context_bindings_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ai_context_bindings_id_seq OWNED BY public.ai_context_bindings.id;

--
-- Name: ai_conversations; Type: TABLE; Schema: public
--

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

--
-- Name: ai_conversations_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ai_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ai_conversations_id_seq OWNED BY public.ai_conversations.id;

--
-- Name: ai_messages; Type: TABLE; Schema: public
--

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

--
-- Name: ai_messages_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ai_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ai_messages_id_seq OWNED BY public.ai_messages.id;

--
-- Name: ai_tool_logs; Type: TABLE; Schema: public
--

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

--
-- Name: ai_tool_logs_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.ai_tool_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_tool_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.ai_tool_logs_id_seq OWNED BY public.ai_tool_logs.id;

--
-- Name: alert_events; Type: TABLE; Schema: public
--

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

--
-- Name: alert_events_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.alert_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: alert_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.alert_events_id_seq OWNED BY public.alert_events.id;

--
-- Name: alert_rules; Type: TABLE; Schema: public
--

CREATE TABLE public.alert_rules (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    metric character varying(100) NOT NULL,
    method character varying(50) DEFAULT '阈值检测'::character varying NOT NULL,
    params character varying(200) DEFAULT ''::character varying,
    severity character varying(20) DEFAULT '警告'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: alert_rules_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.alert_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: alert_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.alert_rules_id_seq OWNED BY public.alert_rules.id;

--
-- Name: anchor_capabilities; Type: TABLE; Schema: public
--

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

--
-- Name: anchor_capabilities_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.anchor_capabilities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: anchor_capabilities_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.anchor_capabilities_id_seq OWNED BY public.anchor_capabilities.id;

--
-- Name: anchor_profiles; Type: TABLE; Schema: public
--

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

--
-- Name: anchor_rankings; Type: TABLE; Schema: public
--

CREATE TABLE public.anchor_rankings (
    id integer NOT NULL,
    anchor_id integer NOT NULL,
    overall smallint DEFAULT 0 NOT NULL,
    expression smallint DEFAULT 0 NOT NULL,
    interaction smallint DEFAULT 0 NOT NULL,
    conversion smallint DEFAULT 0 NOT NULL,
    professionalism smallint DEFAULT 0 NOT NULL,
    rank_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: anchor_rankings_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.anchor_rankings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: anchor_rankings_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.anchor_rankings_id_seq OWNED BY public.anchor_rankings.id;

--
-- Name: anchor_script_templates; Type: TABLE; Schema: public
--

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

--
-- Name: anchor_script_templates_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.anchor_script_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: anchor_script_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.anchor_script_templates_id_seq OWNED BY public.anchor_script_templates.id;

--
-- Name: anchor_training_plans; Type: TABLE; Schema: public
--

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

--
-- Name: anchor_training_plans_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.anchor_training_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: anchor_training_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.anchor_training_plans_id_seq OWNED BY public.anchor_training_plans.id;

--
-- Name: anchor_training_records; Type: TABLE; Schema: public
--

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

--
-- Name: anchor_training_records_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.anchor_training_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: anchor_training_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.anchor_training_records_id_seq OWNED BY public.anchor_training_records.id;

--
-- Name: anchors; Type: TABLE; Schema: public
--

CREATE TABLE public.anchors (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    platform character varying(50) DEFAULT '抖音'::character varying NOT NULL,
    level character varying(20) DEFAULT 'B级'::character varying,
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT anchors_status_check CHECK ((status = ANY (ARRAY[0, 1])))
);

--
-- Name: anchors_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.anchors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: anchors_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.anchors_id_seq OWNED BY public.anchors.id;

--
-- Name: audit_logs; Type: TABLE; Schema: public
--

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

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

--
-- Name: competitor_brands; Type: TABLE; Schema: public
--

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

--
-- Name: competitor_brands_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.competitor_brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: competitor_brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.competitor_brands_id_seq OWNED BY public.competitor_brands.id;

--
-- Name: competitor_price_data; Type: TABLE; Schema: public
--

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

--
-- Name: competitor_price_data_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.competitor_price_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: competitor_price_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.competitor_price_data_id_seq OWNED BY public.competitor_price_data.id;

--
-- Name: data_exports; Type: TABLE; Schema: public
--

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

--
-- Name: data_exports_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.data_exports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: data_exports_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.data_exports_id_seq OWNED BY public.data_exports.id;

--
-- Name: data_uploads; Type: TABLE; Schema: public
--

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
    CONSTRAINT data_uploads_status_check CHECK (((status)::text = ANY (ARRAY[('processing'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text])))
);

--
-- Name: data_uploads_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.data_uploads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: data_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.data_uploads_id_seq OWNED BY public.data_uploads.id;

--
-- Name: dict_items; Type: TABLE; Schema: public
--

CREATE TABLE public.dict_items (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    item_count integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT '启用'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: dict_items_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.dict_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: dict_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.dict_items_id_seq OWNED BY public.dict_items.id;

--
-- Name: douyin_anchor_daily_metrics; Type: TABLE; Schema: public
--

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

--
-- Name: douyin_anchor_daily_metrics_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.douyin_anchor_daily_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: douyin_anchor_daily_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.douyin_anchor_daily_metrics_id_seq OWNED BY public.douyin_anchor_daily_metrics.id;

--
-- Name: douyin_channel_daily_metrics; Type: TABLE; Schema: public
--

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

--
-- Name: douyin_channel_daily_metrics_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.douyin_channel_daily_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: douyin_channel_daily_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.douyin_channel_daily_metrics_id_seq OWNED BY public.douyin_channel_daily_metrics.id;

--
-- Name: goal_tracking; Type: TABLE; Schema: public
--

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

--
-- Name: goal_tracking_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.goal_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: goal_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.goal_tracking_id_seq OWNED BY public.goal_tracking.id;

--
-- Name: improvement_tasks; Type: TABLE; Schema: public
--

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

--
-- Name: TABLE improvement_tasks; Type: COMMENT; Schema: public
--

COMMENT ON TABLE public.improvement_tasks IS '改进任务，支持从预警自动生成';

--
-- Name: improvement_tasks_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.improvement_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: improvement_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.improvement_tasks_id_seq OWNED BY public.improvement_tasks.id;

--
-- Name: issue_library; Type: TABLE; Schema: public
--

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

--
-- Name: issue_library_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.issue_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: issue_library_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.issue_library_id_seq OWNED BY public.issue_library.id;

--
-- Name: live_rooms; Type: TABLE; Schema: public
--

CREATE TABLE public.live_rooms (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    platform character varying(50) DEFAULT '抖音'::character varying NOT NULL,
    status character varying(20) DEFAULT 'inactive'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT live_rooms_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('archived'::character varying)::text])))
);

--
-- Name: live_rooms_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.live_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: live_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.live_rooms_id_seq OWNED BY public.live_rooms.id;

--
-- Name: live_sessions; Type: TABLE; Schema: public
--

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
    CONSTRAINT live_sessions_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('live'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);

--
-- Name: live_sessions_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.live_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: live_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.live_sessions_id_seq OWNED BY public.live_sessions.id;

--
-- Name: multi_room_status; Type: TABLE; Schema: public
--

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

--
-- Name: multi_room_status_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.multi_room_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: multi_room_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.multi_room_status_id_seq OWNED BY public.multi_room_status.id;

--
-- Name: operators; Type: TABLE; Schema: public
--

CREATE TABLE public.operators (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    employee_id character varying(50) DEFAULT ''::character varying,
    status smallint DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT operators_status_check CHECK ((status = ANY (ARRAY[0, 1])))
);

--
-- Name: operators_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.operators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: operators_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.operators_id_seq OWNED BY public.operators.id;

--
-- Name: overview_activities; Type: TABLE; Schema: public
--

CREATE TABLE public.overview_activities (
    id integer NOT NULL,
    title character varying(300) NOT NULL,
    time_desc character varying(50) DEFAULT '刚刚'::character varying NOT NULL,
    activity_type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT overview_activities_activity_type_check CHECK (((activity_type)::text = ANY (ARRAY[('gmv_milestone'::character varying)::text, ('order_placed'::character varying)::text, ('viewer_peak'::character varying)::text, ('session_update'::character varying)::text, ('system_notify'::character varying)::text, ('info'::character varying)::text])))
);

--
-- Name: overview_activities_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.overview_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: overview_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.overview_activities_id_seq OWNED BY public.overview_activities.id;

--
-- Name: overview_daily_stats; Type: TABLE; Schema: public
--

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

--
-- Name: overview_daily_stats_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.overview_daily_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: overview_daily_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.overview_daily_stats_id_seq OWNED BY public.overview_daily_stats.id;

--
-- Name: permissions; Type: TABLE; Schema: public
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    module character varying(50) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;

--
-- Name: product_template_items; Type: TABLE; Schema: public
--

CREATE TABLE public.product_template_items (
    id integer NOT NULL,
    template_id integer NOT NULL,
    name character varying(200) NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    cost numeric(10,2) DEFAULT 0 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    category character varying(50) DEFAULT ''::character varying,
    display_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: product_template_items_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.product_template_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: product_template_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.product_template_items_id_seq OWNED BY public.product_template_items.id;

--
-- Name: product_templates; Type: TABLE; Schema: public
--

CREATE TABLE public.product_templates (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    product_count integer DEFAULT 0 NOT NULL,
    total_value numeric(10,2) DEFAULT 0 NOT NULL,
    scenario character varying(100) DEFAULT ''::character varying,
    use_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: product_templates_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.product_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: product_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.product_templates_id_seq OWNED BY public.product_templates.id;

--
-- Name: promotions; Type: TABLE; Schema: public
--

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

--
-- Name: TABLE promotions; Type: COMMENT; Schema: public
--

COMMENT ON TABLE public.promotions IS '活动管理';

--
-- Name: COLUMN promotions.name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.name IS '活动名称';

--
-- Name: COLUMN promotions.type; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.type IS '活动类型';

--
-- Name: COLUMN promotions.content; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.content IS '活动内容';

--
-- Name: COLUMN promotions.start_date; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.start_date IS '开始日期';

--
-- Name: COLUMN promotions.end_date; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.end_date IS '结束日期';

--
-- Name: COLUMN promotions.applicable_rooms; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.applicable_rooms IS '适用直播间ID列表';

--
-- Name: COLUMN promotions.applicable_anchors; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.applicable_anchors IS '适用主播ID列表';

--
-- Name: COLUMN promotions.target_gmv; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.target_gmv IS '目标GMV';

--
-- Name: COLUMN promotions.current_gmv; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.current_gmv IS '当前GMV';

--
-- Name: COLUMN promotions.status; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN public.promotions.status IS '状态: preparing/active/ended';

--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;

--
-- Name: role_modules; Type: TABLE; Schema: public
--

CREATE TABLE public.role_modules (
    role_code character varying(50) NOT NULL,
    module_code character varying(50) NOT NULL
);

--
-- Name: role_permissions; Type: TABLE; Schema: public
--

CREATE TABLE public.role_permissions (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);

--
-- Name: roles; Type: TABLE; Schema: public
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;

--
-- Name: room_health; Type: TABLE; Schema: public
--

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

--
-- Name: room_health_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.room_health_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: room_health_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.room_health_id_seq OWNED BY public.room_health.id;

--
-- Name: script_library; Type: TABLE; Schema: public
--

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

--
-- Name: script_library_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.script_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: script_library_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.script_library_id_seq OWNED BY public.script_library.id;

--
-- Name: session_anchor_metrics; Type: TABLE; Schema: public
--

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

--
-- Name: session_anchor_metrics_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_anchor_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_anchor_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_anchor_metrics_id_seq OWNED BY public.session_anchor_metrics.id;

--
-- Name: session_channel_metrics; Type: TABLE; Schema: public
--

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
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: session_channel_metrics_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_channel_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_channel_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_channel_metrics_id_seq OWNED BY public.session_channel_metrics.id;

--
-- Name: session_live_basic_info; Type: TABLE; Schema: public
--

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

--
-- Name: session_live_basic_info_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_live_basic_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_live_basic_info_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_live_basic_info_id_seq OWNED BY public.session_live_basic_info.id;

--
-- Name: session_overview_metrics; Type: TABLE; Schema: public
--

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

--
-- Name: session_overview_metrics_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_overview_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_overview_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_overview_metrics_id_seq OWNED BY public.session_overview_metrics.id;

--
-- Name: session_plan_products; Type: TABLE; Schema: public
--

CREATE TABLE public.session_plan_products (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    group_letter character(1) NOT NULL,
    product_code character varying(100) DEFAULT ''::character varying NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: session_plan_products_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_plan_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_plan_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_plan_products_id_seq OWNED BY public.session_plan_products.id;

--
-- Name: session_plans; Type: TABLE; Schema: public
--

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

--
-- Name: session_plans_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_plans_id_seq OWNED BY public.session_plans.id;

--
-- Name: session_product_details; Type: TABLE; Schema: public
--

CREATE TABLE public.session_product_details (
    id integer NOT NULL,
    session_id integer,
    room_id integer,
    business_date date NOT NULL,
    product_order integer DEFAULT 0,
    product_name character varying(500) NOT NULL,
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: session_product_details_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_product_details_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_product_details_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_product_details_id_seq OWNED BY public.session_product_details.id;

--
-- Name: session_product_skus; Type: TABLE; Schema: public
--

CREATE TABLE public.session_product_skus (
    id integer NOT NULL,
    product_id integer,
    sku_name character varying(500) NOT NULL,
    sku_image character varying(500) DEFAULT ''::character varying,
    payment_amount numeric(14,2) DEFAULT 0,
    sold_count integer DEFAULT 0,
    buyer_count integer DEFAULT 0,
    order_count integer DEFAULT 0,
    upload_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: session_product_skus_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_product_skus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_product_skus_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_product_skus_id_seq OWNED BY public.session_product_skus.id;

--
-- Name: session_products; Type: TABLE; Schema: public
--

CREATE TABLE public.session_products (
    id integer NOT NULL,
    session_id integer NOT NULL,
    name character varying(200) NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    display_order smallint DEFAULT 0 NOT NULL,
    estimated_min smallint DEFAULT 0 NOT NULL,
    actual_min smallint DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_products_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('live'::character varying)::text, ('done'::character varying)::text, ('skipped'::character varying)::text])))
);

--
-- Name: session_products_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_products_id_seq OWNED BY public.session_products.id;

--
-- Name: session_short_video_traffic; Type: TABLE; Schema: public
--

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

--
-- Name: session_short_video_traffic_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.session_short_video_traffic_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: session_short_video_traffic_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.session_short_video_traffic_id_seq OWNED BY public.session_short_video_traffic.id;

--
-- Name: system_config; Type: TABLE; Schema: public
--

CREATE TABLE public.system_config (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text DEFAULT ''::text NOT NULL,
    config_type character varying(50) DEFAULT 'string'::character varying NOT NULL,
    description text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: system_config_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.system_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: system_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.system_config_id_seq OWNED BY public.system_config.id;

--
-- Name: system_jobs; Type: TABLE; Schema: public
--

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

--
-- Name: system_jobs_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.system_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: system_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.system_jobs_id_seq OWNED BY public.system_jobs.id;

--
-- Name: system_modules; Type: TABLE; Schema: public
--

CREATE TABLE public.system_modules (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(50) DEFAULT ''::character varying,
    sort_order smallint DEFAULT 0,
    visible_to text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: target_templates; Type: TABLE; Schema: public
--

CREATE TABLE public.target_templates (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metrics jsonb DEFAULT '[]'::jsonb CONSTRAINT target_templates_metrics_new_not_null NOT NULL,
    period character varying(20) DEFAULT 'monthly'::character varying NOT NULL
);

--
-- Name: target_templates_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.target_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: target_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.target_templates_id_seq OWNED BY public.target_templates.id;

--
-- Name: user_sessions; Type: TABLE; Schema: public
--

CREATE TABLE public.user_sessions (
    id character varying(128) NOT NULL,
    user_id integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: users; Type: TABLE; Schema: public
--

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
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('super_admin'::character varying)::text, ('admin'::character varying)::text, ('manager'::character varying)::text, ('employee'::character varying)::text, ('ops_director'::character varying)::text, ('ops_staff'::character varying)::text, ('controller'::character varying)::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY[0, 1])))
);

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: ad_channel_metrics id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ad_channel_metrics ALTER COLUMN id SET DEFAULT nextval('public.ad_channel_metrics_id_seq'::regclass);

--
-- Name: ad_plans id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ad_plans ALTER COLUMN id SET DEFAULT nextval('public.ad_plans_id_seq'::regclass);

--
-- Name: ai_action_approvals id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ai_action_approvals ALTER COLUMN id SET DEFAULT nextval('public.ai_action_approvals_id_seq'::regclass);

--
-- Name: ai_config id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ai_config ALTER COLUMN id SET DEFAULT nextval('public.ai_config_id_seq'::regclass);

--
-- Name: ai_context_bindings id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ai_context_bindings ALTER COLUMN id SET DEFAULT nextval('public.ai_context_bindings_id_seq'::regclass);

--
-- Name: ai_conversations id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ai_conversations ALTER COLUMN id SET DEFAULT nextval('public.ai_conversations_id_seq'::regclass);

--
-- Name: ai_messages id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ai_messages ALTER COLUMN id SET DEFAULT nextval('public.ai_messages_id_seq'::regclass);

--
-- Name: ai_tool_logs id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.ai_tool_logs ALTER COLUMN id SET DEFAULT nextval('public.ai_tool_logs_id_seq'::regclass);

--
-- Name: alert_events id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.alert_events ALTER COLUMN id SET DEFAULT nextval('public.alert_events_id_seq'::regclass);

--
-- Name: alert_rules id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.alert_rules ALTER COLUMN id SET DEFAULT nextval('public.alert_rules_id_seq'::regclass);

--
-- Name: anchor_capabilities id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.anchor_capabilities ALTER COLUMN id SET DEFAULT nextval('public.anchor_capabilities_id_seq'::regclass);

--
-- Name: anchor_rankings id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.anchor_rankings ALTER COLUMN id SET DEFAULT nextval('public.anchor_rankings_id_seq'::regclass);

--
-- Name: anchor_script_templates id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.anchor_script_templates ALTER COLUMN id SET DEFAULT nextval('public.anchor_script_templates_id_seq'::regclass);

--
-- Name: anchor_training_plans id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.anchor_training_plans ALTER COLUMN id SET DEFAULT nextval('public.anchor_training_plans_id_seq'::regclass);

--
-- Name: anchor_training_records id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.anchor_training_records ALTER COLUMN id SET DEFAULT nextval('public.anchor_training_records_id_seq'::regclass);

--
-- Name: anchors id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.anchors ALTER COLUMN id SET DEFAULT nextval('public.anchors_id_seq'::regclass);

--
-- Name: audit_logs id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

--
-- Name: competitor_brands id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.competitor_brands ALTER COLUMN id SET DEFAULT nextval('public.competitor_brands_id_seq'::regclass);

--
-- Name: competitor_price_data id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.competitor_price_data ALTER COLUMN id SET DEFAULT nextval('public.competitor_price_data_id_seq'::regclass);

--
-- Name: data_exports id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.data_exports ALTER COLUMN id SET DEFAULT nextval('public.data_exports_id_seq'::regclass);

--
-- Name: data_uploads id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.data_uploads ALTER COLUMN id SET DEFAULT nextval('public.data_uploads_id_seq'::regclass);

--
-- Name: dict_items id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.dict_items ALTER COLUMN id SET DEFAULT nextval('public.dict_items_id_seq'::regclass);

--
-- Name: douyin_anchor_daily_metrics id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.douyin_anchor_daily_metrics ALTER COLUMN id SET DEFAULT nextval('public.douyin_anchor_daily_metrics_id_seq'::regclass);

--
-- Name: douyin_channel_daily_metrics id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.douyin_channel_daily_metrics ALTER COLUMN id SET DEFAULT nextval('public.douyin_channel_daily_metrics_id_seq'::regclass);

--
-- Name: goal_tracking id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.goal_tracking ALTER COLUMN id SET DEFAULT nextval('public.goal_tracking_id_seq'::regclass);

--
-- Name: improvement_tasks id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.improvement_tasks ALTER COLUMN id SET DEFAULT nextval('public.improvement_tasks_id_seq'::regclass);

--
-- Name: issue_library id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.issue_library ALTER COLUMN id SET DEFAULT nextval('public.issue_library_id_seq'::regclass);

--
-- Name: live_rooms id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.live_rooms ALTER COLUMN id SET DEFAULT nextval('public.live_rooms_id_seq'::regclass);

--
-- Name: live_sessions id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.live_sessions ALTER COLUMN id SET DEFAULT nextval('public.live_sessions_id_seq'::regclass);

--
-- Name: multi_room_status id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.multi_room_status ALTER COLUMN id SET DEFAULT nextval('public.multi_room_status_id_seq'::regclass);

--
-- Name: operators id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.operators ALTER COLUMN id SET DEFAULT nextval('public.operators_id_seq'::regclass);

--
-- Name: overview_activities id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.overview_activities ALTER COLUMN id SET DEFAULT nextval('public.overview_activities_id_seq'::regclass);

--
-- Name: overview_daily_stats id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.overview_daily_stats ALTER COLUMN id SET DEFAULT nextval('public.overview_daily_stats_id_seq'::regclass);

--
-- Name: permissions id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);

--
-- Name: product_template_items id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.product_template_items ALTER COLUMN id SET DEFAULT nextval('public.product_template_items_id_seq'::regclass);

--
-- Name: product_templates id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.product_templates ALTER COLUMN id SET DEFAULT nextval('public.product_templates_id_seq'::regclass);

--
-- Name: promotions id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);

--
-- Name: roles id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);

--
-- Name: room_health id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.room_health ALTER COLUMN id SET DEFAULT nextval('public.room_health_id_seq'::regclass);

--
-- Name: script_library id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.script_library ALTER COLUMN id SET DEFAULT nextval('public.script_library_id_seq'::regclass);

--
-- Name: session_anchor_metrics id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_anchor_metrics ALTER COLUMN id SET DEFAULT nextval('public.session_anchor_metrics_id_seq'::regclass);

--
-- Name: session_channel_metrics id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_channel_metrics ALTER COLUMN id SET DEFAULT nextval('public.session_channel_metrics_id_seq'::regclass);

--
-- Name: session_live_basic_info id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_live_basic_info ALTER COLUMN id SET DEFAULT nextval('public.session_live_basic_info_id_seq'::regclass);

--
-- Name: session_overview_metrics id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_overview_metrics ALTER COLUMN id SET DEFAULT nextval('public.session_overview_metrics_id_seq'::regclass);

--
-- Name: session_plan_products id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_plan_products ALTER COLUMN id SET DEFAULT nextval('public.session_plan_products_id_seq'::regclass);

--
-- Name: session_plans id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_plans ALTER COLUMN id SET DEFAULT nextval('public.session_plans_id_seq'::regclass);

--
-- Name: session_product_details id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_product_details ALTER COLUMN id SET DEFAULT nextval('public.session_product_details_id_seq'::regclass);

--
-- Name: session_product_skus id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_product_skus ALTER COLUMN id SET DEFAULT nextval('public.session_product_skus_id_seq'::regclass);

--
-- Name: session_products id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_products ALTER COLUMN id SET DEFAULT nextval('public.session_products_id_seq'::regclass);

--
-- Name: session_short_video_traffic id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.session_short_video_traffic ALTER COLUMN id SET DEFAULT nextval('public.session_short_video_traffic_id_seq'::regclass);

--
-- Name: system_config id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.system_config ALTER COLUMN id SET DEFAULT nextval('public.system_config_id_seq'::regclass);

--
-- Name: system_jobs id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.system_jobs ALTER COLUMN id SET DEFAULT nextval('public.system_jobs_id_seq'::regclass);

--
-- Name: target_templates id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.target_templates ALTER COLUMN id SET DEFAULT nextval('public.target_templates_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Name: ad_channel_metrics ad_channel_metrics_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ad_channel_metrics
    ADD CONSTRAINT ad_channel_metrics_pkey PRIMARY KEY (id);

--
-- Name: ad_plans ad_plans_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ad_plans
    ADD CONSTRAINT ad_plans_pkey PRIMARY KEY (id);

--
-- Name: ai_action_approvals ai_action_approvals_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_pkey PRIMARY KEY (id);

--
-- Name: ai_config ai_config_config_key_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_config
    ADD CONSTRAINT ai_config_config_key_key UNIQUE (config_key);

--
-- Name: ai_config ai_config_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_config
    ADD CONSTRAINT ai_config_pkey PRIMARY KEY (id);

--
-- Name: ai_context_bindings ai_context_bindings_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_context_bindings
    ADD CONSTRAINT ai_context_bindings_pkey PRIMARY KEY (id);

--
-- Name: ai_context_bindings ai_context_bindings_user_id_scope_type_scope_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_context_bindings
    ADD CONSTRAINT ai_context_bindings_user_id_scope_type_scope_id_key UNIQUE (user_id, scope_type, scope_id);

--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);

--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);

--
-- Name: ai_tool_logs ai_tool_logs_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_pkey PRIMARY KEY (id);

--
-- Name: alert_events alert_events_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.alert_events
    ADD CONSTRAINT alert_events_pkey PRIMARY KEY (id);

--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);

--
-- Name: anchor_capabilities anchor_capabilities_anchor_id_evaluated_at_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_anchor_id_evaluated_at_key UNIQUE (anchor_id, evaluated_at);

--
-- Name: anchor_capabilities anchor_capabilities_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_pkey PRIMARY KEY (id);

--
-- Name: anchor_profiles anchor_profiles_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_profiles
    ADD CONSTRAINT anchor_profiles_pkey PRIMARY KEY (id);

--
-- Name: anchor_rankings anchor_rankings_anchor_id_rank_date_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_rankings
    ADD CONSTRAINT anchor_rankings_anchor_id_rank_date_key UNIQUE (anchor_id, rank_date);

--
-- Name: anchor_rankings anchor_rankings_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_rankings
    ADD CONSTRAINT anchor_rankings_pkey PRIMARY KEY (id);

--
-- Name: anchor_script_templates anchor_script_templates_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_script_templates
    ADD CONSTRAINT anchor_script_templates_pkey PRIMARY KEY (id);

--
-- Name: anchor_training_plans anchor_training_plans_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_training_plans
    ADD CONSTRAINT anchor_training_plans_pkey PRIMARY KEY (id);

--
-- Name: anchor_training_records anchor_training_records_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_training_records
    ADD CONSTRAINT anchor_training_records_pkey PRIMARY KEY (id);

--
-- Name: anchors anchors_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchors
    ADD CONSTRAINT anchors_pkey PRIMARY KEY (id);

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

--
-- Name: competitor_brands competitor_brands_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.competitor_brands
    ADD CONSTRAINT competitor_brands_pkey PRIMARY KEY (id);

--
-- Name: competitor_price_data competitor_price_data_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.competitor_price_data
    ADD CONSTRAINT competitor_price_data_pkey PRIMARY KEY (id);

--
-- Name: data_exports data_exports_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.data_exports
    ADD CONSTRAINT data_exports_pkey PRIMARY KEY (id);

--
-- Name: data_uploads data_uploads_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.data_uploads
    ADD CONSTRAINT data_uploads_pkey PRIMARY KEY (id);

--
-- Name: dict_items dict_items_code_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.dict_items
    ADD CONSTRAINT dict_items_code_key UNIQUE (code);

--
-- Name: dict_items dict_items_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.dict_items
    ADD CONSTRAINT dict_items_pkey PRIMARY KEY (id);

--
-- Name: douyin_anchor_daily_metrics douyin_anchor_daily_metrics_business_date_account_name_anch_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_business_date_account_name_anch_key UNIQUE (business_date, account_name, anchor_name);

--
-- Name: douyin_anchor_daily_metrics douyin_anchor_daily_metrics_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_pkey PRIMARY KEY (id);

--
-- Name: douyin_channel_daily_metrics douyin_channel_daily_metrics_business_date_channel_name_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_channel_daily_metrics
    ADD CONSTRAINT douyin_channel_daily_metrics_business_date_channel_name_key UNIQUE (business_date, channel_name);

--
-- Name: douyin_channel_daily_metrics douyin_channel_daily_metrics_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_channel_daily_metrics
    ADD CONSTRAINT douyin_channel_daily_metrics_pkey PRIMARY KEY (id);

--
-- Name: goal_tracking goal_tracking_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.goal_tracking
    ADD CONSTRAINT goal_tracking_pkey PRIMARY KEY (id);

--
-- Name: improvement_tasks improvement_tasks_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.improvement_tasks
    ADD CONSTRAINT improvement_tasks_pkey PRIMARY KEY (id);

--
-- Name: issue_library issue_library_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.issue_library
    ADD CONSTRAINT issue_library_pkey PRIMARY KEY (id);

--
-- Name: live_rooms live_rooms_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.live_rooms
    ADD CONSTRAINT live_rooms_pkey PRIMARY KEY (id);

--
-- Name: live_sessions live_sessions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_pkey PRIMARY KEY (id);

--
-- Name: multi_room_status multi_room_status_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.multi_room_status
    ADD CONSTRAINT multi_room_status_pkey PRIMARY KEY (id);

--
-- Name: operators operators_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.operators
    ADD CONSTRAINT operators_pkey PRIMARY KEY (id);

--
-- Name: overview_activities overview_activities_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.overview_activities
    ADD CONSTRAINT overview_activities_pkey PRIMARY KEY (id);

--
-- Name: overview_daily_stats overview_daily_stats_date_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.overview_daily_stats
    ADD CONSTRAINT overview_daily_stats_date_key UNIQUE (date);

--
-- Name: overview_daily_stats overview_daily_stats_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.overview_daily_stats
    ADD CONSTRAINT overview_daily_stats_pkey PRIMARY KEY (id);

--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);

--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);

--
-- Name: product_template_items product_template_items_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.product_template_items
    ADD CONSTRAINT product_template_items_pkey PRIMARY KEY (id);

--
-- Name: product_templates product_templates_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.product_templates
    ADD CONSTRAINT product_templates_pkey PRIMARY KEY (id);

--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);

--
-- Name: role_modules role_modules_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.role_modules
    ADD CONSTRAINT role_modules_pkey PRIMARY KEY (role_code, module_code);

--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);

--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);

--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

--
-- Name: room_health room_health_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_pkey PRIMARY KEY (id);

--
-- Name: room_health room_health_room_id_evaluated_at_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_room_id_evaluated_at_key UNIQUE (room_id, evaluated_at);

--
-- Name: script_library script_library_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.script_library
    ADD CONSTRAINT script_library_pkey PRIMARY KEY (id);

--
-- Name: session_anchor_metrics session_anchor_metrics_date_anchor_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_date_anchor_id_key UNIQUE (date, anchor_id);

--
-- Name: session_anchor_metrics session_anchor_metrics_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_pkey PRIMARY KEY (id);

--
-- Name: session_channel_metrics session_channel_metrics_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_channel_metrics
    ADD CONSTRAINT session_channel_metrics_pkey PRIMARY KEY (id);

--
-- Name: session_live_basic_info session_live_basic_info_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_pkey PRIMARY KEY (id);

--
-- Name: session_live_basic_info session_live_basic_info_room_id_business_date_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_room_id_business_date_key UNIQUE (room_id, business_date);

--
-- Name: session_overview_metrics session_overview_metrics_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_pkey PRIMARY KEY (id);

--
-- Name: session_overview_metrics session_overview_metrics_room_id_business_date_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_room_id_business_date_key UNIQUE (room_id, business_date);

--
-- Name: session_plan_products session_plan_products_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_pkey PRIMARY KEY (id);

--
-- Name: session_plans session_plans_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_pkey PRIMARY KEY (id);

--
-- Name: session_product_details session_product_details_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_details
    ADD CONSTRAINT session_product_details_pkey PRIMARY KEY (id);

--
-- Name: session_product_details session_product_details_room_id_business_date_product_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_details
    ADD CONSTRAINT session_product_details_room_id_business_date_product_id_key UNIQUE (room_id, business_date, product_id);

--
-- Name: session_product_skus session_product_skus_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_skus
    ADD CONSTRAINT session_product_skus_pkey PRIMARY KEY (id);

--
-- Name: session_product_skus session_product_skus_product_id_sku_name_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_skus
    ADD CONSTRAINT session_product_skus_product_id_sku_name_key UNIQUE (product_id, sku_name);

--
-- Name: session_products session_products_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_products
    ADD CONSTRAINT session_products_pkey PRIMARY KEY (id);

--
-- Name: session_short_video_traffic session_short_video_traffic_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_pkey PRIMARY KEY (id);

--
-- Name: session_short_video_traffic session_short_video_traffic_room_id_business_date_video_nam_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_room_id_business_date_video_nam_key UNIQUE (room_id, business_date, video_name);

--
-- Name: system_config system_config_config_key_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_config_key_key UNIQUE (config_key);

--
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);

--
-- Name: system_jobs system_jobs_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.system_jobs
    ADD CONSTRAINT system_jobs_pkey PRIMARY KEY (id);

--
-- Name: system_modules system_modules_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_pkey PRIMARY KEY (code);

--
-- Name: target_templates target_templates_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.target_templates
    ADD CONSTRAINT target_templates_pkey PRIMARY KEY (id);

--
-- Name: session_channel_metrics uq_session_channel_period_channel; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_channel_metrics
    ADD CONSTRAINT uq_session_channel_period_channel UNIQUE (period_date, channel);

--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

--
-- Name: idx_ai_action_approvals_requested_by; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_action_approvals_requested_by ON public.ai_action_approvals USING btree (requested_by);

--
-- Name: idx_ai_action_approvals_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_action_approvals_status ON public.ai_action_approvals USING btree (status);

--
-- Name: idx_ai_action_approvals_tool_log; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_action_approvals_tool_log ON public.ai_action_approvals USING btree (tool_log_id);

--
-- Name: idx_ai_context_bindings_scope; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_context_bindings_scope ON public.ai_context_bindings USING btree (scope_type, scope_id);

--
-- Name: idx_ai_context_bindings_user; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_context_bindings_user ON public.ai_context_bindings USING btree (user_id);

--
-- Name: idx_ai_conversations_deerflow_thread; Type: INDEX; Schema: public
--

CREATE UNIQUE INDEX idx_ai_conversations_deerflow_thread ON public.ai_conversations USING btree (deerflow_thread_id) WHERE (deerflow_thread_id IS NOT NULL);

--
-- Name: idx_ai_conversations_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_conversations_status ON public.ai_conversations USING btree (status);

--
-- Name: idx_ai_conversations_user; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations USING btree (user_id);

--
-- Name: idx_ai_messages_conv; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_messages_conv ON public.ai_messages USING btree (conversation_id);

--
-- Name: idx_ai_messages_user; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_messages_user ON public.ai_messages USING btree (user_id);

--
-- Name: idx_ai_tool_logs_actor; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_tool_logs_actor ON public.ai_tool_logs USING btree (actor_user_id);

--
-- Name: idx_ai_tool_logs_conv; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_tool_logs_conv ON public.ai_tool_logs USING btree (conversation_id);

--
-- Name: idx_ai_tool_logs_created; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_tool_logs_created ON public.ai_tool_logs USING btree (created_at DESC);

--
-- Name: idx_ai_tool_logs_tool; Type: INDEX; Schema: public
--

CREATE INDEX idx_ai_tool_logs_tool ON public.ai_tool_logs USING btree (tool_name);

--
-- Name: idx_alert_events_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_alert_events_status ON public.alert_events USING btree (status);

--
-- Name: idx_alert_events_time; Type: INDEX; Schema: public
--

CREATE INDEX idx_alert_events_time ON public.alert_events USING btree (event_time DESC);

--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);

--
-- Name: idx_audit_logs_actor; Type: INDEX; Schema: public
--

CREATE INDEX idx_audit_logs_actor ON public.audit_logs USING btree (actor_user_id);

--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at);

--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);

--
-- Name: idx_basic_info_room_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_basic_info_room_date ON public.session_live_basic_info USING btree (room_id, business_date DESC);

--
-- Name: idx_douyin_anchor_daily_anchor; Type: INDEX; Schema: public
--

CREATE INDEX idx_douyin_anchor_daily_anchor ON public.douyin_anchor_daily_metrics USING btree (anchor_name, business_date DESC);

--
-- Name: idx_douyin_anchor_daily_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_douyin_anchor_daily_date ON public.douyin_anchor_daily_metrics USING btree (business_date DESC);

--
-- Name: idx_douyin_channel_daily_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_douyin_channel_daily_date ON public.douyin_channel_daily_metrics USING btree (business_date DESC);

--
-- Name: idx_goal_tracking_source; Type: INDEX; Schema: public
--

CREATE INDEX idx_goal_tracking_source ON public.goal_tracking USING btree (source_template_id);

--
-- Name: idx_live_sessions_anchor; Type: INDEX; Schema: public
--

CREATE INDEX idx_live_sessions_anchor ON public.live_sessions USING btree (anchor_id);

--
-- Name: idx_live_sessions_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_live_sessions_date ON public.live_sessions USING btree (date);

--
-- Name: idx_live_sessions_operator; Type: INDEX; Schema: public
--

CREATE INDEX idx_live_sessions_operator ON public.live_sessions USING btree (operator_id);

--
-- Name: idx_live_sessions_room; Type: INDEX; Schema: public
--

CREATE INDEX idx_live_sessions_room ON public.live_sessions USING btree (room_id);

--
-- Name: idx_live_sessions_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_live_sessions_status ON public.live_sessions USING btree (status);

--
-- Name: idx_multi_room_status_room; Type: INDEX; Schema: public
--

CREATE INDEX idx_multi_room_status_room ON public.multi_room_status USING btree (room_id);

--
-- Name: idx_overview_activities_created; Type: INDEX; Schema: public
--

CREATE INDEX idx_overview_activities_created ON public.overview_activities USING btree (created_at DESC);

--
-- Name: idx_overview_room_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_overview_room_date ON public.session_overview_metrics USING btree (room_id, business_date DESC);

--
-- Name: idx_permissions_module; Type: INDEX; Schema: public
--

CREATE INDEX idx_permissions_module ON public.permissions USING btree (module);

--
-- Name: idx_product_room_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_product_room_date ON public.session_product_details USING btree (room_id, business_date DESC);

--
-- Name: idx_pt_items_template; Type: INDEX; Schema: public
--

CREATE INDEX idx_pt_items_template ON public.product_template_items USING btree (template_id);

--
-- Name: idx_session_anchor_metrics_anchor; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_anchor_metrics_anchor ON public.session_anchor_metrics USING btree (anchor_id);

--
-- Name: idx_session_anchor_metrics_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_anchor_metrics_date ON public.session_anchor_metrics USING btree (date);

--
-- Name: idx_session_channel_channel; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_channel_channel ON public.session_channel_metrics USING btree (channel);

--
-- Name: idx_session_channel_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_channel_date ON public.session_channel_metrics USING btree (period_date);

--
-- Name: idx_session_channel_session; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_channel_session ON public.session_channel_metrics USING btree (session_id);

--
-- Name: idx_session_plan_products_plan; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_plan_products_plan ON public.session_plan_products USING btree (plan_id);

--
-- Name: idx_session_plans_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_plans_date ON public.session_plans USING btree (plan_date);

--
-- Name: idx_session_plans_room; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_plans_room ON public.session_plans USING btree (room_id);

--
-- Name: idx_session_products_session; Type: INDEX; Schema: public
--

CREATE INDEX idx_session_products_session ON public.session_products USING btree (session_id);

--
-- Name: idx_sku_product; Type: INDEX; Schema: public
--

CREATE INDEX idx_sku_product ON public.session_product_skus USING btree (product_id);

--
-- Name: idx_system_jobs_run_at; Type: INDEX; Schema: public
--

CREATE INDEX idx_system_jobs_run_at ON public.system_jobs USING btree (run_at);

--
-- Name: idx_system_jobs_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_system_jobs_status ON public.system_jobs USING btree (status);

--
-- Name: idx_system_jobs_type; Type: INDEX; Schema: public
--

CREATE INDEX idx_system_jobs_type ON public.system_jobs USING btree (job_type);

--
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);

--
-- Name: idx_user_sessions_user; Type: INDEX; Schema: public
--

CREATE INDEX idx_user_sessions_user ON public.user_sessions USING btree (user_id);

--
-- Name: idx_users_role; Type: INDEX; Schema: public
--

CREATE INDEX idx_users_role ON public.users USING btree (role);

--
-- Name: idx_users_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_users_status ON public.users USING btree (status);

--
-- Name: idx_users_username; Type: INDEX; Schema: public
--

CREATE INDEX idx_users_username ON public.users USING btree (username);

--
-- Name: idx_video_room_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_video_room_date ON public.session_short_video_traffic USING btree (room_id, business_date DESC);

--
-- Name: ai_action_approvals ai_action_approvals_approved_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: ai_action_approvals ai_action_approvals_requested_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: ai_action_approvals ai_action_approvals_tool_log_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_action_approvals
    ADD CONSTRAINT ai_action_approvals_tool_log_id_fkey FOREIGN KEY (tool_log_id) REFERENCES public.ai_tool_logs(id) ON DELETE CASCADE;

--
-- Name: ai_context_bindings ai_context_bindings_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_context_bindings
    ADD CONSTRAINT ai_context_bindings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;

--
-- Name: ai_messages ai_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: ai_tool_logs ai_tool_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: ai_tool_logs ai_tool_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.ai_tool_logs
    ADD CONSTRAINT ai_tool_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;

--
-- Name: anchor_capabilities anchor_capabilities_anchor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_capabilities
    ADD CONSTRAINT anchor_capabilities_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE CASCADE;

--
-- Name: anchor_profiles anchor_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_profiles
    ADD CONSTRAINT anchor_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.anchors(id) ON DELETE CASCADE;

--
-- Name: anchor_rankings anchor_rankings_anchor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_rankings
    ADD CONSTRAINT anchor_rankings_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE CASCADE;

--
-- Name: anchor_training_records anchor_training_records_plan_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.anchor_training_records
    ADD CONSTRAINT anchor_training_records_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.anchor_training_plans(id);

--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);

--
-- Name: competitor_price_data competitor_price_data_brand_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.competitor_price_data
    ADD CONSTRAINT competitor_price_data_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.competitor_brands(id) ON DELETE CASCADE;

--
-- Name: douyin_anchor_daily_metrics douyin_anchor_daily_metrics_anchor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id) ON DELETE SET NULL;

--
-- Name: douyin_anchor_daily_metrics douyin_anchor_daily_metrics_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_anchor_daily_metrics
    ADD CONSTRAINT douyin_anchor_daily_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: douyin_channel_daily_metrics douyin_channel_daily_metrics_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.douyin_channel_daily_metrics
    ADD CONSTRAINT douyin_channel_daily_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: live_sessions live_sessions_anchor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id);

--
-- Name: live_sessions live_sessions_operator_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.operators(id);

--
-- Name: live_sessions live_sessions_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id);

--
-- Name: multi_room_status multi_room_status_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.multi_room_status
    ADD CONSTRAINT multi_room_status_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

--
-- Name: product_template_items product_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.product_template_items
    ADD CONSTRAINT product_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.product_templates(id) ON DELETE CASCADE;

--
-- Name: role_modules role_modules_module_code_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.role_modules
    ADD CONSTRAINT role_modules_module_code_fkey FOREIGN KEY (module_code) REFERENCES public.system_modules(code) ON DELETE CASCADE;

--
-- Name: role_modules role_modules_role_code_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.role_modules
    ADD CONSTRAINT role_modules_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code) ON DELETE CASCADE;

--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;

--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;

--
-- Name: room_health room_health_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.room_health
    ADD CONSTRAINT room_health_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE CASCADE;

--
-- Name: session_anchor_metrics session_anchor_metrics_anchor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id);

--
-- Name: session_anchor_metrics session_anchor_metrics_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_anchor_metrics
    ADD CONSTRAINT session_anchor_metrics_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id);

--
-- Name: session_live_basic_info session_live_basic_info_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

--
-- Name: session_live_basic_info session_live_basic_info_session_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

--
-- Name: session_live_basic_info session_live_basic_info_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_live_basic_info
    ADD CONSTRAINT session_live_basic_info_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: session_overview_metrics session_overview_metrics_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

--
-- Name: session_overview_metrics session_overview_metrics_session_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

--
-- Name: session_overview_metrics session_overview_metrics_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_overview_metrics
    ADD CONSTRAINT session_overview_metrics_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: session_plan_products session_plan_products_plan_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_plan_products
    ADD CONSTRAINT session_plan_products_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.session_plans(id) ON DELETE CASCADE;

--
-- Name: session_plans session_plans_anchor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_anchor_id_fkey FOREIGN KEY (anchor_id) REFERENCES public.anchors(id);

--
-- Name: session_plans session_plans_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.promotions(id);

--
-- Name: session_plans session_plans_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_plans
    ADD CONSTRAINT session_plans_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id);

--
-- Name: session_product_details session_product_details_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_details
    ADD CONSTRAINT session_product_details_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

--
-- Name: session_product_details session_product_details_session_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_details
    ADD CONSTRAINT session_product_details_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

--
-- Name: session_product_details session_product_details_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_details
    ADD CONSTRAINT session_product_details_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: session_product_skus session_product_skus_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_skus
    ADD CONSTRAINT session_product_skus_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.session_product_details(id) ON DELETE CASCADE;

--
-- Name: session_product_skus session_product_skus_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_product_skus
    ADD CONSTRAINT session_product_skus_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: session_products session_products_session_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_products
    ADD CONSTRAINT session_products_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE CASCADE;

--
-- Name: session_short_video_traffic session_short_video_traffic_room_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.live_rooms(id) ON DELETE SET NULL;

--
-- Name: session_short_video_traffic session_short_video_traffic_session_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id) ON DELETE SET NULL;

--
-- Name: session_short_video_traffic session_short_video_traffic_upload_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.session_short_video_traffic
    ADD CONSTRAINT session_short_video_traffic_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.data_uploads(id) ON DELETE SET NULL;

--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--

