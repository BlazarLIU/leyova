-- database/migrations/164_p8_ai_v2_schema.sql
-- Master Plan §9 P8: AI 模块 6 契约深度重构核心 Schema
-- 包含：指标真值源 (metric_definition/metric_catalog)、AI 运行流水 (ai_v2_run/step/evidence/claim/llm_call)、评测基准 (ai_eval_case/run)
BEGIN;

-- 1. 指标注册表真值源增强 (metric_definition + metric_catalog 视图)
ALTER TABLE public.metric_definition 
  ADD COLUMN IF NOT EXISTS synonyms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner VARCHAR(64) NOT NULL DEFAULT 'data_team',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 更新指标同义词词典，赋能 Schema Mapper 毫秒级意图识别
UPDATE public.metric_definition SET synonyms = ARRAY['gmv', 'GMV', '成交额', '销售额', '销售总额', '流水', '卖了多少钱'] WHERE metric_code = 'gmv';
UPDATE public.metric_definition SET synonyms = ARRAY['实付', '买家实付', '实收金额', '到手金额'] WHERE metric_code = 'pay_amount';
UPDATE public.metric_definition SET synonyms = ARRAY['净销售额', '净销售', '实际成交', '剔退成交'] WHERE metric_code = 'net_sales';
UPDATE public.metric_definition SET synonyms = ARRAY['订单量', '单量', '总单数', '销售单数', '付款单数'] WHERE metric_code = 'paid_order_count';
UPDATE public.metric_definition SET synonyms = ARRAY['买家数', '人数', '购买人数', '客户数', '用户数'] WHERE metric_code = 'paid_buyer_count';
UPDATE public.metric_definition SET synonyms = ARRAY['aov', 'AOV', '客单价', '笔单价', '平均订单金额'] WHERE metric_code = 'avg_order_value';
UPDATE public.metric_definition SET synonyms = ARRAY['退款', '退款金额', '退货金额', '退单金额'] WHERE metric_code = 'refund_amount';
UPDATE public.metric_definition SET synonyms = ARRAY['退款单数', '退单数', '退款笔数'] WHERE metric_code = 'refund_count';
UPDATE public.metric_definition SET synonyms = ARRAY['退款率', '退货率', '退单率'] WHERE metric_code = 'refund_rate';
UPDATE public.metric_definition SET synonyms = ARRAY['曝光', '展现', '展现量', '浏览展现量', '播放量', '观看量'] WHERE metric_code = 'impressions';
UPDATE public.metric_definition SET synonyms = ARRAY['点击', '点击量', '点击数', '进店次数', '点击次数'] WHERE metric_code = 'clicks';
UPDATE public.metric_definition SET synonyms = ARRAY['uv', 'UV', '访客', '访客数', '进店人数', '独立访客'] WHERE metric_code = 'visitors';
UPDATE public.metric_definition SET synonyms = ARRAY['ctr', 'CTR', '点击率', '点击转化率', '点展比'] WHERE metric_code = 'ctr';
UPDATE public.metric_definition SET synonyms = ARRAY['gpm', 'GPM', '千次成交', '千次展现成交', '千次展现gmv', '千次转化'] WHERE metric_code = 'gpm';
UPDATE public.metric_definition SET synonyms = ARRAY['广告消耗', '广告花费', '投放金额', '投放成本', '投流花费', '投流消耗', '推广费', '千川花费', '磁力花费'] WHERE metric_code = 'ad_spend';
UPDATE public.metric_definition SET synonyms = ARRAY['roi', 'ROI', '投产比', '综合投产比', '投放roi', '产出比'] WHERE metric_code = 'roi';
UPDATE public.metric_definition SET synonyms = ARRAY['净roi', '净ROI', '真实ROI', '扣退ROI', '净利润投产比'] WHERE metric_code = 'net_roi';

-- 重建并兼容升级 metric_catalog 视图
DROP VIEW IF EXISTS public.metric_catalog CASCADE;
CREATE VIEW public.metric_catalog AS
  SELECT 
    id,
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

