-- 213_decision_loop_hardening.sql
-- 1) 移除决策案默认租户，禁止新写入静默落入租户 1
-- 2) 状态机迁移到九态 + 异常态
-- 3) 数据 Gate 默认改为 NOT_EVALUABLE，历史 PASS 重新评估
-- 4) 为决策闭环新表补齐 RLS 策略

BEGIN;

ALTER TABLE public.decision_cases ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.decision_cases ALTER COLUMN status SET DEFAULT 'DRAFT';
ALTER TABLE public.decision_cases ALTER COLUMN data_gate_status SET DEFAULT 'NOT_EVALUABLE';

UPDATE public.decision_cases
   SET data_gate_status = 'NOT_EVALUABLE'
 WHERE data_gate_status = 'PASS';

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.decision_cases'::regclass
       AND contype = 'c'
       AND (pg_get_constraintdef(oid) LIKE '%draft%' OR conname = 'decision_cases_status_check')
  LOOP
    EXECUTE format('ALTER TABLE public.decision_cases DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

UPDATE public.decision_cases
   SET status = CASE lower(status)
     WHEN 'draft' THEN 'DRAFT'
     WHEN 'pending' THEN 'AWAITING_APPROVAL'
     WHEN 'approved' THEN 'APPROVED'
     WHEN 'rejected' THEN 'REJECTED'
     WHEN 'applied' THEN 'EXECUTING'
     WHEN 'measured' THEN 'AWAITING_REVIEW'
     WHEN 'closed' THEN 'ARCHIVED'
     ELSE upper(status)
   END
 WHERE status <> upper(status);

ALTER TABLE public.decision_cases
  ADD CONSTRAINT decision_cases_status_check CHECK (status IN (
    'DRAFT', 'INVESTIGATING', 'PROPOSED', 'AWAITING_APPROVAL', 'APPROVED',
    'EXECUTING', 'AWAITING_REVIEW', 'REVIEWED', 'ARCHIVED',
    'DATA_INSUFFICIENT', 'BLOCKED', 'REJECTED', 'CANCELLED'
  ));

-- RLS 策略：新表只允许当前租户访问
DROP POLICY IF EXISTS decision_memo_versions_tenant_isolation ON public.decision_memo_versions;
CREATE POLICY decision_memo_versions_tenant_isolation ON public.decision_memo_versions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

DROP POLICY IF EXISTS decision_evidence_items_tenant_isolation ON public.decision_evidence_items;
CREATE POLICY decision_evidence_items_tenant_isolation ON public.decision_evidence_items
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

DROP POLICY IF EXISTS decision_case_events_tenant_isolation ON public.decision_case_events;
CREATE POLICY decision_case_events_tenant_isolation ON public.decision_case_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::int);

COMMIT;
