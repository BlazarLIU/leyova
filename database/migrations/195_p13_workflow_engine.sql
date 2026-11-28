-- database/migrations/195_p13_workflow_engine.sql
-- Workflow Engine：DAG 定义、运行、节点运行、产物
-- 设计要点：
--   1. 定义不可变：修改 DSL 必须新增版本，运行中的 Run 固定引用某一版本；
--   2. 节点级状态机，支持重试、断点续跑、人工中断；
--   3. 人工审核节点是一等公民，不可被自动跳过；
--   4. 产物单独存表，便于追溯与复用。
BEGIN;

-- ── 工作流定义 ──
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  key VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  -- DSL：{nodes:[{id,type,with,dependsOn,retry,timeoutMs}], edges:[{from,to}]}
  dsl JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workflow_definition_version UNIQUE (tenant_id, key, version),
  CONSTRAINT ck_workflow_definition_status CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant
  ON public.workflow_definitions (tenant_id, key, version DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active
  ON public.workflow_definitions (tenant_id, key) WHERE is_active = TRUE;

-- ── 工作流运行 ──
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  definition_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE RESTRICT,
  definition_key VARCHAR(64) NOT NULL,
  definition_version INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  trigger_type VARCHAR(16) NOT NULL DEFAULT 'manual',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 断点续跑：记录已完成节点与当前游标
  cursor VARCHAR(64) NOT NULL DEFAULT '',
  completed_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_nodes INT NOT NULL DEFAULT 0,
  succeeded_nodes INT NOT NULL DEFAULT 0,
  failed_nodes INT NOT NULL DEFAULT 0,
  -- 人工中断：waiting_review 时记录待审节点
  waiting_node VARCHAR(64) NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  cost_cny NUMERIC(12, 6) NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(128) NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_workflow_run_status CHECK (status IN ('queued', 'running', 'waiting_review', 'succeeded', 'failed', 'cancelled')),
  CONSTRAINT ck_workflow_run_trigger CHECK (trigger_type IN ('manual', 'schedule', 'event', 'api'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant
  ON public.workflow_runs (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_definition
  ON public.workflow_runs (tenant_id, definition_key, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_runs_idempotency
  ON public.workflow_runs (tenant_id, idempotency_key)
  WHERE idempotency_key <> '';

-- ── 节点运行 ──
CREATE TABLE IF NOT EXISTS public.workflow_node_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id VARCHAR(64) NOT NULL,
  node_type VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempt INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 2,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT NOT NULL DEFAULT '',
  duration_ms INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, node_id),
  CONSTRAINT ck_workflow_node_status CHECK (status IN ('pending', 'running', 'waiting_review', 'succeeded', 'failed', 'skipped', 'cancelled')),
  CONSTRAINT ck_workflow_node_type CHECK (node_type IN (
    'ingest', 'retrieve', 'generate', 'compliance_check', 'human_review',
    'render', 'publish', 'measure', 'transform', 'notify'
  ))
);

CREATE INDEX IF NOT EXISTS idx_workflow_node_runs_run
  ON public.workflow_node_runs (run_id, created_at);

-- ── 节点产物 ──
CREATE TABLE IF NOT EXISTS public.workflow_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id VARCHAR(64) NOT NULL,
  artifact_type VARCHAR(32) NOT NULL DEFAULT 'json',
  name VARCHAR(255) NOT NULL DEFAULT '',
  -- 内联内容（小产物）或外部引用（大文件）
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_path TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_workflow_artifact_type CHECK (artifact_type IN ('json', 'text', 'video', 'image', 'audio', 'file'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_run
  ON public.workflow_artifacts (run_id, node_id);

-- ── 默认工作流：商品到切片 ──
INSERT INTO public.workflow_definitions
  (tenant_id, key, name, description, version, dsl, status, is_active)
VALUES (
  1,
  'product_to_clip',
  '商品到切片',
  '商品资料入库 → 知识召回 → 脚本生成 → 合规检查 → 人工审核 → 渲染切片',
  1,
  '{
    "nodes": [
      {"id": "ingest", "type": "ingest", "with": {"collectionCode": "products", "title": "{{input.productName}}", "content": "{{input.productInfo}}", "businessKey": "{{input.businessKey}}"}},
      {"id": "retrieve", "type": "retrieve", "dependsOn": ["ingest"], "with": {"query": "{{input.productName}}", "collections": ["products", "scripts"], "topK": 6}},
      {"id": "script", "type": "generate", "dependsOn": ["retrieve"], "with": {"templateKey": "live_script", "variables": {"product": "{{input.productName}}", "audience": "{{input.audience}}"}}},
      {"id": "compliance", "type": "compliance_check", "dependsOn": ["script"], "with": {"text": "{{nodes.script.content}}"}},
      {"id": "review", "type": "human_review", "dependsOn": ["compliance"], "with": {"assigneeRole": "content_editor", "title": "脚本审核"}},
      {"id": "publish", "type": "publish", "dependsOn": ["review"], "with": {"platformCode": "douyin", "title": "{{input.productName}}", "sandbox": true}}
    ]
  }'::jsonb,
  'published',
  TRUE
)
ON CONFLICT (tenant_id, key, version) DO NOTHING;

-- ── RLS ──
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'workflow_definitions', 'workflow_runs', 'workflow_node_runs', 'workflow_artifacts'
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