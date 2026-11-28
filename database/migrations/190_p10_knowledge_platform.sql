-- database/migrations/190_p10_knowledge_platform.sql
-- W9 知识平台：pgvector 语义检索 + 四个知识域（商品/脚本/违禁词/回放）+ ACL + 索引版本 + 引用回溯
-- 设计要点：
--   1. embedding 列不固定维度（不同模型维度不同），维度记录在 kb_collections.embedding_dim；
--   2. 违禁词以规则库为主（DFA/ACF），语义检索为辅；
--   3. 引用必须能回溯到本地 kb_chunks，跨租户一律拒绝。
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
-- 中文关键词兜底检索依赖 trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 知识集合 ──
CREATE TABLE IF NOT EXISTS public.kb_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  domain VARCHAR(24) NOT NULL DEFAULT 'document',
  description TEXT NOT NULL DEFAULT '',
  embedding_model VARCHAR(120) NOT NULL DEFAULT '',
  embedding_dim INT NOT NULL DEFAULT 0,
  -- 非敏感配置：{"embeddingProvider":"doubao","embeddingApiBase":"https://..."}；密钥走 integration_credentials
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  chunk_size INT NOT NULL DEFAULT 800,
  chunk_overlap INT NOT NULL DEFAULT 100,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  document_count INT NOT NULL DEFAULT 0,
  chunk_count INT NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_kb_collection_code UNIQUE (tenant_id, code),
  CONSTRAINT ck_kb_collection_domain CHECK (domain IN ('product', 'script', 'banned', 'replay', 'document')),
  CONSTRAINT ck_kb_collection_status CHECK (status IN ('active', 'archived')),
  CONSTRAINT ck_kb_collection_chunk CHECK (chunk_size BETWEEN 100 AND 4000 AND chunk_overlap >= 0 AND chunk_overlap < chunk_size)
);

CREATE INDEX IF NOT EXISTS idx_kb_collections_tenant
  ON public.kb_collections (tenant_id, domain, status);

