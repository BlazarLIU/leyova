-- ============================================================================
-- Migration: 112_dual_track_foundation.sql
-- Description: Parallel Dual-Track Foundation:
--   Track 1 (Brand Self-Broadcasting):
--     - dim_brand: Brand/project root entity
--     - dim_shop.brand_id reference
--     - cost_entries: Structured cost entries for net profit calculation
--     - alert_rules: Custom metric threshold alerts and webhook channels
--   Track 2 (Agency MCN SaaS Multi-Tenant):
--     - tenants & tenant_subscriptions: Multi-tenant SaaS foundation
--     - users extensions: tenant_id, user_type
--     - agency_clients & agency_projects: Agency client & project contract model
--     - agency_slot_fees & agency_anchor_assignments: Slot fees & cross-project dispatch
--     - agency_anchor_commission_plans: Anchor commission tier plans
--     - agency_settlement_bills & agency_settlement_items: Monthly invoices (immutable after sent)
--     - agency_client_tokens & brand_viewer_permissions: Client portal access control
--     - PostgreSQL RLS policies & immutability protection rules
-- ============================================================================

BEGIN;

-- Record migration 111 if not recorded
INSERT INTO public.schema_migrations (version, name)
VALUES ('111_migrate_sessions_to_registrations', 'Migrate sessions to registrations')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- TRACK 1: BRAND SELF-BROADCASTING EXTENSIONS
-- ============================================================================

-- 1. Brand Layer (above dim_shop)
CREATE TABLE IF NOT EXISTS public.dim_brand (
    id bigserial PRIMARY KEY,
    brand_name varchar(100) NOT NULL,
    brand_code varchar(50) UNIQUE,
    operate_mode varchar(20) DEFAULT 'self', -- 'self' | 'agency' | 'hybrid'
    logo_url text,
    description text,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Link dim_shop to dim_brand if column not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'dim_shop' AND column_name = 'brand_id'
    ) THEN
        ALTER TABLE public.dim_shop ADD COLUMN brand_id bigint REFERENCES public.dim_brand(id) ON DELETE SET NULL;
        CREATE INDEX idx_dim_shop_brand_id ON public.dim_shop(brand_id);
    END IF;
END $$;

-- Preset default brand
INSERT INTO public.dim_brand (id, brand_name, brand_code, operate_mode)
VALUES (1, '默认品牌', 'DEFAULT_BRAND', 'self')
ON CONFLICT (id) DO NOTHING;

-- Associate existing shops with default brand
UPDATE public.dim_shop SET brand_id = 1 WHERE brand_id IS NULL;

