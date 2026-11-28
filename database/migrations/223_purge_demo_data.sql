-- 223_purge_demo_data.sql
-- 彻底清理存量库中的演示业务数据、演示/默认账号与预置大模型配置：
--   - 新装库在迁移完成时无任何预置账号、无预置大模型密钥/地址、无演示业务数据；
--   - 首次部署访问页面自动进入 /setup 由部署者自主创建超级管理员账号；
--   - 若存量库已由管理员自行修改密码或自建超管账号，则保留该自定义超管，不误删。

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. 清空全部演示业务表与 AI 运行态/模型配置表（按 FK 依赖由 CASCADE 处理）
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  demo_tables text[] := ARRAY[
    -- 账号 / 组织
    'user_work_modes', 'workbench_widgets',
    'staff_day_status', 'session_staff_assignments', 'live_registrations',
    -- 场次与主播
    'live_sessions', 'live_rooms', 'room_health', 'multi_room_status',
    'session_plans', 'session_plan_products', 'session_short_video_traffic',
    'session_anchor_metrics', 'session_channel_metrics', 'session_overview_metrics',
    'session_live_basic_info', 'session_metrics',
    'anchors', 'anchor_profiles', 'anchor_capabilities', 'anchor_script_templates',
    'operators',
    -- 商品 / 库存 / 履约
    'dim_product', 'dim_brand', 'dim_sku_mapping', 'dim_product_channel_listing',
    'fact_inventory_reservation', 'fact_inventory_stock', 'fact_inventory_ledger',
    'fact_fulfillment_waybill', 'fact_after_sale_tickets',
    -- 交易 / 订单 / 售后
    'fact_trade_daily', 'fact_traffic_daily', 'fact_ad_spend_daily',
    'canonical_orders', 'canonical_order_items', 'canonical_refund_events',
    'fact_order_event_stream', 'fact_order_rma_item', 'fact_selection_item',
    'fact_kol_cooperation', 'fact_search_keyword_daily', 'fact_content_daily',
    'fact_cs_session', 'fact_settlement_cycles', 'fact_jd_settlement_fees',
    'fact_gl_voucher', 'fact_gl_entry',
    -- 聚合
    'agg_shop_daily', 'agg_trade_day_platform_channel', 'agg_traffic_day_live',
    -- 内容 / 投放 / 活动
    'content_attribution_ledger', 'content_schedules', 'content_tasks', 'content_projects',
    'ad_plan', 'ad_plan_receipts', 'campaign_plan', 'promotion_rules', 'promotions',
    'pricing_rules', 'video_metrics',
    -- 合规 / 竞品 / 目标
    'compliance_events', 'compliance_activity_reminder',
    'compliance_rule_snapshot', 'compliance_rule_change', 'compliance_risk_assessment',
    'competitor_brands', 'competitor_price_data',
    'goal_tracking', 'issue_library', 'script_library', 'alert_events',
    -- HRBP / 代运营 / 品牌
    'hrbp_candidates', 'hrbp_auditions', 'biz_targets',
    'agency_projects', 'agency_clients', 'brand_kits',
    -- 店铺（演示阶段由迁移预置）
    'dim_shop',
    -- AI 会话 / 评测 / 模型配置（不携带任何预置大模型或调试对话进入新部署）
    'ai_messages', 'ai_conversations', 'ai_v2_run', 'ai_analysis_runs',
    'ai_action_approvals', 'ai_tool_logs', 'ai_context_bindings',
    'llm_provider_config', 'ai_model_providers', 'ai_model_profile',
    'integration_credentials'
  ];
BEGIN
  FOREACH t IN ARRAY demo_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE public.%I CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- 清理 LLM 类别的集成连接，避免空库自带未授权的厂商连接条目
DELETE FROM public.integration_connections WHERE category = 'llm';

-- 清空知识库集合默认模型绑定，由部署者按需在界面自行绑定
UPDATE public.kb_collections
   SET embedding_model = '',
       embedding_dim   = 0,
       config          = '{}'::jsonb,
       updated_at      = now();

-- ────────────────────────────────────────────────────────────
-- 2. 账号收敛：清理演示账号及历史默认口令 admin，保留用户自定义超管
-- ────────────────────────────────────────────────────────────
CREATE TEMP TABLE tmp_purge_users (id bigint PRIMARY KEY) ON COMMIT DROP;
INSERT INTO tmp_purge_users (id)
SELECT id
  FROM public.users
 WHERE username <> 'admin'
    OR (
      username = 'admin'
      AND password_hash = '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry'
    );

DELETE FROM public.user_sessions
 WHERE user_id IN (SELECT id FROM tmp_purge_users);

DELETE FROM public.user_module_overrides
 WHERE user_id IN (SELECT id FROM tmp_purge_users);

DELETE FROM public.user_platform_permissions
 WHERE user_id IN (SELECT id FROM tmp_purge_users);

DELETE FROM public.sys_user_role
 WHERE user_id IN (SELECT id FROM tmp_purge_users);