-- ── 文档 ──
CREATE TABLE IF NOT EXISTS public.kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  collection_id UUID NOT NULL REFERENCES public.kb_collections(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  source_type VARCHAR(16) NOT NULL DEFAULT 'text',
  source_ref TEXT NOT NULL DEFAULT '',
  doc_version INT NOT NULL DEFAULT 1,
  content_hash VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  chunk_count INT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 结构化过滤字段（商品域用：spu_code/category/platform）
  business_key VARCHAR(120) NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_kb_document_status CHECK (status IN ('pending', 'indexing', 'ready', 'failed', 'archived')),
  CONSTRAINT ck_kb_document_source CHECK (source_type IN ('text', 'url', 'file', 'asr', 'structured'))
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_collection
  ON public.kb_documents (tenant_id, collection_id, status);
CREATE INDEX IF NOT EXISTS idx_kb_documents_business_key
  ON public.kb_documents (tenant_id, business_key);

-- ── 切片（含向量）──
CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  collection_id UUID NOT NULL REFERENCES public.kb_collections(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  seq INT NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  embedding vector NULL,
  embedding_model VARCHAR(120) NOT NULL DEFAULT '',
  -- 时间戳（直播回放域）与页码（PDF）
  start_ms INT NULL,
  end_ms INT NULL,
  page_no INT NULL,
  -- 结构化标签：{"spuCode":"...","category":"...","platform":"..."}
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  acl_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  index_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_collection
  ON public.kb_chunks (tenant_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document
  ON public.kb_chunks (document_id, seq);
-- 关键词兜底检索（中文用 trigram）
CREATE INDEX IF NOT EXISTS idx_kb_chunks_content_trgm
  ON public.kb_chunks USING gin (content gin_trgm_ops);
-- 向量精确近邻（万级切片下顺序扫描可接受；规模上来后按维度建 HNSW 分区索引）
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_null
  ON public.kb_chunks (tenant_id) WHERE embedding IS NOT NULL;

-- ── 索引版本（换 embedding 模型必须新建版本，禁止原地覆盖）──
CREATE TABLE IF NOT EXISTS public.kb_index_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  collection_id UUID NOT NULL REFERENCES public.kb_collections(id) ON DELETE CASCADE,
  version INT NOT NULL,
  embedding_model VARCHAR(120) NOT NULL DEFAULT '',
  embedding_dim INT NOT NULL DEFAULT 0,
  chunk_count INT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'building',
  built_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, version),
  CONSTRAINT ck_kb_index_status CHECK (status IN ('building', 'active', 'retired', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_kb_index_versions_collection
  ON public.kb_index_versions (tenant_id, collection_id, status);

-- ── ACL：集合级角色可见性 ──
CREATE TABLE IF NOT EXISTS public.kb_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  collection_id UUID NOT NULL REFERENCES public.kb_collections(id) ON DELETE CASCADE,
  role_code VARCHAR(32) NOT NULL,
  effect VARCHAR(8) NOT NULL DEFAULT 'allow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, role_code),
  CONSTRAINT ck_kb_acl_effect CHECK (effect IN ('allow', 'deny'))
);

-- ── 入库任务（状态机：queued → running → succeeded/failed）──
CREATE TABLE IF NOT EXISTS public.kb_ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INT NOT NULL DEFAULT 1,
  collection_id UUID NOT NULL REFERENCES public.kb_collections(id) ON DELETE CASCADE,
  document_id UUID NULL REFERENCES public.kb_documents(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  stage VARCHAR(24) NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  chunk_count INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_kb_ingest_status CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  CONSTRAINT ck_kb_ingest_stage CHECK (stage IN ('queued', 'parse', 'clean', 'chunk', 'embed', 'index', 'done', 'failed')),
  CONSTRAINT ck_kb_ingest_progress CHECK (progress BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_kb_ingest_jobs_tenant
  ON public.kb_ingest_jobs (tenant_id, status, created_at DESC);

-- ── 检索反馈 ──
CREATE TABLE IF NOT EXISTS public.kb_feedback (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1,
  run_id VARCHAR(64) NULL,
  chunk_id UUID NULL REFERENCES public.kb_chunks(id) ON DELETE SET NULL,
  document_id UUID NULL REFERENCES public.kb_documents(id) ON DELETE SET NULL,
  rating VARCHAR(8) NOT NULL DEFAULT 'up',
  comment TEXT NOT NULL DEFAULT '',
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_kb_feedback_rating CHECK (rating IN ('up', 'down'))
);

CREATE INDEX IF NOT EXISTS idx_kb_feedback_tenant
  ON public.kb_feedback (tenant_id, created_at DESC);

-- ── 违禁词规则库（DFA/ACF 主通道）──
CREATE TABLE IF NOT EXISTS public.kb_banned_words (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL DEFAULT 1,
  word VARCHAR(64) NOT NULL,
  normalized VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'absolute',
  severity VARCHAR(8) NOT NULL DEFAULT 'high',
  action VARCHAR(16) NOT NULL DEFAULT 'block',
  platform VARCHAR(32) NOT NULL DEFAULT 'all',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  word_version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_kb_banned_word UNIQUE (tenant_id, normalized, platform),
  CONSTRAINT ck_kb_banned_category CHECK (category IN ('absolute', 'medical', 'financial', 'platform', 'politics', 'other')),
  CONSTRAINT ck_kb_banned_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT ck_kb_banned_action CHECK (action IN ('block', 'warn', 'rewrite'))
);

CREATE INDEX IF NOT EXISTS idx_kb_banned_words_tenant
  ON public.kb_banned_words (tenant_id, enabled, platform);

-- ── 引用回溯：把 ai_v2_citation 挂回本地切片实体 ──
ALTER TABLE public.ai_v2_citation
  ADD COLUMN IF NOT EXISTS local_chunk_id UUID NULL,
  ADD COLUMN IF NOT EXISTS collection_id UUID NULL,
  ADD COLUMN IF NOT EXISTS doc_version INT NULL,
  ADD COLUMN IF NOT EXISTS page_no INT NULL,
  ADD COLUMN IF NOT EXISTS start_ms INT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_v2_citation_chunk
  ON public.ai_v2_citation (local_chunk_id);

-- ── 默认知识域（空集合，等待入库）──
INSERT INTO public.kb_collections (tenant_id, code, name, domain, description, embedding_model)
VALUES
  (1, 'products', '商品资料', 'product', '标题、卖点、参数、规格、资质与价格带', ''),
  (1, 'scripts', '爆款脚本', 'script', '按品类与平台沉淀的开场/痛点/卖点/逼单/收尾结构', ''),
  (1, 'banned_words', '违禁词库', 'banned', '极限词、医疗功效、平台禁用词规则库', ''),
  (1, 'replays', '直播回放', 'replay', 'ASR 转写、时间戳、说话人与商品提及', '')
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ── RLS ──
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kb_collections', 'kb_documents', 'kb_chunks', 'kb_index_versions',
    'kb_acl', 'kb_ingest_jobs', 'kb_feedback', 'kb_banned_words'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS p_%I_tenant ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY p_%I_tenant ON public.%I USING ((tenant_id = rls_tenant_id()) OR (rls_role() = ''super_admin'')) WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = ''super_admin''))',
      t, t
    );
  END LOOP;
END $$;

COMMIT;