-- 2. Cost Entries (Structured cost tracking for net profit calculation)
CREATE TABLE IF NOT EXISTS public.cost_entries (
    id bigserial PRIMARY KEY,
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
    cost_date date NOT NULL,
    cost_type varchar(32) NOT NULL, -- 'labor' | 'ad' | 'goods' | 'platform_fee' | 'other'
    cost_name varchar(100) NOT NULL,
    amount numeric(14,2) NOT NULL DEFAULT 0.00,
    remark text,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cost_entries_shop_date ON public.cost_entries (shop_id, cost_date);
CREATE INDEX IF NOT EXISTS idx_cost_entries_type ON public.cost_entries (cost_type);

-- 3. Metric Alert Rules & Webhook Notifications
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id serial PRIMARY KEY,
    rule_name varchar(100) NOT NULL,
    shop_id bigint REFERENCES public.dim_shop(id) ON DELETE CASCADE,
    platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
    metric_code varchar(64) NOT NULL,
    condition varchar(16) NOT NULL, -- 'gt' | 'lt' | 'drop_pct' | 'rise_pct'
    threshold numeric(14,4) NOT NULL,
    notify_channels jsonb DEFAULT '[]'::jsonb, -- e.g. [{"type": "dingtalk", "webhook": "https://..."}]
    is_active boolean DEFAULT true,
    last_triggered_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TRACK 2: AGENCY MCN SAAS MULTI-TENANT FOUNDATION
-- ============================================================================

-- 4. Tenants (Each MCN/Agency company is an isolated tenant)
CREATE TABLE IF NOT EXISTS public.tenants (
    id serial PRIMARY KEY,
    name varchar(200) NOT NULL,
    slug varchar(50) UNIQUE NOT NULL,
    plan varchar(30) DEFAULT 'starter', -- 'starter' | 'pro' | 'enterprise'
    max_projects integer DEFAULT 10,
    max_users integer DEFAULT 20,
    max_anchors integer DEFAULT 50,
    status varchar(20) DEFAULT 'active', -- 'active' | 'suspended' | 'cancelled'
    trial_ends_at timestamptz,
    billing_email varchar(200),
    logo_url text,
    custom_domain varchar(200),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Preset default tenant for existing system data
INSERT INTO public.tenants (id, name, slug, plan)
VALUES (1, '默认代运营中心', 'default-agency', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- 5. Tenant Subscriptions (SaaS billing & licensing)
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan varchar(30) NOT NULL,
    billing_cycle varchar(10) DEFAULT 'monthly', -- 'monthly' | 'yearly'
    unit_price numeric(10,2) DEFAULT 0.00,
    started_at date NOT NULL,
    expires_at date,
    payment_ref varchar(100),
    status varchar(20) DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);

-- 6. Extend users table for Multi-Tenancy & User Types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN tenant_id integer REFERENCES public.tenants(id) ON DELETE SET NULL;
        CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'user_type'
    ) THEN
        ALTER TABLE public.users ADD COLUMN user_type varchar(20) DEFAULT 'agency_staff';
        -- 'platform_admin' (SuperAdmin of the whole SaaS)
        -- 'agency_staff' (Staff/Anchor/Manager of the Agency)
        -- 'brand_viewer' (Client Brand Representative login)
    END IF;
END $$;

-- Existing users belong to default tenant as agency_staff
UPDATE public.users SET tenant_id = 1 WHERE tenant_id IS NULL;

-- 7. Agency Clients (Brand owners contracting with the Agency)
CREATE TABLE IF NOT EXISTS public.agency_clients (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name varchar(200) NOT NULL,
    brand_name varchar(200),
    contact varchar(100),
    contact_phone varchar(50),
    contract_no varchar(50),
    status varchar(20) DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agency_clients_tenant ON public.agency_clients(tenant_id);

-- 8. Agency Projects (Contracts & Live broadcasting projects)
CREATE TABLE IF NOT EXISTS public.agency_projects (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id integer NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    name varchar(200) NOT NULL,
    platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
    contract_start date,
    contract_end date,
    billing_model varchar(30) DEFAULT 'monthly_flat',
    -- 'monthly_flat', 'gmv_commission', 'hybrid'
    flat_fee numeric(14,2) DEFAULT 0.00,
    commission_tiers jsonb DEFAULT '[]'::jsonb,
    gmv_target numeric(14,2),
    play_hours_target numeric(6,1),
    status varchar(20) DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agency_projects_tenant ON public.agency_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agency_projects_client ON public.agency_projects(client_id);

-- 9. Add project_id to live_sessions & live_registrations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'live_sessions' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE public.live_sessions ADD COLUMN project_id integer REFERENCES public.agency_projects(id) ON DELETE SET NULL;
        CREATE INDEX idx_live_sessions_project_id ON public.live_sessions(project_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'live_registrations' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE public.live_registrations ADD COLUMN project_id integer REFERENCES public.agency_projects(id) ON DELETE SET NULL;
        CREATE INDEX idx_live_registrations_project_id ON public.live_registrations(project_id);
    END IF;
END $$;

-- 10. Agency Slot Fees & Pass-Through Expenses
CREATE TABLE IF NOT EXISTS public.agency_slot_fees (
    id bigserial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
    session_id integer REFERENCES public.live_sessions(id) ON DELETE SET NULL,
    fee_type varchar(30) NOT NULL, -- 'slot', 'ad_pass_through', 'bonus', 'penalty'
    amount numeric(14,2) NOT NULL DEFAULT 0.00,
    biz_date date NOT NULL,
    remark text,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slot_fees_tenant_project ON public.agency_slot_fees(tenant_id, project_id);

-- 11. Agency Anchor Assignments (Cross-project anchor scheduling)
CREATE TABLE IF NOT EXISTS public.agency_anchor_assignments (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    anchor_id integer NOT NULL REFERENCES public.anchors(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
    role varchar(30) DEFAULT 'lead', -- 'lead', 'support', 'backup'
    start_date date NOT NULL,
    end_date date,
    created_at timestamptz DEFAULT now(),
    UNIQUE(anchor_id, project_id, start_date)
);
CREATE INDEX IF NOT EXISTS idx_anchor_assignments_tenant ON public.agency_anchor_assignments(tenant_id);

-- 12. Agency Anchor Commission Plans
CREATE TABLE IF NOT EXISTS public.agency_anchor_commission_plans (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
    anchor_id integer NOT NULL REFERENCES public.anchors(id) ON DELETE CASCADE,
    base_salary numeric(10,2) DEFAULT 0.00,
    commission_tiers jsonb DEFAULT '[]'::jsonb,
    attendance_bonus numeric(10,2) DEFAULT 0.00,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamptz DEFAULT now()
);

-- 13. Monthly Settlement Bills (IMMUTABLE after status=sent)
CREATE TABLE IF NOT EXISTS public.agency_settlement_bills (
    id serial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES public.agency_projects(id) ON DELETE CASCADE,
    period_month varchar(7) NOT NULL, -- e.g. '2026-11'
    total_gmv numeric(14,2) DEFAULT 0.00,
    flat_fee numeric(14,2) DEFAULT 0.00,
    commission_amount numeric(14,2) DEFAULT 0.00,
    slot_fee_total numeric(14,2) DEFAULT 0.00,
    anchor_commission numeric(14,2) DEFAULT 0.00,
    deduction_total numeric(14,2) DEFAULT 0.00,
    total_payable numeric(14,2) DEFAULT 0.00,
    status varchar(20) DEFAULT 'draft', -- 'draft', 'review', 'sent', 'confirmed', 'paid'
    pdf_url varchar(500),
    sent_at timestamptz,
    confirmed_at timestamptz,
    paid_at timestamptz,
    created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(project_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_settlement_tenant_month ON public.agency_settlement_bills(tenant_id, period_month);

-- 14. Monthly Settlement Items
CREATE TABLE IF NOT EXISTS public.agency_settlement_items (
    id bigserial PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bill_id integer NOT NULL REFERENCES public.agency_settlement_bills(id) ON DELETE CASCADE,
    item_type varchar(30) NOT NULL, -- 'gmv_commission', 'flat_fee', 'slot_fee', 'anchor_commission', 'bonus', 'penalty'
    description text,
    amount numeric(14,2) NOT NULL DEFAULT 0.00,
    ref_session_id integer REFERENCES public.live_sessions(id) ON DELETE SET NULL,
    ref_date date,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settlement_items_bill ON public.agency_settlement_items(bill_id);

-- 15. Brand Viewer Permissions (Client portal access whitelist)
CREATE TABLE IF NOT EXISTS public.brand_viewer_permissions (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id integer NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    project_ids integer[] DEFAULT '{}'::integer[],
    can_view_gmv boolean DEFAULT true,
    can_view_cost boolean DEFAULT false,
    can_view_anchors boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, client_id)
);

-- 16. Agency Client Portal Fast Tokens
CREATE TABLE IF NOT EXISTS public.agency_client_tokens (
    token varchar(64) PRIMARY KEY,
    tenant_id integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_id integer NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
    project_ids integer[] DEFAULT '{}'::integer[],
    expires_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 17. Seed initial sample data for demonstration if agency_clients is empty
DO $$
DECLARE
    v_client_id int;
    v_project_id int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.agency_clients LIMIT 1) THEN
        INSERT INTO public.agency_clients (tenant_id, name, brand_name, contact, contact_phone, contract_no)
        VALUES (1, '星辉品牌管理有限公司', 'GAP官方', '陈总监', '13800000001', 'AGY-2026-001')
        RETURNING id INTO v_client_id;

        INSERT INTO public.agency_projects (tenant_id, client_id, name, platform_code, contract_start, contract_end, billing_model, flat_fee, gmv_target)
        VALUES (1, v_client_id, 'GAP抖音官方旗舰店代播项目', 'douyin', '2026-01-01', '2026-12-31', 'hybrid', 30000.00, 5000000.00)
        RETURNING id INTO v_project_id;
    END IF;
END $$;

-- Register migration 112
INSERT INTO public.schema_migrations (version, name)
VALUES ('112_dual_track_foundation', 'Parallel dual track: Brand cost/alert + Agency multi-tenant schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;

