-- database/migrations/192_p10_promptops_generation.sql
-- W10 PromptOps + 脚本/文案生成
-- 设计要点：
--   1. prompt_versions 不可变：任何修改都新增版本，禁止 UPDATE 正文；
--   2. 灰度按 prompt_templates.canary_version + 比例决定实际使用版本；
--   3. 生成草稿必须先过合规闸门才允许采纳，采纳后才进 script_library；
--   4. 引用与合规命中都落库，保证「生成了什么、依据什么、卡在哪」可追溯。
BEGIN;

-- ── 提示词模板 ──
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  key VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  scene VARCHAR(32) NOT NULL DEFAULT 'script',
  platform VARCHAR(32) NOT NULL DEFAULT 'all',
  category VARCHAR(64) NOT NULL DEFAULT 'all',
  description TEXT NOT NULL DEFAULT '',
  -- 变量 schema：[{"name":"product","required":true,"description":"商品名"}]
  variables_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 当前生效版本与灰度版本
  active_version INT NOT NULL DEFAULT 0,
  canary_version INT NULL,
  canary_ratio INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_prompt_template_key UNIQUE (tenant_id, key),
  CONSTRAINT ck_prompt_template_scene CHECK (scene IN ('script', 'copy', 'title', 'reply', 'analysis')),
  CONSTRAINT ck_prompt_template_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT ck_prompt_canary_ratio CHECK (canary_ratio BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_tenant
  ON public.prompt_templates (tenant_id, scene, status);

-- ── 提示词版本（不可变）──
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  template_id UUID NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  user_template TEXT NOT NULL DEFAULT '',
  output_schema TEXT NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version),
  CONSTRAINT ck_prompt_version_positive CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_template
  ON public.prompt_versions (template_id, version DESC);

-- 不可变约束：正文一旦写入禁止修改
CREATE OR REPLACE FUNCTION public.prompt_versions_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.system_prompt <> OLD.system_prompt
     OR NEW.user_template <> OLD.user_template
     OR NEW.output_schema <> OLD.output_schema
     OR NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'prompt_versions 不可变：请新建版本而不是修改历史版本';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompt_versions_immutable ON public.prompt_versions;
CREATE TRIGGER trg_prompt_versions_immutable
  BEFORE UPDATE ON public.prompt_versions
  FOR EACH ROW EXECUTE FUNCTION public.prompt_versions_immutable();

-- ── 提示词评测 ──
CREATE TABLE IF NOT EXISTS public.prompt_eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  template_id UUID NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  case_count INT NOT NULL DEFAULT 0,
  pass_count INT NOT NULL DEFAULT 0,
  pass_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  avg_latency_ms INT NOT NULL DEFAULT 0,
  total_cost_cny NUMERIC(12, 6) NOT NULL DEFAULT 0,
  detail JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'completed',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_prompt_eval_status CHECK (status IN ('completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_eval_template
  ON public.prompt_eval_runs (tenant_id, template_id, created_at DESC);

-- ── 生成草稿（含合规结果与引用）──
CREATE TABLE IF NOT EXISTS public.ai_generation_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  template_id UUID NULL REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
  template_key VARCHAR(64) NOT NULL DEFAULT '',
  template_version INT NOT NULL DEFAULT 0,
  scene VARCHAR(32) NOT NULL DEFAULT 'script',
  platform VARCHAR(32) NOT NULL DEFAULT 'all',
  business_key VARCHAR(120) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  -- 生成输入变量与非敏感上下文
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 引用：[{"chunkId","documentName","snippet","score"}]
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 合规：{"blocked":bool,"hits":[{"word","action"}],"scannedAt":...}
  compliance JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'pending_review',
  review_note VARCHAR(500) NOT NULL DEFAULT '',
  reviewed_by BIGINT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  final_script_id INT NULL,
  model VARCHAR(120) NOT NULL DEFAULT '',
  tokens_used INT NOT NULL DEFAULT 0,
  cost_cny NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  degraded BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_generation_status CHECK (status IN ('pending_review', 'approved', 'rejected', 'blocked')),
  CONSTRAINT ck_generation_scene CHECK (scene IN ('script', 'copy', 'title', 'reply', 'analysis'))
);

CREATE INDEX IF NOT EXISTS idx_generation_drafts_tenant
  ON public.ai_generation_drafts (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_drafts_template
  ON public.ai_generation_drafts (tenant_id, template_key, created_at DESC);

-- ── 默认模板（脚本 / 文案 / 标题）──
INSERT INTO public.prompt_templates
  (tenant_id, key, name, scene, platform, category, description, variables_schema)
VALUES
  (1, 'live_script', '直播带货脚本', 'script', 'all', 'all',
   '按开场/痛点/卖点/逼单/收尾结构生成，必须引用商品资料',
   '[{"name":"product","required":true,"description":"商品名称与核心卖点"},{"name":"audience","required":false,"description":"目标人群"}]'::jsonb),
  (1, 'product_copy', '商品短文案', 'copy', 'all', 'all',
   '商品详情页/短视频口播文案，突出卖点与场景',
   '[{"name":"product","required":true,"description":"商品名称与核心卖点"},{"name":"platform","required":false,"description":"投放平台"}]'::jsonb),
  (1, 'video_title', '短视频标题', 'title', 'all', 'all',
   '生成 5 条可选标题，避免极限词',
   '[{"name":"product","required":true,"description":"商品名称与核心卖点"}]'::jsonb)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- ── 默认版本 v1 ──
INSERT INTO public.prompt_versions
  (tenant_id, template_id, version, system_prompt, user_template, output_schema, notes)
SELECT 1, t.id, 1, v.system_prompt, v.user_template, v.output_schema, '初始版本'
  FROM public.prompt_templates t
  JOIN (VALUES
    ('live_script',
     '你是资深直播带货编导。严格依据给定商品资料与知识片段撰写，不得编造参数、价格或资质。禁止使用极限词与医疗功效表达。',
     E'商品信息：{{product}}\n目标人群：{{audience}}\n知识依据：\n{{knowledge}}\n\n请按「开场钩子 / 痛点共鸣 / 卖点拆解 / 逼单 / 收尾」五段结构输出脚本，每段 2-4 句，口语化，不使用夸张绝对化用语。',
     ''),
    ('product_copy',
     '你是电商文案专家。只使用给定商品信息与知识依据，不编造卖点；避免极限词。',
     E'商品信息：{{product}}\n平台：{{platform}}\n知识依据：\n{{knowledge}}\n\n请输出 120-180 字商品短文案，突出 2-3 个核心卖点与使用场景。',
     ''),
    ('video_title',
     '你是短视频标题策划。标题必须真实、具体，不使用极限词与夸大承诺。',
     E'商品信息：{{product}}\n知识依据：\n{{knowledge}}\n\n请输出 5 条标题，每条不超过 20 字，逐行输出，不加序号。',
     '')
  ) AS v(key, system_prompt, user_template, output_schema) ON v.key = t.key
WHERE t.tenant_id = 1
ON CONFLICT (template_id, version) DO NOTHING;

UPDATE public.prompt_templates t
   SET active_version = 1
 WHERE t.tenant_id = 1 AND t.active_version = 0;

-- ── RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'prompt_templates', 'prompt_versions', 'prompt_eval_runs', 'ai_generation_drafts'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_tenant ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY p_%I_tenant ON public.%I USING ((tenant_id = rls_tenant_id()) OR (rls_role() = ''super_admin'')) WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = ''super_admin''))',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMIT;
