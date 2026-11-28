-- database/migrations/186_p9_run_citations.sql
-- W6 知识接线：Run 级引用落库（知识库片段 → 回答来源）
-- 约束：引用必须带租户，跨租户检索默认拒绝；片段仅作数据展示，不作为指令使用。
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_v2_citation (
  id BIGSERIAL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES public.ai_v2_run(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  chunk_id VARCHAR(128) NOT NULL DEFAULT '',
  document_id VARCHAR(128) NOT NULL DEFAULT '',
  document_name VARCHAR(255) NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  score NUMERIC(6, 4) NOT NULL DEFAULT 0,
  tenant_id INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_ai_v2_citation_run
  ON public.ai_v2_citation (run_id, seq);

ALTER TABLE public.ai_v2_citation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_ai_v2_citation_tenant ON public.ai_v2_citation;
CREATE POLICY p_ai_v2_citation_tenant ON public.ai_v2_citation
  USING ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'))
  WITH CHECK ((tenant_id = rls_tenant_id()) OR (rls_role() = 'super_admin'));

COMMIT;