-- 2. AI 运行会话与单次问答流水 (ai_v2_run)
CREATE TABLE IF NOT EXISTS public.ai_v2_run (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id INT REFERENCES public.tenants(id) ON DELETE SET NULL,
  conversation_id VARCHAR(64),
  question TEXT NOT NULL,
  engine VARCHAR(16) NOT NULL DEFAULT 'rule', -- 'rule' | 'llm'
  prompt_version VARCHAR(32) NOT NULL DEFAULT 'v2.0',
  plan JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  verdict VARCHAR(32) NOT NULL DEFAULT 'verified', -- 'verified' | 'rejected' | 'insufficient'
  rejection_reason TEXT,
  duration_ms INT NOT NULL DEFAULT 0,
  cost_cny NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_run_conv ON public.ai_v2_run(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_v2_run_created ON public.ai_v2_run(created_at DESC);

-- 3. AI 执行步骤 (ai_v2_step)
CREATE TABLE IF NOT EXISTS public.ai_v2_step (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES public.ai_v2_run(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  role VARCHAR(32) NOT NULL, -- 'planner' | 'executor' | 'critic' | 'reporter'
  tool VARCHAR(64),
  input JSONB NOT NULL DEFAULT '{}',
  output_ref JSONB NOT NULL DEFAULT '{}',
  row_count INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'success',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_step_run ON public.ai_v2_step(run_id, seq);

-- 4. AI 证据溯源表 (ai_v2_evidence: 严格血缘 parents 链)
CREATE TABLE IF NOT EXISTS public.ai_v2_evidence (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES public.ai_v2_run(id) ON DELETE CASCADE,
  evidence_key VARCHAR(32) NOT NULL, -- e1, e2...
  kind VARCHAR(32) NOT NULL, -- 'fact' | 'derived' | 'model_param'
  metric VARCHAR(64) NOT NULL,
  label VARCHAR(128) NOT NULL,
  unit VARCHAR(32) NOT NULL DEFAULT '',
  value NUMERIC(18, 4) NOT NULL,
  scope VARCHAR(128) NOT NULL DEFAULT 'all',
  time_range VARCHAR(64) NOT NULL DEFAULT '',
  parents TEXT[] NOT NULL DEFAULT '{}',
  sql_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_evidence_run ON public.ai_v2_evidence(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_v2_evidence_key ON public.ai_v2_evidence(run_id, evidence_key);

-- 5. AI 结构化结论断言表 (ai_v2_claim)
CREATE TABLE IF NOT EXISTS public.ai_v2_claim (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES public.ai_v2_run(id) ON DELETE CASCADE,
  seq INT NOT NULL DEFAULT 1,
  headline TEXT,
  text TEXT NOT NULL,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  kind VARCHAR(32) NOT NULL DEFAULT 'fact', -- 'fact' | 'derived' | 'judgement'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_claim_run ON public.ai_v2_claim(run_id);

-- 6. OTel 兼容的模型调用追踪 (ai_v2_llm_call)
CREATE TABLE IF NOT EXISTS public.ai_v2_llm_call (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES public.ai_v2_run(id) ON DELETE CASCADE,
  step_seq INT NOT NULL DEFAULT 1,
  operation_name VARCHAR(64) NOT NULL,
  request_model VARCHAR(64) NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_cny NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  finish_reason VARCHAR(32) NOT NULL DEFAULT 'stop',
  error_code VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_llm_run ON public.ai_v2_llm_call(run_id);

-- 7. 评测基准用例库 (ai_eval_case)
CREATE TABLE IF NOT EXISTS public.ai_eval_case (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  category VARCHAR(32) NOT NULL, -- 'S1_query', 'S2_attribution', 'S3_drilldown', 'S4_anomaly', 'S5_forecast', 'S6_review'
  question TEXT NOT NULL,
  expected_intent VARCHAR(32) NOT NULL,
  expected_metrics TEXT[] NOT NULL,
  expected_dimensions TEXT[] NOT NULL DEFAULT '{}',
  assertions JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_case_cat ON public.ai_eval_case(category);

-- 8. 评测执行回执 (ai_eval_run)
CREATE TABLE IF NOT EXISTS public.ai_eval_run (
  id BIGSERIAL PRIMARY KEY,
  batch_id VARCHAR(64) NOT NULL,
  case_id INT REFERENCES public.ai_eval_case(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL,
  actual_intent VARCHAR(32),
  actual_metrics TEXT[] NOT NULL DEFAULT '{}',
  evidence_count INT NOT NULL DEFAULT 0,
  claim_count INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_run_batch ON public.ai_eval_run(batch_id, passed);

-- 9. 清理已被废弃的 DeerFlow / OpenClaw 系统配置
DELETE FROM public.system_config 
WHERE config_key IN ('ai_engine', 'deerflow_api_base', 'deerflow_model', 'deerflow_timeout_ms');

-- 10. RLS 权限配置
ALTER TABLE public.ai_v2_run ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_v2_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_v2_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_v2_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_v2_llm_call ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_eval_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_eval_run ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_ai_v2_run_tenant ON public.ai_v2_run;
CREATE POLICY p_ai_v2_run_tenant ON public.ai_v2_run
  FOR ALL
  USING (
    tenant_id IS NULL 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int
    OR current_setting('app.current_user_role', true) IN ('admin', 'superadmin', 'auditor')
  )
  WITH CHECK (
    tenant_id IS NULL 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int
    OR current_setting('app.current_user_role', true) IN ('admin', 'superadmin')
  );

DROP POLICY IF EXISTS p_ai_v2_step_tenant ON public.ai_v2_step;
CREATE POLICY p_ai_v2_step_tenant ON public.ai_v2_step FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_ai_v2_evidence_tenant ON public.ai_v2_evidence;
CREATE POLICY p_ai_v2_evidence_tenant ON public.ai_v2_evidence FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_ai_v2_claim_tenant ON public.ai_v2_claim;
CREATE POLICY p_ai_v2_claim_tenant ON public.ai_v2_claim FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_ai_v2_llm_tenant ON public.ai_v2_llm_call;
CREATE POLICY p_ai_v2_llm_tenant ON public.ai_v2_llm_call FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_ai_eval_case_read ON public.ai_eval_case;
CREATE POLICY p_ai_eval_case_read ON public.ai_eval_case FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS p_ai_eval_run_read ON public.ai_eval_run;
CREATE POLICY p_ai_eval_run_read ON public.ai_eval_run FOR ALL USING (true) WITH CHECK (true);

COMMIT;
