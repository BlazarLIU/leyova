-- 215_anchor_profiles_and_compliance.sql
-- 1) 主播轻量能力画像表 (适用品类、风格标签)
-- 2) 合规新规学习与整改轻量任务表
-- 3) 敏感违规词受控替换字典表
-- 4) 补齐 RLS 租户隔离策略

BEGIN;

-- 1. 主播轻量能力画像表
CREATE TABLE IF NOT EXISTS public.anchor_competency_profiles (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  anchor_name         text NOT NULL,
  suitable_categories text[] NOT NULL DEFAULT '{}',
  style_tags          text[] NOT NULL DEFAULT '{}',
  hourly_rate         numeric(12, 2) DEFAULT 0,
  status              text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_anchor_name_per_tenant UNIQUE (tenant_id, anchor_name)
);

CREATE INDEX IF NOT EXISTS idx_anchor_profiles_tenant
  ON public.anchor_competency_profiles (tenant_id);

ALTER TABLE public.anchor_competency_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anchor_competency_profiles_tenant_isolation ON public.anchor_competency_profiles;
CREATE POLICY anchor_competency_profiles_tenant_isolation ON public.anchor_competency_profiles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 2. 合规新规学习与整改任务表
CREATE TABLE IF NOT EXISTS public.compliance_learning_tasks (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title               text NOT NULL,
  rule_reference      text,
  assignee_id         integer REFERENCES public.users(id) ON DELETE SET NULL,
  assignee_name       text,
  due_date            date,
  status              text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  completion_notes    text,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_tasks_tenant
  ON public.compliance_learning_tasks (tenant_id, status);

ALTER TABLE public.compliance_learning_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_learning_tasks_tenant_isolation ON public.compliance_learning_tasks;
CREATE POLICY compliance_learning_tasks_tenant_isolation ON public.compliance_learning_tasks
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 3. 敏感违规词受控替换字典表
CREATE TABLE IF NOT EXISTS public.compliance_sensitive_replacements (
  id                  bigserial PRIMARY KEY,
  tenant_id           integer REFERENCES public.tenants(id) ON DELETE CASCADE,
  sensitive_word      text NOT NULL,
  category            text NOT NULL DEFAULT 'EXTREME_WORDS',
  risk_level          text NOT NULL CHECK (risk_level IN ('BLOCK', 'WARN')),
  suggested_replacement text NOT NULL,
  explanation         text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensitive_replacements_lookup
  ON public.compliance_sensitive_replacements (tenant_id, sensitive_word);

ALTER TABLE public.compliance_sensitive_replacements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS compliance_sensitive_replacements_tenant_isolation ON public.compliance_sensitive_replacements;
CREATE POLICY compliance_sensitive_replacements_tenant_isolation ON public.compliance_sensitive_replacements
  USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

-- 插入一些通用基础合规受控替换词种子（tenant_id 为 NULL 表示全租户通用）
INSERT INTO public.compliance_sensitive_replacements (tenant_id, sensitive_word, category, risk_level, suggested_replacement, explanation)
VALUES
  (NULL, '全网第一', 'EXTREME_WORDS', 'BLOCK', '热销爆款 / 明星推荐', '违反广告法绝对化用语，禁止使用“第一”'),
  (NULL, '最便宜', 'EXTREME_WORDS', 'BLOCK', '超值福利价 / 限时优惠', '违反广告法绝对化用语，禁止使用“最”'),
  (NULL, '全网最低价', 'PRICE_MISLEADING', 'BLOCK', '直播间专属机制 / 惊喜宠粉价', '价格绝对化承诺易引发价格虚假争议'),
  (NULL, '保证有效', 'EFFECT_PROMISE', 'BLOCK', '坚持使用体验更佳 / 口碑好评见证', '功效绝对化保证存在监管处罚风险'),
  (NULL, '根治', 'MEDICAL_CLAIMS', 'BLOCK', '深层修护 / 改善缓解', '非药品普通产品禁止宣传疾病根治或医疗功效'),
  (NULL, '顶级', 'EXTREME_WORDS', 'WARN', '甄选品质 / 高端系列', '绝对化用语建议替换为温和品质表达');

COMMIT;
