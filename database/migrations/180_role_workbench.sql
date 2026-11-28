-- ============================================================================
-- 180：角色工作台与四层权限（W2.5）
-- ----------------------------------------------------------------------------
-- 1. role_workbenches / workbench_widgets：配置驱动的工作台，不为每个角色写页面。
-- 2. permission_requests：未授权模块的申请与审批，审批通过写 user_module_overrides。
-- 3. AI 子模块拆分：ai_chat / ai_review / ai_content / ai_ads / ai_people /
--    ai_finance / ai_governance / ai_assortment；父模块 ai 授权自动覆盖子模块。
--
-- 四层权限：
--   L1 菜单隐藏（前端导航）
--   L2 路由守卫（RequireAccess）
--   L3 API 模块鉴权（module-guard）
--   L4 数据范围（data_scope）
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 工作台
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_workbenches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_key    text NOT NULL,
  variant     text NOT NULL DEFAULT 'default',
  name        text NOT NULL,
  description text,
  layout      jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role_key, variant)
);

CREATE TABLE IF NOT EXISTS public.workbench_widgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workbench_id uuid NOT NULL REFERENCES public.role_workbenches(id) ON DELETE CASCADE,
  widget_key  text NOT NULL,
  title       text NOT NULL,
  description text,
  module_code text,
  route       text,
  permission  text,
  widget_type text NOT NULL DEFAULT 'link'
                CHECK (widget_type IN ('link', 'metric', 'action', 'list', 'ai')),
  size        text NOT NULL DEFAULT 'md'
                CHECK (size IN ('sm', 'md', 'lg', 'full')),
  sort_order  integer NOT NULL DEFAULT 0,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workbench_id, widget_key)
);

