-- =============================================================================
-- Migration 122: AI 选品全品类化、多因子信号引擎与一键运营方案生成器
-- 对应规划：FINAL-PLAN Phase 2 (② AI 选品全品类化 + 一键运营方案 + 融合进 AI 助手)
-- =============================================================================

-- 1. 类目主档表 (dim_category)
CREATE TABLE IF NOT EXISTS public.dim_category (
  code varchar(40) PRIMARY KEY,
  parent_code varchar(40) REFERENCES public.dim_category(code) ON DELETE SET NULL,
  level smallint NOT NULL CHECK (level IN (1, 2)),
  name varchar(80) NOT NULL,
  weather_sensitivity varchar(10) NOT NULL DEFAULT 'low' CHECK (weather_sensitivity IN ('high', 'medium', 'low')),
  lifecycle_days integer DEFAULT 60,
  seasonal_peak varchar(20)[] DEFAULT '{}'::varchar[],
  status varchar(20) NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  remark text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dim_category_parent ON public.dim_category(parent_code);
CREATE INDEX IF NOT EXISTS idx_dim_category_level ON public.dim_category(level);

-- 2. 种子类目（覆盖 10 大一级类目与 20 个二级类目）
INSERT INTO public.dim_category (code, parent_code, level, name, weather_sensitivity, lifecycle_days, seasonal_peak, sort_order)
VALUES
  -- 一级类目
  ('APPAREL',   NULL, 1, '服饰鞋帽', 'high',   30, ARRAY['10','11','12'], 1),
  ('BEAUTY',    NULL, 1, '美妆个护', 'medium', 45, ARRAY['06','11'],      2),
  ('FOOD',      NULL, 1, '食品生鲜', 'medium', 30, ARRAY['01','09','10'],  3),
  ('DIGITAL',   NULL, 1, '数码3C',   'low',    90, ARRAY['06','11'],      4),
  ('HOME',      NULL, 1, '家居日用', 'low',    60, ARRAY['10','11'],      5),
  ('BABY',      NULL, 1, '母婴用品', 'low',    60, ARRAY['05','11'],      6),
  ('OUTDOOR',   NULL, 1, '运动户外', 'high',   45, ARRAY['04','05','09','10'], 7),
  ('PET',       NULL, 1, '宠物用品', 'low',    60, ARRAY['06','11'],      8),
  ('APPLIANCE', NULL, 1, '小家电',   'medium', 90, ARRAY['06','11'],      9),
  ('HEALTH',    NULL, 1, '医药健康', 'medium', 90, ARRAY['01','11','12'], 10),

  -- 二级类目 (每类目 >= 2 个)
  ('APPAREL_OUTDOOR', 'APPAREL', 2, '户外与防寒服饰', 'high',   30, ARRAY['10','11','12'], 11),
  ('APPAREL_DAILY',   'APPAREL', 2, '日常内搭与针织', 'medium', 30, ARRAY['09','10','11'], 12),
  ('BEAUTY_SKINCARE', 'BEAUTY',  2, '面部补水修护',   'high',   45, ARRAY['10','11','12'], 21),
  ('BEAUTY_MAKEUP',   'BEAUTY',  2, '潮流彩妆洗护',   'low',    45, ARRAY['05','06','11'], 22),
  ('FOOD_SNACK',      'FOOD',    2, '轻食即食与咖啡', 'low',    45, ARRAY['06','09','11'], 31),
  ('FOOD_FRESH',      'FOOD',    2, '原切生鲜滋补',   'medium', 30, ARRAY['01','11','12'], 32),
  ('DIGITAL_AUDIO',   'DIGITAL', 2, '智能音频与外设', 'low',    90, ARRAY['06','11'],      41),
  ('DIGITAL_COMP',    'DIGITAL', 2, '数码配件与办公', 'low',    90, ARRAY['06','11'],      42),
  ('HOME_BED',        'HOME',    2, '家纺床品保暖',   'high',   60, ARRAY['10','11','12'], 51),
  ('HOME_DAILY',      'HOME',    2, '收纳清洁与香氛', 'low',    60, ARRAY['06','11'],      52),
  ('BABY_CARE',       'BABY',    2, '婴儿纸尿裤湿巾', 'low',    45, ARRAY['05','06','11'], 61),
  ('BABY_GEAR',       'BABY',    2, '童车童床洗护',   'low',    90, ARRAY['05','11'],      62),
  ('OUTDOOR_CAMP',    'OUTDOOR', 2, '露营徒步装备',   'high',   45, ARRAY['04','05','10'], 71),
  ('OUTDOOR_FIT',     'OUTDOOR', 2, '室内健身瑜伽',   'low',    60, ARRAY['03','04','09'], 72),
  ('PET_FOOD',        'PET',     2, '猫狗主粮零食',   'low',    45, ARRAY['06','11'],      81),
  ('PET_SUPPLY',      'PET',     2, '宠物清洁饮水',   'low',    60, ARRAY['06','11'],      82),
  ('APPLIANCE_SEASON','APPLIANCE', 2, '季候环境电器', 'high',   60, ARRAY['06','07','11','12'], 91),
  ('APPLIANCE_KITCH', 'APPLIANCE', 2, '精致厨电个护', 'low',    90, ARRAY['06','11'],      92),
  ('HEALTH_SUPP',     'HEALTH',  2, '膳食营养维他命', 'medium', 90, ARRAY['01','11','12'], 101),
  ('HEALTH_DEVICE',   'HEALTH',  2, '家用医疗监测仪', 'low',    90, ARRAY['01','11'],      102)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  weather_sensitivity = EXCLUDED.weather_sensitivity,
  lifecycle_days = EXCLUDED.lifecycle_days,
  seasonal_peak = EXCLUDED.seasonal_peak,
  sort_order = EXCLUDED.sort_order;

-- 3. dim_product 关联 category_code
ALTER TABLE public.dim_product ADD COLUMN IF NOT EXISTS category_code varchar(40) REFERENCES public.dim_category(code) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dim_product_category_code ON public.dim_product(category_code);

-- 回填 66 SKU 对应二级类目
UPDATE public.dim_product SET category_code = 'APPAREL_OUTDOOR' WHERE category = '服饰鞋帽' AND (sku_code LIKE '%001%' OR sku_code LIKE '%004%' OR sku_code LIKE '%005%');
UPDATE public.dim_product SET category_code = 'APPAREL_DAILY'   WHERE category = '服饰鞋帽' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'BEAUTY_SKINCARE' WHERE category = '美妆个护' AND (sku_code LIKE '%011%' OR sku_code LIKE '%012%' OR sku_code LIKE '%013%' OR sku_code LIKE '%014%');
UPDATE public.dim_product SET category_code = 'BEAUTY_MAKEUP'   WHERE category = '美妆个护' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'FOOD_SNACK'      WHERE category = '食品生鲜' AND (sku_code LIKE '%021%' OR sku_code LIKE '%022%' OR sku_code LIKE '%023%' OR sku_code LIKE '%026%');
UPDATE public.dim_product SET category_code = 'FOOD_FRESH'      WHERE category = '食品生鲜' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'DIGITAL_AUDIO'   WHERE category = '数码3C' AND (sku_code LIKE '%031%' OR sku_code LIKE '%032%' OR sku_code LIKE '%033%');
UPDATE public.dim_product SET category_code = 'DIGITAL_COMP'    WHERE category = '数码3C' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'HOME_BED'        WHERE category = '家居日用' AND (sku_code LIKE '%041%' OR sku_code LIKE '%042%');
UPDATE public.dim_product SET category_code = 'HOME_DAILY'      WHERE category = '家居日用' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'BABY_CARE'       WHERE category = '母婴用品' AND (sku_code LIKE '%051%' OR sku_code LIKE '%052%' OR sku_code LIKE '%055%');
UPDATE public.dim_product SET category_code = 'BABY_GEAR'       WHERE category = '母婴用品' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'OUTDOOR_CAMP'    WHERE category = '运动户外' AND (sku_code LIKE '%061%' OR sku_code LIKE '%064%' OR sku_code LIKE '%065%' OR sku_code LIKE '%066%');
UPDATE public.dim_product SET category_code = 'OUTDOOR_FIT'     WHERE category = '运动户外' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'PET_FOOD'        WHERE category = '宠物用品' AND (sku_code LIKE '%071%' OR sku_code LIKE '%075%');
UPDATE public.dim_product SET category_code = 'PET_SUPPLY'      WHERE category = '宠物用品' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'APPLIANCE_SEASON'WHERE category = '小家电' AND (sku_code LIKE '%083%' OR sku_code LIKE '%084%');
UPDATE public.dim_product SET category_code = 'APPLIANCE_KITCH' WHERE category = '小家电' AND category_code IS NULL;
UPDATE public.dim_product SET category_code = 'HEALTH_SUPP'     WHERE category = '医药健康' AND (sku_code LIKE '%091%');
UPDATE public.dim_product SET category_code = 'HEALTH_DEVICE'   WHERE category = '医药健康' AND category_code IS NULL;

-- 4. 信号源注册与权重配置 (signal_source)
CREATE TABLE IF NOT EXISTS public.signal_source (
  id bigserial PRIMARY KEY,
  code varchar(40) NOT NULL,
  category_code varchar(40) NOT NULL REFERENCES public.dim_category(code) ON DELETE CASCADE,
  weight numeric(5,4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  is_active boolean NOT NULL DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  remark text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_signal_category UNIQUE (code, category_code)
);

CREATE INDEX IF NOT EXISTS idx_signal_source_cat ON public.signal_source(category_code);

-- 种子信号源配置：覆盖 10 个一级类目，权重和恒等于 1.0000
INSERT INTO public.signal_source (code, category_code, weight, is_active, remark)
VALUES
  -- 强天气相关类目 (APPAREL, OUTDOOR): 天气=0.45, 销售趋势=0.25, 逆向退款=0.10, 库存健康=0.10, 搜索需求=0.10
  ('weather',              'APPAREL', 0.4500, true, '气温气象主信号'),
  ('sales_trend',          'APPAREL', 0.2500, true, '近30天GMV趋势环比'),
  ('refund_rate_inverse',  'APPAREL', 0.1000, true, '品类低退款偏好'),
  ('inventory_health',     'APPAREL', 0.1000, true, '可用库存与安全库存比'),
  ('keyword_demand',       'APPAREL', 0.1000, true, '站内高意向搜索占比'),

  ('weather',              'OUTDOOR', 0.4500, true, '气象主导出行装备'),
  ('sales_trend',          'OUTDOOR', 0.2500, true, '近30天户外品销售趋势'),
  ('refund_rate_inverse',  'OUTDOOR', 0.1000, true, '逆向退款率评分'),
  ('inventory_health',     'OUTDOOR', 0.1000, true, '可用库存深度'),
  ('keyword_demand',       'OUTDOOR', 0.1000, true, '搜索长尾热度'),

  -- 中度天气相关 (BEAUTY, FOOD, APPLIANCE, HEALTH): 天气=0.20, 销售趋势=0.35, 逆向退款=0.15, 库存健康=0.15, 搜索需求=0.15
  ('weather',              'BEAUTY', 0.2000, true, '季候肤质切换信号'),
  ('sales_trend',          'BEAUTY', 0.3500, true, '美妆主销趋势'),
  ('refund_rate_inverse',  'BEAUTY', 0.1500, true, '客诉与退款控制'),
  ('inventory_health',     'BEAUTY', 0.1500, true, '批次有效期与库存量'),
  ('keyword_demand',       'BEAUTY', 0.1500, true, '功效成分搜索词'),

  ('weather',              'FOOD', 0.2000, true, '气温与生鲜保质期'),
  ('sales_trend',          'FOOD', 0.3500, true, '食品复购趋势'),
  ('refund_rate_inverse',  'FOOD', 0.1500, true, '破损与品质退款率'),
  ('inventory_health',     'FOOD', 0.1500, true, '周转库存深度'),
  ('keyword_demand',       'FOOD', 0.1500, true, '节令食品搜索热度'),

  ('weather',              'APPLIANCE', 0.2000, true, '冷暖季节小家电'),
  ('sales_trend',          'APPLIANCE', 0.3500, true, '家电换新趋势'),
  ('refund_rate_inverse',  'APPLIANCE', 0.1500, true, '售后无忧保障'),
  ('inventory_health',     'APPLIANCE', 0.1500, true, '大件现货储备'),
  ('keyword_demand',       'APPLIANCE', 0.1500, true, '功能型号搜索指数'),

  ('weather',              'HEALTH', 0.2000, true, '季节性呼吸防护'),
  ('sales_trend',          'HEALTH', 0.3500, true, '家庭常备药械趋势'),
  ('refund_rate_inverse',  'HEALTH', 0.1500, true, '低退款高信赖度'),
  ('inventory_health',     'HEALTH', 0.1500, true, '器械库存完好率'),
  ('keyword_demand',       'HEALTH', 0.1500, true, '健康体征搜索量'),

  -- 弱/无天气相关 (DIGITAL, HOME, BABY, PET): 天气=0.05, 销售趋势=0.45, 逆向退款=0.20, 库存健康=0.15, 搜索需求=0.15
  ('weather',              'DIGITAL', 0.0500, true, '天气底噪信号'),
  ('sales_trend',          'DIGITAL', 0.4500, true, '3C 核心爆款趋势'),
  ('refund_rate_inverse',  'DIGITAL', 0.2000, true, '数码高客单防退款'),
  ('inventory_health',     'DIGITAL', 0.1500, true, '现货供应链保障'),
  ('keyword_demand',       'DIGITAL', 0.1500, true, '数码评测与型号搜索'),

  ('weather',              'HOME', 0.0500, true, '家居日常弱天气'),
  ('sales_trend',          'HOME', 0.4500, true, '日用百货持续动销'),
  ('refund_rate_inverse',  'HOME', 0.2000, true, '家居售后满意度'),
  ('inventory_health',     'HOME', 0.1500, true, '日百高周转库存'),
  ('keyword_demand',       'HOME', 0.1500, true, '生活痛点关键词'),

  ('weather',              'BABY', 0.0500, true, '母婴刚需消耗品'),
  ('sales_trend',          'BABY', 0.4500, true, '母婴周期性复购'),
  ('refund_rate_inverse',  'BABY', 0.2000, true, '母婴品质零差评'),
  ('inventory_health',     'BABY', 0.1500, true, '关键消耗品不断货'),
  ('keyword_demand',       'BABY', 0.1500, true, '成分安全搜索'),

  ('weather',              'PET', 0.0500, true, '宠物主粮弱气象'),
  ('sales_trend',          'PET', 0.4500, true, '宠物高粘性复购'),
  ('refund_rate_inverse',  'PET', 0.2000, true, '适口性与售后把控'),
  ('inventory_health',     'PET', 0.1500, true, '主粮仓储深度'),
  ('keyword_demand',       'PET', 0.1500, true, '配方与口味搜索词')
ON CONFLICT (code, category_code) DO UPDATE SET
  weight = EXCLUDED.weight,
  is_active = EXCLUDED.is_active,
  remark = EXCLUDED.remark;

-- 5. 选品建议运行记录表 (fact_selection_recommendation)
CREATE TABLE IF NOT EXISTS public.fact_selection_recommendation (
  id bigserial PRIMARY KEY,
  recommendation_no varchar(40) NOT NULL UNIQUE,
  tenant_id integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_code varchar(40) NOT NULL REFERENCES public.dim_category(code) ON DELETE CASCADE,
  platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
  shop_id bigint REFERENCES public.dim_shop(id) ON DELETE SET NULL,
  city varchar(40) NOT NULL DEFAULT '全国',
  signals_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  strategy varchar(20) NOT NULL DEFAULT 'trend_led' CHECK (strategy IN ('weather_led', 'trend_led', 'degraded')),
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'adopted', 'archived')),
  insufficient_reason text DEFAULT '',
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_selection_rec_tenant_cat ON public.fact_selection_recommendation(tenant_id, category_code);
CREATE INDEX IF NOT EXISTS idx_selection_rec_shop ON public.fact_selection_recommendation(shop_id);
CREATE INDEX IF NOT EXISTS idx_selection_rec_created ON public.fact_selection_recommendation(created_at DESC);

-- 6. 选品推荐明细表 (fact_selection_item)
CREATE TABLE IF NOT EXISTS public.fact_selection_item (
  id bigserial PRIMARY KEY,
  recommendation_id bigint NOT NULL REFERENCES public.fact_selection_recommendation(id) ON DELETE CASCADE,
  rank_no smallint NOT NULL DEFAULT 1,
  product_id bigint REFERENCES public.dim_product(id) ON DELETE SET NULL,
  suggested_name varchar(200) NOT NULL,
  suggested_specs varchar(200) DEFAULT '',
  match_score numeric(5,2) NOT NULL DEFAULT 0.00,
  reason text NOT NULL DEFAULT '',
  suggested_price numeric(12,2) NOT NULL DEFAULT 0.00,
  estimated_margin_rate numeric(5,4) NOT NULL DEFAULT 0.00,
  risk_flags text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_selection_item_rec ON public.fact_selection_item(recommendation_id, rank_no);

-- 7. 运营方案模板表 (campaign_plan_template)
CREATE TABLE IF NOT EXISTS public.campaign_plan_template (
  id serial PRIMARY KEY,
  template_code varchar(40) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  category_code varchar(40) REFERENCES public.dim_category(code) ON DELETE SET NULL,
  platform_code varchar(32) REFERENCES public.system_platform_configs(platform_code) ON DELETE SET NULL,
  version smallint NOT NULL DEFAULT 1,
  blocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_rules_version varchar(40) DEFAULT 'v1.0',
  is_active boolean NOT NULL DEFAULT true,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 种子方案模板
INSERT INTO public.campaign_plan_template (template_code, name, category_code, platform_code, version, blocks, is_active)
VALUES
  (
    'TMPL_STANDARD_LIVE',
    '标准直播运营爆破方案',
    NULL,
    NULL,
    1,
    '{
      "version": 1,
      "sections": [
        {"key": "positioning", "title": "场次定位与目标", "type": "target_breakdown", "required": true},
        {"key": "assortment", "title": "货盘结构与分层", "type": "sku_list", "required": true, "rules": {"minCount": 3, "maxCount": 10}},
        {"key": "pricing", "title": "价格带与毛利设计", "type": "price_band", "required": true},
        {"key": "timing", "title": "开播时段与节奏分段", "type": "schedule", "required": true},
        {"key": "script", "title": "AI 话术与逼单连带", "type": "talking_points", "required": true, "rules": {"complianceScan": true}},
        {"key": "staffing", "title": "主播场控中控分工", "type": "role_assignment", "required": true},
        {"key": "ad_traffic", "title": "付费投流与流量追投", "type": "budget_plan", "required": false},
        {"key": "inventory_risk", "title": "备货与库存预警", "type": "stock_check", "required": true}
      ]
    }'::jsonb,
    true
  ),
  (
    'TMPL_SEASONAL_BURST',
    '季节与天气敏感品打榜方案',
    'APPAREL',
    NULL,
    1,
    '{
      "version": 1,
      "sections": [
        {"key": "weather_trigger", "title": "降温/升温天气触发点", "type": "weather_signal", "required": true},
        {"key": "hero_sku", "title": "强天气关联主推品", "type": "sku_focus", "required": true},
        {"key": "assortment", "title": "连带搭配组合货盘", "type": "sku_list", "required": true},
        {"key": "script", "title": "痛点升温与场景化话术", "type": "talking_points", "required": true, "rules": {"complianceScan": true}},
        {"key": "ad_traffic", "title": "气象定向流量投放", "type": "budget_plan", "required": true}
      ]
    }'::jsonb,
    true
  )
ON CONFLICT (template_code) DO UPDATE SET
  name = EXCLUDED.name,
  blocks = EXCLUDED.blocks,
  is_active = EXCLUDED.is_active;

-- 8. 运营方案实例表 (campaign_plan)
CREATE TABLE IF NOT EXISTS public.campaign_plan (
  id bigserial PRIMARY KEY,
  plan_no varchar(40) NOT NULL UNIQUE,
  tenant_id integer NOT NULL DEFAULT 1 REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id integer REFERENCES public.campaign_plan_template(id) ON DELETE SET NULL,
  template_version smallint NOT NULL DEFAULT 1,
  shop_id bigint REFERENCES public.dim_shop(id) ON DELETE CASCADE,
  category_code varchar(40) REFERENCES public.dim_category(code) ON DELETE SET NULL,
  plan_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_recommendation_id bigint REFERENCES public.fact_selection_recommendation(id) ON DELETE SET NULL,
  approval_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  generated_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_plan_shop ON public.campaign_plan(shop_id);
CREATE INDEX IF NOT EXISTS idx_campaign_plan_tenant ON public.campaign_plan(tenant_id);

-- 9. 行级安全隔离 (RLS) 与权限授权
ALTER TABLE public.dim_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_selection_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_selection_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_plan_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.dim_category FORCE ROW LEVEL SECURITY;
ALTER TABLE public.signal_source FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fact_selection_recommendation FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fact_selection_item FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_plan_template FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_plan FORCE ROW LEVEL SECURITY;

-- 读权限策略
DROP POLICY IF EXISTS p_dim_category_select ON public.dim_category;
CREATE POLICY p_dim_category_select ON public.dim_category FOR SELECT TO leyova_app USING (true);

DROP POLICY IF EXISTS p_signal_source_select ON public.signal_source;
CREATE POLICY p_signal_source_select ON public.signal_source FOR SELECT TO leyova_app USING (true);

DROP POLICY IF EXISTS p_campaign_plan_template_select ON public.campaign_plan_template;
CREATE POLICY p_campaign_plan_template_select ON public.campaign_plan_template FOR SELECT TO leyova_app USING (true);

DROP POLICY IF EXISTS p_selection_rec_select ON public.fact_selection_recommendation;
CREATE POLICY p_selection_rec_select ON public.fact_selection_recommendation FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL
    AND ((shop_id IS NULL) OR rls_can_access_shop(shop_id))
    AND (tenant_id = rls_tenant_id() OR (rls_role() = 'super_admin' AND rls_is_agency_staff()))
  );

DROP POLICY IF EXISTS p_selection_item_select ON public.fact_selection_item;
CREATE POLICY p_selection_item_select ON public.fact_selection_item FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.fact_selection_recommendation r
      WHERE r.id = recommendation_id
        AND ((r.shop_id IS NULL) OR rls_can_access_shop(r.shop_id))
        AND (r.tenant_id = rls_tenant_id() OR (rls_role() = 'super_admin' AND rls_is_agency_staff()))
    )
  );

