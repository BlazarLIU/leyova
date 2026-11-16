-- database/migrations/161_p7_custom_field_engine.sql
-- Master Plan §5.2 #13: 自定义字段机制 (EAV / JSONB 元数据驱动引擎，消除平台专属指标频繁加表膨胀)
BEGIN;

-- 1. 自定义字段元数据定义表 sys_custom_field_definition
CREATE TABLE IF NOT EXISTS public.sys_custom_field_definition (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('product', 'shop', 'live_session', 'order', 'ad_plan', 'channel_listing')),
  field_key VARCHAR(64) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'date', 'select', 'json')),
  platform_code VARCHAR(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
  options JSONB NOT NULL DEFAULT '[]', -- 适用于 select 类型，如 [{"label": "S级", "value": "S"}]
  is_required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT NOT NULL DEFAULT '',
  validation_regex TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_field_def_idx 
  ON public.sys_custom_field_definition (entity_type, field_key, COALESCE(platform_code, '__all__'));

CREATE INDEX IF NOT EXISTS idx_custom_field_entity_plat 
  ON public.sys_custom_field_definition(entity_type, platform_code, is_active);

-- 2. 自定义字段值存储表 sys_custom_field_value
CREATE TABLE IF NOT EXISTS public.sys_custom_field_value (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  field_id INT NOT NULL REFERENCES public.sys_custom_field_definition(id) ON DELETE CASCADE,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  field_value_text TEXT NOT NULL DEFAULT '',
  field_value_number NUMERIC(18,4),
  field_value_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_field_val UNIQUE (field_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_val_entity ON public.sys_custom_field_value(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_custom_val_key ON public.sys_custom_field_value(field_key);

-- 3. 主实体表扩展 jsonb custom_fields 字段支持单表快读
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.dim_product ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.ad_plan ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';

-- 4. RLS 强制安全隔离
ALTER TABLE public.sys_custom_field_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_custom_field_definition FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sys_custom_field_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_custom_field_value FORCE ROW LEVEL SECURITY;

-- 字段定义允许所有认证用户读取
DROP POLICY IF EXISTS p_custom_field_def_select ON public.sys_custom_field_definition;
CREATE POLICY p_custom_field_def_select ON public.sys_custom_field_definition
  FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL AND
    (platform_code IS NULL OR rls_has_platform(platform_code))
  );

DROP POLICY IF EXISTS p_custom_field_def_write ON public.sys_custom_field_definition;
CREATE POLICY p_custom_field_def_write ON public.sys_custom_field_definition
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director'])
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director'])
  );

-- 字段值读写策略
DROP POLICY IF EXISTS p_custom_field_val_select ON public.sys_custom_field_value;
CREATE POLICY p_custom_field_val_select ON public.sys_custom_field_value
  FOR SELECT TO leyova_app
  USING (rls_user_id() IS NOT NULL);

DROP POLICY IF EXISTS p_custom_field_val_write ON public.sys_custom_field_value;
CREATE POLICY p_custom_field_val_write ON public.sys_custom_field_value
  FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'ad_buyer'])
  )
  WITH CHECK (
    rls_is_agency_staff() AND
    rls_role() = ANY (ARRAY['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'ad_buyer'])
  );

-- 5. 预置常见平台专属字段定义
INSERT INTO public.sys_custom_field_definition (
  entity_type, field_key, field_label, data_type, platform_code, options, description, sort_order
) VALUES
  ('live_session', 'douyin_room_level', '抖音直播间评级', 'select', 'douyin', '[{"label":"S级大促","value":"S"},{"label":"A级日常","value":"A"},{"label":"B级测试","value":"B"}]'::jsonb, '抖音官方官方流量池分发评级', 10),
  ('live_session', 'streamer_dress_code', '主播出镜着装规范', 'string', 'douyin', '[]'::jsonb, '直播合规着装与主题要求', 20),
  ('product', 'xhs_seeding_tag', '小红书种草标签', 'string', 'xiaohongshu', '[]'::jsonb, '蒲公英/聚光合作种草关键词', 10),
  ('product', 'is_kol_gifting', '达人寄样专属款', 'boolean', 'xiaohongshu', '[]'::jsonb, '是否仅供 KOL 达人寄样测评', 20),
  ('ad_plan', 'magnetic_bid_strategy', '磁力金牛出价策略', 'select', 'kuaishou', '[{"label":"最大转化","value":"max_conversion"},{"label":"控成本","value":"target_cost"}]'::jsonb, '快手商业化广告专属策略', 10),
  ('order', 'logistics_cold_chain', '冷链配送标记', 'boolean', NULL, '[]'::jsonb, '全平台通用冷链或特殊打包标识', 10)
ON CONFLICT (entity_type, field_key, COALESCE(platform_code, '__all__')) DO UPDATE SET
  field_label = EXCLUDED.field_label,
  options = EXCLUDED.options,
  description = EXCLUDED.description;

COMMIT;