-- ────────────────────────────────────────────────────────────
-- 2. 权限申请
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_code text NOT NULL,
  reason      text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_requests_user
  ON public.permission_requests(tenant_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_permission_requests_pending
  ON public.permission_requests(tenant_id, status, created_at DESC);

-- 同一用户同一模块只允许一个待审申请
CREATE UNIQUE INDEX IF NOT EXISTS uq_permission_requests_pending
  ON public.permission_requests(tenant_id, user_id, module_code)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- 3. AI 子模块
-- ────────────────────────────────────────────────────────────
INSERT INTO public.system_modules (code, name, icon, sort_order, is_enabled, is_core) VALUES
  ('ai_chat',       'AI 对话',   'message-square', 201, true, false),
  ('ai_review',     'AI 复盘',   'clipboard-list', 202, true, false),
  ('ai_content',    'AI 内容',   'pen-tool',       203, true, false),
  ('ai_ads',        'AI 投放',   'target',         204, true, false),
  ('ai_people',     'AI 人效',   'users',          205, true, false),
  ('ai_finance',    'AI 财务',   'wallet',         206, true, false),
  ('ai_governance', 'AI 治理',   'shield',         207, true, false),
  ('ai_assortment', 'AI 选品',   'package',        208, true, false)
ON CONFLICT (code) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. 工作台种子（按 roles 表实有 8 个角色 + brand_viewer 只读）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.role_workbenches (tenant_id, role_key, variant, name, description, is_default)
VALUES
  (1, 'super_admin',  'default', '负责人工作台', '目标缺口、净利、复盘与治理', true),
  (1, 'ops_director', 'default', '运营总监工作台', '多直播间作战、审批与异常', true),
  (1, 'ops_staff',    'default', '运营专员工作台', '今日场次、排品与复盘', true),
  (1, 'ad_buyer',     'default', '投放专员工作台', '投放、素材与预算', true),
  (1, 'video_editor', 'default', '拍剪工作台', '素材、剪辑任务与内容数据', true),
  (1, 'hrbp',         'default', 'HRBP 工作台', '主播人才、排班与绩效', true),
  (1, 'controller',   'default', '中控工作台', '现场控制、库存与实时数据', true),
  (1, 'cs_agent',     'default', '客服工作台', '售后、客服与履约', true),
  (1, 'brand_viewer', 'default', '品牌方工作台', '只读经营概览与复盘', true)
ON CONFLICT (tenant_id, role_key, variant) DO NOTHING;

INSERT INTO public.workbench_widgets
  (workbench_id, widget_key, title, module_code, route, widget_type, size, sort_order)
SELECT w.id, v.widget_key, v.title, v.module_code, v.route, v.widget_type, v.size, v.sort_order
FROM (VALUES
  -- super_admin（负责人）
  ('super_admin','gmv','今日 GMV 与目标缺口','overview','/overview/home','metric','md',10),
  ('super_admin','net_roi','净利与投放 ROI','net_roi','/ops/net-roi','metric','md',20),
  ('super_admin','review','经营复盘','review_overview','/review/overview','link','md',30),
  ('super_admin','permissions','权限申请审批','system_users','/workbench','action','md',40),
  ('super_admin','ai','AI 经营助手','ai','/ai-ops/cockpit','ai','lg',50),
  -- ops_director
  ('ops_director','battle','今日作战单','overview','/overview/home','action','lg',10),
  ('ops_director','multiroom','多直播间作战','system_multiroom','/system/multi-room','link','md',20),
  ('ops_director','alerts','异常告警','system_alerts','/system/alerts','list','md',30),
  ('ops_director','review','复盘总览','review_overview','/review/overview','link','md',40),
  ('ops_director','ai_review','AI 复盘归因','ai_review','/ai-ops/review/overview','ai','md',50),
  -- ops_staff
  ('ops_staff','sessions','今日场次','session','/overview/sessions','link','lg',10),
  ('ops_staff','assort','排品与货盘','session_products','/ops/session-products','link','md',20),
  ('ops_staff','review','场次复盘','review','/review/products','link','md',30),
  ('ops_staff','live_data','登记数据','live_data','/live/data','metric','md',40),
  -- ad_buyer（投放）
  ('ad_buyer','ad_console','投放控制台','net_roi','/ops/net-roi','link','lg',10),
  ('ad_buyer','materials','素材表现','content','/content/video-data','link','md',20),
  ('ad_buyer','search','搜索词卡位','search_seo','/ops/search-keywords','link','md',30),
  ('ad_buyer','ai_ads','AI 投放建议','ai_ads','/ai-ops/cockpit','ai','md',40),
  -- video_editor（拍剪/编导）
  ('video_editor','create','视频创作','content','/content/video-create','link','lg',10),
  ('video_editor','calendar','内容排产','content_schedule','/content/schedule','link','md',20),
  ('video_editor','metrics','内容数据','review_overview','/review/overview','metric','md',30),
  ('video_editor','ai_content','AI 编导助手','ai_content','/ai-ops/content/clips','ai','lg',40),
  -- hrbp
  ('hrbp','anchors','主播人才库','anchor','/anchors/list','link','lg',10),
  ('hrbp','schedule','排班与人效','system_personnel_ops','/hrbp/workspace','link','md',20),
  ('hrbp','performance','个人达成','personal_achievement','/live/attendance','metric','md',30),
  ('hrbp','ai_people','AI 人效助手','ai_people','/ai-ops/people/performance','ai','md',40),
  -- controller（中控）
  ('controller','live_console','现场控制台','session','/overview/sessions','action','lg',10),
  ('controller','inventory','商品与库存','product_center','/ops/inventory','link','md',20),
  ('controller','live_data','实时数据','live_data','/live/data','metric','md',30),
  ('controller','registration','直播登记','live_registration','/live/registration','link','md',40),
  -- cs_agent（客服）
  ('cs_agent','tickets','售后工单','after_sales','/ops/after-sales','link','lg',10),
  ('cs_agent','cs','客服响应','customer_service','/ops/cs','link','md',20),
  ('cs_agent','fulfillment','履约进度','fulfillment','/ops/fulfillment','metric','md',30),
  ('cs_agent','review','复盘总览','review_overview','/review/overview','link','md',40),
  -- brand_viewer（只读）
  ('brand_viewer','overview','经营概览','overview','/overview/home','metric','lg',10),
  ('brand_viewer','review','复盘报告','review_overview','/review/overview','link','md',20)
) AS v(role_key, widget_key, title, module_code, route, widget_type, size, sort_order)
JOIN public.role_workbenches w
  ON w.role_key = v.role_key AND w.variant = 'default' AND w.tenant_id = 1
ON CONFLICT (workbench_id, widget_key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. AI 子模块默认授权（精细授权角色，不授予父模块 ai）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.sys_role_permission (role_code, resource, action, effect, scope_type)
SELECT v.role_code, 'module:' || v.module_code, '*', 'allow', 'tenant'
FROM (VALUES
  ('ad_buyer',     'ai_chat'),
  ('ad_buyer',     'ai_review'),
  ('ad_buyer',     'ai_ads'),
  ('video_editor', 'ai_chat'),
  ('video_editor', 'ai_review'),
  ('video_editor', 'ai_content'),
  ('controller',   'ai_chat'),
  ('controller',   'product_center'),
  ('cs_agent',     'ai_chat'),
  ('cs_agent',     'ai_review')
) AS v(role_code, module_code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sys_role_permission p
   WHERE p.role_code = v.role_code
     AND p.resource = 'module:' || v.module_code
);

COMMIT;