DROP POLICY IF EXISTS p_campaign_plan_select ON public.campaign_plan;
CREATE POLICY p_campaign_plan_select ON public.campaign_plan FOR SELECT TO leyova_app
  USING (
    rls_user_id() IS NOT NULL
    AND ((shop_id IS NULL) OR rls_can_access_shop(shop_id))
    AND (tenant_id = rls_tenant_id() OR (rls_role() = 'super_admin' AND rls_is_agency_staff()))
  );

-- 写权限策略
DROP POLICY IF EXISTS p_selection_rec_write ON public.fact_selection_recommendation;
CREATE POLICY p_selection_rec_write ON public.fact_selection_recommendation FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])
    AND ((shop_id IS NULL) OR rls_can_access_shop(shop_id))
    AND (tenant_id = rls_tenant_id() OR rls_role() = 'super_admin'::text)
  )
  WITH CHECK (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])
    AND ((shop_id IS NULL) OR rls_can_access_shop(shop_id))
    AND (tenant_id = rls_tenant_id() OR rls_role() = 'super_admin'::text)
  );

DROP POLICY IF EXISTS p_selection_item_write ON public.fact_selection_item;
CREATE POLICY p_selection_item_write ON public.fact_selection_item FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])
  )
  WITH CHECK (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'ops_staff'::text, 'operator'::text])
  );

DROP POLICY IF EXISTS p_campaign_plan_write ON public.campaign_plan;
CREATE POLICY p_campaign_plan_write ON public.campaign_plan FOR ALL TO leyova_app
  USING (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'operator'::text])
    AND ((shop_id IS NULL) OR rls_can_access_shop(shop_id))
    AND (tenant_id = rls_tenant_id() OR rls_role() = 'super_admin'::text)
  )
  WITH CHECK (
    rls_is_agency_staff()
    AND rls_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'ops_director'::text, 'operator'::text])
    AND ((shop_id IS NULL) OR rls_can_access_shop(shop_id))
    AND (tenant_id = rls_tenant_id() OR rls_role() = 'super_admin'::text)
  );

GRANT SELECT ON public.dim_category TO leyova_app;
GRANT SELECT ON public.signal_source TO leyova_app;
GRANT SELECT ON public.campaign_plan_template TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fact_selection_recommendation TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fact_selection_item TO leyova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_plan TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.fact_selection_recommendation_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.fact_selection_item_id_seq TO leyova_app;
GRANT USAGE, SELECT ON SEQUENCE public.campaign_plan_id_seq TO leyova_app;