-- 处理指向 public.users 的 NO ACTION / RESTRICT 外键：可空列置 NULL，不可空列删对应残留行
DO $$
DECLARE
  v_fk record;
BEGIN
  FOR v_fk IN
    SELECT con.conrelid::regclass AS tbl,
           a.attname AS col,
           a.attnotnull AS not_null
      FROM pg_constraint con
      JOIN pg_attribute a
        ON a.attrelid = con.conrelid
       AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.users'::regclass
       AND con.confdeltype IN ('a', 'r')
       AND con.conrelid <> 'public.users'::regclass
  LOOP
    IF v_fk.not_null THEN
      EXECUTE format(
        'DELETE FROM %s WHERE %I IN (SELECT id FROM tmp_purge_users)',
        v_fk.tbl, v_fk.col
      );
    ELSE
      EXECUTE format(
        'UPDATE %s SET %I = NULL WHERE %I IN (SELECT id FROM tmp_purge_users)',
        v_fk.tbl, v_fk.col, v_fk.col
      );
    END IF;
  END LOOP;
END $$;

DELETE FROM public.users
 WHERE id IN (SELECT id FROM tmp_purge_users);

-- 重置账号主键序列（空库时下一位由 /setup 创建的超级管理员 id = 1）
SELECT setval(
  pg_get_serial_sequence('public.users', 'id'),
  COALESCE((SELECT max(id) FROM public.users), 0) + 1,
  false
);

-- ────────────────────────────────────────────────────────────
-- 3. 恢复系统默认告警规则（TRUNCATE CASCADE 可能因外键连带清空）
-- ────────────────────────────────────────────────────────────
INSERT INTO public.alert_rules (name, metric, method, params, severity, enabled)
SELECT * FROM (VALUES
  ('单场GMV低于 5000 元',     'gmv',          '阈值检测', '{"op":"<","value":5000}',                    '警告', true),
  ('小时产出低于 1000 元',     'gmv_per_hour', '阈值检测', '{"op":"<","value":1000}',                    '警告', true),
  ('退款率高于 15%',          'refund_rate',  '阈值检测', '{"op":">","value":0.15}',                    '严重', true),
  ('直播间在线人数骤降 30%',   'online_peak',  '环比下降', '{"ratio":0.3,"window":"1h"}',                '严重', true),
  ('当日数据未上传',          'data_upload',  '缺失检测', '{"types":["anchor_analysis","channel_analysis"]}', '警告', true)
) AS v(name, metric, method, params, severity, enabled)
WHERE NOT EXISTS (SELECT 1 FROM public.alert_rules);

-- ────────────────────────────────────────────────────────────
-- 4. 首次安装向导状态同步：无超级管理员时开放 /setup 自建最高权限账号
-- ────────────────────────────────────────────────────────────
INSERT INTO public.instance_setup (id, status)
VALUES (1, 'pending')
ON CONFLICT (id) DO NOTHING;

UPDATE public.instance_setup
   SET status = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN 'completed'
         ELSE 'pending'
       END,
       setup_source = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN setup_source
         ELSE NULL
       END,
       plan_snapshot = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN plan_snapshot
         ELSE NULL
       END,
       ai_profile = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN ai_profile
         ELSE NULL
       END,
       health_score = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN health_score
         ELSE NULL
       END,
       install_token_hash = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN install_token_hash
         ELSE NULL
       END,
       install_token_expires_at = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN install_token_expires_at
         ELSE NULL
       END,
       completed_at = CASE
         WHEN EXISTS (SELECT 1 FROM public.users WHERE role = 'super_admin') THEN COALESCE(completed_at, now())
         ELSE NULL
       END,
       updated_at = now()
 WHERE id = 1;

-- ────────────────────────────────────────────────────────────
-- 5. 结果校验
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_default_admin int;
  v_sessions int;
  v_llm_cfg int;
  v_creds int;
BEGIN
  SELECT count(*) INTO v_default_admin
    FROM public.users
   WHERE username = 'admin'
     AND password_hash = '$2b$10$8uKvULBvWvz09U9sSZp0xedNDnk3ugPVtzF6B.4j2PVxZ9tjc8.Ry';
  SELECT count(*) INTO v_sessions FROM public.live_sessions;
  SELECT count(*) INTO v_llm_cfg FROM public.llm_provider_config;
  SELECT count(*) INTO v_creds FROM public.integration_credentials;

  IF v_default_admin > 0 THEN
    RAISE EXCEPTION '清理后不应残留默认口令 admin 账号';
  END IF;
  IF v_sessions <> 0 THEN
    RAISE EXCEPTION '清理后 live_sessions 应为 0，实际 %', v_sessions;
  END IF;
  IF v_llm_cfg <> 0 OR v_creds <> 0 THEN
    RAISE EXCEPTION '清理后大模型配置与凭证应为空，实际 llm=% creds=%', v_llm_cfg, v_creds;
  END IF;

  RAISE NOTICE '演示数据、默认账号与大模型配置清理完成';
END $$;

COMMIT;
